// Shared vocabulary for inbox placement tests: folder labels and tones, rate
// formatting, and the messages for every refusal the start endpoint returns.
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import type { DitherTone } from "@/components/ui/dither";
import type {
    PlacementCounts,
    PlacementFolder,
    PlacementOverview,
    PlacementPanel,
    PlacementTest,
    PlacementTestStatus,
} from "@/lib/api/models/app/placement/Placement";

export interface FolderStyle {
    label: string;
    tone: DitherTone;
    dot: string;
    text: string;
    chip: string;
}

export const FOLDER: Record<PlacementFolder, FolderStyle> = {
    inbox: { label: "דואר נכנס", tone: "emerald", dot: "bg-emerald-500", text: "text-emerald-600", chip: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    promotions: { label: "קידומי מכירות", tone: "violet", dot: "bg-violet-500", text: "text-violet-600", chip: "bg-violet-50 text-violet-700 border-violet-200" },
    other: { label: "לשונית אחרת", tone: "sky", dot: "bg-sky-500", text: "text-sky-600", chip: "bg-sky-50 text-sky-700 border-sky-200" },
    spam: { label: "ספאם", tone: "rose", dot: "bg-rose-500", text: "text-rose-600", chip: "bg-rose-50 text-rose-700 border-rose-200" },
    missing: { label: "מעולם לא הגיע", tone: "slate", dot: "bg-slate-500", text: "text-slate-600", chip: "bg-slate-100 text-slate-700 border-slate-200" },
    pending: { label: "ממתין", tone: "slate", dot: "bg-slate-300", text: "text-slate-400", chip: "bg-white text-slate-500 border-slate-200" },
    failed: { label: "לא נשלח", tone: "amber", dot: "bg-amber-500", text: "text-amber-600", chip: "bg-amber-50 text-amber-700 border-amber-200" },
    cancelled: { label: "בוטל", tone: "slate", dot: "bg-slate-300", text: "text-slate-400", chip: "bg-slate-50 text-slate-500 border-slate-200" },
};

// The folders a copy that left can land in, in the order the bars stack.
export const LANDED_FOLDERS = ["inbox", "promotions", "other", "spam", "missing"] as const;

export const STATUS: Record<PlacementTestStatus, { label: string; chip: string; dot: string }> = {
    running: { label: "פעיל", chip: "bg-sky-50 text-sky-700 border-sky-200", dot: "bg-sky-500 animate-pulse" },
    completed: { label: "הושלם", chip: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
    cancelled: { label: "בוטל", chip: "bg-slate-50 text-slate-600 border-slate-200", dot: "bg-slate-400" },
    failed: { label: "נכשל", chip: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
};

export const ORIGIN_LABEL: Record<string, string> = {
    manual: "ידני",
    monitor: "ניטור",
    admin: "מפעיל",
    remote: "מופע מקושר",
};

export const PANEL_LABEL_HE: Record<PlacementPanel, string> = {
    instance: "פאנל משותף",
    workspace: "תיבות הבדיקה שלך",
    cloud: "פאנל Warmbly Cloud",
};

export const PANEL_HINT_HE: Record<PlacementPanel, string> = {
    instance: "תיבות בדיקה משותפות לכל סביבות העבודה במופע זה.",
    workspace: "תיבות דואר לבדיקה שסביבת העבודה שלך סימנה כתיבות בדיקה.",
    cloud: "תיבות הבדיקה של Warmbly Cloud, דרך החשבון המקושר שלך.",
};

/** A 0..1 fraction as a whole percentage, or a dash while there is none. */
export function fmtRate(r: number | null | undefined): string {
    if (r == null) return "—";
    return `${Math.round(r * 100)}%`;
}

export function rateTone(r: number | null | undefined): string {
    if (r == null) return "text-slate-400";
    if (r >= 0.8) return "text-emerald-600";
    if (r >= 0.6) return "text-amber-600";
    return "text-rose-600";
}

/** Copies that have a verdict, sent or not. */
export function resolvedCount(c: PlacementCounts): number {
    return Math.max(0, c.total - c.pending);
}

export function isTracked(t: Pick<PlacementTest, "open_tracking" | "link_tracking">): boolean {
    return t.open_tracking || t.link_tracking;
}

export function fmtDate(d: Date | string | null | undefined): string {
    if (!d) return "—";
    const date = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("he-IL", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        hourCycle: "h23",
    });
}

export function fmtDay(d: Date | string | null | undefined): string {
    if (!d) return "—";
    const date = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("he-IL", { month: "short", day: "numeric" });
}

export function usageLabel(o: PlacementOverview | undefined): string {
    if (!o) return "";
    const { used, limit } = o.usage;
    if (limit == null) return "ללא הגבלה";
    return `${used} מתוך ${limit} בדיקות החודש`;
}

// Unmetered and free: tests never require credits or paywalls in this edition.
export function testCost(usage: PlacementOverview["usage"] | undefined, metered: boolean, tests: number) {
    return { paid: 0, credits: 0, payable: true, canPay: true };
}

// Which part of the new-test form a refusal is about, so it shows beside it.
export type PlacementErrorField = "sender" | "source" | "tracking" | "panel" | "general";

export function placementErrorMessage(
    err: AppError,
    ctx: { resetsOn?: Date | null; panel?: PlacementPanel; chosen?: boolean } = {},
): { field: PlacementErrorField; message: string } {
    switch (err?.code) {
        case "placement_not_entitled":
            return { field: "general", message: "בדיקות מיקום דורשות תקופת ניסיון או מנוי פעיל." };
        case "placement_quota_exceeded":
            return {
                field: "panel",
                message: `מכסת בדיקות המיקום לחודש זה נוצלה${ctx.resetsOn ? ` עד ${fmtDay(ctx.resetsOn)}` : ""}. בדיקות על תיבות הבדיקה שלך אינן נספרות במכסה.`,
            };
        case "placement_too_many_running":
            return { field: "general", message: "שלוש בדיקות כבר רצות בסביבת עבודה זו. המתן לסיום אחת מהן או בטל בדיקה פעילה." };
        case "placement_sender_busy":
            return { field: "sender", message: "תיבת דואר זו עדיין שולחת בדיקה אחרת. בחר תיבה אחרת או המתן עד שתסיים לשלוח את כל העותקים." };
        case "placement_sender_unavailable":
            return { field: "sender", message: "תיבת דואר זו אינה יכולה לשלוח בדיקה: היא אינה מחוברת, או שהיא מוגדרת כתיבת בדיקה בעצמה." };
        case "placement_daily_budget":
            return { field: "sender", message: "לתיבת דואר זו נותרה מכסה יומית מעטה מדי להיום עבור בדיקה מועילה. בחר תיבה אחרת או נסה שוב מחר." };
        case "placement_no_seeds":
            return {
                field: "panel",
                message:
                    ctx.panel === "workspace"
                        ? "אף אחת מתיבות הבדיקה שלך אינה יכולה לקבל בדיקה זו. הוסף תיבת בדיקה בדומיין שונה מזה של השולח."
                        : "בפאנל זה אין תיבת בדיקה שתיבה זו יכולה לשלוח אליה. תיבות בדיקה בדומיין של השולח עצמו מדולגות תמיד.",
            };
        case "placement_panel_unavailable":
            return { field: "panel", message: "פאנל Warmbly Cloud דורש שמופע זה יהיה מקושר אל Warmbly Cloud." };
        case "placement_invalid_tracking":
            return { field: "tracking", message: "קמפיין זה שולח טקסט רגיל בלבד, ללא מעקב. בחר כבוי או כמו בקמפיין." };
        default:
            return { field: "general", message: buildError(err) };
    }
}

export function seedBlocker(s: { blocker?: string; email: string }, senderEmail?: string): string | null {
    if (s.blocker) return s.blocker;
    if (senderEmail && s.email.toLowerCase().endsWith("@" + senderEmail.split("@")[1]?.toLowerCase())) {
        return "אותו דומיין כמו השולח";
    }
    return null;
}
