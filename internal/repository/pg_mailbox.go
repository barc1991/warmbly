package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/warmbly/warmbly/internal/infrastructure/db"
	"github.com/warmbly/warmbly/internal/models"
)

// MailboxRepository stores an account's folder rows. A folder is keyed by its
// name, which IMAP guarantees is unique per account; uid_validity rides along
// as the validity marker for the UIDs the cursor holds.
type MailboxRepository interface {
	CreateEntry(ctx context.Context, userId, emailId uuid.UUID, mb *models.Mailbox) error
	GetMailbox(ctx context.Context, userId, emailId uuid.UUID, name string) (*models.Mailbox, error)
	ListMailboxes(ctx context.Context, userId, emailId uuid.UUID) ([]models.Mailbox, error)
	DeleteMailbox(ctx context.Context, userId, emailId uuid.UUID, name string) error
	// DeleteMailboxByUIDValidity retires a folder a worker named only by its
	// UIDVALIDITY, which is what a worker deployed before the name became the
	// identity sends. Nothing else should reach for it.
	DeleteMailboxByUIDValidity(ctx context.Context, userId, emailId uuid.UUID, uidValidity uint32) error
	// RenameMailbox moves a folder row to a new name. The mail filed under
	// the old one is moved by the caller in the same handler.
	RenameMailbox(ctx context.Context, userId, emailId uuid.UUID, from, to string) error
}

type mailboxRepository struct {
	db *db.DB
}

func NewMailboxRepository(db *db.DB) MailboxRepository {
	return &mailboxRepository{db: db}
}

func (r *mailboxRepository) CreateEntry(ctx context.Context, userId, emailId uuid.UUID, mb *models.Mailbox) error {
	mb.UpdatedAt = time.Now()

	query := `
		INSERT INTO unibox_mailboxes (email_id, uid_validity, mailbox, attributes, highestmodseq, uid_next, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (email_id, mailbox) DO UPDATE SET
			uid_validity = EXCLUDED.uid_validity,
			attributes = EXCLUDED.attributes,
			highestmodseq = EXCLUDED.highestmodseq,
			uid_next = EXCLUDED.uid_next,
			updated_at = EXCLUDED.updated_at
	`

	// attributes is NOT NULL; a nil slice binds as SQL NULL. See textArray.
	_, err := r.db.Exec(ctx, query,
		emailId, mb.UIDValidity, mb.Name, textArray(mb.Attrs), mb.HighestModSeq, mb.UIDNext, mb.UpdatedAt,
	)
	return err
}

func (r *mailboxRepository) GetMailbox(ctx context.Context, userId, emailId uuid.UUID, name string) (*models.Mailbox, error) {
	query := `
		SELECT mailbox, attributes, uid_validity, highestmodseq, uid_next, updated_at
		FROM unibox_mailboxes
		WHERE email_id = $1 AND mailbox = $2
	`

	var mb models.Mailbox
	err := r.db.QueryRow(ctx, query, emailId, name).Scan(
		&mb.Name, &mb.Attrs, &mb.UIDValidity, &mb.HighestModSeq, &mb.UIDNext, &mb.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return &mb, nil
}

func (r *mailboxRepository) ListMailboxes(ctx context.Context, userId, emailId uuid.UUID) ([]models.Mailbox, error) {
	query := `
		SELECT mailbox, attributes, uid_validity, highestmodseq, uid_next, updated_at
		FROM unibox_mailboxes
		WHERE email_id = $1
	`

	rows, err := r.db.Query(ctx, query, emailId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var mailboxes []models.Mailbox
	for rows.Next() {
		var mb models.Mailbox
		if err := rows.Scan(&mb.Name, &mb.Attrs, &mb.UIDValidity, &mb.HighestModSeq, &mb.UIDNext, &mb.UpdatedAt); err != nil {
			return nil, err
		}
		mailboxes = append(mailboxes, mb)
	}

	return mailboxes, nil
}

func (r *mailboxRepository) DeleteMailbox(ctx context.Context, userId, emailId uuid.UUID, name string) error {
	_, err := r.db.Exec(ctx,
		`DELETE FROM unibox_mailboxes WHERE email_id = $1 AND mailbox = $2`,
		emailId, name,
	)
	return err
}

func (r *mailboxRepository) DeleteMailboxByUIDValidity(ctx context.Context, userId, emailId uuid.UUID, uidValidity uint32) error {
	_, err := r.db.Exec(ctx,
		`DELETE FROM unibox_mailboxes WHERE email_id = $1 AND uid_validity = $2`,
		emailId, uidValidity,
	)
	return err
}

// RenameMailbox is an update, not a delete and an insert, so the row keeps the
// cursor it holds: an IMAP RENAME leaves UIDVALIDITY and every UID alone, and
// re-baselining the folder would re-import its history for a change of label.
//
// A name the account already has means the listing showed us both at once,
// which is not a rename. Leave the row alone and let the ordinary insert and
// delete paths sort it out.
func (r *mailboxRepository) RenameMailbox(ctx context.Context, userId, emailId uuid.UUID, from, to string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE unibox_mailboxes SET mailbox = $3, updated_at = NOW()
		 WHERE email_id = $1 AND mailbox = $2
		   AND NOT EXISTS (SELECT 1 FROM unibox_mailboxes o WHERE o.email_id = $1 AND o.mailbox = $3)`,
		emailId, from, to,
	)
	return err
}
