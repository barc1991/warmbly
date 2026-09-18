-- The free plan is the connect-and-see-it-work tier: mailboxes, sync and a
-- couple of small campaigns. AI is a paid feature, so the allowance goes to
-- zero and the trial grant in internal/app/trial stops firing (it only grants
-- when monthly_credits > 0).
--
-- Existing balances are deliberately left alone. Someone who already received
-- the allowance keeps what they have; taking credits back from an account that
UPDATE plans
SET monthly_credits = 1000000,
    max_contacts = 100000000,
    daily_emails = 10000000,
    ai_generation = true,
    account_limit = 0,
    max_campaigns = NULL,
    max_active_campaigns = NULL,
    max_team_members = NULL,
    max_email_accounts = NULL,
    daily_campaign_limit = NULL,
    updated_at = NOW()
WHERE id = '00000000-0000-0000-0000-000000000001';
