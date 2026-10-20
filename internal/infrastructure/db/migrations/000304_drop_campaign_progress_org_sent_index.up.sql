-- Covered by idx_campaign_progress_sent, which a btree scan reads in either direction.
DROP INDEX IF EXISTS CONCURRENTLY IF EXISTS public.idx_campaign_progress_org_sent;
