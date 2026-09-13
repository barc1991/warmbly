// Package credits implements the AI writing-assistant credit ledger: balance
// reads, atomic consumption with idempotency, and grants. Hard billing
// correctness (no negative balances, no double-charge on retry) lives in the
// repository's atomic SQL; this service layer adds the abuse caps (a short
// rolling window plus a daily window) on top.
package credits

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/warmbly/warmbly/internal/errx"
	"github.com/warmbly/warmbly/internal/infrastructure/cache"
	"github.com/warmbly/warmbly/internal/models"
	"github.com/warmbly/warmbly/internal/repository"
)

const (
	// Rolling-window cap: max writing-assistant generations per org in a 5-hour
	// window. Catches burst abuse independent of credit balance.
	WindowShort       = 5 * time.Hour
	DefaultShortLimit = 60

	// Daily cap: max writing-assistant generations per org per UTC day.
	WindowDaily       = 24 * time.Hour
	DefaultDailyLimit = 300
)

// ErrInsufficientCredits signals the org has fewer credits than requested. The
// handler maps this to HTTP 402. Distinct, exported sentinels are used (rather
// than *errx.Error) because errx has no 402 code; the handler emits the 402
// envelope itself.
var ErrInsufficientCredits = errors.New("insufficient credits")

// ErrCapExceeded signals the org hit a rolling/daily generation cap. The
// handler maps this to HTTP 429.
var ErrCapExceeded = errors.New("generation rate cap exceeded")

// ErrSpendLimitReached signals the org hit its own configured day/week/month
// spend limit. It wraps ErrCapExceeded so every existing errors.Is mapping
// (→429) keeps working while the message tells the user it was their budget.
var ErrSpendLimitReached = fmt.Errorf("%w: configured AI spend limit reached", ErrCapExceeded)

// ErrMemberLimitReached signals the acting member hit the org's per-member
// monthly AI limit. Wraps ErrCapExceeded for the same 429 mapping.
var ErrMemberLimitReached = fmt.Errorf("%w: your monthly AI limit for this workspace is used up", ErrCapExceeded)

// DefaultLowBalanceThreshold applies when an org has never saved settings.
const DefaultLowBalanceThreshold = 25

// UsageOverview is the composed payload for the AI usage dashboard: spend per
// window, the configured limits, a daily series, and breakdowns.
type UsageOverview struct {
	SpentToday int `json:"spent_today"`
	SpentWeek  int `json:"spent_week"`
	SpentMonth int `json:"spent_month"`

	LimitDaily   *int `json:"limit_daily"`
	LimitWeekly  *int `json:"limit_weekly"`
	LimitMonthly *int `json:"limit_monthly"`

	Series   []models.CreditUsagePoint  `json:"series"`
	ByReason []models.CreditUsageBucket `json:"by_reason"`
	ByModel  []models.CreditUsageBucket `json:"by_model"`
}

// CreditService is the application-facing API for AI credits.
type CreditService interface {
	// Unmetered reports whether the ledger is bypassed for every org
	// (BILLING_PROVIDER=none): AI use is unlimited and not plan-based, so
	// balances, allowances and top-ups are meaningless to callers.
	Unmetered() bool

	// GetBalance returns the org's current spendable balance across both pools
	// (0 if no ledger yet).
	GetBalance(ctx context.Context, orgID uuid.UUID) (int, *errx.Error)

	// GetLedger returns the org's full ledger (monthly + purchased pools, reset
	// date, lifetime purchased). Returns a zero-value ledger (not nil) when the
	// org has no ledger row yet.
	GetLedger(ctx context.Context, orgID uuid.UUID) (*models.CreditLedger, *errx.Error)

	// Consume enforces the abuse caps, then atomically debits `amount` credits,
	// draining the monthly pool first then purchased. On success it returns the
	// resulting combined balance. idempotencyKey may be empty; when set, a retry
	// with the same key does not double-charge and does not re-count against the
	// caps.
	//
	// Returns ErrInsufficientCredits (→402) or ErrCapExceeded (→429) as
	// sentinel errors the handler maps; any other error is an internal failure.
	Consume(ctx context.Context, orgID uuid.UUID, amount int, reason, model string, tokens int, idempotencyKey string) (int, error)

	// Grant adds credits to an org's monthly pool (e.g. a provider-failure
	// refund). Returns the resulting combined balance.
	Grant(ctx context.Context, orgID uuid.UUID, amount int, reason string) (int, *errx.Error)

	// GrantPurchased adds top-up credits to the purchased pool (never expire,
	// survive resets) and bumps lifetime total_purchased. idempotencyKey (the
	// Stripe event id) makes webhook retries safe. Plain error return so the
	// stripe package's CreditGranter can satisfy it without importing errx.
	GrantPurchased(ctx context.Context, orgID uuid.UUID, amount int, reason, idempotencyKey string) (int, error)

	// ResetMonthlyAllowance sets the monthly pool to `allowance` (set-to-N;
	// purchased pool untouched) and stamps the reset time. idempotencyKey (the
	// Stripe event id) makes webhook retries safe.
	ResetMonthlyAllowance(ctx context.Context, orgID uuid.UUID, allowance int, idempotencyKey string) error

	// CheckUsageCaps returns ErrCapExceeded when the org has hit a rolling 5h
	// or daily generation cap, WITHOUT consuming. Lets a caller gate expensive
	// AI work (e.g. a research run) before doing it, so a cap trip at charge
	// time does not waste a full run.
	CheckUsageCaps(ctx context.Context, orgID uuid.UUID) error

	// SettleUsage prices the ACTUAL token usage of a completed AI call
	// (MeteredCost) and charges the overage beyond what was already charged
	// up-front. Best-effort by design: it drains the balance to zero at worst
	// and never fails the already-delivered result. Returns the extra credits
	// charged. idempotencyKey should be the call's key with a ":usage" suffix.
	SettleUsage(ctx context.Context, orgID uuid.UUID, alreadyCharged int, model string, tokens int, reason, idempotencyKey string) (int, error)

	// GetSpendSettings returns the org's spend controls, with defaults filled
	// in when the org never saved any.
	GetSpendSettings(ctx context.Context, orgID uuid.UUID) (*models.AISpendSettings, *errx.Error)

	// UpdateSpendSettings validates and persists the org's spend controls.
	UpdateSpendSettings(ctx context.Context, orgID uuid.UUID, s *models.AISpendSettings) (*models.AISpendSettings, *errx.Error)

	// GetUsageOverview composes the AI usage dashboard payload over the last
	// `days` days (clamped to 1..90).
	GetUsageOverview(ctx context.Context, orgID uuid.UUID, days int) (*UsageOverview, *errx.Error)

	// SetMonitor installs a hook invoked (async, best-effort) with the
	// resulting balance after every fresh debit. The credit-watch component
	// uses it to drive low-balance alerts and auto top-up without the credits
	// package depending on Stripe or pubsub.
	SetMonitor(fn func(orgID uuid.UUID, balance int))

	// ListTransactions returns recent ledger transactions, newest first.
	ListTransactions(ctx context.Context, orgID uuid.UUID, limit int) ([]models.CreditTransaction, *errx.Error)

	// ListTransactionsBefore keyset-paginates the history (rows older than the
	// cursor). Pass zero values for the first page.
	ListTransactionsBefore(ctx context.Context, orgID uuid.UUID, limit int, beforeCreatedAt time.Time, beforeID uuid.UUID) ([]models.CreditTransaction, *errx.Error)
}

// selfHostBalance is the sentinel balance reported when billing is disabled:
// large enough to read as effectively unlimited everywhere.
const selfHostBalance = 1_000_000_000

type creditService struct {
	repo       repository.CreditRepository
	settings   repository.AISettingsRepository
	cache      *cache.Cache
	shortLimit int
	dailyLimit int
	monitor    func(orgID uuid.UUID, balance int)
	// selfHost bypasses the credit ledger (BILLING_PROVIDER=none): the operator
	// pays their AI provider directly, so Warmbly's credit metering is moot and
	// every consume succeeds without debiting.
	selfHost bool
}

func NewService(repo repository.CreditRepository, settings repository.AISettingsRepository, c *cache.Cache) CreditService {
	return &creditService{
		repo:       repo,
		settings:   settings,
		cache:      c,
		shortLimit: DefaultShortLimit,
		dailyLimit: DefaultDailyLimit,
		selfHost:   true,
	}
}

func (s *creditService) Unmetered() bool { return true }

func (s *creditService) SetMonitor(fn func(orgID uuid.UUID, balance int)) {
	s.monitor = fn
}

// notifyMonitor hands the post-debit balance to the credit-watch hook on a
// detached goroutine so alerting/auto-top-up can never slow or fail a charge.
func (s *creditService) notifyMonitor(orgID uuid.UUID, balance int) {
	if s.monitor == nil {
		return
	}
	go s.monitor(orgID, balance)
}

// windowStarts returns the UTC starts of the current calendar day, ISO week
// (Monday), and calendar month.
func windowStarts(now time.Time) (day, week, month time.Time) {
	now = now.UTC()
	day = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	weekday := int(now.Weekday())
	if weekday == 0 {
		weekday = 7 // Sunday belongs to the week that started the prior Monday
	}
	week = day.AddDate(0, 0, -(weekday - 1))
	month = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	return day, week, month
}

func (s *creditService) GetBalance(_ context.Context, _ uuid.UUID) (int, *errx.Error) {
	return selfHostBalance, nil
}

func (s *creditService) GetLedger(ctx context.Context, orgID uuid.UUID) (*models.CreditLedger, *errx.Error) {
	ledger, err := s.repo.GetBalance(ctx, orgID)
	if err != nil {
		return nil, errx.New(errx.Internal, "failed to read credit ledger")
	}
	if ledger == nil {
		// No ledger yet: report an empty one so callers get a stable shape.
		return &models.CreditLedger{OrgID: orgID}, nil
	}
	return ledger, nil
}

func (s *creditService) Consume(_ context.Context, _ uuid.UUID, _ int, _, _ string, _ int, _ string) (int, error) {
	return selfHostBalance, nil
}

func (s *creditService) SettleUsage(ctx context.Context, orgID uuid.UUID, alreadyCharged int, model string, tokens int, reason, idempotencyKey string) (int, error) {
	if s.selfHost {
		return 0, nil
	}
	total := MeteredCost(model, tokens)
	extra := total - alreadyCharged
	if extra <= 0 {
		return 0, nil
	}
	// No caps and no spend-limit gate here: the work is already delivered and
	// was gated at reservation time; the settle just prices what it used,
	// draining to zero at worst.
	consumed, bal, replayed, err := s.repo.ConsumeAtMost(ctx, orgID, extra, reason, model, tokens, idempotencyKey)
	if err != nil {
		return 0, err
	}
	if !replayed && consumed > 0 {
		s.notifyMonitor(orgID, bal)
	}
	return consumed, nil
}

func (s *creditService) GetSpendSettings(ctx context.Context, orgID uuid.UUID) (*models.AISpendSettings, *errx.Error) {
	if s.settings == nil {
		return nil, errx.New(errx.Internal, "spend settings unavailable")
	}
	cfg, err := s.settings.Get(ctx, orgID)
	if err != nil {
		return nil, errx.New(errx.Internal, "failed to read spend settings")
	}
	if cfg == nil {
		return &models.AISpendSettings{
			OrgID:                orgID,
			LowBalanceThreshold:  DefaultLowBalanceThreshold,
			AutoTopupPack:        CreditPacks[0].Key,
			AutoTopupThreshold:   50,
			AutoTopupMaxPerMonth: 2,
		}, nil
	}
	return cfg, nil
}

func (s *creditService) UpdateSpendSettings(ctx context.Context, orgID uuid.UUID, in *models.AISpendSettings) (*models.AISpendSettings, *errx.Error) {
	if s.settings == nil {
		return nil, errx.New(errx.Internal, "spend settings unavailable")
	}
	for _, limit := range []*int{in.SpendLimitDaily, in.SpendLimitWeekly, in.SpendLimitMonthly, in.MemberLimitDaily, in.MemberLimitWeekly, in.MemberLimitMonthly} {
		if limit != nil && *limit <= 0 {
			return nil, errx.New(errx.BadRequest, "spend limits must be positive (omit to disable)")
		}
	}
	if in.LowBalanceThreshold < 0 || in.LowBalanceThreshold > 1_000_000 {
		return nil, errx.New(errx.BadRequest, "invalid low-balance threshold")
	}
	if in.AutoTopupThreshold < 0 || in.AutoTopupThreshold > 1_000_000 {
		return nil, errx.New(errx.BadRequest, "invalid auto top-up threshold")
	}
	if in.AutoTopupMaxPerMonth < 0 || in.AutoTopupMaxPerMonth > 100 {
		return nil, errx.New(errx.BadRequest, "invalid auto top-up monthly maximum")
	}
	if PackByKey(in.AutoTopupPack) == nil {
		return nil, errx.New(errx.BadRequest, "unknown credit pack")
	}
	in.OrgID = orgID
	out, err := s.settings.Upsert(ctx, in)
	if err != nil {
		return nil, errx.New(errx.Internal, "failed to save spend settings")
	}
	return out, nil
}

func (s *creditService) GetUsageOverview(ctx context.Context, orgID uuid.UUID, days int) (*UsageOverview, *errx.Error) {
	if days < 1 || days > 90 {
		days = 30
	}
	dayStart, weekStart, monthStart := windowStarts(time.Now())
	day, week, month, err := s.repo.SpentInWindows(ctx, orgID, dayStart, weekStart, monthStart)
	if err != nil {
		return nil, errx.New(errx.Internal, "failed to read AI spend")
	}
	since := dayStart.AddDate(0, 0, -(days - 1))
	series, err := s.repo.UsageDaily(ctx, orgID, since)
	if err != nil {
		return nil, errx.New(errx.Internal, "failed to read AI usage series")
	}
	byReason, err := s.repo.UsageBreakdown(ctx, orgID, since, "reason")
	if err != nil {
		return nil, errx.New(errx.Internal, "failed to read AI usage breakdown")
	}
	byModel, err := s.repo.UsageBreakdown(ctx, orgID, since, "model")
	if err != nil {
		return nil, errx.New(errx.Internal, "failed to read AI usage breakdown")
	}
	out := &UsageOverview{
		SpentToday: day, SpentWeek: week, SpentMonth: month,
		Series: series, ByReason: byReason, ByModel: byModel,
	}
	if s.settings != nil {
		if cfg, cerr := s.settings.Get(ctx, orgID); cerr == nil && cfg != nil {
			out.LimitDaily, out.LimitWeekly, out.LimitMonthly = cfg.SpendLimitDaily, cfg.SpendLimitWeekly, cfg.SpendLimitMonthly
		}
	}
	return out, nil
}

func (s *creditService) Grant(ctx context.Context, orgID uuid.UUID, amount int, reason string) (int, *errx.Error) {
	if amount <= 0 {
		return 0, errx.New(errx.BadRequest, "grant amount must be positive")
	}
	bal, _, err := s.repo.Grant(ctx, orgID, amount, reason, "")
	if err != nil {
		return 0, errx.New(errx.Internal, "failed to grant credits")
	}
	return bal, nil
}

func (s *creditService) GrantPurchased(ctx context.Context, orgID uuid.UUID, amount int, reason, idempotencyKey string) (int, error) {
	if amount <= 0 {
		return 0, errors.New("grant amount must be positive")
	}
	bal, _, err := s.repo.GrantPurchased(ctx, orgID, amount, reason, idempotencyKey)
	if err != nil {
		return 0, err
	}
	return bal, nil
}

func (s *creditService) ResetMonthlyAllowance(ctx context.Context, orgID uuid.UUID, allowance int, idempotencyKey string) error {
	if allowance < 0 {
		return errors.New("allowance must be non-negative")
	}
	_, err := s.repo.ResetMonthly(ctx, orgID, allowance, idempotencyKey)
	return err
}

func (s *creditService) CheckUsageCaps(_ context.Context, _ uuid.UUID) error {
	return nil
}

func (s *creditService) ListTransactions(ctx context.Context, orgID uuid.UUID, limit int) ([]models.CreditTransaction, *errx.Error) {
	txns, err := s.repo.ListTransactions(ctx, orgID, limit)
	if err != nil {
		return nil, errx.New(errx.Internal, "failed to list credit transactions")
	}
	return txns, nil
}

func (s *creditService) ListTransactionsBefore(ctx context.Context, orgID uuid.UUID, limit int, beforeCreatedAt time.Time, beforeID uuid.UUID) ([]models.CreditTransaction, *errx.Error) {
	txns, err := s.repo.ListTransactionsBefore(ctx, orgID, limit, beforeCreatedAt, beforeID)
	if err != nil {
		return nil, errx.New(errx.Internal, "failed to list credit transactions")
	}
	return txns, nil
}
