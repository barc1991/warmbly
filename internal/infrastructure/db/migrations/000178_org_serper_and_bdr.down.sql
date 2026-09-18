ALTER TABLE ai_thread_drafts
    DROP COLUMN IF EXISTS signature_data,
    DROP COLUMN IF EXISTS research_notes;

ALTER TABLE org_ai_settings
    DROP COLUMN IF EXISTS signature_extraction_enabled,
    DROP COLUMN IF EXISTS first_reply_website_crawl,
    DROP COLUMN IF EXISTS inbox_auto_send_min_confidence,
    DROP COLUMN IF EXISTS inbox_auto_send_enabled;

DROP TABLE IF EXISTS org_serper_cache;
DROP TABLE IF EXISTS org_serper_keys;
