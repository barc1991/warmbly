CREATE INDEX IF NOT EXISTS CONCURRENTLY IF NOT EXISTS idx_campaign_progress_campaign
    ON public.campaign_contact_progress USING btree (campaign_id);
