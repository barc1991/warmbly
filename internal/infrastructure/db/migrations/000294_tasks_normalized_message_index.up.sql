CREATE INDEX IF NOT EXISTS CONCURRENTLY IF NOT EXISTS idx_tasks_normalized_message_id
    ON public.tasks (btrim(message_id, '<>'));
