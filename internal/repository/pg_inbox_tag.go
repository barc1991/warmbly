package repository

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// InboxTagResult is one classified inbound message.
type InboxTagResult struct {
	ID               uuid.UUID
	OrganizationID   uuid.UUID
	EmailAccountID   uuid.UUID
	MessageID        string
	ThreadID         string
	Kind             string
	KindConfidence   float64
	KindSource       string
	Intent           string
	IntentConfidence float64
	Relevance        int
	Priority         string
	NeedsReview      bool
	Answers          json.RawMessage
	Labels           []string
	Model            string
	InputTokens      int
	CreatedAt        time.Time
}

type InboxTagRepository interface {
	// AlreadyTagged is the idempotency check. Webhooks retry and a re-sync
	// replays the same message, so this runs before anything is asked.
	AlreadyTagged(ctx context.Context, orgID uuid.UUID, messageID string) (bool, error)
	Save(ctx context.Context, r *InboxTagResult) error
	// ListForReview backs the phase-1 review page: what was decided, how
	// confident it was, and what it would have done.
	ListForReview(ctx context.Context, orgID uuid.UUID, limit, offset int, needsReviewOnly bool) ([]InboxTagResult, int, error)

	// ListUntagged and PreviousOutbound back the historical backfill.
	ListUntagged(ctx context.Context, orgID uuid.UUID, since time.Time, limit int) ([]BackfillCandidate, error)
	PreviousOutbound(ctx context.Context, accountID uuid.UUID, threadID string, before time.Time) (string, error)
}

type inboxTagRepository struct {
	db *pgxpool.Pool
}

func NewInboxTagRepository(db *pgxpool.Pool) InboxTagRepository {
	return &inboxTagRepository{db: db}
}

func (r *inboxTagRepository) AlreadyTagged(ctx context.Context, orgID uuid.UUID, messageID string) (bool, error) {
	if messageID == "" {
		// No key to be idempotent on. Treated as already handled rather than
		// classified repeatedly: a message with no Message-ID would otherwise
		// be re-tagged on every sync, spending a call each time.
		return true, nil
	}
	const q = `SELECT EXISTS (SELECT 1 FROM inbox_tag_results WHERE organization_id = $1 AND message_id = $2)`
	var exists bool
	if err := r.db.QueryRow(ctx, q, orgID, messageID).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

func (r *inboxTagRepository) Save(ctx context.Context, res *InboxTagResult) error {
	const q = `
		INSERT INTO inbox_tag_results (
			organization_id, email_account_id, message_id, thread_id,
			kind, kind_confidence, kind_source, intent, intent_confidence,
			relevance, priority, needs_review, answers, labels, model, input_tokens
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
		ON CONFLICT (organization_id, message_id) DO NOTHING
	`
	answers := res.Answers
	if len(answers) == 0 {
		answers = json.RawMessage(`{}`)
	}
	labels := res.Labels
	if labels == nil {
		labels = []string{}
	}
	_, err := r.db.Exec(ctx, q,
		res.OrganizationID, res.EmailAccountID, res.MessageID, res.ThreadID,
		res.Kind, res.KindConfidence, res.KindSource, res.Intent, res.IntentConfidence,
		res.Relevance, res.Priority, res.NeedsReview, answers, labels, res.Model, res.InputTokens,
	)
	return err
}

func (r *inboxTagRepository) ListForReview(ctx context.Context, orgID uuid.UUID, limit, offset int, needsReviewOnly bool) ([]InboxTagResult, int, error) {
	where := `WHERE organization_id = $1`
	if needsReviewOnly {
		where += ` AND needs_review`
	}

	var total int
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM inbox_tag_results `+where, orgID).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.db.Query(ctx, `
		SELECT id, organization_id, email_account_id, message_id, thread_id,
		       kind, kind_confidence, kind_source, intent, intent_confidence,
		       relevance, priority, needs_review, answers, labels, model, input_tokens, created_at
		FROM inbox_tag_results `+where+`
		ORDER BY relevance DESC, created_at DESC
		LIMIT $2 OFFSET $3`, orgID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	out := make([]InboxTagResult, 0, limit)
	for rows.Next() {
		var x InboxTagResult
		if err := rows.Scan(
			&x.ID, &x.OrganizationID, &x.EmailAccountID, &x.MessageID, &x.ThreadID,
			&x.Kind, &x.KindConfidence, &x.KindSource, &x.Intent, &x.IntentConfidence,
			&x.Relevance, &x.Priority, &x.NeedsReview, &x.Answers, &x.Labels, &x.Model, &x.InputTokens, &x.CreatedAt,
		); err != nil {
			return nil, 0, err
		}
		out = append(out, x)
	}
	return out, total, rows.Err()
}

// BackfillCandidate is one historical message the backfill may classify.
type BackfillCandidate struct {
	EmailAccountID uuid.UUID
	UserID         uuid.UUID
	MessageID      string
	ThreadID       string
	Subject        string
	BodyText       string
	FromAddr       string
	InternalDate   time.Time
}

// ListUntagged returns inbound messages that have never been classified, newest
// first, for the backfill.
//
// Three exclusions, all deliberate:
//
//   - folder = 'inbox' only. Our own sends are never classified, and the folder
//     is the fact that says which is which. Reading direction from content is
//     how our own outbound gets labelled a human reply at 0.94 confidence.
//   - a sender that is one of our own mailboxes is dropped even inside the
//     inbox folder: mail between two connected mailboxes lands in the second
//     one's inbox and is still ours.
//   - anything already in inbox_tag_results, so a re-run resumes rather than
//     repeats. Same key the live path is idempotent on.
func (r *inboxTagRepository) ListUntagged(ctx context.Context, orgID uuid.UUID, since time.Time, limit int) ([]BackfillCandidate, error) {
	const q = `
		SELECT ue.email_id, ue.user_id, ue.message_id, ue.thread_id,
		       ue.subject, ue.body_text, COALESCE(ue.from_addr[1], ''), ue.internal_date
		FROM unibox_emails ue
		JOIN email_accounts ea ON ea.id = ue.email_id
		WHERE ea.organization_id = $1
		  AND ue.folder = 'inbox'
		  AND ue.internal_date >= $2
		  AND ue.message_id <> ''
		  AND LOWER(COALESCE(NULLIF((regexp_match(COALESCE(ue.from_addr[1], ''), '\(([^()]+)\)\s*$'))[1], ''), TRIM(COALESCE(ue.from_addr[1], ''))))
		      NOT IN (SELECT LOWER(email) FROM email_accounts WHERE organization_id = $1)
		  AND NOT EXISTS (
		        SELECT 1 FROM inbox_tag_results r
		        WHERE r.organization_id = $1 AND r.message_id = ue.message_id
		      )
		ORDER BY ue.internal_date DESC
		LIMIT $3
	`
	rows, err := r.db.Query(ctx, q, orgID, since, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []BackfillCandidate
	for rows.Next() {
		var c BackfillCandidate
		if err := rows.Scan(&c.EmailAccountID, &c.UserID, &c.MessageID, &c.ThreadID,
			&c.Subject, &c.BodyText, &c.FromAddr, &c.InternalDate); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// PreviousOutbound is the plain text of the last message we sent in a thread
// before a given moment.
//
// Without it a reply cannot be read: "yes", "that works" and "sounds good" are
// answers, and the question they answer is not in them. Giving the model our
// side of the exchange is what lets the reply mean anything.
func (r *inboxTagRepository) PreviousOutbound(ctx context.Context, accountID uuid.UUID, threadID string, before time.Time) (string, error) {
	if threadID == "" {
		return "", nil
	}
	const q = `
		SELECT body_text
		FROM unibox_emails
		WHERE email_id = $1 AND thread_id = $2 AND folder = 'sent' AND internal_date < $3
		ORDER BY internal_date DESC
		LIMIT 1
	`
	var body string
	if err := r.db.QueryRow(ctx, q, accountID, threadID, before).Scan(&body); err != nil {
		// No previous message is the normal case for the first inbound of a
		// thread, not an error worth failing a classification over.
		return "", nil
	}
	return body, nil
}
