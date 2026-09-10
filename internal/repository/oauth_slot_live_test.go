package repository

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/warmbly/warmbly/internal/models"
)

func TestLiveOAuthSlotsLifecycle(t *testing.T) {
	dbHandle, _ := liveContactDB(t)
	f := newSharedOrgFixture(t, dbHandle.Pool)
	ctx := context.Background()
	repo := NewOAuthSlotRepository(dbHandle)

	// 1. Create slot 1 (Google Project 1, max 2)
	slot1 := &models.OAuthConnectionSlot{
		OrgID:                 f.org,
		Provider:              "gmail",
		Name:                  "Google Project 1",
		ClientID:              "slot1-" + uuid.New().String() + ".apps.googleusercontent.com",
		EncryptedClientSecret: "encrypted-secret-1",
		MaxAccounts:           2,
		IsDefault:             true,
	}
	created1, err := repo.Create(ctx, slot1)
	if err != nil {
		t.Fatalf("create slot1: %v", err)
	}
	if created1.ID == uuid.Nil {
		t.Fatalf("expected non-nil id for slot1")
	}

	// 2. Create slot 2 (Google Project 2, max 2)
	slot2 := &models.OAuthConnectionSlot{
		OrgID:                 f.org,
		Provider:              "gmail",
		Name:                  "Google Project 2",
		ClientID:              "slot2-" + uuid.New().String() + ".apps.googleusercontent.com",
		EncryptedClientSecret: "encrypted-secret-2",
		MaxAccounts:           2,
		IsDefault:             false,
	}
	created2, err := repo.Create(ctx, slot2)
	if err != nil {
		t.Fatalf("create slot2: %v", err)
	}

	// 3. List slots
	slots, err := repo.List(ctx, f.org)
	if err != nil {
		t.Fatalf("list slots: %v", err)
	}
	if len(slots) < 2 {
		t.Fatalf("expected at least 2 slots, got %d", len(slots))
	}

	// 4. GetAvailableSlot should return slot1 (is_default = true)
	avail, err := repo.GetAvailableSlot(ctx, f.org, "gmail")
	if err != nil {
		t.Fatalf("get available slot: %v", err)
	}
	if avail.ID != created1.ID {
		t.Fatalf("expected slot1 as available, got %v", avail.ID)
	}

	// 5. Connect 2 dummy mailboxes to slot1
	mb1 := uuid.New()
	mb2 := uuid.New()
	_, err = dbHandle.Pool.Exec(ctx, `
		INSERT INTO email_accounts (id, user_id, organization_id, email, name, provider, oauth_slot_id, signature_plain, signature_html, warmup_tag, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, 'gmail', $6, '', '', '', now(), now()),
		       ($7, $2, $3, $8, $5, 'gmail', $6, '', '', '', now(), now())
	`, mb1, f.owner, f.org, "user1@test.local", "User 1", created1.ID, mb2, "user2@test.local")
	if err != nil {
		t.Fatalf("insert dummy mailboxes for slot1: %v", err)
	}

	// Count accounts for slot1
	cnt1, err := repo.CountAccountsForSlot(ctx, created1.ID)
	if err != nil || cnt1 != 2 {
		t.Fatalf("expected 2 accounts for slot1, got %d (err: %v)", cnt1, err)
	}

	// 6. GetAvailableSlot should now route to slot2 (since slot1 reached max_accounts: 2)
	avail2, err := repo.GetAvailableSlot(ctx, f.org, "gmail")
	if err != nil {
		t.Fatalf("get available slot after slot1 full: %v", err)
	}
	if avail2.ID != created2.ID {
		t.Fatalf("expected slot2 to be picked, got %v", avail2.ID)
	}

	// 7. Fill slot2 with 2 mailboxes
	mb3 := uuid.New()
	mb4 := uuid.New()
	_, err = dbHandle.Pool.Exec(ctx, `
		INSERT INTO email_accounts (id, user_id, organization_id, email, name, provider, oauth_slot_id, signature_plain, signature_html, warmup_tag, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, 'gmail', $6, '', '', '', now(), now()),
		       ($7, $2, $3, $8, $5, 'gmail', $6, '', '', '', now(), now())
	`, mb3, f.owner, f.org, "user3@test.local", "User 3", created2.ID, mb4, "user4@test.local")
	if err != nil {
		t.Fatalf("insert dummy mailboxes for slot2: %v", err)
	}

	// 8. Both slots are full (2/2 and 2/2). GetAvailableSlot should return ErrNoRows
	_, err = repo.GetAvailableSlot(ctx, f.org, "gmail")
	if !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("expected pgx.ErrNoRows when all slots full, got: %v", err)
	}

	// 9. Deleting slot1 must fail check (count > 0)
	cntDel, err := repo.CountAccountsForSlot(ctx, created1.ID)
	if err != nil || cntDel == 0 {
		t.Fatalf("expected > 0 accounts preventing deletion, got %d", cntDel)
	}

	// 10. Update slot2 capacity to 5
	newMax := 5
	newName := "Google Project 2 - Expanded"
	err = repo.Update(ctx, f.org, created2.ID, &models.UpdateOAuthConnectionSlot{
		MaxAccounts: &newMax,
		Name:        &newName,
	})
	if err != nil {
		t.Fatalf("update slot2: %v", err)
	}

	// 11. Now slot2 has room again (2/5). GetAvailableSlot should return slot2!
	avail3, err := repo.GetAvailableSlot(ctx, f.org, "gmail")
	if err != nil {
		t.Fatalf("expected slot2 to become available again, got error: %v", err)
	}
	if avail3.ID != created2.ID || avail3.Name != newName || avail3.MaxAccounts != 5 {
		t.Fatalf("unexpected slot properties: %+v", avail3)
	}

	// Clean up dummy accounts and slots
	_, _ = dbHandle.Pool.Exec(ctx, `DELETE FROM email_accounts WHERE id IN ($1, $2, $3, $4)`, mb1, mb2, mb3, mb4)
	_ = repo.Delete(ctx, f.org, created1.ID)
	_ = repo.Delete(ctx, f.org, created2.ID)
}
