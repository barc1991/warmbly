-- Repair reply markers created when an outbound threaded follow-up was
-- consumed as though it were the contact's inbound reply (issue #549).
--
-- The match is intentionally narrow. The reply stamp must be within two
-- seconds of a Sent-folder message to that contact, the message must answer
-- the exact campaign task whose progress was stamped, its classifier must be
-- inconclusive, and no reply-intent row from the contact may exist nearby.

WITH false_replies AS (
    SELECT DISTINCT
        p.campaign_id,
        p.contact_id,
        p.sequence_id,
        p.dispatch_task_id,
        p.replied_at,
        ue.id AS source_message_id
    FROM campaign_contact_progress p
    JOIN campaigns campaign ON campaign.id = p.campaign_id
    JOIN contacts c
      ON c.id = p.contact_id
     AND c.organization_id = campaign.organization_id
    JOIN tasks parent_task ON parent_task.id = p.dispatch_task_id
    JOIN email_accounts source_account
      ON source_account.organization_id = campaign.organization_id
    JOIN unibox_emails ue
      ON ue.email_id = source_account.id
     AND (ue.folder = 'sent' OR ue.provider_folder = 'sent')
     AND p.replied_at BETWEEN ue.created_at
                          AND ue.created_at + INTERVAL '2 seconds'
     AND EXISTS (
            SELECT 1
            FROM unnest(ue.in_reply_to) AS refs(message_id)
            WHERE btrim(refs.message_id, '<> ') = btrim(parent_task.message_id, '<> ')
        )
     AND EXISTS (
            SELECT 1
            FROM unnest(ue.to_addr) AS recipients(address)
            WHERE lower(btrim(COALESCE(
                substring(recipients.address FROM '<([^>]*)>'),
                substring(recipients.address FROM '\(([^()]*)\)\s*$'),
                recipients.address
            ))) = lower(btrim(c.email))
        )
    WHERE p.replied_at IS NOT NULL
      AND p.reply_class IN ('', 'unknown')
      AND p.reply_confidence = 0
      AND p.reply_source = ''
      AND NOT EXISTS (
            SELECT 1
            FROM reply_intents ri
            WHERE ri.campaign_id = p.campaign_id
              AND lower(ri.contact_email) = lower(c.email)
              AND ri.created_at BETWEEN p.replied_at - INTERVAL '30 seconds'
                                    AND p.replied_at + INTERVAL '30 seconds'
        )
)
DELETE FROM contact_verification_evidence evidence
USING false_replies false_reply
WHERE evidence.contact_id = false_reply.contact_id
  AND evidence.kind = 'replied'
  AND evidence.ref = false_reply.source_message_id::text;

WITH false_replies AS (
    SELECT DISTINCT
        p.campaign_id,
        p.contact_id,
        p.sequence_id,
        p.dispatch_task_id,
        p.replied_at,
        ue.email_id AS source_account_id
    FROM campaign_contact_progress p
    JOIN campaigns campaign ON campaign.id = p.campaign_id
    JOIN contacts c
      ON c.id = p.contact_id
     AND c.organization_id = campaign.organization_id
    JOIN tasks parent_task ON parent_task.id = p.dispatch_task_id
    JOIN email_accounts source_account
      ON source_account.organization_id = campaign.organization_id
    JOIN unibox_emails ue
      ON ue.email_id = source_account.id
     AND (ue.folder = 'sent' OR ue.provider_folder = 'sent')
     AND p.replied_at BETWEEN ue.created_at
                          AND ue.created_at + INTERVAL '2 seconds'
     AND EXISTS (
            SELECT 1
            FROM unnest(ue.in_reply_to) AS refs(message_id)
            WHERE btrim(refs.message_id, '<> ') = btrim(parent_task.message_id, '<> ')
        )
     AND EXISTS (
            SELECT 1
            FROM unnest(ue.to_addr) AS recipients(address)
            WHERE lower(btrim(COALESCE(
                substring(recipients.address FROM '<([^>]*)>'),
                substring(recipients.address FROM '\(([^()]*)\)\s*$'),
                recipients.address
            ))) = lower(btrim(c.email))
        )
    WHERE p.replied_at IS NOT NULL
      AND p.reply_class IN ('', 'unknown')
      AND p.reply_confidence = 0
      AND p.reply_source = ''
      AND NOT EXISTS (
            SELECT 1
            FROM reply_intents ri
            WHERE ri.campaign_id = p.campaign_id
              AND lower(ri.contact_email) = lower(c.email)
              AND ri.created_at BETWEEN p.replied_at - INTERVAL '30 seconds'
                                    AND p.replied_at + INTERVAL '30 seconds'
        )
)
DELETE FROM reply_intents intent
USING false_replies false_reply, email_accounts sending_account
WHERE intent.campaign_id = false_reply.campaign_id
  AND intent.task_id = false_reply.dispatch_task_id
  AND intent.created_at BETWEEN false_reply.replied_at - INTERVAL '30 seconds'
                            AND false_reply.replied_at + INTERVAL '30 seconds'
  AND sending_account.id = false_reply.source_account_id
  AND lower(intent.contact_email) IN (
        lower(sending_account.email),
        lower(COALESCE(NULLIF(sending_account.send_as_email, ''), sending_account.email))
    );

WITH false_replies AS (
    SELECT DISTINCT
        p.campaign_id,
        p.contact_id,
        p.sequence_id
    FROM campaign_contact_progress p
    JOIN campaigns campaign ON campaign.id = p.campaign_id
    JOIN contacts c
      ON c.id = p.contact_id
     AND c.organization_id = campaign.organization_id
    JOIN tasks parent_task ON parent_task.id = p.dispatch_task_id
    JOIN email_accounts source_account
      ON source_account.organization_id = campaign.organization_id
    JOIN unibox_emails ue
      ON ue.email_id = source_account.id
     AND (ue.folder = 'sent' OR ue.provider_folder = 'sent')
     AND p.replied_at BETWEEN ue.created_at
                          AND ue.created_at + INTERVAL '2 seconds'
     AND EXISTS (
            SELECT 1
            FROM unnest(ue.in_reply_to) AS refs(message_id)
            WHERE btrim(refs.message_id, '<> ') = btrim(parent_task.message_id, '<> ')
        )
     AND EXISTS (
            SELECT 1
            FROM unnest(ue.to_addr) AS recipients(address)
            WHERE lower(btrim(COALESCE(
                substring(recipients.address FROM '<([^>]*)>'),
                substring(recipients.address FROM '\(([^()]*)\)\s*$'),
                recipients.address
            ))) = lower(btrim(c.email))
        )
    WHERE p.replied_at IS NOT NULL
      AND p.reply_class IN ('', 'unknown')
      AND p.reply_confidence = 0
      AND p.reply_source = ''
      AND NOT EXISTS (
            SELECT 1
            FROM reply_intents ri
            WHERE ri.campaign_id = p.campaign_id
              AND lower(ri.contact_email) = lower(c.email)
              AND ri.created_at BETWEEN p.replied_at - INTERVAL '30 seconds'
                                    AND p.replied_at + INTERVAL '30 seconds'
        )
), cleared AS (
    UPDATE campaign_contact_progress progress
    SET replied_at = NULL,
        reply_class = '',
        reply_confidence = 0,
        reply_source = '',
        instant_fired = array_remove(instant_fired, 'reply')
    FROM false_replies false_reply
    WHERE progress.campaign_id = false_reply.campaign_id
      AND progress.contact_id = false_reply.contact_id
      AND progress.sequence_id = false_reply.sequence_id
    RETURNING progress.campaign_id, progress.contact_id
)
UPDATE campaign_ab_assignments assignment
SET replied_at = NULL
WHERE EXISTS (
        SELECT 1
        FROM cleared
        WHERE cleared.campaign_id = assignment.campaign_id
          AND cleared.contact_id = assignment.contact_id
    )
  AND NOT EXISTS (
        SELECT 1
        FROM campaign_contact_progress progress
        WHERE progress.campaign_id = assignment.campaign_id
          AND progress.contact_id = assignment.contact_id
          AND progress.replied_at IS NOT NULL
    );
