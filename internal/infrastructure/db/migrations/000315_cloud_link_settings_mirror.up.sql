-- When this instance last mirrored the warmup settings Warmbly Cloud reported for the mailbox.
ALTER TABLE public.cloud_link_mailboxes
    ADD COLUMN IF NOT EXISTS settings_observed_at timestamptz;
