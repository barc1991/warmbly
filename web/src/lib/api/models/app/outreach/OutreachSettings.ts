// Workspace-wide outreach controls, mirroring models.AdvancedOutreachSettings.
// PATCH /outreach/settings replaces the whole object, so an edit must send the
// blocks it is not changing back unmodified.

export interface SendTimeOptimizationSettings {
    enabled: boolean;
    use_contact_timezone: boolean;
    default_contact_timezone: string;
    preferred_hours: number[];
    weekend_weight_multiplier: number;
}

export interface PreflightSettings {
    enabled: boolean;
    check_tracking_domain: boolean;
    check_unsubscribe_header: boolean;
    check_ab_variant_configured: boolean;
    check_daily_limit: boolean;
    check_schedule_window: boolean;
    check_content_score: boolean;
    min_content_score: number;
}

// The in-body opt-out every campaign email carries unless a campaign
// overrides it. "text" is a reply-to-opt-out sentence, "link" a sentence with
// a real unsubscribe link, "off" nothing.
export type UnsubscribeMode = "text" | "link" | "off";

export interface UnsubscribeSettings {
    mode: UnsubscribeMode;
    text: string;
    link_intro: string;
    link_text: string;
}

export const DEFAULT_UNSUBSCRIBE: UnsubscribeSettings = {
    mode: "text",
    text: "אם זה לא רלוונטי, פשוט השב והודע לי ולא אפנה אליך שוב במייל.",
    link_intro: "לא האדם הנכון, או לא מעוניין?",
    link_text: "הסר אותי מרשימת התפוצה",
};

export interface OutreachSettings {
    bounce_pipeline: Record<string, unknown>;
    task_reliability: Record<string, unknown>;
    ab_testing: Record<string, unknown>;
    reply_intent: Record<string, unknown>;
    send_time_optimization: SendTimeOptimizationSettings;
    preflight: PreflightSettings;
    dashboard: Record<string, unknown>;
    unsubscribe: UnsubscribeSettings;
    custom?: Record<string, unknown>;
}

// Business hours, matching the backend default.
export const DEFAULT_PREFERRED_HOURS = [9, 10, 11, 14, 15, 16];

export function formatHour(h: number): string {
    return `${h.toString().padStart(2, "0")}:00`;
}

// Collapses a sorted hour list into "09:00-11:00, 14:00-16:00" for the summary line.
export function describeHours(hours: number[]): string {
    const sorted = [...new Set(hours)].filter((h) => h >= 0 && h <= 23).sort((a, b) => a - b);
    if (sorted.length === 0) return "לא נבחרו שעות";
    const runs: number[][] = [];
    for (const h of sorted) {
        const last = runs[runs.length - 1];
        if (last && h === last[last.length - 1] + 1) last.push(h);
        else runs.push([h]);
    }
    return runs
        .map((run) => (run.length === 1 ? formatHour(run[0]) : `${formatHour(run[0])}-${formatHour(run[run.length - 1])}`))
        .join(", ");
}
