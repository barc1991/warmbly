package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/warmbly/warmbly/internal/infrastructure/db"
	"github.com/warmbly/warmbly/internal/models"
)

// OAuthSlotRepository manages dynamic OAuth connection slots for an organization.
type OAuthSlotRepository interface {
	List(ctx context.Context, orgID uuid.UUID) ([]*models.OAuthConnectionSlot, error)
	GetByID(ctx context.Context, orgID, slotID uuid.UUID) (*models.OAuthConnectionSlot, error)
	GetRawByID(ctx context.Context, slotID uuid.UUID) (*models.OAuthConnectionSlot, error)
	GetAvailableSlot(ctx context.Context, orgID uuid.UUID, provider string) (*models.OAuthConnectionSlot, error)
	Create(ctx context.Context, slot *models.OAuthConnectionSlot) (*models.OAuthConnectionSlot, error)
	Update(ctx context.Context, orgID, slotID uuid.UUID, udata *models.UpdateOAuthConnectionSlot) error
	Delete(ctx context.Context, orgID, slotID uuid.UUID) error
	CountAccountsForSlot(ctx context.Context, slotID uuid.UUID) (int, error)
}

type oauthSlotRepository struct {
	DB *db.DB
}

func NewOAuthSlotRepository(database *db.DB) OAuthSlotRepository {
	return &oauthSlotRepository{DB: database}
}

const oauthSlotSelectCols = `
	s.id, s.org_id, s.provider, s.name, s.client_id, s.encrypted_client_secret,
	s.max_accounts, s.is_default, s.created_at, s.updated_at,
	COUNT(ea.id)::int AS connected_count
`

func scanOAuthSlot(row pgx.Row, s *models.OAuthConnectionSlot) error {
	return row.Scan(
		&s.ID, &s.OrgID, &s.Provider, &s.Name, &s.ClientID, &s.EncryptedClientSecret,
		&s.MaxAccounts, &s.IsDefault, &s.CreatedAt, &s.UpdatedAt,
		&s.ConnectedCount,
	)
}

func (r *oauthSlotRepository) List(ctx context.Context, orgID uuid.UUID) ([]*models.OAuthConnectionSlot, error) {
	query := fmt.Sprintf(`
		SELECT %s
		FROM oauth_connection_slots s
		LEFT JOIN email_accounts ea ON ea.oauth_slot_id = s.id
		WHERE s.org_id = $1
		GROUP BY s.id
		ORDER BY s.created_at ASC
	`, oauthSlotSelectCols)

	rows, err := r.DB.Query(ctx, query, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var slots []*models.OAuthConnectionSlot
	for rows.Next() {
		var s models.OAuthConnectionSlot
		if err := scanOAuthSlot(rows, &s); err != nil {
			return nil, err
		}
		slots = append(slots, &s)
	}
	return slots, nil
}

func (r *oauthSlotRepository) GetByID(ctx context.Context, orgID, slotID uuid.UUID) (*models.OAuthConnectionSlot, error) {
	query := fmt.Sprintf(`
		SELECT %s
		FROM oauth_connection_slots s
		LEFT JOIN email_accounts ea ON ea.oauth_slot_id = s.id
		WHERE s.org_id = $1 AND s.id = $2
		GROUP BY s.id
	`, oauthSlotSelectCols)

	var s models.OAuthConnectionSlot
	if err := scanOAuthSlot(r.DB.QueryRow(ctx, query, orgID, slotID), &s); err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *oauthSlotRepository) GetRawByID(ctx context.Context, slotID uuid.UUID) (*models.OAuthConnectionSlot, error) {
	query := fmt.Sprintf(`
		SELECT %s
		FROM oauth_connection_slots s
		LEFT JOIN email_accounts ea ON ea.oauth_slot_id = s.id
		WHERE s.id = $1
		GROUP BY s.id
	`, oauthSlotSelectCols)

	var s models.OAuthConnectionSlot
	if err := scanOAuthSlot(r.DB.QueryRow(ctx, query, slotID), &s); err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *oauthSlotRepository) GetAvailableSlot(ctx context.Context, orgID uuid.UUID, provider string) (*models.OAuthConnectionSlot, error) {
	query := fmt.Sprintf(`
		SELECT %s
		FROM oauth_connection_slots s
		LEFT JOIN email_accounts ea ON ea.oauth_slot_id = s.id
		WHERE s.org_id = $1 AND s.provider = $2
		GROUP BY s.id
		HAVING COUNT(ea.id) < s.max_accounts
		ORDER BY s.is_default DESC, s.created_at ASC
		LIMIT 1
	`, oauthSlotSelectCols)

	var s models.OAuthConnectionSlot
	if err := scanOAuthSlot(r.DB.QueryRow(ctx, query, orgID, provider), &s); err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *oauthSlotRepository) Create(ctx context.Context, slot *models.OAuthConnectionSlot) (*models.OAuthConnectionSlot, error) {
	if slot.ID == uuid.Nil {
		slot.ID = uuid.New()
	}
	now := time.Now().UTC()
	slot.CreatedAt = now
	slot.UpdatedAt = now

	tx, err := r.DB.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if slot.IsDefault {
		_, err := tx.Exec(ctx, `UPDATE oauth_connection_slots SET is_default = false WHERE org_id = $1`, slot.OrgID)
		if err != nil {
			return nil, err
		}
	}

	query := `
		INSERT INTO oauth_connection_slots (
			id, org_id, provider, name, client_id, encrypted_client_secret,
			max_accounts, is_default, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	_, err = tx.Exec(
		ctx, query,
		slot.ID, slot.OrgID, slot.Provider, slot.Name, slot.ClientID, slot.EncryptedClientSecret,
		slot.MaxAccounts, slot.IsDefault, slot.CreatedAt, slot.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	slot.ConnectedCount = 0
	return slot, nil
}

func (r *oauthSlotRepository) Update(ctx context.Context, orgID, slotID uuid.UUID, udata *models.UpdateOAuthConnectionSlot) error {
	setClauses := []string{"updated_at = now()"}
	args := []any{orgID, slotID}
	idx := 3

	if udata.Name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", idx))
		args = append(args, strings.TrimSpace(*udata.Name))
		idx++
	}
	if udata.ClientSecret != nil && *udata.ClientSecret != "" {
		setClauses = append(setClauses, fmt.Sprintf("encrypted_client_secret = $%d", idx))
		args = append(args, *udata.ClientSecret)
		idx++
	}
	if udata.MaxAccounts != nil && *udata.MaxAccounts > 0 {
		setClauses = append(setClauses, fmt.Sprintf("max_accounts = $%d", idx))
		args = append(args, *udata.MaxAccounts)
		idx++
	}
	if udata.IsDefault != nil {
		if *udata.IsDefault {
			_, _ = r.DB.Exec(ctx, `UPDATE oauth_connection_slots SET is_default = false WHERE org_id = $1`, orgID)
		}
		setClauses = append(setClauses, fmt.Sprintf("is_default = $%d", idx))
		args = append(args, *udata.IsDefault)
		idx++
	}

	query := fmt.Sprintf(`UPDATE oauth_connection_slots SET %s WHERE org_id = $1 AND id = $2`, strings.Join(setClauses, ", "))
	cmd, err := r.DB.Exec(ctx, query, args...)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return errors.New("slot not found")
	}
	return nil
}

func (r *oauthSlotRepository) Delete(ctx context.Context, orgID, slotID uuid.UUID) error {
	cmd, err := r.DB.Exec(ctx, `DELETE FROM oauth_connection_slots WHERE org_id = $1 AND id = $2`, orgID, slotID)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return errors.New("slot not found")
	}
	return nil
}

func (r *oauthSlotRepository) CountAccountsForSlot(ctx context.Context, slotID uuid.UUID) (int, error) {
	var count int
	err := r.DB.QueryRow(ctx, `SELECT COUNT(id) FROM email_accounts WHERE oauth_slot_id = $1`, slotID).Scan(&count)
	return count, err
}
