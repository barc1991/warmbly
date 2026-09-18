DROP TABLE IF EXISTS org_gemini_keys;

ALTER TABLE org_ai_settings
    DROP COLUMN IF EXISTS gemini_primary_model,
    DROP COLUMN IF EXISTS gemini_fallback_enabled,
    DROP COLUMN IF EXISTS gemini_fallback_chain;
