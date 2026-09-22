ALTER TABLE org_ai_settings
    ALTER COLUMN gemini_fallback_chain SET DEFAULT '["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"]'::jsonb;
