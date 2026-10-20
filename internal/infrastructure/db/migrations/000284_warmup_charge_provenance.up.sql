ALTER TABLE warmup_tasks
    ADD COLUMN IF NOT EXISTS warmup_charged_date DATE DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS warmup_reply_charged BOOLEAN DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS warmup_refunded_at TIMESTAMPTZ DEFAULT NULL,
    DROP CONSTRAINT IF EXISTS warmup_tasks_charge_provenance,
    ADD CONSTRAINT warmup_tasks_charge_provenance CHECK (
        (warmup_charged_date IS NULL AND warmup_reply_charged IS NULL AND warmup_refunded_at IS NULL)
        OR (warmup_charged_date IS NOT NULL AND warmup_reply_charged IS NOT NULL)
    );
