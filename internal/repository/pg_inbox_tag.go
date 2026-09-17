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
