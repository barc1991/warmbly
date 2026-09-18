-- Org-level Gemini API keys: multiple keys per workspace with smart rotation,
-- cooldown tracking on rate limits (429/quota), and error classification.
-- encrypted_key is sealed with the per-organization DEK (KeyDomainOrgDEK).
CREATE TABLE IF NOT EXISTS org_gemini_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    masked_key TEXT NOT NULL,
    encrypted_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'disabled', 'cooldown')),
    fail_count INTEGER NOT NULL DEFAULT 0,
    request_count INTEGER NOT NULL DEFAULT 0,
    last_used TIMESTAMPTZ,
    last_error TEXT NOT NULL DEFAULT '',
    cooldown_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_gemini_keys_org ON org_gemini_keys (org_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_gemini_keys_org_masked ON org_gemini_keys (org_id, masked_key);

-- Model selection and smart fallback chain configuration in org_ai_settings
ALTER TABLE org_ai_settings
    ADD COLUMN IF NOT EXISTS gemini_primary_model TEXT NOT NULL DEFAULT 'gemini-3.8-flash',
    ADD COLUMN IF NOT EXISTS gemini_fallback_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS gemini_fallback_chain JSONB NOT NULL DEFAULT '["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"]'::jsonb;
