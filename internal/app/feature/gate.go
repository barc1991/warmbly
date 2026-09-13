package feature

import (
	"context"

	"github.com/google/uuid"
	"github.com/warmbly/warmbly/internal/errx"
	"github.com/warmbly/warmbly/internal/models"
	"github.com/warmbly/warmbly/internal/repository"
)

const (
	// FreeTierDailyEmailLimit is the daily campaign email limit for free trial users
	FreeTierDailyEmailLimit = 20

	// UnlimitedEmails indicates unlimited daily emails
	UnlimitedEmails = -1

	// Attachment storage quotas (overall bytes per organization). Generous by
	// design; paid orgs get a much larger pool. Tunable per-plan later via a
	// plans column without changing callers.
	FreeTierStorageBytes int64 = 2 << 30  // 2 GiB for free / trial orgs
	PaidStorageBytes     int64 = 50 << 30 // 50 GiB for paid orgs
)

type FeatureGateService interface {
	// CanSendCampaignEmail checks if an organization can send campaign emails
	CanSendCampaignEmail(ctx context.Context, orgID uuid.UUID) (bool, *errx.Error)

	// CanUseWarmup checks if an organization can use the warmup feature.
	// Free-trial orgs may use warmup during their 14-day window.
	CanUseWarmup(ctx context.Context, orgID uuid.UUID) (bool, *errx.Error)

	// CanUseUnibox checks if an organization can use the unibox feature.
	// Free-trial orgs may use unibox during their 14-day window.
	CanUseUnibox(ctx context.Context, orgID uuid.UUID) (bool, *errx.Error)

	// CanAddInbox returns whether the org may connect another email account.
	// Free workspaces are capped at FreeWorkspaceMailboxLimit connected mailboxes.
	// Paid orgs are not gated here (plan limits govern sending volume).
	CanAddInbox(ctx context.Context, orgID uuid.UUID, currentCount int) (bool, *errx.Error)

	// GetDailyEmailLimit returns the daily email limit for an organization
	// Returns -1 for unlimited, 0 for blocked
	GetDailyEmailLimit(ctx context.Context, orgID uuid.UUID) (int, *errx.Error)

	// GetSubscriptionStatus returns subscription info for feature checks
	GetSubscriptionStatus(ctx context.Context, orgID uuid.UUID) (*SubscriptionStatus, *errx.Error)

	// IsPaidOrganization checks if the organization has an active paid subscription
	IsPaidOrganization(ctx context.Context, orgID uuid.UUID) (bool, *errx.Error)

	// GetStorageLimitBytes returns the org's total attachment storage quota in
	// bytes (generous; larger for paid orgs).
	GetStorageLimitBytes(ctx context.Context, orgID uuid.UUID) (int64, *errx.Error)

	// CanUseWritingAssistant reports whether the org may use the AI writing
	// assistant (paid or in free trial; expired/no-subscription is blocked).
	CanUseWritingAssistant(ctx context.Context, orgID uuid.UUID) (bool, *errx.Error)

	// CanUseInboxAgent reports whether the org may use the inbox agent (paid
	// only — it drafts unattended, so it is not offered on the free trial). The
	// org must ALSO have opted in (organizations.inbox_agent_enabled), which is
	// checked separately by the caller.
	CanUseInboxAgent(ctx context.Context, orgID uuid.UUID) (bool, *errx.Error)
}

// SubscriptionStatus contains status info for feature gating
type SubscriptionStatus struct {
	HasSubscription    bool         `json:"has_subscription"`
	IsInFreeTrial      bool         `json:"is_in_free_trial"`
	IsFreeTrialExpired bool         `json:"is_free_trial_expired"`
	IsPaidSubscriber   bool         `json:"is_paid_subscriber"`
	DailyEmailLimit    int          `json:"daily_email_limit"`
	Plan               *models.Plan `json:"plan,omitempty"`
}

type featureGateService struct {
	subRepo  repository.SubscriptionRepository
	planRepo repository.PlanRepository
	// selfHost unlocks every gate. Set when BILLING_PROVIDER=none (the self-host
	// default): there is no payment provider, so every feature is available and
	// sending is unlimited. Stripe deployments (BILLING_PROVIDER=stripe) keep the
	// subscription-based gating below.
	selfHost bool
	// poolLink entitles a linked workspace to warm without a paid plan; nil when not wired.
	poolLink PoolLinkReader
	// overrides is the per-org limit override row, so an approved daily-send
	// increase raises what the sender enforces and not only what the
	// dashboard shows. Nil when not wired.
	overrides LimitOverrideReader
}

// PoolLinkReader answers whether a workspace has a live self-hosted link.
type PoolLinkReader interface {
	HasActiveLink(ctx context.Context, orgID uuid.UUID) bool
}

// LimitOverrideReader reads the operator override row for an organization.
// Satisfied by the organization repository.
type LimitOverrideReader interface {
	GetOrganizationLimitOverrides(ctx context.Context, orgID uuid.UUID) (*models.OrganizationLimitOverrides, error)
}

func NewService(subRepo repository.SubscriptionRepository, planRepo repository.PlanRepository) FeatureGateService {
	return &featureGateService{
		subRepo:  subRepo,
		planRepo: planRepo,
		selfHost: true,
	}
}

// WirePoolLink attaches the pool-link entitlement after construction.
func (s *featureGateService) WirePoolLink(r PoolLinkReader) { s.poolLink = r }

// WireLimitOverrides attaches the override reader after construction.
func (s *featureGateService) WireLimitOverrides(r LimitOverrideReader) { s.overrides = r }

// CanSendCampaignEmail checks if an organization can send campaign emails
func (s *featureGateService) CanSendCampaignEmail(ctx context.Context, orgID uuid.UUID) (bool, *errx.Error) {
	if s.selfHost {
		return true, nil
	}
	sub, err := s.subRepo.GetByOrganizationID(ctx, orgID)
	if err != nil {
		return false, errx.New(errx.Internal, "failed to get subscription")
	}

	// No subscription = blocked
	if sub == nil {
		return false, nil
	}

	// Active paid subscription = allowed
	if sub.HasPaidSubscription() {
		return true, nil
	}

	// In free trial = allowed (with limit)
	if sub.IsInFreeTrial() {
		return true, nil
	}

	// Trial expired, no paid subscription = blocked
	return false, nil
}

// CanUseWarmup checks if an organization can use the warmup feature.
func (s *featureGateService) CanUseWarmup(_ context.Context, _ uuid.UUID) (bool, *errx.Error) {
	return true, nil
}

// CanUseUnibox checks if an organization can use the unibox feature.
func (s *featureGateService) CanUseUnibox(_ context.Context, _ uuid.UUID) (bool, *errx.Error) {
	return true, nil
}

// CanAddInbox: workspaces are uncapped.
func (s *featureGateService) CanAddInbox(_ context.Context, _ uuid.UUID, _ int) (bool, *errx.Error) {
	return true, nil
}

// GetDailyEmailLimit returns the daily email limit for an organization (unlimited).
func (s *featureGateService) GetDailyEmailLimit(_ context.Context, _ uuid.UUID) (int, *errx.Error) {
	return UnlimitedEmails, nil
}

// GetSubscriptionStatus returns subscription info for feature checks (unlimited enterprise).
func (s *featureGateService) GetSubscriptionStatus(_ context.Context, _ uuid.UUID) (*SubscriptionStatus, *errx.Error) {
	return &SubscriptionStatus{
		HasSubscription:  true,
		IsPaidSubscriber: true,
		DailyEmailLimit:  UnlimitedEmails,
	}, nil
}

// GetStorageLimitBytes returns the org's attachment storage quota.
func (s *featureGateService) GetStorageLimitBytes(_ context.Context, _ uuid.UUID) (int64, *errx.Error) {
	// Storage is effectively unlimited (100 TB pool)
	return 100 * 1024 * 1024 * 1024 * 1024, nil
}

// CanUseWritingAssistant — AI assistant is unconditionally enabled.
func (s *featureGateService) CanUseWritingAssistant(_ context.Context, _ uuid.UUID) (bool, *errx.Error) {
	return true, nil
}

// CanUseInboxAgent gates the inbox agent — unconditionally enabled.
func (s *featureGateService) CanUseInboxAgent(_ context.Context, _ uuid.UUID) (bool, *errx.Error) {
	return true, nil
}

// IsPaidOrganization checks if the organization has an active paid subscription (always true).
func (s *featureGateService) IsPaidOrganization(_ context.Context, _ uuid.UUID) (bool, *errx.Error) {
	return true, nil
}
