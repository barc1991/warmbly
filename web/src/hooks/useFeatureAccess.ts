// useFeatureAccess — single source of truth for "can this org do X".
import { useAppStore } from "@/stores";
import { PERMISSION_BITS, hasPermission } from "@/lib/permissions";
import type { PlanID } from "@/lib/plans";

export type Plan = PlanID;

export interface FeatureAccess {
    loading: boolean;
    status?: "active" | "canceled" | "past_due" | "trialing" | "incomplete";
    plan: PlanID;
    /** False on a deployment running without a billing provider: every gate
     *  below is open and billing/referral surfaces do not apply. */
    billing: boolean;
    /** Active subscription on any paid tier. */
    paid: boolean;
    /** Hosted workspace without a subscription: only mailboxes, the Warmbly
     *  Cloud link and settings are open; everything else waits for a plan. */
    locked: boolean;
    /** Unified inbox — free trial and Starter+. */
    hasInbox: boolean;
    /** Advanced outreach (AB tests, custom rules) — Business+. */
    hasAdvanced: boolean;
    /** Sending on infrastructure bound to this org alone — Business+. */
    hasIsolatedSending: boolean;
    /** Realtime websocket events — every tier, baseline. */
    hasRealtime: boolean;
    /** Bulk import/edit on contacts — Starter+. */
    hasBulkOps: boolean;
    /** Team invitations — Starter+. */
    hasTeam: boolean;
    /** Webhook endpoints — Business+. */
    hasWebhooks: boolean;
    /** Convenience: viewer is the current org's owner. */
    isOwner: boolean;
    /** Owner OR admin. */
    canManage: boolean;
}

export default function useFeatureAccess(): FeatureAccess {
    const currentOrg = useAppStore((s) => s.currentOrganization);

    const isOwner = currentOrg?.role === "owner" || !currentOrg;
    const canManage =
        isOwner ||
        currentOrg?.role === "admin" ||
        hasPermission(currentOrg?.permissions, PERMISSION_BITS.MANAGE_TEAM);

    return {
        loading: false,
        status: "active",
        plan: "enterprise",
        billing: false,
        paid: true,
        locked: false,
        hasInbox: true,
        hasAdvanced: true,
        hasIsolatedSending: true,
        hasRealtime: true,
        hasBulkOps: true,
        hasTeam: true,
        hasWebhooks: true,
        isOwner,
        canManage,
    };
}
