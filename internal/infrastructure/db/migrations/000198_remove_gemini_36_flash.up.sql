-- Update default fallback chain in org_ai_settings to exclude gemini-3.6-flash
ALTER TABLE org_ai_settings
    ALTER COLUMN gemini_fallback_chain SET DEFAULT '["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.5-flash-lite"]'::jsonb;

-- If any organization was configured with gemini-3.6-flash as primary model, revert to gemini-3.8-flash
UPDATE org_ai_settings
SET gemini_primary_model = 'gemini-3.8-flash'
WHERE gemini_primary_model = 'gemini-3.6-flash';

-- Remove gemini-3.6-flash from existing fallback chains
UPDATE org_ai_settings
SET gemini_fallback_chain = gemini_fallback_chain - 'gemini-3.6-flash'
WHERE gemini_fallback_chain ? 'gemini-3.6-flash';
