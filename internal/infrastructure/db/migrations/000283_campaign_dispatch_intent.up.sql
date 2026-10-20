DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'campaign_dispatch_intent') THEN
        CREATE TYPE campaign_dispatch_intent AS ENUM ('unverified', 'wakeup', 'send');
    END IF;
END
$$;

ALTER TABLE campaign_tasks
    ADD COLUMN IF NOT EXISTS dispatch_intent campaign_dispatch_intent NOT NULL DEFAULT 'unverified';

CREATE OR REPLACE FUNCTION retain_campaign_dispatch_intent() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD.dispatch_intent = 'send' OR OLD.contact_id IS NOT NULL OR OLD.sequence_id IS NOT NULL THEN
            NEW.dispatch_intent := 'send';
        ELSIF OLD.dispatch_intent = 'unverified' AND NEW.dispatch_intent = 'wakeup' THEN
            NEW.dispatch_intent := 'unverified';
        END IF;
    END IF;
    IF NEW.contact_id IS NOT NULL OR NEW.sequence_id IS NOT NULL THEN
        NEW.dispatch_intent := 'send';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS campaign_dispatch_intent_monotonic ON campaign_tasks;
CREATE TRIGGER campaign_dispatch_intent_monotonic
    BEFORE INSERT OR UPDATE ON campaign_tasks
    FOR EACH ROW EXECUTE FUNCTION retain_campaign_dispatch_intent();
