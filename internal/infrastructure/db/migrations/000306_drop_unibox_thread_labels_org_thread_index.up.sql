-- Covered by the primary key (organization_id, thread_id, category_id).
DROP INDEX IF EXISTS CONCURRENTLY IF EXISTS public.idx_unibox_thread_labels_org_thread;
