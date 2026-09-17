-- Opt-in open/click tracking for mail written by hand in the unibox.
--
-- Campaign mail has carried a pixel and wrapped links for a long time, but a
-- direct send went out clean and left no engagement record anywhere, so the
-- only reporting a workspace had covered campaigns it might never run.
--
-- Off by default and per mailbox: a tracking pixel in a one-to-one reply is a
-- different proposition from one in a cold sequence, so it is the operator's
-- call rather than a platform default.
ALTER TABLE email_accounts
    ADD COLUMN IF NOT EXISTS track_direct_mail BOOLEAN NOT NULL DEFAULT FALSE;

-- Engagement lands on the send record itself. email_tasks is exactly the set of
-- direct sends (task_type = 'email'); campaign and warmup sends keep their own
-- tables, so there is nothing to disambiguate here.
--
-- Clicks are a count and a last-seen, not per-link rows: email_link_clicks
-- requires campaign_id, contact_id and sequence_id, none of which a direct send
-- has, and the campaign analytics queries join on all three.
ALTER TABLE email_tasks
    ADD COLUMN IF NOT EXISTS tracked BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS opened_machine BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS click_count INTEGER NOT NULL DEFAULT 0;

-- The direct-mail analytics window scans tracked sends by time. tasks holds the
-- timestamp and the mailbox, so the partial index is what keeps that join from
-- walking every task ever created.
CREATE INDEX IF NOT EXISTS idx_email_tasks_tracked
    ON email_tasks (task_id)
    WHERE tracked;
