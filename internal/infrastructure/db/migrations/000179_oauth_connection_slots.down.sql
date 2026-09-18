DROP INDEX IF EXISTS idx_email_accounts_oauth_slot;
ALTER TABLE email_accounts DROP COLUMN IF EXISTS oauth_slot_id;
DROP TABLE IF EXISTS oauth_connection_slots;
