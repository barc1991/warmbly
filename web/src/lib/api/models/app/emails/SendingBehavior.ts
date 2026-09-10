// Per-mailbox human sending behaviour (mirrors the Go models).
//
// Every minute-of-day value is minutes since LOCAL midnight in the mailbox's
// own timezone. The profile holds RANGES; the plan holds the values a mailbox
// actually rolled for one day.

export default interface SendingBehavior {
    email_account_id: string;
    enabled: boolean;

    daily_limit_min: number;
    daily_limit_max: number;

    hourly_limit_min: number;
    hourly_limit_max: number;

    gap_min_seconds: number;
    gap_max_seconds: number;

    work_start_min: number;
    work_start_max: number;
    work_end_min: number;
    work_end_max: number;

    lunch_enabled: boolean;
    lunch_earliest: number;
    lunch_latest: number;
    lunch_min_minutes: number;
    lunch_max_minutes: number;

    // Monday-indexed bitmask: bit 0 = Monday .. bit 6 = Sunday.
    weekdays: number;

    timezone?: string;

    created_at: string;
    updated_at: string;
}

export type SendingBehaviorPatch = Partial<Omit<SendingBehavior, "email_account_id" | "timezone" | "created_at" | "updated_at">>;

export interface DailyPlan {
    email_account_id: string;
    plan_date: string;
    timezone: string;
    is_working_day: boolean;
    daily_limit: number;
    hourly_limit: number;
    work_start_minute: number;
    work_end_minute: number;
    lunch_start_minute: number | null;
    lunch_end_minute: number | null;
    gap_min_seconds: number;
    gap_max_seconds: number;
    created_at: string;
}

export interface DailyPlanView extends DailyPlan {
    sent_today: number;
    remaining_today: number;
    behavior: SendingBehavior;
}

// The defaults the backend substitutes for a mailbox that has never been
// configured. Mirrored here so the editor can render before the first fetch
// resolves, and so "reset to defaults" needs no round trip.
export const DEFAULT_SENDING_BEHAVIOR: SendingBehaviorPatch = {
    enabled: false,
    daily_limit_min: 30,
    daily_limit_max: 45,
    hourly_limit_min: 5,
    hourly_limit_max: 9,
    gap_min_seconds: 90,
    gap_max_seconds: 420,
    work_start_min: 543,
    work_start_max: 567,
    work_end_min: 1038,
    work_end_max: 1076,
    lunch_enabled: true,
    lunch_earliest: 720,
    lunch_latest: 810,
    lunch_min_minutes: 30,
    lunch_max_minutes: 60,
    weekdays: 31,
};

// Monday-first labels, matching the campaign schedule grid.
export const WEEKDAY_LABELS = ["שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת", "ראשון"] as const;

/** Renders minutes-since-midnight as a 24h clock string. */
export function minutesToClock(minutes: number): string {
    const m = Math.max(0, Math.min(1439, Math.round(minutes)));
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Parses "HH:MM" into minutes since midnight; returns null when unparseable. */
export function clockToMinutes(value: string): number | null {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
    if (!match) return null;
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
}

/** "1m 30s" style rendering for a gap expressed in seconds. */
export function secondsToLabel(seconds: number): string {
    if (seconds < 60) return `${seconds} שנ'`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s === 0 ? `${m} דק'` : `${m} דק' ${s} שנ'`;
}

/**
 * The client-side mirror of the backend's validation, so the editor can block
 * a save with a field-level message instead of round-tripping for a 400.
 * Returns null when the profile is valid.
 */
export function validateSendingBehavior(b: SendingBehavior): string | null {
    if (b.daily_limit_min < 1 || b.daily_limit_max > 500) return "נפח השליחה היומי חייב להיות בין 1 ל-500 אימיילים.";
    if (b.daily_limit_min > b.daily_limit_max) return "המינימום היומי אינו יכול לעלות על המקסימום.";
    if (b.hourly_limit_min < 1 || b.hourly_limit_max > 200) return "נפח השליחה השעתי חייב להיות בין 1 ל-200 אימיילים.";
    if (b.hourly_limit_min > b.hourly_limit_max) return "המינימום השעתי אינו יכול לעלות על המקסימום.";
    if (b.gap_min_seconds < 30 || b.gap_max_seconds > 86400) return "ההשהיה בין אימיילים חייבת להיות בין 30 שניות ל-24 שעות.";
    if (b.gap_min_seconds > b.gap_max_seconds) return "ההשהיה הקצרה ביותר אינה יכולה לעלות על הארוכה ביותר.";
    if (b.work_start_min > b.work_start_max) return "שעת ההתחלה המוקדמת אינה יכולה להיות אחרי שעת ההתחלה המאוחרת.";
    if (b.work_end_min > b.work_end_max) return "שעת הסיום המוקדמת אינה יכולה להיות אחרי שעת הסיום המאוחרת.";
    if (b.work_start_max >= b.work_end_min) return "יום העבודה חייב להסתיים לאחר שעת ההתחלה המאוחרת ביותר.";
    if (b.lunch_earliest > b.lunch_latest) return "חלון הפסקת הצהריים הפוך.";
    if (b.lunch_min_minutes > b.lunch_max_minutes) return "משך ההפסקה הקצר ביותר אינו יכול לעלות על הארוך ביותר.";
    if (b.lunch_max_minutes > 240) return "הפסקה אינה יכולה להימשך מעל 4 שעות.";
    if (b.lunch_enabled && (b.lunch_earliest < b.work_start_max || b.lunch_latest + b.lunch_max_minutes > b.work_end_min)) {
        return "ההפסקה חייבת להתאים לתוך יום העבודה הקצר ביותר.";
    }
    if (b.enabled && b.weekdays === 0) return "יש לבחור לפחות יום שליחה אחד.";
    return null;
}
