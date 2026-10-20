CREATE INDEX IF NOT EXISTS CONCURRENTLY IF NOT EXISTS idx_tasks_active_by_account
    ON public.tasks (email_account_id, task_type) WHERE status = 'active';
