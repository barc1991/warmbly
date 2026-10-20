ALTER TABLE send_recovery_resolutions
    ADD COLUMN IF NOT EXISTS conflicting_result_state text,
    ADD COLUMN IF NOT EXISTS recorded_locally_at timestamptz,
    ADD COLUMN IF NOT EXISTS conflict_resolved_at timestamptz,
    DROP CONSTRAINT IF EXISTS send_recovery_resolutions_evidence_type_check,
    ADD CONSTRAINT send_recovery_resolutions_evidence_type_check CHECK (evidence_type IN (
        'authentication_repaired', 'operator_provider_confirmation', 'operator_confirmed_sent',
        'operator_confirmed_not_sent', 'authoritative_result_conflict')),
    DROP CONSTRAINT IF EXISTS send_recovery_resolutions_conflicting_result_state_check,
    ADD CONSTRAINT send_recovery_resolutions_conflicting_result_state_check
        CHECK (conflicting_result_state IN ('sent', 'failed')),
    DROP CONSTRAINT IF EXISTS send_recovery_automatic_conflict_check,
    ADD CONSTRAINT send_recovery_automatic_conflict_check CHECK (
        evidence_type <> 'authoritative_result_conflict' OR (
            previous_reason = 'conflict' AND conflicting_result_state IS NOT NULL
            AND conflict_detected_at IS NOT NULL AND confirmed_result IS NULL
            AND evidence_task_id IS NULL AND confirmation_reference = ''));

DROP INDEX IF EXISTS send_recovery_unknown_resolution;
CREATE UNIQUE INDEX IF NOT EXISTS send_recovery_unknown_resolution ON send_recovery_resolutions (recovery_task_id)
    WHERE previous_reason = 'unknown' AND recorded_locally_at IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS send_recovery_native_conflict ON send_recovery_resolutions (recovery_task_id)
    WHERE evidence_type = 'authoritative_result_conflict' AND recorded_locally_at IS NOT NULL;
