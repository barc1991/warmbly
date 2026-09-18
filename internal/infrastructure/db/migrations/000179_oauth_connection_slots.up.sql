-- Multi-OAuth connection slots: allows connecting multiple Google/Outlook OAuth
-- apps per organization to scale mailboxes beyond single-app test user limits (e.g. 100 users)
-- while keeping all mailboxes, warmup, and unibox in the exact same workspace.
-- encrypted_client_secret is sealed with KeyDomainOrgDEK.
CREATE TABLE IF NOT EXISTS oauth_connection_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider VARCHAR(32) NOT NULL DEFAULT 'gmail',
    name TEXT NOT NULL,
    client_id TEXT NOT NULL,
    encrypted_client_secret TEXT NOT NULL,
    max_accounts INTEGER NOT NULL DEFAULT 100,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_connection_slots_org ON oauth_connection_slots(org_id, created_at ASC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_oauth_connection_slots_org_client_id ON oauth_connection_slots(org_id, client_id);

ALTER TABLE email_accounts
    ADD COLUMN IF NOT EXISTS oauth_slot_id UUID REFERENCES oauth_connection_slots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_accounts_oauth_slot ON email_accounts(oauth_slot_id) WHERE oauth_slot_id IS NOT NULL;
