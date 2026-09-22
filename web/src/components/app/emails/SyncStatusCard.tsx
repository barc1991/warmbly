import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2Icon, DownloadIcon, HourglassIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import toast from "react-hot-toast";
import { CheckSquare } from "@/components/ui/check-square";
import { TextInput } from "@/components/ui/field";
import { useConfirm } from "@/hooks/context/confirm";
import type { AppError } from "@/lib/api/client/normalizeError";
import useSync from "@/lib/api/hooks/app/emails/useSync";
import useUpdateSyncSkipFolders from "@/lib/api/hooks/app/emails/useUpdateSyncSkipFolders";
import type { SyncFolder, SyncThrottleReason } from "@/lib/api/models/app/emails/SyncState";
import buildError from "@/lib/helper/buildError";
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

// The folders a client may offer to skip: everything the worker listed
// except INBOX and the special folders, which the sync always follows.
function skippable(folders: SyncFolder[]): string[] {
    return folders.filter((f) => f.folder === "inbox" && f.name.toUpperCase() !== "INBOX").map((f) => f.name);
}

// Folders the owner excluded from sync, with the ones the server lists as
// the choices. A skipped folder leaves the listing once the worker stops
// following it, so the rows are the union of both, and a name the listing
// does not have yet (a folder not yet seen, or one on a mailbox that has not
// synced) can be typed in.
function SkipFoldersSection({ mailboxId, listed, skipped }: { mailboxId: string; listed: string[]; skipped: string[] }) {
    const mutation = useUpdateSyncSkipFolders(mailboxId);
    const confirm = useConfirm();
    const [draft, setDraft] = useState("");

    const isSkipped = (name: string) => skipped.some((s) => s.toLowerCase() === name.toLowerCase());
    const rows = [...listed, ...skipped.filter((s) => !listed.some((l) => l.toLowerCase() === s.toLowerCase()))];

    const save = async (next: string[]) => {
        try {
            await mutation.mutateAsync(next);
        } catch (e) {
            toast.error(buildError(e as AppError));
        }
    };
    // Skipping removes what was imported and nothing brings it back, so it
    // asks first; following a folder again does not.
    const skip = (name: string) =>
        confirm.show(
            `להפסיק לסנכרן את "${name}"? דואר שכבר יובא מתיקייה זו יוסר מ-Warmbly. הוא יישאר בתיבת הדואר שלך, אך לא יובא שוב גם אם תחזיר את התיקייה לסנכרון.`,
            () => save([...skipped, name]),
        );
    const toggle = (name: string) => {
        if (isSkipped(name)) {
            void save(skipped.filter((s) => s.toLowerCase() !== name.toLowerCase()));
        } else {
            skip(name);
        }
    };
    const add = () => {
        const name = draft.trim();
        if (!name) return;
        setDraft("");
        if (isSkipped(name)) return;
        skip(name);
    };

    return (
        <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">תיקיות שלא מסונכרנות</div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">
                דואר בתיקייה שמסומנת כאן לעולם לא יגיע ל-Warmbly, ומה שכבר יובא ממנה יוסר. השתמש בזה עבור תיקייה שכלי אחר ממלא, כגון שירות חימום חיצוני. תיקיות דואר נכנס, נשלח, טיוטות, ספאם, אשפה וארכיון מסתנכרנות תמיד.
            </p>
            {rows.length > 0 && (
                <ul className="mt-2 -mx-2.5">
                    {rows.map((name) => (
                        <li key={name}>
                            <button
                                type="button"
                                disabled={mutation.isPending}
                                onClick={() => void toggle(name)}
                                className="w-full px-2.5 h-7 flex items-center gap-2 text-[12px] text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-60 rounded-md text-right"
                            >
                                <CheckSquare checked={isSkipped(name)} />
                                <span className="truncate">{name}</span>
                                {!listed.some((l) => l.toLowerCase() === name.toLowerCase()) && (
                                    <span className="mr-auto text-[10.5px] text-slate-400 shrink-0">מוחרג</span>
                                )}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <div className="mt-2 flex items-center gap-1.5">
                <TextInput
                    value={draft}
                    onChange={setDraft}
                    placeholder="שם התיקייה כפי שמופיע בשרת הדואר"
                    disabled={mutation.isPending}
                    maxLength={255}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            add();
                        }
                    }}
                    className="flex-1"
                />
                <button
                    type="button"
                    onClick={add}
                    disabled={mutation.isPending || !draft.trim()}
                    className="h-7 px-2.5 inline-flex items-center gap-1 rounded-md border border-slate-200 text-[12px] text-slate-700 hover:bg-slate-50 disabled:opacity-50 shrink-0"
                >
                    <PlusIcon className="w-3 h-3" /> החרג
                </button>
            </div>
        </div>
    );
}

export default function SyncStatusCard({ mailboxId, provider }: { mailboxId: string; provider?: string }) {
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

            <div className="mt-3 grid grid-cols-2 gap-2 text-[11.5px] text-slate-600">
                <div className="p-2 rounded-md bg-slate-50 border border-slate-100">
                    <div className="text-slate-400 text-[10.5px]">יובאו עד כה</div>
                    <div className="text-slate-900 font-medium mt-0.5">{synced.toLocaleString()} הודעות</div>
                </div>
                <div className="p-2 rounded-md bg-slate-50 border border-slate-100">
                    <div className="text-slate-400 text-[10.5px]">תקציב ייבוא</div>
                    <div className="text-slate-900 font-medium mt-0.5">{cap.toLocaleString()} הודעות</div>
                </div>
            </div>

            {(state?.folders_skipped_cap ?? 0) > 0 && (
                <p className="mt-2.5 text-[11px] text-amber-700 bg-amber-50/70 border border-amber-100 rounded-md p-2">
                    התיבה מכילה יותר תיקיות ממה שניתן לסנכרן. חלק מהתיקיות לא יסונכרנו.
                </p>
            )}

            {(state?.folders_skipped_conflict ?? 0) > 0 && (
                <p className="mt-2.5 text-[11px] text-amber-700 bg-amber-50/70 border border-amber-100 rounded-md p-2">
                    קיימת התנגשות בשמות תיקיות בשרת הדואר. תיקיות עם שמות כפולים לא יסונכרנו.
                </p>
            )}

            {provider === "smtp_imap" && (
                <SkipFoldersSection
                    mailboxId={mailboxId}
                    listed={skippable(sync.data.folders ?? [])}
                    skipped={sync.data.skip_folders ?? []}
                />
            )}
        </div>
    );
}
