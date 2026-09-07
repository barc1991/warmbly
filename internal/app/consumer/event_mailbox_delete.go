package jobs

import (
	"context"

	"github.com/warmbly/warmbly/internal/models"
)

// HandleMailboxDelete retires a folder the last listing no longer had.
//
// A folder is identified by its name. UIDValidity is the fallback for an
// event from a worker deployed before that was true, which names no folder at
// all; deleting by it after the change would be wrong, because the number is
// not unique across folders.
func (s *JobsService) HandleMailboxDelete(ctx context.Context, e *models.JobEventMailboxDelete) error {
	var err error
	if e.Mailbox != "" {
		err = s.MailboxRepository.DeleteMailbox(ctx, e.UserID, e.EmailID, e.Mailbox)
	} else {
		err = s.MailboxRepository.DeleteMailboxByUIDValidity(ctx, e.UserID, e.EmailID, e.UIDValidity)
	}
	if err != nil {
		CaptureError(e.UserID, e.EmailID, err)
		return err
	}

	return nil
}
