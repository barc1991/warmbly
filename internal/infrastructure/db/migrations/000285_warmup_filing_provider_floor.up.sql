ALTER TABLE warmup_pending_filings ADD COLUMN IF NOT EXISTS provider_retry_at TIMESTAMPTZ;
