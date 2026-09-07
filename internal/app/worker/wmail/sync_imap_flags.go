package wmail

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/warmbly/warmbly/internal/client/smtpimap/imap"
	"github.com/warmbly/warmbly/internal/config"
	"github.com/warmbly/warmbly/internal/errx"
	"github.com/warmbly/warmbly/internal/models"
)

// reportFolderOverflow tells the user once per worker session that the
// mailbox has more folders than the sync follows. Once, not per pass: the
// condition is static until someone reorganizes their mail, and a warning a
// minute would bury every real error in the drawer.
func (w *WMail) reportFolderOverflow() {
	left := w.SmtpImapData.ImapClient.FolderOverflow()
	if left <= 0 || w.SmtpImapData.overflowReported {
		return
	}
	w.SmtpImapData.overflowReported = true
	w.CaptureError(errx.ErrMailFoldersOverflow(left))
}

// imapScanFlags mirrors read state and flag changes on a server without
// CONDSTORE, which cannot say what changed: it re-reads the flags of the
// folder's newest window and relays only the messages whose flags actually
// moved since the previous scan.
//
// It is deliberately periodic (config.ImapFlagScanInterval) rather than every
// pass: it is one FETCH per folder over up to config.ImapFlagScanWindow UIDs,
// and read state is not worth a round trip a minute per folder. New mail does
// not wait for it; that arrives through UIDNEXT on every pass.
func (w *WMail) imapScanFlags(ctx context.Context, box *models.Mailbox, stats *tickStats) *errx.MailError {
	if w.flagScan == nil {
		w.flagScan = map[uint32]*folderFlagScan{}
	}
	scan := w.flagScan[box.UIDValidity]
	now := time.Now()
	if scan != nil && now.Sub(scan.at) < config.ImapFlagScanInterval {
		return nil
	}

	from := uint32(1)
	if box.UIDNext > config.ImapFlagScanWindow {
		from = box.UIDNext - config.ImapFlagScanWindow
	}
	flags, err := w.SmtpImapData.ImapClient.FetchFlags(ctx, from)
	if err != nil {
		return err
	}

	// The first scan of a folder only records the baseline: without a
	// previous scan every message would read as changed and the whole window
	// would be relayed for nothing.
	if scan != nil {
		for uid, state := range flags {
			before, ok := scan.flags[uid]
			// Not in the previous scan means it arrived since; the UIDNEXT
			// path owns it and will store it with its flags.
			if !ok || sameFlags(before.Flags, state.Flags) {
				continue
			}
			if err := w.relayFlags(ctx, box, uid, state, stats); err != nil {
				return err
			}
			if stats.aborted {
				break
			}
		}
	}
	w.flagScan[box.UIDValidity] = &folderFlagScan{at: now, flags: flags}
	return nil
}

// relayFlags sends an UPDATE_EMAIL for one message whose flags moved. A
// message the platform does not know is skipped: it is not ours to update,
// and the message paths admit it under a budget instead.
func (w *WMail) relayFlags(ctx context.Context, box *models.Mailbox, uid uint32, state imap.FlagState, stats *tickStats) *errx.MailError {
	if state.MessageID == "" {
		return nil
	}
	internal, err := w.EmailMessageMapRepository.Get(ctx, w.UserID, w.ID, state.MessageID)
	if err != nil {
		return w.controlPlaneError(err, stats)
	}
	if internal == nil {
		return nil
	}
	internalID, perr := uuid.Parse(internal.ID)
	if perr != nil {
		return nil
	}
	if err := w.onEvent(models.JobEventTypeEmailUpdate, &models.JobEventEmailUpdate{
		UserID:  w.UserID,
		EmailID: w.ID,
		ID:      internalID,
		UID:     uid,
		Mailbox: box.UIDValidity,
		Folder:  imapCanonicalFolder(box),
		Flags:   state.Flags,
	}); err != nil {
		return w.controlPlaneError(err, stats)
	}
	return nil
}

// folderFlagScan is the previous flag snapshot of one folder, held in worker
// memory only: a replaced worker re-baselines on its first scan, which costs
// one FETCH and no wrong updates.
type folderFlagScan struct {
	at    time.Time
	flags map[uint32]imap.FlagState
}

func sameFlags(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	// Flag sets are tiny (under ten) and usually identical, so the quadratic
	// compare beats allocating a set per message per scan.
	for _, x := range a {
		found := false
		for _, y := range b {
			if x == y {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}
