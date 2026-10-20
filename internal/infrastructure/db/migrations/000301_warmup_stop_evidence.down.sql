DROP INDEX IF EXISTS warmup_tasks_target_account;
DROP INDEX IF EXISTS email_accounts_warmup_stopped;
ALTER TABLE email_accounts DROP COLUMN warmup_stopped_at;
