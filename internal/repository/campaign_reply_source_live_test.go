package repository

import (
	"context"
	"testing"

	"github.com/google/uuid"
)

// A stored Sent row must never stamp campaign progress as replied (issue #549).
func TestLiveReplySourceUsesStoredDirectionAtTheWriteBoundary(t *testing.T) {
	_, pool := liveContactDB(t)
	f := newThreadParentFixture(t, pool)
	step := f.step(1, "Hello", true)
	parentTask := f.send(step, f.mailbox, "<opener@test.local>", "thread-1", 60)
	ctx := context.Background()

	if _, err := pool.Exec(ctx, `
		INSERT INTO campaign_contact_progress (campaign_id, contact_id, sequence_id, dispatch_task_id, sent_at)
		VALUES ($1, $2, $3, $4, NOW() - INTERVAL '1 minute')
	`, f.campaign, f.contact, step, parentTask); err != nil {
		t.Fatalf("insert progress: %v", err)
	}

	sentID := uuid.New()
	if _, err := pool.Exec(ctx, `
		INSERT INTO unibox_emails (id, user_id, email_id, folder, provider_folder)
		VALUES ($1, $2, $3, 'sent', 'sent')
	`, sentID, f.owner, f.other); err != nil {
		t.Fatalf("insert sent source: %v", err)
	}
	t.Cleanup(func() {
		if _, err := pool.Exec(context.Background(), `DELETE FROM unibox_emails WHERE id = $1`, sentID); err != nil {
			t.Errorf("cleanup sent source: %v", err)
		}
	})

	repo := NewCampaignProgressRepository(pool)
	inbound, err := repo.IsInboundReplySource(ctx, f.other, sentID)
	if err != nil {
		t.Fatalf("verify sent source: %v", err)
	}
	if inbound {
		t.Fatal("Sent-folder source was accepted as inbound")
	}
	claimed, err := repo.RecordEmailReplied(ctx, f.campaign, f.contact, step, f.other, sentID)
	if err != nil {
		t.Fatalf("record sent source: %v", err)
	}
	if claimed {
		t.Fatal("Sent-folder source claimed reply progress")
	}

	var replied bool
	if err := pool.QueryRow(ctx, `
		SELECT replied_at IS NOT NULL
		FROM campaign_contact_progress
		WHERE campaign_id = $1 AND contact_id = $2 AND sequence_id = $3
	`, f.campaign, f.contact, step).Scan(&replied); err != nil {
		t.Fatalf("read progress: %v", err)
	}
	if replied {
		t.Fatal("Sent-folder source stamped replied_at")
	}

	inboxID := uuid.New()
	if _, err := pool.Exec(ctx, `
		INSERT INTO unibox_emails (id, user_id, email_id, folder, provider_folder)
		VALUES ($1, $2, $3, 'inbox', 'inbox')
	`, inboxID, f.owner, f.mailbox); err != nil {
		t.Fatalf("insert inbound source: %v", err)
	}
	t.Cleanup(func() {
		if _, err := pool.Exec(context.Background(), `DELETE FROM unibox_emails WHERE id = $1`, inboxID); err != nil {
			t.Errorf("cleanup inbound source: %v", err)
		}
	})

	inbound, err = repo.IsInboundReplySource(ctx, f.mailbox, inboxID)
	if err != nil {
		t.Fatalf("verify inbound source: %v", err)
	}
	if !inbound {
		t.Fatal("Inbox source was rejected as outbound")
	}
	claimed, err = repo.RecordEmailReplied(ctx, f.campaign, f.contact, step, f.mailbox, inboxID)
	if err != nil {
		t.Fatalf("record inbound source: %v", err)
	}
	if !claimed {
		t.Fatal("Inbox source did not claim reply progress")
	}
	claimed, err = repo.RecordEmailReplied(ctx, f.campaign, f.contact, step, f.mailbox, inboxID)
	if err != nil {
		t.Fatalf("repeat inbound claim: %v", err)
	}
	if claimed {
		t.Fatal("Already-recorded reply was claimed twice")
	}
	if err := pool.QueryRow(ctx, `
		SELECT replied_at IS NOT NULL
		FROM campaign_contact_progress
		WHERE campaign_id = $1 AND contact_id = $2 AND sequence_id = $3
	`, f.campaign, f.contact, step).Scan(&replied); err != nil {
		t.Fatalf("read inbound progress: %v", err)
	}
	if !replied {
		t.Fatal("Inbox source did not stamp replied_at")
	}
}
