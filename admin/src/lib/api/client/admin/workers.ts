// /admin/workers/* — what a worker is carrying.
//
// The machine half of a worker (liveness, version, usage, enrolment) lives in
// the fleet node API instead; see ./fleetNodes.ts. There is nothing here that
// reaches into a machine, because nothing does any more.

import { Request } from "@/lib/api/client";
import type { AdminWorkerEmailsResult } from "@/lib/api/models/admin";

// getWorkerEmails returns the mailboxes assigned to a worker (paginated), with
// per-mailbox risk band + warmup health so the detail page can show how healthy
// the inboxes on this worker are.
export function getWorkerEmails(
    id: string,
    cursor?: string,
): Promise<AdminWorkerEmailsResult> {
    const q = cursor ? `?cursor=${cursor}` : "";
    return Request({
        method: "GET",
        url: `/admin/workers/${id}/emails${q}`,
        authorization: true,
    });
}

export interface WorkerStats {
    emails_sent_today: number;
    emails_sent_total: number;
    active_campaigns: number;
    connected_emails: number;
    warmup_emails: number;
}

export function getWorkerStats(id: string): Promise<WorkerStats> {
    return Request({
        method: "GET",
        url: `/admin/workers/${id}/stats`,
        authorization: true,
    });
}

// Moves mailboxes onto the worker in the URL. Placement would get there on its
// own, so this is for when you know something it does not; the rotation loop
// will move them again if it disagrees once their residency window passes.
export function reassignWorkerEmails(
    targetWorkerId: string,
    emailIds: string[],
): Promise<{ ok: boolean }> {
    return Request({
        method: "POST",
        url: `/admin/workers/${targetWorkerId}/reassign`,
        data: { email_ids: emailIds },
        authorization: true,
    });
}

export function setWorkerTags(id: string, tags: string[]): Promise<{ ok: boolean; tags: string[] }> {
    return Request({
        method: "PUT",
        url: `/admin/workers/${id}/tags`,
        data: { tags },
        authorization: true,
    });
}

export function listWorkerTags(): Promise<{ data: string[] }> {
    return Request({ method: "GET", url: "/admin/workers/tags", authorization: true });
}
