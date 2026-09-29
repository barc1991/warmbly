// Shared labels and helpers for the seed panel page and its test drawer.

import { formatDistanceToNowStrict } from "date-fns";
import { he } from "date-fns/locale";
import { APIError } from "@/lib/api/client";

export function pct(rate: number | null | undefined): string {
    if (rate === null || rate === undefined || !Number.isFinite(rate)) return "—";
    return `${Math.round(rate * 100)}%`;
}

export function relative(ts: string | null | undefined, empty = "אף פעם"): string {
    if (!ts) return empty;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "—";
    return formatDistanceToNowStrict(d, { addSuffix: true, locale: he });
}

export function absolute(ts: string | null | undefined): string {
    if (!ts) return "";
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("he-IL", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        hourCycle: "h23",
    });
}

export const PANEL_LABEL: Record<string, string> = {
    instance: "מופע מקומי",
    workspace: "סביבת עבודה",
    cloud: "Warmbly Cloud",
};

export const ORIGIN_LABEL: Record<string, string> = {
    manual: "חבר סביבת עבודה",
    monitor: "ניטור אוטומטי",
    admin: "מנהל מערכת",
    remote: "מופע מקושר",
};

// The backend's `error` field is the HTTP status text; the sentence worth
// showing is `message`.
export function describeError(err: unknown): { message: string; code?: string } {
    if (err instanceof APIError) {
        const body = err.body as { message?: string } | undefined;
        return { message: body?.message || err.message, code: err.code };
    }
    return { message: err instanceof Error ? err.message : "הבקשה נכשלה" };
}
