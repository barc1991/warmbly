// Shared vocabulary for placement batches: status labels and tones, the
// summary lines, and the messages for every refusal the batch endpoints return.
import type { AppError } from "@/lib/api/client/normalizeError";
import type { DitherTone } from "@/components/ui/dither";
import type {
    PlacementBatch,
    PlacementBatchProgress,
    PlacementBatchSenderStatus,
    PlacementBatchStatus,
    PlacementPanel,
} from "@/lib/api/models/app/placement/Placement";
import { placementErrorMessage } from "../tests/placementTests";

// Mirrors config.PlacementBatchRetryDays.
export const BATCH_RETRY_DAYS = 7;
// Mirrors config.PlacementBatchOpenPerOrgMax.
export const BATCH_OPEN_MAX = 5;

export const BATCH_STATUS: Record<PlacementBatchStatus, { label: string; chip: string; dot: string }> = {
    queued: { label: "בתור", chip: "bg-white text-slate-600 border-slate-200", dot: "bg-slate-400" },
    running: { label: "פועל", chip: "bg-sky-50 text-sky-700 border-sky-200", dot: "bg-sky-500 animate-pulse" },
    completed: { label: "הושלם", chip: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
    completed_with_warnings: {
        label: "הושלם עם אזהרות",
        chip: "bg-amber-50 text-amber-700 border-amber-200",
        dot: "bg-amber-500",
    },
    cancelled: { label: "בוטל", chip: "bg-slate-50 text-slate-600 border-slate-200", dot: "bg-slate-400" },
    failed: { label: "נכשל", chip: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
};

export const SENDER_STATUS: Record<PlacementBatchSenderStatus, { label: string; chip: string; dot: string }> = {
    queued: { label: "בתור", chip: "bg-white text-slate-500 border-slate-200", dot: "bg-slate-300" },
    deferred: { label: "נדחה", chip: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-400" },
    running: { label: "שולח", chip: "bg-sky-50 text-sky-700 border-sky-200", dot: "bg-sky-500 animate-pulse" },
    completed: { label: "נבדק", chip: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
    skipped: { label: "דולג", chip: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
    failed: { label: "נכשל", chip: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
    cancelled: { label: "בוטל", chip: "bg-slate-50 text-slate-500 border-slate-200", dot: "bg-slate-300" },
};

// Short labels for why a sender was skipped or deferred; `detail` has the sentence.
export const SENDER_REASON: Record<string, string> = {
    placement_daily_budget: "הגיע למגבלה היומית",
    placement_sender_busy: "שולח בדיקה אחרת",
    placement_sender_unavailable: "לא מחובר",
    placement_invalid_seeds: "בחירת תיבות הבדיקה אינה תקפה עוד",
    placement_no_seeds: "אין תיבת בדיקה נגישה",
    placement_sender_deleted: "תיבת הדואר נמחקה",
    placement_batch_retry_expired: "חלון הניסיונות החוזרים הסתיים",
    placement_batch_start_failed: "ההפעלה נכשלה",
    placement_batch_copy_unavailable: "תוכן האימייל אינו זמין עוד",
    placement_quota_exceeded: "מכסת הבדיקות החודשית מוצתה",
    insufficient_credits: "יתרת קרדיטים לא מספקת",
    usage_cap_exceeded: "הגיע למגבלת ההוצאה",
};

export function batchOpen(status: PlacementBatchStatus): boolean {
    return status === "queued" || status === "running";
}

// Progress parts in display order, with the tone each takes in the bar.
const PROGRESS_PARTS: { key: keyof Omit<PlacementBatchProgress, "total">; label: string; tone: DitherTone }[] = [
    { key: "completed", label: "נבדקו", tone: "emerald" },
    { key: "running", label: "שולחים", tone: "sky" },
    { key: "queued", label: "בתור", tone: "slate" },
    { key: "deferred", label: "נדחו", tone: "amber" },
    { key: "skipped", label: "דולגו", tone: "amber" },
    { key: "failed", label: "נכשלו", tone: "rose" },
    { key: "cancelled", label: "בוטלו", tone: "slate" },
];

/** "120 נבדקו · 20 שולחים · 5 דולגו", only the parts that are not zero. */
export function progressLine(p: PlacementBatchProgress): string {
    return PROGRESS_PARTS.filter((part) => p[part.key] > 0)
        .map((part) => `${p[part.key].toLocaleString()} ${part.label}`)
        .join(" · ");
}

/** Bar segments for senders that are done one way or another, or sending. */
export function progressSegments(p: PlacementBatchProgress): { frac: number; tone: DitherTone }[] {
    const denom = Math.max(1, p.total);
    return PROGRESS_PARTS.filter((part) => part.key !== "queued" && part.key !== "deferred" && p[part.key] > 0).map((part) => ({
        frac: p[part.key] / denom,
        tone: part.tone,
    }));
}

/** Senders that have finished one way or another. */
export function doneCount(p: PlacementBatchProgress): number {
    return p.completed + p.skipped + p.failed + p.cancelled;
}

/** "שולחי הקמפיין · מדגם של 10%". */
export function scopeSummary(b: Pick<PlacementBatch, "selection">): string {
    const { selection } = b;
    const parts: string[] = [];
    const scope = selection.sender_scope;
    if (selection.sender_account_ids) {
        parts.push(`${selection.sender_account_ids.toLocaleString()} תיבות דואר שנבחרו`);
    } else if (scope?.type === "campaign") {
        parts.push("שולחי הקמפיין");
    } else if (scope) {
        parts.push("כל תיבות הדואר");
    }
    if (scope?.untested_days) parts.push(`לא נבדקו ${scope.untested_days} ימים`);
    const s = selection.sample;
    switch (s?.mode) {
        case "random":
            parts.push(`מדגם אקראי של ${(s.count ?? 0).toLocaleString()}`);
            break;
        case "percent":
            parts.push(`מדגם של ${s.percent ?? 0}%`);
            break;
        case "per_domain":
            parts.push(`${s.count ?? 0} לכל דומיין`);
            break;
        case "per_provider":
            parts.push(`${s.count ?? 0} לכל ספק`);
            break;
    }
    return parts.join(" · ");
}

/** "כ-2 שעות", "כ-25 דקות", "פחות מ-2 דקות". */
export function fmtDuration(seconds: number): string {
    if (seconds < 90) return "פחות מ-2 דקות";
    const minutes = Math.round(seconds / 60);
    if (minutes < 90) return `כ-${minutes} דקות`;
    const hours = Math.round(minutes / 60);
    if (hours < 36) return `כ-${hours} שעות`;
    const days = Math.round(hours / 24);
    return `כ-${days} ימים`;
}

// Which step of the new-batch dialog a refusal is about, so it shows there.
export type BatchErrorField = "senders" | "email" | "review" | "general";

export function batchErrorMessage(
    err: AppError,
    ctx: { resetsOn?: Date | null; panel?: PlacementPanel } = {},
): { field: BatchErrorField; message: string } {
    switch (err?.code) {
        case "placement_batch_empty":
            return { field: "senders", message: "אין תיבת דואר שולחת התואמת לבחירה זו. הרחב את הסינונים או בחר תיבות אחרות." };
        case "placement_batch_too_large":
            return { field: "senders", message: err.message || "אצווה זו כוללת יותר שולחים מהמותר במופע זה. צמצם את הבחירה או קח מדגם." };
        case "placement_too_many_batches":
            return {
                field: "general",
                message: `${BATCH_OPEN_MAX} אצוות כבר רצות בסביבת עבודה זו. המתן לסיום אחת מהן או בטל אצווה קיימת.`,
            };
        case "placement_quota_exceeded":
            return {
                field: "review",
                message: "בדיקות ה-Placement החינמיות של החודש אינן מכסות אצווה זו. בחר מדגם קטן יותר או השתמש בתיבות בדיקה משלך.",
            };
        case "insufficient_credits":
            return { field: "review", message: "אין מספיק קרדיטים בסביבת העבודה עבור אצווה זו. טען קרדיטים בהגדרות > חיוב או בחר מדגם קטן יותר." };
        case "usage_cap_exceeded":
            return { field: "review", message: "אצווה זו תחרוג ממגבלת ההוצאה שהוגדרה. מנהל מערכת יכול להעלות את המגבלה בהגדרות > חיוב." };
        case "placement_no_seeds":
            return {
                field: "email",
                message:
                    ctx.panel === "workspace"
                        ? "אף אחת מתיבות הבדיקה שלך אינה יכולה לקבל אצווה זו. הוסף תיבת בדיקה, או נקה את הבחירה."
                        : "בפאנל זה אין תיבת בדיקה ששולחים אלה יכולים להגיע אליה.",
            };
    }
    const single = placementErrorMessage(err, { resetsOn: ctx.resetsOn, panel: ctx.panel });
    switch (single.field) {
        case "sender":
            return { field: "senders", message: single.message };
        case "source":
        case "tracking":
        case "panel":
            return { field: "email", message: single.message };
        default:
            return { field: "general", message: single.message };
    }
}
