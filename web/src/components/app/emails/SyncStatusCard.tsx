import { motion } from "framer-motion";
import { CheckCircle2Icon, DownloadIcon, HourglassIcon, RefreshCwIcon } from "lucide-react";
import useSync from "@/lib/api/hooks/app/emails/useSync";
import type { SyncThrottleReason } from "@/lib/api/models/app/emails/SyncState";
import { cn } from "@/lib/utils";

// Sync card in the mailbox drawer: what the initial import has done, whether
// fair use is holding new mail, and when the last pass ran.

const REASON_COPY: Record<SyncThrottleReason, string> = {
    burst: "הגיע נפח דואר גדול בבת אחת",
    hourly: "הושגה המגבלה השעתית לתיבת דואר זו",
    daily: "הושגה המגבלה היומית לתיבת דואר זו",
    org_daily: "הושגה המגבלה היומית של סביבת העבודה",
    priority_daily: "הושגה המגבלה היומית למענות",
};

function relative(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.round(diff / 60_000);
    if (m < 1) return "ממש עכשיו";
    if (m < 60) return `לפני ${m} דק'`;
    const h = Math.round(m / 60);
    if (h < 24) return `לפני ${h} שע'`;
    return new Date(iso).toLocaleDateString("he-IL");
}

function until(iso: string): string {
    const d = new Date(iso);
    const sameDay = d.toDateString() === new Date().toDateString();
    return sameDay
        ? d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })
        : d.toLocaleString("he-IL", { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

export default function SyncStatusCard({ mailboxId }: { mailboxId: string }) {
    const sync = useSync(mailboxId);
    const state = sync.data?.state ?? null;
    const policy = sync.data?.policy;

    if (sync.isPending) {
        return (
            <div className="px-5 py-4">
                <div className="h-3 w-24 rounded bg-slate-100 animate-pulse" />
                <div className="mt-3 h-3 w-48 rounded bg-slate-100 animate-pulse" />
            </div>
        );
    }
    if (!sync.data) return null;

    const throttled = !!state?.throttled_until && new Date(state.throttled_until).getTime() > Date.now();
    const status = state?.backfill_status ?? "pending";
    const cap = policy?.backfill_messages ?? 0;
    const synced = state?.backfill_synced ?? 0;
    const pct = cap > 0 ? Math.min(100, Math.round((synced / cap) * 100)) : 0;

    let headline: React.ReactNode;
    let Icon = CheckCircle2Icon;
    let tone = "text-emerald-600";
    if (throttled && state?.throttled_until) {
        Icon = HourglassIcon;
        tone = "text-amber-600";
        const reason = state.throttle_reason ? REASON_COPY[state.throttle_reason as SyncThrottleReason] : undefined;
        headline = (
            <>
                ממתין לתקציב סנכרון עד {until(state.throttled_until)}
                {reason ? <span className="text-slate-500"> ({reason})</span> : null}
            </>
        );
    } else if (status === "complete") {
        headline = state?.last_synced_at ? `מעודכן, נבדק לאחרונה ${relative(state.last_synced_at)}` : "מעודכן";
    } else if (status === "running") {
        Icon = DownloadIcon;
        tone = "text-sky-600";
        headline = `מייבא דואר אחרון: ${synced.toLocaleString()} הודעות עד כה`;
    } else {
        Icon = RefreshCwIcon;
        tone = "text-sky-600";
        headline = "הייבוא יתחיל בסבב הבא";
    }

    return (
        <div className="px-5 py-4">
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">סנכרון</div>
            <div className={cn("mt-2 inline-flex items-start gap-1.5 text-[12.5px] font-medium", tone)}>
                <Icon className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", status === "running" && !throttled && "animate-pulse")} />
                <span className="text-slate-900">{headline}</span>
            </div>

            {status === "running" && !throttled && (
                <div className="mt-2.5 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <motion.div
                        className="h-full rounded-full bg-sky-500"
                        initial={false}
                        animate={{ width: `${Math.max(pct, 3)}%` }}
                        transition={{ type: "spring", stiffness: 120, damping: 20 }}
                    />
                </div>
            )}

            <p className="mt-2 text-[11.5px] leading-relaxed text-slate-500">
                {status === "complete" && policy
                    ? `ייבאנו ${synced.toLocaleString()} הודעות מ-${policy.backfill_days} הימים האחרונים. דואר חדש מסתנכרן עם הגעתו.`
                    : policy
                        ? `${policy.backfill_days} הימים האחרונים נטענים מהחדש לישן, עד ${cap.toLocaleString()} הודעות. דואר חדש מסתנכרן במקביל.`
                        : null}
                {throttled ? " מענות לפנייה שלך ממשיכים להסתנכרן; שאר הדואר יתחדש אוטומטית." : null}
            </p>

            {(state?.deferred ?? 0) > 0 && (
                <p className="mt-1 text-[11.5px] text-amber-700">
                    {state!.deferred.toLocaleString()} הודעות ממתינות בשרת.
                </p>
            )}

            {(state?.folders_skipped_cap ?? 0) > 0 && (
                <p className="mt-1 text-[11.5px] text-amber-700">
                    {state!.folders_skipped_cap!.toLocaleString()} תיקיות לא סונכרנו: בתיבת דואר זו יש יותר תיקיות ממה ש-Warmbly עוקב אחריו. דואר נכנס, נשלח, טיוטות, ארכיון, ספאם ואשפה תמיד כלולים.
                </p>
            )}

            {(state?.folders_skipped_conflict ?? 0) > 0 && (
                <p className="mt-1 text-[11.5px] text-amber-700">
                    שרת הדואר שלך הציג {state!.folders_skipped_conflict!.toLocaleString()} שמות תיקיות יותר מפעם אחת, לכן רק הראשונה מביניהן סונכרנה. שינוי שם של אחת מהן בשרת הדואר יפתור זאת.
                </p>
            )}
        </div>
    );
}
