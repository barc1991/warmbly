package repository

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/warmbly/warmbly/internal/infrastructure/db"
	"github.com/warmbly/warmbly/internal/models"
)

// GeminiKeysRepository manages the persistence of org-owned Gemini API keys and fallback configuration.
type GeminiKeysRepository interface {
	ListKeys(ctx context.Context, orgID uuid.UUID) ([]*models.OrgGeminiKey, error)
	ListActiveKeys(ctx context.Context, orgID uuid.UUID) ([]*models.OrgGeminiKey, error)
	GetKey(ctx context.Context, orgID, keyID uuid.UUID) (*models.OrgGeminiKey, error)
	CreateKey(ctx context.Context, key *models.OrgGeminiKey) (*models.OrgGeminiKey, error)
	DeleteKey(ctx context.Context, orgID, keyID uuid.UUID) error
	UpdateKeyStatus(ctx context.Context, orgID, keyID uuid.UUID, status models.GeminiKeyStatus) error
	UpdateKeyStats(ctx context.Context, keyID uuid.UUID, reqDelta, failDelta int, lastErr string, cooldownUntil *time.Time, status models.GeminiKeyStatus) error
	GetConfig(ctx context.Context, orgID uuid.UUID) (*models.GeminiOrgConfig, error)
	UpdateConfig(ctx context.Context, orgID uuid.UUID, cfg *models.GeminiOrgConfig) error
}

type geminiKeysRepository struct {
	DB *db.DB
}

func NewGeminiKeysRepository(database *db.DB) GeminiKeysRepository {
	return &geminiKeysRepository{DB: database}
}

const geminiKeyCols = `id, org_id, name, masked_key, encrypted_key, status, fail_count, request_count, last_used, last_error, cooldown_until, created_at, updated_at`

func scanGeminiKey(row pgx.Row, k *models.OrgGeminiKey) error {
	var statusStr string
	err := row.Scan(
		&k.ID, &k.OrgID, &k.Name, &k.MaskedKey, &k.EncryptedKey,
		&statusStr, &k.FailCount, &k.RequestCount,
		&k.LastUsed, &k.LastError, &k.CooldownUntil,
		&k.CreatedAt, &k.UpdatedAt,
	)
	if err != nil {
		return err
	}
	k.Status = models.GeminiKeyStatus(statusStr)
	return nil
}

func (r *geminiKeysRepository) ListKeys(ctx context.Context, orgID uuid.UUID) ([]*models.OrgGeminiKey, error) {
	rows, err := r.DB.Query(ctx, `SELECT `+geminiKeyCols+` FROM org_gemini_keys WHERE org_id = $1 ORDER BY created_at DESC`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var keys []*models.OrgGeminiKey
	for rows.Next() {
		k := &models.OrgGeminiKey{}
		if err := scanGeminiKey(rows, k); err != nil {
			return nil, err
		}
		keys = append(keys, k)
	}
	return keys, rows.Err()
}

func (r *geminiKeysRepository) ListActiveKeys(ctx context.Context, orgID uuid.UUID) ([]*models.OrgGeminiKey, error) {
	rows, err := r.DB.Query(ctx, `SELECT `+geminiKeyCols+` FROM org_gemini_keys WHERE org_id = $1 AND status != 'disabled' AND status != 'paused' ORDER BY created_at ASC`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var keys []*models.OrgGeminiKey
	for rows.Next() {
		k := &models.OrgGeminiKey{}
		if err := scanGeminiKey(rows, k); err != nil {
			return nil, err
		}
		keys = append(keys, k)
	}
	return keys, rows.Err()
}

func (r *geminiKeysRepository) GetKey(ctx context.Context, orgID, keyID uuid.UUID) (*models.OrgGeminiKey, error) {
	k := &models.OrgGeminiKey{}
	err := scanGeminiKey(r.DB.QueryRow(ctx, `SELECT `+geminiKeyCols+` FROM org_gemini_keys WHERE org_id = $1 AND id = $2`, orgID, keyID), k)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return k, nil
}

func (r *geminiKeysRepository) CreateKey(ctx context.Context, key *models.OrgGeminiKey) (*models.OrgGeminiKey, error) {
	k := &models.OrgGeminiKey{}
	status := string(key.Status)
	if status == "" {
		status = string(models.GeminiKeyStatusActive)
	}
	err := scanGeminiKey(r.DB.QueryRow(ctx, `
		INSERT INTO org_gemini_keys
			(org_id, name, masked_key, encrypted_key, status)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING `+geminiKeyCols,
		key.OrgID, key.Name, key.MaskedKey, key.EncryptedKey, status,
	), k)
	if err != nil {
		return nil, err
	}
	return k, nil
}

func (r *geminiKeysRepository) DeleteKey(ctx context.Context, orgID, keyID uuid.UUID) error {
	cmd, err := r.DB.Exec(ctx, `DELETE FROM org_gemini_keys WHERE org_id = $1 AND id = $2`, orgID, keyID)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (r *geminiKeysRepository) UpdateKeyStatus(ctx context.Context, orgID, keyID uuid.UUID, status models.GeminiKeyStatus) error {
	cmd, err := r.DB.Exec(ctx, `UPDATE org_gemini_keys SET status = $1, updated_at = now() WHERE org_id = $2 AND id = $3`, string(status), orgID, keyID)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (r *geminiKeysRepository) UpdateKeyStats(ctx context.Context, keyID uuid.UUID, reqDelta, failDelta int, lastErr string, cooldownUntil *time.Time, status models.GeminiKeyStatus) error {
	_, err := r.DB.Exec(ctx, `
		UPDATE org_gemini_keys SET
			request_count = request_count + $1,
			fail_count = fail_count + $2,
			last_used = now(),
			last_error = CASE WHEN $3 <> '' THEN $3 ELSE last_error END,
			cooldown_until = $4,
			status = CASE WHEN $5 <> '' THEN $5 ELSE status END,
			updated_at = now()
		WHERE id = $6`,
		reqDelta, failDelta, lastErr, cooldownUntil, string(status), keyID,
	)
	return err
}

func (r *geminiKeysRepository) GetConfig(ctx context.Context, orgID uuid.UUID) (*models.GeminiOrgConfig, error) {
	var primaryModel string
	var fallbackEnabled bool
	var fallbackChainJSON []byte

	err := r.DB.QueryRow(ctx, `
		SELECT gemini_primary_model, gemini_fallback_enabled, gemini_fallback_chain
		FROM org_ai_settings
		WHERE org_id = $1`, orgID,
	).Scan(&primaryModel, &fallbackEnabled, &fallbackChainJSON)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return &models.GeminiOrgConfig{
				PrimaryModel:    "gemini-3.8-flash",
				FallbackEnabled: true,
				FallbackChain:   []string{"gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"},
			}, nil
		}
		return nil, err
	}

	var chain []string
	if len(fallbackChainJSON) > 0 {
		_ = json.Unmarshal(fallbackChainJSON, &chain)
	}
	if len(chain) == 0 {
		chain = []string{"gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"}
	}

	return &models.GeminiOrgConfig{
		PrimaryModel:    primaryModel,
		FallbackEnabled: fallbackEnabled,
		FallbackChain:   chain,
	}, nil
}

func (r *geminiKeysRepository) UpdateConfig(ctx context.Context, orgID uuid.UUID, cfg *models.GeminiOrgConfig) error {
	chainJSON, err := json.Marshal(cfg.FallbackChain)
	if err != nil {
		return err
	}

	_, err = r.DB.Exec(ctx, `
		INSERT INTO org_ai_settings (org_id, gemini_primary_model, gemini_fallback_enabled, gemini_fallback_chain, updated_at)
		VALUES ($1, $2, $3, $4, now())
		ON CONFLICT (org_id) DO UPDATE SET
			gemini_primary_model = EXCLUDED.gemini_primary_model,
			gemini_fallback_enabled = EXCLUDED.gemini_fallback_enabled,
			gemini_fallback_chain = EXCLUDED.gemini_fallback_chain,
			updated_at = now()`,
		orgID, cfg.PrimaryModel, cfg.FallbackEnabled, chainJSON,
	)
	return err
}
