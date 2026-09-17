-- The data repair is one-way because restoring false reply markers would
-- restore issue #549. Only the processing-claim columns are reversible.
ALTER TABLE unibox_emails
    DROP COLUMN campaign_reply_processed_at,
    DROP COLUMN campaign_reply_claimed_at;
