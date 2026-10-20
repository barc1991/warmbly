ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS dispatch_retry_at timestamptz,
    ADD COLUMN IF NOT EXISTS dispatch_failure_since timestamptz,
    ADD COLUMN IF NOT EXISTS dispatch_failure_at timestamptz;

CREATE INDEX IF NOT EXISTS tasks_pending_dispatch_due ON tasks
    (GREATEST(scheduled_at, COALESCE(dispatch_retry_at, scheduled_at)), id)
    WHERE status = 'pending';
