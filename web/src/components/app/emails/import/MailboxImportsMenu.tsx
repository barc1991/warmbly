// MailboxImportsMenu: the mailboxes page's way back into a running or recent
// import. Hidden until the workspace has one. Each entry says what the import
// is doing or waiting on, and can be hidden from the list.
import React from "react";
import toast from "react-hot-toast";
import { FileSpreadsheetIcon, Loader2Icon, XIcon } from "lucide-react";
import {
    PopoverMenu,
    PopoverMenuContent,
    PopoverMenuLabel,
    PopoverMenuTrigger,
} from "@/components/ui/popover-menu";
import useMailboxImports from "@/lib/api/hooks/app/emails/useMailboxImports";
import { useDismissMailboxImport } from "@/lib/api/hooks/app/emails/useMailboxImportActions";
import { type MailboxImport } from "@/lib/api/models/app/emails/MailboxImport";
import { vendorLabel } from "@/lib/api/models/app/emails/MailboxSources";
import { useConfirm } from "@/hooks/context/confirm";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import timeAgo from "@/lib/helper/timeAgo";
import { cn } from "@/lib/utils";
import { VENDOR_AUTHORIZING, importSourceName, plural } from "./importFields";
import MailboxImportDialog from "./MailboxImportDialog";
import ProviderLogo from "@/components/app/emails/ProviderLogo";

type Tone = "working" | "waiting" | "action" | "error" | "done" | "muted";

interface JobState {
    text: string;
    hint?: string;
    tone: Tone;
}

// jobState says, in words, what an import is doing now and what it waits on.
function jobState(job: MailboxImport): JobState {
    const c = job.counts;
    const authorizing = job.causes?.find((x) => x.cause === VENDOR_AUTHORIZING)?.count ?? 0;
    const signin = Math.max(0, c.needs_signin - authorizing);
    const inFlight = c.queued + c.running;
    const settled = job.total - inFlight;

    if (job.status === "cancelled") return { text: "הופסק", tone: "muted" };
    // What needs the person comes first; work still going on is mentioned alongside.
    const connecting = job.status === "running" && inFlight > 0;
    const alongside =
        (connecting ? ` עדיין מחבר ${settled.toLocaleString()} מתוך ${job.total.toLocaleString()}.` : "") +
        (authorizing > 0 ? ` ${plural(authorizing, "תיבה נוספת נמצאת", "תיבות נוספות נמצאות")} בתהליך הרשאה.` : "");
    if (c.failed > 0) {
        return { text: `${c.failed.toLocaleString()} נכשלו`, hint: `פתח כדי לראות מדוע ולנסות שוב.${alongside}`, tone: "error" };
    }
    if (signin > 0) {
        return {
            text: `${plural(signin, "תיבת דואר דורשת", "תיבות דואר דורשות")} התחברות`,
            hint: `פתח כדי להתחבר לכל אחת מהן.${alongside}`,
            tone: "action",
        };
    }
    if (connecting) {
        return {
            text: `מחבר ${settled.toLocaleString()} מתוך ${job.total.toLocaleString()}`,
            hint: "כל תיבת דואר נבדקת מול שרת המייל שלה, מספר שניות לכל תיבה.",
            tone: "working",
        };
    }
    if (authorizing > 0) {
        return {
            text: `מאשר הרשאה עבור ${plural(authorizing, "תיבת דואר", "תיבות דואר")}`,
            hint: `${vendorLabel(job.vendor) || "ספק תיבות הדואר"} מאשר את Warmbly. התהליך עשוי להימשך עד שעה והתיבות יתחברו מעצמן; פתח כדי לחבר אותן מוקדם יותר.`,
            tone: "waiting",
        };
    }
    const ok = c.connected + c.updated;
    return { text: ok > 0 ? `${ok.toLocaleString()} חוברו` : "הושלם", tone: "done" };
}

const TONE: Record<Tone, string> = {
    working: "text-sky-700",
    waiting: "text-sky-700",
    action: "text-amber-700",
    error: "text-red-600",
    done: "text-emerald-700",
    muted: "text-slate-500",
};

export default function MailboxImportsMenu() {
    const imports = useMailboxImports();
    const [openId, setOpenId] = React.useState<string | null>(null);
    const [menuOpen, setMenuOpen] = React.useState(false);
    const jobs = imports.data?.data ?? [];
    const running = jobs.filter((j) => j.status === "running").length;
    const needsYou = jobs.filter((j) => {
        const t = jobState(j).tone;
        return t === "action" || t === "error";
    }).length;

    return (
        <>
            {jobs.length > 0 && (
                <PopoverMenu align="end" open={menuOpen} onOpenChange={setMenuOpen}>
                    <PopoverMenuTrigger asChild>
                        <button
                            type="button"
                            className="h-7 px-2.5 rounded-md inline-flex items-center gap-1.5 text-[12px] font-medium transition-colors border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 bg-white"
                        >
                            {running > 0 ? (
                                <Loader2Icon className="w-3 h-3 text-sky-600 animate-spin" />
                            ) : (
                                <FileSpreadsheetIcon className="w-3 h-3" />
                            )}
                            ייבואים
                            {running > 0 && <span className="text-sky-600 tabular-nums">{running}</span>}
                            {needsYou > 0 && (
                                <span
                                    className="min-w-4 h-4 px-1 rounded-full bg-amber-100 text-amber-800 text-[10.5px] tabular-nums inline-flex items-center justify-center"
                                    title={`${plural(needsYou, "ייבוא דורש", "ייבואים דורשים")} התייחסות`}
                                >
                                    {needsYou}
                                </span>
                            )}
                        </button>
                    </PopoverMenuTrigger>
                    <PopoverMenuContent minWidth={340}>
                        <PopoverMenuLabel>ייבואים אחרונים</PopoverMenuLabel>
                        <div className="max-h-[60vh] overflow-y-auto">
                            {jobs.map((job) => (
                                <ImportEntry
                                    key={job.id}
                                    job={job}
                                    onOpen={() => {
                                        setMenuOpen(false);
                                        setOpenId(job.id);
                                    }}
                                />
                            ))}
                        </div>
                    </PopoverMenuContent>
                </PopoverMenu>
            )}
            <MailboxImportDialog importId={openId} onClose={() => setOpenId(null)} />
        </>
    );
}

function ImportEntry({ job, onOpen }: { job: MailboxImport; onOpen: () => void }) {
    const confirm = useConfirm();
    const dismiss = useDismissMailboxImport();
    const st = jobState(job);
    const live = job.status === "running";

    const hide = (e: React.MouseEvent) => {
        e.stopPropagation();
        const run = async () => {
            try {
                await dismiss.mutateAsync(job.id);
                toast.success(live ? "הייבוא הופסק והוסתר" : "הייבוא הוסתר");
            } catch (err) {
                toast.error(buildError(err as AppError));
            }
        };
        if (live) {
            confirm.show("להפסיק את הייבוא הזה ולהסתיר אותו? תיבות דואר שכבר חוברו יישארו מחוברות.", run);
            return;
        }
        void run();
    };

    return (
        <div className="group relative flex items-start gap-2 px-3 py-2 hover:bg-slate-50 transition-colors">
            <button
                type="button"
                role="menuitem"
                onClick={onOpen}
                className="min-w-0 flex-1 flex items-start gap-2 text-start"
            >
                <span
                    className={cn(
                        "mt-1.5 block size-1.5 shrink-0 rounded-full",
                        live ? "bg-sky-500 animate-pulse" : st.tone === "error" ? "bg-red-400" : st.tone === "action" ? "bg-amber-400" : "bg-slate-300",
                    )}
                />
                <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 min-w-0 text-[12.5px] text-slate-800">
                        {job.vendor && <ProviderLogo id={job.vendor} size="xs" framed={false} />}
                        <span className="truncate">
                            {importSourceName(job)} · {plural(job.total, "תיבת דואר", "תיבות דואר")}
                        </span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px]">
                        {st.tone === "working" || st.tone === "waiting" ? <Loader2Icon className="w-3 h-3 text-sky-600 animate-spin shrink-0" /> : null}
                        <span className={cn("tabular-nums", TONE[st.tone])}>{st.text}</span>
                        <span className="text-slate-400">· {timeAgo(job.created_at)}</span>
                    </span>
                    {st.hint && <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{st.hint}</span>}
                </span>
            </button>
            <button
                type="button"
                onClick={hide}
                disabled={dismiss.isPending}
                aria-label={live ? "הפסק והסתר ייבוא זה" : "הסתר ייבוא זה"}
                title={live ? "הפסק והסתר" : "הסתר"}
                className="shrink-0 mt-0.5 size-5 rounded inline-flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity disabled:opacity-50"
            >
                <XIcon className="w-3 h-3" />
            </button>
        </div>
    );
}
