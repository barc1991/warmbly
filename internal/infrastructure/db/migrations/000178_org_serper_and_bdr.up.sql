-- Org-level Serper API keys: multiple keys with rotation, 2,500-request quota tracking,
-- and 429 rate-limit cooldown handling. Encrypted with Org DEK.
CREATE TABLE IF NOT EXISTS org_serper_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    masked_key TEXT NOT NULL,
    encrypted_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'disabled', 'cooldown', 'exhausted')),
    fail_count INTEGER NOT NULL DEFAULT 0,
    request_count INTEGER NOT NULL DEFAULT 0,
    remaining_credits INTEGER NOT NULL DEFAULT 2500,
    last_used TIMESTAMPTZ,
    last_error TEXT NOT NULL DEFAULT '',
    cooldown_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_serper_keys_org ON org_serper_keys (org_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_serper_keys_org_masked ON org_serper_keys (org_id, masked_key);

-- 7-day cache for Serper queries to prevent duplicate search costs
CREATE TABLE IF NOT EXISTS org_serper_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    query_hash TEXT NOT NULL,
    query TEXT NOT NULL,
    results_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_org_serper_cache_org_hash ON org_serper_cache (org_id, query_hash);
CREATE INDEX IF NOT EXISTS idx_org_serper_cache_expires ON org_serper_cache (expires_at);

-- BDR and Autonomous Inbox settings on org_ai_settings
ALTER TABLE org_ai_settings
    ADD COLUMN IF NOT EXISTS inbox_auto_send_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS inbox_auto_send_min_confidence NUMERIC(3,2) NOT NULL DEFAULT 0.90,
    ADD COLUMN IF NOT EXISTS first_reply_website_crawl BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS signature_extraction_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Additional research notes and signature data on ai_thread_drafts
ALTER TABLE ai_thread_drafts
    ADD COLUMN IF NOT EXISTS research_notes TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS signature_data JSONB NOT NULL DEFAULT '{}'::jsonb;
