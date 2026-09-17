package repository

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
)

// Workspace warmup analytics aggregate every mailbox into one row per date.
func TestLiveWarmupAnalyticsAreOrganizationScoped(t *testing.T) {
	handle, pool := liveContactDB(t)
	ctx := context.Background()
	userID, orgID, accountID, secondAccountID := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	day := time.Date(2026, time.September, 15, 0, 0, 0, 0, time.UTC)

	exec := func(query string, args ...any) {
		t.Helper()
		if _, err := pool.Exec(ctx, query, args...); err != nil {
			t.Fatalf("fixture: %v", err)
		}
	}
	exec(`INSERT INTO users (id, first_name, last_name, email)
	      VALUES ($1, 'Warmup', 'Scope', $2)`, userID, "warmup-scope-"+uuid.NewString()+"@example.test")
	exec(`INSERT INTO organizations (id, name, owner_user_id)
	      VALUES ($1, 'Warmup scope', $2)`, orgID, userID)
	exec(`INSERT INTO email_accounts
	        (id, user_id, organization_id, email, name, signature_plain, signature_html, provider)
	      VALUES ($1, $2, $3, $4, 'Warmup scope', '', '', 'smtp_imap')`,
		accountID, userID, orgID, "warmup-scope-mailbox-"+uuid.NewString()+"@example.test")
	exec(`INSERT INTO email_accounts
	        (id, user_id, organization_id, email, name, signature_plain, signature_html, provider)
	      VALUES ($1, $2, $3, $4, 'Warmup scope second', '', '', 'smtp_imap')`,
		secondAccountID, userID, orgID, "warmup-scope-mailbox-"+uuid.NewString()+"@example.test")
	exec(`INSERT INTO warmup_statistics (email_account_id, date, emails_sent, emails_replied, target_volume)
	      VALUES ($1, $3, 8, 3, 10), ($2, $3, 5, 2, 8)`, accountID, secondAccountID, day)

	t.Cleanup(func() {
		for _, step := range []struct {
			query string
			arg   uuid.UUID
		}{
			{`DELETE FROM email_accounts WHERE organization_id = $1`, orgID},
			{`DELETE FROM organizations WHERE id = $1`, orgID},
			{`DELETE FROM users WHERE id = $1`, userID},
		} {
			if _, err := pool.Exec(context.Background(), step.query, step.arg); err != nil {
				t.Errorf("cleanup: %v", err)
			}
		}
	})

	repo := &analyticsRepository{DB: handle}
	stats, xerr := repo.GetWarmupStats(ctx, orgID, &accountID, day, day)
	if xerr != nil {
		t.Fatalf("GetWarmupStats: %v", xerr)
	}
	if len(stats) != 1 || stats[0].EmailsSent != 8 || stats[0].EmailsReplied != 3 {
		t.Fatalf("warmup stats = %+v, want the organization's 8 sends and 3 replies", stats)
	}
	stats, xerr = repo.GetWarmupStats(ctx, orgID, nil, day, day)
	if xerr != nil {
		t.Fatalf("GetWarmupStats workspace: %v", xerr)
	}
	if len(stats) != 1 || stats[0].EmailsSent != 13 || stats[0].EmailsReplied != 5 || stats[0].TargetVolume != 18 {
		t.Fatalf("workspace warmup stats = %+v, want one date with 13 sends, 5 replies, and target 18", stats)
	}
}
