ALTER TABLE public.deliverability_events
    DROP CONSTRAINT IF EXISTS deliverability_events_idempotency_unique;

ALTER TABLE public.deliverability_events
    ADD CONSTRAINT deliverability_events_idempotency_unique
    UNIQUE (idempotency_key);
