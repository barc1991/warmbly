package advanced

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/warmbly/warmbly/internal/errx"
	"github.com/warmbly/warmbly/internal/models"
	"github.com/warmbly/warmbly/internal/repository"
)

type incomingReplyAdvancedRepo struct {
	repository.AdvancedOutreachRepository
}

func (incomingReplyAdvancedRepo) GetOutreachSettings(context.Context, uuid.UUID) (*models.AdvancedOutreachSettings, error) {
	settings := models.DefaultAdvancedOutreachSettings()
	return &settings, nil
}

func (incomingReplyAdvancedRepo) MarkVariantEvent(context.Context, uuid.UUID, uuid.UUID, string) error {
	return nil
}

func (incomingReplyAdvancedRepo) CreateReplyIntent(context.Context, *models.ReplyIntentRecord) error {
	return nil
}

type incomingReplyEmailRepo struct {
	repository.EmailRepository
	account *models.Email
}

func (r incomingReplyEmailRepo) GetByID(context.Context, uuid.UUID) (*models.Email, *errx.Error) {
	return r.account, nil
}

type incomingReplyTaskRepo struct {
	repository.TaskRepository
	task     *repository.Task
	campaign *repository.CampaignTask
}

func (r incomingReplyTaskRepo) GetTaskByMessageID(context.Context, string) (*repository.Task, error) {
	return r.task, nil
}

func (r incomingReplyTaskRepo) GetCampaignTask(context.Context, uuid.UUID) (*repository.CampaignTask, error) {
	return r.campaign, nil
}

type incomingReplyContactRepo struct {
	repository.ContactRepository
	senderContact *models.Contact
	taskContact   *models.Contact
}

func (r incomingReplyContactRepo) GetByEmailAndOrganization(context.Context, uuid.UUID, string) (*models.Contact, *errx.Error) {
	return r.senderContact, nil
}

func (r incomingReplyContactRepo) GetByID(context.Context, uuid.UUID) (*models.Contact, *errx.Error) {
	return r.taskContact, nil
}

type incomingReplyProgressRepo struct {
	repository.CampaignProgressRepository
	replied       int
	latest        *repository.CampaignSequencePair
	sourceInbound bool
}

func (r *incomingReplyProgressRepo) IsInboundReplySource(context.Context, uuid.UUID, uuid.UUID) (bool, error) {
	return r.sourceInbound, nil
}

func (r *incomingReplyProgressRepo) GetLatestCampaignSequenceForContact(context.Context, uuid.UUID) (*repository.CampaignSequencePair, error) {
	return r.latest, nil
}

func (r *incomingReplyProgressRepo) GetLatestReplyClass(context.Context, uuid.UUID, uuid.UUID) (string, error) {
	return "", nil
}

func (r *incomingReplyProgressRepo) RecordReplyClassification(context.Context, uuid.UUID, uuid.UUID, uuid.UUID, string, string, float64) error {
	return nil
}

func (r *incomingReplyProgressRepo) RecordEmailReplied(context.Context, uuid.UUID, uuid.UUID, uuid.UUID, uuid.UUID, uuid.UUID) error {
	r.replied++
	return nil
}

type incomingReplyCampaignRepo struct{ repository.CampaignRepository }

func (incomingReplyCampaignRepo) GetSequencesRoutingByCampaignID(context.Context, uuid.UUID) ([]models.Sequence, error) {
	return nil, nil
}

func newIncomingReplyService(account *models.Email, senderContact *models.Contact, taskContact uuid.UUID) (*service, *incomingReplyProgressRepo) {
	taskID, campaignID, sequenceID := uuid.New(), uuid.New(), uuid.New()
	progress := &incomingReplyProgressRepo{sourceInbound: true}
	taskContactRecord := &models.Contact{ID: taskContact, Email: "task-contact@example.test"}
	if senderContact != nil && senderContact.ID == taskContact {
		taskContactRecord = senderContact
	}
	return &service{
		repo:         incomingReplyAdvancedRepo{},
		campaignRepo: incomingReplyCampaignRepo{},
		emailRepo:    incomingReplyEmailRepo{account: account},
		taskRepo: incomingReplyTaskRepo{
			task:     &repository.Task{ID: taskID, TaskType: "campaign", EmailAccountID: account.ID},
			campaign: &repository.CampaignTask{TaskID: taskID, CampaignID: &campaignID, ContactID: &taskContact, SequenceID: &sequenceID},
		},
		contactRepo: incomingReplyContactRepo{
			senderContact: senderContact,
			taskContact:   taskContactRecord,
		},
		campaignProgressRepo: progress,
	}, progress
}

func TestMessageAddressesMailbox(t *testing.T) {
	account := &models.Email{
		Email:       "mailbox@example.test",
		SendAsEmail: "alias@example.test",
		ReplyTo:     "replies@example.test",
	}
	for _, tc := range []struct {
		name    string
		message *models.EmailMessageStoreData
		want    bool
	}{
		{name: "mailbox in to", message: &models.EmailMessageStoreData{ToAddr: []string{"Mailbox <mailbox@example.test>"}}, want: true},
		{name: "send alias in cc", message: &models.EmailMessageStoreData{CC: []string{"alias@example.test"}}, want: true},
		{name: "reply address in bcc", message: &models.EmailMessageStoreData{BCC: []string{"replies@example.test"}}, want: true},
		{name: "different recipient", message: &models.EmailMessageStoreData{ToAddr: []string{"other@example.test"}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := messageAddressesMailbox(tc.message, account); got != tc.want {
				t.Fatalf("messageAddressesMailbox() = %t, want %t", got, tc.want)
			}
		})
	}
}

func TestProcessIncomingReplyRejectsMailboxOwnSentCopy(t *testing.T) {
	orgID, accountID, contactID := uuid.New(), uuid.New(), uuid.New()
	account := &models.Email{ID: accountID, OrganizationID: &orgID, Email: "sender@example.test"}
	service, progress := newIncomingReplyService(account, nil, contactID)

	xerr := service.ProcessIncomingReply(context.Background(), accountID, &models.EmailMessageStoreData{
		EmailID:   accountID,
		Folder:    models.FolderInbox,
		FromAddr:  []string{"Sender <sender@example.test>"},
		ToAddr:    []string{"recipient@example.test"},
		InReplyTo: []string{"<opener@example.test>"},
		Subject:   "Re: Hello",
	})
	if xerr != nil {
		t.Fatal(xerr)
	}
	if progress.replied != 0 {
		t.Fatalf("RecordEmailReplied calls = %d, want 0 for the mailbox's own outbound copy", progress.replied)
	}
}

func TestProcessIncomingReplyRejectsOutboundFolder(t *testing.T) {
	for _, tc := range []struct {
		name, folder, providerFolder string
	}{
		{name: "sent", folder: models.FolderSent},
		{name: "draft", folder: models.FolderDrafts},
		{name: "provider sent", folder: models.FolderInbox, providerFolder: models.FolderSent},
	} {
		t.Run(tc.name, func(t *testing.T) {
			orgID, accountID, contactID := uuid.New(), uuid.New(), uuid.New()
			account := &models.Email{ID: accountID, OrganizationID: &orgID, Email: "sender@example.test"}
			service, progress := newIncomingReplyService(account, &models.Contact{
				ID: contactID, Email: "recipient@example.test",
			}, contactID)

			xerr := service.ProcessIncomingReply(context.Background(), accountID, &models.EmailMessageStoreData{
				EmailID:        accountID,
				Folder:         tc.folder,
				ProviderFolder: tc.providerFolder,
				FromAddr:       []string{"Recipient <recipient@example.test>"},
				ToAddr:         []string{"sender@example.test"},
				InReplyTo:      []string{"<opener@example.test>"},
				Subject:        "Re: Hello",
			})
			if xerr != nil {
				t.Fatal(xerr)
			}
			if progress.replied != 0 {
				t.Fatalf("RecordEmailReplied calls = %d, want 0 for outbound folder", progress.replied)
			}
		})
	}
}

func TestProcessIncomingReplyTrustsPersistedDirectionOverEventPayload(t *testing.T) {
	orgID, accountID, contactID := uuid.New(), uuid.New(), uuid.New()
	account := &models.Email{ID: accountID, OrganizationID: &orgID, Email: "sender@example.test"}
	service, progress := newIncomingReplyService(account, &models.Contact{
		ID: contactID, Email: "recipient@example.test",
	}, contactID)
	progress.sourceInbound = false

	xerr := service.ProcessIncomingReply(context.Background(), accountID, &models.EmailMessageStoreData{
		ID:        uuid.New(),
		EmailID:   accountID,
		Folder:    models.FolderInbox,
		FromAddr:  []string{"Recipient <recipient@example.test>"},
		ToAddr:    []string{"sender@example.test"},
		InReplyTo: []string{"<opener@example.test>"},
		Subject:   "Re: Hello",
	})
	if xerr != nil {
		t.Fatal(xerr)
	}
	if progress.replied != 0 {
		t.Fatalf("RecordEmailReplied calls = %d, want 0 when the stored source is outbound", progress.replied)
	}
}

func TestProcessIncomingReplyRequiresThreadSenderToMatchContact(t *testing.T) {
	orgID, accountID := uuid.New(), uuid.New()
	taskContactID, senderContactID := uuid.New(), uuid.New()
	account := &models.Email{ID: accountID, OrganizationID: &orgID, Email: "sender@example.test"}
	service, progress := newIncomingReplyService(account, &models.Contact{
		ID: senderContactID, Email: "other@example.test",
	}, taskContactID)
	latestCampaignID, latestSequenceID := uuid.New(), uuid.New()
	progress.latest = &repository.CampaignSequencePair{CampaignID: latestCampaignID, SequenceID: latestSequenceID}

	xerr := service.ProcessIncomingReply(context.Background(), accountID, &models.EmailMessageStoreData{
		EmailID:   accountID,
		Folder:    models.FolderInbox,
		FromAddr:  []string{"Other person <other@example.test>"},
		ToAddr:    []string{"sender@example.test"},
		InReplyTo: []string{"<opener@example.test>"},
		Subject:   "Re: Hello",
	})
	if xerr != nil {
		t.Fatal(xerr)
	}
	if progress.replied != 0 {
		t.Fatalf("RecordEmailReplied calls = %d, want 0 when the threaded sender is a different contact", progress.replied)
	}
}

func TestProcessIncomingReplyRequiresRecipientToMatchMailbox(t *testing.T) {
	orgID, accountID, contactID := uuid.New(), uuid.New(), uuid.New()
	account := &models.Email{ID: accountID, OrganizationID: &orgID, Email: "sender@example.test"}
	service, progress := newIncomingReplyService(account, &models.Contact{
		ID: contactID, Email: "recipient@example.test",
	}, contactID)

	xerr := service.ProcessIncomingReply(context.Background(), accountID, &models.EmailMessageStoreData{
		EmailID:   accountID,
		Folder:    models.FolderInbox,
		FromAddr:  []string{"Recipient <recipient@example.test>"},
		ToAddr:    []string{"someone-else@example.test"},
		InReplyTo: []string{"<opener@example.test>"},
		Subject:   "Re: Hello",
	})
	if xerr != nil {
		t.Fatal(xerr)
	}
	if progress.replied != 0 {
		t.Fatalf("RecordEmailReplied calls = %d, want 0 when the recipient is not the sending mailbox", progress.replied)
	}
}

func TestProcessIncomingReplyRequiresThreadToMatchMailbox(t *testing.T) {
	orgID, accountID, contactID := uuid.New(), uuid.New(), uuid.New()
	account := &models.Email{ID: accountID, OrganizationID: &orgID, Email: "sender@example.test"}
	service, progress := newIncomingReplyService(account, &models.Contact{
		ID: contactID, Email: "recipient@example.test",
	}, contactID)
	service.taskRepo.(incomingReplyTaskRepo).task.EmailAccountID = uuid.New()
	latestCampaignID, latestSequenceID := uuid.New(), uuid.New()
	progress.latest = &repository.CampaignSequencePair{CampaignID: latestCampaignID, SequenceID: latestSequenceID}

	xerr := service.ProcessIncomingReply(context.Background(), accountID, &models.EmailMessageStoreData{
		EmailID:   accountID,
		Folder:    models.FolderInbox,
		FromAddr:  []string{"Recipient <recipient@example.test>"},
		ToAddr:    []string{"sender@example.test"},
		InReplyTo: []string{"<opener@example.test>"},
		Subject:   "Re: Hello",
	})
	if xerr != nil {
		t.Fatal(xerr)
	}
	if progress.replied != 0 {
		t.Fatalf("RecordEmailReplied calls = %d, want 0 when the thread belongs to another mailbox", progress.replied)
	}
}

func TestProcessIncomingReplyAcceptsMatchingThreadSender(t *testing.T) {
	orgID, accountID, contactID := uuid.New(), uuid.New(), uuid.New()
	account := &models.Email{ID: accountID, OrganizationID: &orgID, Email: "sender@example.test"}
	service, progress := newIncomingReplyService(account, &models.Contact{
		ID: contactID, Email: "recipient@example.test",
	}, contactID)

	xerr := service.ProcessIncomingReply(context.Background(), accountID, &models.EmailMessageStoreData{
		EmailID:   accountID,
		Folder:    models.FolderInbox,
		FromAddr:  []string{"Recipient <recipient@example.test>"},
		ToAddr:    []string{"sender@example.test"},
		InReplyTo: []string{"<opener@example.test>"},
		Subject:   "Re: Hello",
	})
	if xerr != nil {
		t.Fatal(xerr)
	}
	if progress.replied != 1 {
		t.Fatalf("RecordEmailReplied calls = %d, want 1 for the matching contact", progress.replied)
	}
}
