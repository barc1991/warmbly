ALTER TABLE fleet_nodes
    ADD COLUMN IF NOT EXISTS cpu_scope text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS memory_scope text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS memory_used_mb integer,
    ADD COLUMN IF NOT EXISTS memory_limit_mb integer,
    ADD COLUMN IF NOT EXISTS resident_mb integer;
