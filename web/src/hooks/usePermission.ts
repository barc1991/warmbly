import { useCallback } from "react";
import { useAppStore } from "@/stores";
import { hasPermission, PERMISSION_BITS } from "@/lib/permissions";

export type PermissionKey = keyof typeof PERMISSION_BITS;

// usePermission reports whether the current member holds a permission in the
// active workspace. The owner always passes. Returns true while permissions
// are still unknown (undefined) so pages don't flash a denial during load.
export function usePermission(key: PermissionKey): boolean {
    const org = useAppStore((s) => s.currentOrganization);
    return orgHasPermission(org, key);
}

// checkPermission is the non-hook variant for event handlers (keyboard
// shortcuts, store actions) — same semantics as usePermission.
export function checkPermission(key: PermissionKey): boolean {
    return orgHasPermission(useAppStore.getState().currentOrganization, key);
}

function orgHasPermission(
    org: { role?: string; permissions?: number } | null | undefined,
    key: PermissionKey,
): boolean {
    if (!org) return true; // no org context yet — don't gate prematurely
    if (org.role === "owner") return true;
    if (org.permissions === undefined) return true; // unknown — assume yes until loaded
    return hasPermission(org.permissions, PERMISSION_BITS[key]);
}

// Friendly label for each permission, used in the "you don't have permission"
// popup so the message names exactly what the member is missing.
export const PERMISSION_LABELS: Record<PermissionKey, string> = {
    MANAGE_TEAM: "ניהול צוות",
    MANAGE_BILLING: "ניהול חיובים ותשלומים",
    MANAGE_CAMPAIGNS: "ניהול קמפיינים",
    MANAGE_CONTACTS: "ניהול אנשי קשר",
    MANAGE_EMAILS: "ניהול תיבות דוא״ל",
    VIEW_ANALYTICS: "צפייה בנתונים ודוחות",
    SEND_CAMPAIGNS: "שליחת קמפיינים",
    ACCESS_UNIBOX: "שימוש בתיבת דואר מאוחדת (Unibox)",
    MANAGE_SEQUENCES: "ניהול שלבים ורצפים",
    MANAGE_SETTINGS: "ניהול הגדרות",
    VIEW_CAMPAIGNS: "צפייה בקמפיינים",
    VIEW_CONTACTS: "צפייה באנשי קשר",
    TRANSFER_OWNERSHIP: "העברת בעלות על הארגון",
    MANAGE_API_KEYS: "ניהול מפתחות API",
    USE_INTEGRATIONS: "שימוש באינטגרציות",
    USE_AI: "שימוש ביכולות AI",
};

// Fire the global permission-denied popup (the same one the API client raises
// on a 403). Used to explain a blocked action proactively, before any request.
export function showPermissionDenied(key: PermissionKey) {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
        new CustomEvent("permission-denied", {
            detail: {
                message: `דרושה הרשאת "${PERMISSION_LABELS[key]}" כדי לבצע פעולה זו.`,
            },
        }),
    );
}

export interface WriteGuard {
    /** Whether the current member may perform this write. */
    allowed: boolean;
    /** Convenience: !allowed — render a lock affordance when true. */
    locked: boolean;
    /**
     * Wrap a click/submit handler. When the member lacks the permission the
     * wrapped handler swallows the event and pops the permission dialog instead
     * of running the action — so a denied edit is blocked before any request.
     */
    guard: <E extends { preventDefault?: () => void; stopPropagation?: () => void }>(
        fn?: (e: E) => void,
    ) => (e: E) => void;
}

// useWriteGuard gates a write action by permission. Use it to disable/lock an
// edit control AND to wrap its handler so clicking it (e.g. via keyboard) still
// can't perform the action — it explains the missing permission instead.
export function useWriteGuard(key: PermissionKey): WriteGuard {
    const allowed = usePermission(key);
    const guard = useCallback(
        <E extends { preventDefault?: () => void; stopPropagation?: () => void }>(
            fn?: (e: E) => void,
        ) =>
            (e: E) => {
                if (!allowed) {
                    e?.preventDefault?.();
                    e?.stopPropagation?.();
                    showPermissionDenied(key);
                    return;
                }
                fn?.(e);
            },
        [allowed, key],
    );
    return { allowed, locked: !allowed, guard };
}
