// /admin/fleet/* — placement as the operator sees it: every worker against
// its capacity row, the decision log the control loops write, and the
// isolated-egress reservations. Shapes mirror the fleet section of
// internal/models/admin_ops.go (snake_case, as the backend serializes them).

import { Request } from "@/lib/api/client";
import type { WorkerHealthState } from "@/lib/api/models/admin";

export interface AdminFleetWorkerRow {
    worker_id: string;
    name: string;
    ip_addr: string;
    active: boolean;
    region: string;
    health_state: WorkerHealthState;
    install_state: string;
    last_seen_at?: string | null;
    live: boolean;
    account_count: number;
    tags: string[] | null;

    load_score: number;
    base_capacity: number;
    health_multiplier: number;
    age_multiplier: number;
    effective_capacity: number;
    /** Load over effective capacity; the rotation loop calls a worker hot above 0.85. */
    utilization: number;
    sends_attempted_1h: number;
    sends_succeeded_1h: number;
    bounces_hard_1h: number;
    bounces_soft_1h: number;
    complaints_1h: number;
    auth_errors_1h: number;
}

export interface AdminFleetDecision {
    id: number;
    kind: string;
    worker_id?: string | null;
    worker_name: string;
    mailbox_id?: string | null;
    /** Raw JSON as the control loop recorded it; shape depends on `kind`. */
    before?: unknown;
    after?: unknown;
    reason: string;
    triggered_by: string;
    created_at: string;
}

export interface AdminDedicatedAssignment {
    id: string;
    worker_id: string;
    worker_name: string;
    worker_live: boolean;
    organization_id: string;
    organization_name: string;
    subscription_id: string;
    assigned_at: string;
    released_at?: string | null;
    account_count: number;
}

export interface AdminConvertDedicatedRequest {
    organization_id: string;
    subscription_id: string;
    drain_to_worker_id?: string | null;
}

export interface AdminConvertDedicatedResponse {
    ok: boolean;
    accounts_drained: number;
    new_assignment: boolean;
}

export interface AdminReleaseDedicatedResponse {
    ok: boolean;
    worker_id: string;
    accounts_remaining: number;
}

export interface FleetDecisionsParams {
    kind?: string;
    worker_id?: string;
    limit?: number;
}

export function getFleetCapacity(): Promise<{ data: AdminFleetWorkerRow[] | null }> {
    return Request({
        method: "GET",
        url: "/admin/fleet/capacity",
        authorization: true,
    });
}

export function listFleetDecisions(
    params: FleetDecisionsParams = {},
): Promise<{ data: AdminFleetDecision[] | null }> {
    const usp = new URLSearchParams();
    if (params.kind) usp.set("kind", params.kind);
    if (params.worker_id) usp.set("worker_id", params.worker_id);
    if (params.limit) usp.set("limit", String(params.limit));
    const q = usp.toString();
    return Request({
        method: "GET",
        url: `/admin/fleet/decisions${q ? `?${q}` : ""}`,
        authorization: true,
    });
}

export function listDedicatedAssignments(): Promise<{ data: AdminDedicatedAssignment[] | null }> {
    return Request({
        method: "GET",
        url: "/admin/fleet/dedicated",
        authorization: true,
    });
}

// Releases the reservation. Nothing migrates: the worker carries no category to
// reset, and the workspace's mailboxes stay put until the rotation loop finds
// them a better home on its own schedule.
export function releaseDedicatedWorker(orgId: string): Promise<AdminReleaseDedicatedResponse> {
    return Request({
        method: "POST",
        url: `/admin/fleet/dedicated/${orgId}/release`,
        authorization: true,
    });
}

// The backend refuses a worker that still carries mailboxes unless
// drain_to_worker_id names where they go first.
export function convertWorkerToDedicated(
    workerId: string,
    body: AdminConvertDedicatedRequest,
): Promise<AdminConvertDedicatedResponse> {
    return Request({
        method: "POST",
        url: `/admin/workers/${workerId}/convert-dedicated`,
        authorization: true,
        data: body,
    });
}
