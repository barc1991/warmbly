package inboxtag

import (
	"context"
	"encoding/json"
	"strings"
	"sync"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"github.com/warmbly/warmbly/internal/app/replyclassify"
	"github.com/warmbly/warmbly/internal/models"
	"github.com/warmbly/warmbly/internal/repository"
)

// PHASE 1. This service writes labels and a relevance score. It does not
// snooze, does not hold a lead, does not create a task, and does not suppress
// anything. Those are phases 2 and 3 and they are separate changes on purpose:
// a wrongly suppressed address is silent and permanent, so nothing earns that
// power until a human has watched the labels be right for a week.
//
// There is a test asserting this service reaches none of those primitives. If
// you are adding one, you are starting phase 2 and the test should be the first
// thing you change.

// Asker is the model call, narrowed to what the service uses so tests can
// supply a cached response instead of a network.
type Asker interface {
	Ask(ctx context.Context, state any, questions map[string]Question) (*Response, error)
}

// Categories maps label slugs to the workspace category rows they file under.
// set_thread_labels takes category UUIDs, not strings, so the slug -> uuid map
// is resolved once and cached rather than rebuilt per message.
type Categories interface {
	EnsureCategory(ctx context.Context, orgID uuid.UUID, slug string) (uuid.UUID, error)
	// EnsureAll creates the whole taxonomy up front, so every label is
	// filterable from the moment the feature is on rather than appearing one
	// at a time as each first fires.
	EnsureAll(ctx context.Context, orgID uuid.UUID, slugs []string) error
	SetThreadLabels(ctx context.Context, orgID, userID uuid.UUID, threadID string, categoryIDs []uuid.UUID) error
}

// MailboxAddresses answers "is this one of ours", which is a fact and must
// never be a question.
type MailboxAddresses interface {
	IsOwnAddress(ctx context.Context, orgID uuid.UUID, addr string) (bool, error)
}

type Service struct {
	asker      Asker
	repo       repository.InboxTagRepository
	categories Categories
	mailboxes  MailboxAddresses
	// enabled gates the whole feature. Off by default, and off whenever no API
	// key is configured, so an instance that never heard of TypeSafe behaves
	// exactly as it did before.
	enabled bool

	// seeded remembers which workspaces already have the full taxonomy, so the
	// label set is created once per process rather than per message.
	seededMu sync.Mutex
	seeded   map[uuid.UUID]bool
}

func NewService(asker Asker, repo repository.InboxTagRepository, categories Categories, mailboxes MailboxAddresses, enabled bool) *Service {
	return &Service{asker: asker, repo: repo, categories: categories, mailboxes: mailboxes, enabled: enabled}
}

func (s *Service) Enabled() bool {
	return s != nil && s.enabled && s.asker != nil && s.repo != nil
}

// Message is the projection the service needs. Built by the caller from the
// stored message; the service never reads the database for it.
type Message struct {
	OrganizationID uuid.UUID
	UserID         uuid.UUID
	EmailAccountID uuid.UUID
	MessageID      string
	ThreadID       string
	Subject        string
	BodyText       string
	FromAddr       string
	Headers        map[string][]string
	// PreviousMessage is our last outbound in this thread, so a bare "yes" has
	// something to be an answer to.
	PreviousMessage string
	Campaign        string
	// Outbound is set by the caller from the folder, not guessed from content.
	Outbound bool
}

// Classify runs the whole pipeline for one inbound message. Safe to call on
// anything: it decides for itself whether there is a call to make.
//
// Returns the decision for logging and tests. Errors are returned but callers
// treat them as best-effort: tagging must never block inbox ingest.
func (s *Service) Classify(ctx context.Context, m Message) (Decision, error) {
	if !s.Enabled() {
		return Decision{}, nil
	}

	// 1. Our own mail. Checked before anything else and before any call: given
	// only a body, the model calls our own outbound a human reply at 0.94
	// confidence. This is the filter that makes that impossible.
	if m.Outbound || s.isOwn(ctx, m) {
		return DecideOutbound(), nil
	}

	// 2. Idempotency. A webhook retry and a folder re-sync both replay the same
	// Message-ID, and neither should spend a second call to reach the answer
	// already on the row.
	done, err := s.repo.AlreadyTagged(ctx, m.OrganizationID, m.MessageID)
	if err != nil {
		return Decision{}, err
	}
	if done {
		return Decision{}, nil
	}

	// 3. The free layers first. Headers written by the sending system say what
	// a message IS: RFC 3834 Auto-Submitted, X-Autoreply, a DSN content type.
	// The model reads the same message as prose and infers. Where a header has
	// spoken there is nothing to ask, so nothing is asked.
	facts := Facts{DeterministicKind: deterministicKind(m)}

	state := BuildState(m.Subject, m.BodyText, m.PreviousMessage, m.Campaign)

	var resp *Response
	if facts.DeterministicKind == "" {
		if !HasContent(state) {
			return Decision{}, nil
		}
		// 4. ONE call. Every question at once: they are evaluated in parallel
		// against a single state ingest, so the set costs what its largest
		// member costs. A loop per tag would be a bug.
		resp, err = s.asker.Ask(ctx, state, Questions())
		if err != nil {
			return Decision{}, err
		}
	}

	answers := map[string]Answer{}
	model := ""
	tokens := 0
	if resp != nil {
		answers = resp.Answers
		model = resp.Model
		tokens = resp.Usage.InputTokens
	}

	// 5. Code decides. Nothing above this line chose a label.
	decision := Decide(answers, facts)

	if err := s.persist(ctx, m, decision, answers, model, tokens); err != nil {
		return decision, err
	}

	// 6. The only side effect in this phase.
	if err := s.applyLabels(ctx, m, decision); err != nil {
		// The verdict is already stored, so a label that failed to apply is
		// visible on the review page rather than lost.
		log.Warn().Err(err).Str("thread_id", m.ThreadID).Msg("inbox tagging: labels not applied")
	}

	return decision, nil
}

func (s *Service) isOwn(ctx context.Context, m Message) bool {
	if s.mailboxes == nil || m.FromAddr == "" {
		return false
	}
	own, err := s.mailboxes.IsOwnAddress(ctx, m.OrganizationID, m.FromAddr)
	if err != nil {
		// Fail closed: an unknown answer here means we might be about to
		// classify our own send, which is the one wrong answer that looks
		// entirely plausible.
		log.Warn().Err(err).Msg("inbox tagging: could not resolve sender ownership, skipping")
		return true
	}
	return own
}

// deterministicKind maps the offline classifier's verdict onto this taxonomy.
// Only the classes headers decide definitively are mapped; everything else
// falls through to the model.
func deterministicKind(m Message) string {
	res := replyclassify.ClassifyOffline(replyclassify.Input{
		Headers:  m.Headers,
		Subject:  m.Subject,
		BodyText: m.BodyText,
	})
	switch res.Class {
	case replyclassify.ClassOutOfOffice:
		return KindAutoReplyOOO
	case replyclassify.ClassAutoReply:
		return KindAutoReplyTicket
	default:
		// Positive, negative and neutral are lexicon guesses about a human
		// reply, not statements about what the message is. They are exactly
		// the judgment the model is better at, so they are not mapped.
		return ""
	}
}

func (s *Service) persist(ctx context.Context, m Message, d Decision, answers map[string]Answer, model string, tokens int) error {
	raw, err := json.Marshal(answers)
	if err != nil {
		raw = json.RawMessage(`{}`)
	}
	return s.repo.Save(ctx, &repository.InboxTagResult{
		OrganizationID:   m.OrganizationID,
		EmailAccountID:   m.EmailAccountID,
		MessageID:        m.MessageID,
		ThreadID:         m.ThreadID,
		Kind:             d.Kind,
		KindConfidence:   d.KindConfidence,
		KindSource:       d.KindSource,
		Intent:           d.Intent,
		IntentConfidence: d.IntentConfidence,
		Relevance:        d.Relevance,
		Priority:         d.Priority,
		NeedsReview:      d.NeedsReview,
		Answers:          raw,
		Labels:           d.Labels,
		Model:            model,
		InputTokens:      tokens,
	})
}

// seedTaxonomy creates every label once per workspace per process, so the
// filter offers the full set rather than only what has fired so far.
func (s *Service) seedTaxonomy(ctx context.Context, orgID uuid.UUID) {
	if s.categories == nil {
		return
	}
	s.seededMu.Lock()
	seeded := s.seeded[orgID]
	s.seededMu.Unlock()
	if seeded {
		return
	}
	if err := s.categories.EnsureAll(ctx, orgID, AllLabels()); err != nil {
		// Not fatal: the per-label EnsureCategory below still creates whatever
		// this decision needs. Only the "all labels visible" guarantee is lost
		// until the next attempt.
		log.Warn().Err(err).Msg("inbox tagging: could not seed the label taxonomy")
		return
	}
	s.seededMu.Lock()
	if s.seeded == nil {
		s.seeded = map[uuid.UUID]bool{}
	}
	s.seeded[orgID] = true
	s.seededMu.Unlock()
}

func (s *Service) applyLabels(ctx context.Context, m Message, d Decision) error {
	if s.categories == nil || m.ThreadID == "" || len(d.Labels) == 0 {
		return nil
	}
	s.seedTaxonomy(ctx, m.OrganizationID)
	ids := make([]uuid.UUID, 0, len(d.Labels))
	for _, label := range d.Labels {
		id, err := s.categories.EnsureCategory(ctx, m.OrganizationID, label)
		if err != nil {
			return err
		}
		ids = append(ids, id)
	}
	return s.categories.SetThreadLabels(ctx, m.OrganizationID, m.UserID, m.ThreadID, ids)
}

// MessageFrom projects a stored inbound message into the service's input.
// Direction comes from the folder the message is in, never from its content.
func MessageFrom(orgID, userID uuid.UUID, msg *models.EmailMessageStoreData, headers map[string][]string, previous, campaign string) Message {
	from := ""
	if len(msg.FromAddr) > 0 {
		from = strings.TrimSpace(msg.FromAddr[0])
	}
	return Message{
		OrganizationID:  orgID,
		UserID:          userID,
		EmailAccountID:  msg.EmailID,
		MessageID:       msg.MessageID,
		ThreadID:        msg.ThreadID,
		Subject:         msg.Subject,
		BodyText:        msg.BodyText,
		FromAddr:        from,
		Headers:         headers,
		PreviousMessage: previous,
		Campaign:        campaign,
		Outbound:        !msg.MayBeInbound(),
	}
}
