package jobs

import (
	"context"

	"github.com/warmbly/warmbly/internal/models"
)

// HandleMailboxRename follows a folder the server renamed.
//
// A folder is keyed by name, so a rename would otherwise read as one folder
// disappearing and another appearing, which orphans every message filed under
// the old name and re-imports the folder's history under the new one. An IMAP
// RENAME keeps UIDVALIDITY and every UID, so there is nothing to re-import:
// the row and the mail both just move.
//
// The row moves first. If the mail move then fails the event is retried, and
// the second pass finds no row to rename (which is a no-op) and re-runs the
// move, so a partial apply repairs itself rather than leaving the folder
// renamed with its mail behind.
func (s *JobsService) HandleMailboxRename(ctx context.Context, e *models.JobEventMailboxRename) error {
	if e.From == "" || e.To == "" || e.From == e.To {
		return nil
	}
	if err := s.MailboxRepository.RenameMailbox(ctx, e.UserID, e.EmailID, e.From, e.To); err != nil {
		CaptureError(e.UserID, e.EmailID, err)
		return err
	}
	if err := s.UniboxRepository.MoveFolderPath(ctx, e.EmailID, e.From, e.To); err != nil {
		CaptureError(e.UserID, e.EmailID, err)
		return err
	}
	return nil
}
