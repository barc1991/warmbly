package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/warmbly/warmbly/internal/infrastructure/db"
	"github.com/warmbly/warmbly/internal/models"
)

// SerperKeysRepository manages persistence of org Serper keys, 7-day query cache, and BDR settings.
type SerperKeysRepository interface {
	ListKeys(ctx context.Context, orgID uuid.UUID) ([]*models.OrgSerperKey, error)
	ListActiveKeys(ctx context.Context, orgID uuid.UUID) ([]*models.OrgSerperKey, error)
	GetKey(ctx context.Context, orgID, keyID uuid.UUID) (*models.OrgSerperKey, error)
	CreateKey(ctx context.Context, key *models.OrgSerperKey) (*models.OrgSerperKey, error)
	DeleteKey(ctx context.Context, orgID, keyID uuid.UUID) error
	UpdateKeyStatus(ctx context.Context, orgID, keyID uuid.UUID, status models.SerperKeyStatus) error
	RecordKeySuccess(ctx context.Context, keyID uuid.UUID, credits int) error
	RecordKeyRateLimit(ctx context.Context, keyID uuid.UUID, cooldownUntil time.Time, errMsg string) error
	RecordKeyExhausted(ctx context.Context, keyID uuid.UUID, errMsg string) error
	GetRotationStats(ctx context.Context, orgID uuid.UUID) (*models.SerperRotationStats, error)
	GetCachedSearch(ctx context.Context, orgID uuid.UUID, queryHash string) ([]byte, error)
	SetCachedSearch(ctx context.Context, orgID uuid.UUID, queryHash, query string, resultsJSON []byte) error
	GetBDRSettings(ctx context.Context, orgID uuid.UUID) (*models.BDRSettings, error)
	UpdateBDRSettings(ctx context.Context, orgID uuid.UUID, s *models.BDRSettings) error
}

type serperKeysRepository struct {
	DB *db.DB
}

// NewSerperKeysRepository builds the Serper repository.
func NewSerperKeysRepository(database *db.DB) SerperKeysRepository {
	return &serperKeysRepository{DB: database}
}

const serperKeyCols = `id, org_id, name, masked_key, encrypted_key, status, fail_count, request_count, remaining_credits, last_used, last_error, cooldown_until, created_at, updated_at`

func scanSerperKey(row pgx.Row, k *models.OrgSerperKey) error {
	var status string
	err := row.Scan(
		&k.ID,
		&k.OrgID,
		&k.Name,
		&k.MaskedKey,
		&k.EncryptedKey,
		&status,
		&k.FailCount,
		&k.RequestCount,
		&k.RemainingCredits,
		&k.LastUsed,
		&k.LastError,
		&k.CooldownUntil,
		&k.CreatedAt,
		&k.UpdatedAt,
	)
	if err != nil {
		return err
	}
	k.Status = models.SerperKeyStatus(status)
	return nil
}

func (r *serperKeysRepository) ListKeys(ctx context.Context, orgID uuid.UUID) ([]*models.OrgSerperKey, error) {
	rows, err := r.DB.Query(ctx, `SELECT `+serperKeyCols+` FROM org_serper_keys WHERE org_id = $1 ORDER BY created_at DESC`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var keys []*models.OrgSerperKey
	for rows.Next() {
		k := &models.OrgSerperKey{}
		if err := scanSerperKey(rows, k); err != nil {
			return nil, err
		}
		keys = append(keys, k)
	}
	return keys, rows.Err()
}

func (r *serperKeysRepository) ListActiveKeys(ctx context.Context, orgID uuid.UUID) ([]*models.OrgSerperKey, error) {
	rows, err := r.DB.Query(ctx, `SELECT `+serperKeyCols+` FROM org_serper_keys WHERE org_id = $1 AND status != 'disabled' AND status != 'paused' AND status != 'exhausted' ORDER BY created_at ASC`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var keys []*models.OrgSerperKey
	for rows.Next() {
		k := &models.OrgSerperKey{}
		if err := scanSerperKey(rows, k); err != nil {
			return nil, err
		}
		keys = append(keys, k)
	}
	return keys, rows.Err()
}

func (r *serperKeysRepository) GetKey(ctx context.Context, orgID, keyID uuid.UUID) (*models.OrgSerperKey, error) {
	k := &models.OrgSerperKey{}
	err := scanSerperKey(r.DB.QueryRow(ctx, `SELECT `+serperKeyCols+` FROM org_serper_keys WHERE org_id = $1 AND id = $2`, orgID, keyID), k)
	if err != nil {
		return nil, err
	}
	return k, nil
}

func (r *serperKeysRepository) CreateKey(ctx context.Context, key *models.OrgSerperKey) (*models.OrgSerperKey, error) {
	k := &models.OrgSerperKey{}
	status := string(key.Status)
	if status == "" {
		status = string(models.SerperKeyStatusActive)
	}

	remaining := key.RemainingCredits
	if remaining <= 0 {
		remaining = 2500
	}

	err := scanSerperKey(r.DB.QueryRow(ctx, `
		INSERT INTO org_serper_keys (org_id, name, masked_key, encrypted_key, status, remaining_credits)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING `+serperKeyCols,
		key.OrgID, key.Name, key.MaskedKey, key.EncryptedKey, status, remaining,
	), k)
	if err != nil {
		return nil, err
	}
	return k, nil
}

func (r *serperKeysRepository) DeleteKey(ctx context.Context, orgID, keyID uuid.UUID) error {
	cmd, err := r.DB.Exec(ctx, `DELETE FROM org_serper_keys WHERE org_id = $1 AND id = $2`, orgID, keyID)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return errors.New("key not found")
	}
	return nil
}

func (r *serperKeysRepository) UpdateKeyStatus(ctx context.Context, orgID, keyID uuid.UUID, status models.SerperKeyStatus) error {
	cmd, err := r.DB.Exec(ctx, `UPDATE org_serper_keys SET status = $1, updated_at = now() WHERE org_id = $2 AND id = $3`, string(status), orgID, keyID)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return errors.New("key not found")
	}
	return nil
}

func (r *serperKeysRepository) RecordKeySuccess(ctx context.Context, keyID uuid.UUID, credits int) error {
	_, err := r.DB.Exec(ctx, `
		UPDATE org_serper_keys SET
			request_count = request_count + 1,
			remaining_credits = GREATEST(0, remaining_credits - $1),
			status = CASE WHEN request_count + 1 >= 2500 OR remaining_credits - $1 <= 0 THEN 'exhausted' ELSE status END,
			last_used = now(),
			updated_at = now()
		WHERE id = $2`,
		credits, keyID,
	)
	return err
}

func (r *serperKeysRepository) RecordKeyRateLimit(ctx context.Context, keyID uuid.UUID, cooldownUntil time.Time, errMsg string) error {
	_, err := r.DB.Exec(ctx, `
		UPDATE org_serper_keys SET
			fail_count = fail_count + 1,
			status = 'cooldown',
			cooldown_until = $1,
			last_error = $2,
			updated_at = now()
		WHERE id = $3`,
		cooldownUntil, errMsg, keyID,
	)
	return err
}

func (r *serperKeysRepository) RecordKeyExhausted(ctx context.Context, keyID uuid.UUID, errMsg string) error {
	_, err := r.DB.Exec(ctx, `
		UPDATE org_serper_keys SET
			status = 'exhausted',
			remaining_credits = 0,
			last_error = $1,
			updated_at = now()
		WHERE id = $2`,
		errMsg, keyID,
	)
	return err
}

func (r *serperKeysRepository) GetRotationStats(ctx context.Context, orgID uuid.UUID) (*models.SerperRotationStats, error) {
	stats := &models.SerperRotationStats{}
	row := r.DB.QueryRow(ctx, `
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE status = 'active'),
			COUNT(*) FILTER (WHERE status = 'cooldown'),
			COUNT(*) FILTER (WHERE status = 'exhausted'),
			COALESCE(SUM(request_count), 0),
			COALESCE(SUM(remaining_credits), 0)
		FROM org_serper_keys
		WHERE org_id = $1`,
		orgID,
	)
	err := row.Scan(
		&stats.TotalKeys,
		&stats.ActiveKeys,
		&stats.CooldownKeys,
		&stats.ExhaustedKeys,
		&stats.TotalRequests,
		&stats.RemainingCredits,
	)
	return stats, err
}

func (r *serperKeysRepository) GetCachedSearch(ctx context.Context, orgID uuid.UUID, queryHash string) ([]byte, error) {
	var results []byte
	err := r.DB.QueryRow(ctx, `
		SELECT results_json
		FROM org_serper_cache
		WHERE org_id = $1 AND query_hash = $2 AND expires_at > now()`,
		orgID, queryHash,
	).Scan(&results)
	if err != nil {
		return nil, err
	}
	return results, nil
}

func (r *serperKeysRepository) SetCachedSearch(ctx context.Context, orgID uuid.UUID, queryHash, query string, resultsJSON []byte) error {
	_, err := r.DB.Exec(ctx, `
		INSERT INTO org_serper_cache (org_id, query_hash, query, results_json, expires_at)
		VALUES ($1, $2, $3, $4, now() + INTERVAL '7 days')
		ON CONFLICT (org_id, query_hash) DO UPDATE SET
			results_json = EXCLUDED.results_json,
			expires_at = now() + INTERVAL '7 days'`,
		orgID, queryHash, query, resultsJSON,
	)
	return err
}

func (r *serperKeysRepository) GetBDRSettings(ctx context.Context, orgID uuid.UUID) (*models.BDRSettings, error) {
	s := &models.BDRSettings{
		InboxAutoSendEnabled:       false,
		InboxAutoSendMinConfidence: 0.90,
		FirstReplyWebsiteCrawl:     true,
		SignatureExtractionEnabled: true,
	}
	row := r.DB.QueryRow(ctx, `
		SELECT
			COALESCE(inbox_auto_send_enabled, false),
			COALESCE(inbox_auto_send_min_confidence, 0.90),
			COALESCE(first_reply_website_crawl, true),
			COALESCE(signature_extraction_enabled, true)
		FROM org_ai_settings
		WHERE org_id = $1`,
		orgID,
	)
	err := row.Scan(&s.InboxAutoSendEnabled, &s.InboxAutoSendMinConfidence, &s.FirstReplyWebsiteCrawl, &s.SignatureExtractionEnabled)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	return s, nil
}

func (r *serperKeysRepository) UpdateBDRSettings(ctx context.Context, orgID uuid.UUID, s *models.BDRSettings) error {
	_, err := r.DB.Exec(ctx, `
		INSERT INTO org_ai_settings (org_id, inbox_auto_send_enabled, inbox_auto_send_min_confidence, first_reply_website_crawl, signature_extraction_enabled)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (org_id) DO UPDATE SET
			inbox_auto_send_enabled = EXCLUDED.inbox_auto_send_enabled,
			inbox_auto_send_min_confidence = EXCLUDED.inbox_auto_send_min_confidence,
			first_reply_website_crawl = EXCLUDED.first_reply_website_crawl,
			signature_extraction_enabled = EXCLUDED.signature_extraction_enabled,
			updated_at = now()`,
		orgID, s.InboxAutoSendEnabled, s.InboxAutoSendMinConfidence, s.FirstReplyWebsiteCrawl, s.SignatureExtractionEnabled,
	)
	return err
}
