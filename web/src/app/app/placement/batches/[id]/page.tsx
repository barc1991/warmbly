// Detailed view of a placement batch: headline placement, progress across
// senders, and breakdowns by domain, provider and recipient provider.
//
// 100% natural Israeli Hebrew localization, unmetered & free, strict RTL.

import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
    ArrowLeftIcon,
    ArrowUpRightIcon,
    AtSignIcon,
    Grid3x3Icon,
    Loader2Icon,
    MailIcon,
    ServerIcon,
    SquareIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { EmptyBlock, SectionBar } from "@/components/layout/Page";
import { SelectMenu } from "@/components/ui/select-menu";
import { SearchInput } from "@/components/ui/field";
import PermissionButton from "@/components/ui/PermissionButton";
import { useConfirm } from "@/hooks/context/confirm";
import useCampaign from "@/lib/api/hooks/app/campaigns/useCampaign";
import useDebouncedValue from "@/hooks/useDebouncedValue";
import {
    useCancelPlacementBatch,
    usePlacementBatch,
    usePlacementBatchSenders,
} from "@/lib/api/hooks/app/placement/usePlacement";
import type {
    PlacementBatchDetail,
    PlacementBatchGroup,
    PlacementBatchSender,
    PlacementBatchSenderSort,
    PlacementBatchSenderStatus,
    PlacementCounts,
    PlacementTracking,
} from "@/lib/api/models/app/placement/Placement";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import { cn } from "@/lib/utils";
import {
    FOLDER,
    PANEL_LABEL_HE,
    fmtDate,
    fmtRate,
    rateTone,
} from "@/components/app/placement/tests/placementTests";
import { IssueRow } from "@/components/app/campaigns/ContentScore";
import {
    PlacementBar,
    PlacementLegend,
} from "@/components/app/placement/tests/PlacementParts";
import {
    BatchProgressBar,
    BatchStatusChip,
    SenderStatusChip,
} from "@/components/app/placement/batches/BatchParts";
import {
    SENDER_REASON,
    SENDER_STATUS,
    batchOpen,
    progressLine,
    scopeSummary,
} from "@/components/app/placement/batches/placementBatches";

type Tab = "mailboxes" | "domains" | "providers" | "recipients";

const TABS: { key: Tab; label: string; icon: typeof MailIcon }[] = [
    { key: "mailboxes", label: "תיבות דואר", icon: MailIcon },
    { key: "domains", label: "דומיינים", icon: AtSignIcon },
    { key: "providers", label: "ספקים", icon: ServerIcon },
    { key: "recipients", label: "ספקי נמענים", icon: Grid3x3Icon },
];

const TRACKING_LABEL: Record<PlacementTracking, string> = {
    campaign: "מעקב כמו בקמפיין",
    on: "עם מעקב",
    off: "ללא מעקב",
    compare: "השוואה עם וללא מעקב",
};

// Domains drawn in the matrix before "Show all".
const MATRIX_ROWS = 100;

export default function PlacementBatchPage() {
    const { id = "" } = useParams();
    const q = usePlacementBatch(id);
    const err = q.error as unknown as AppError | null;

    return (
        <div className="flex flex-col min-h-full bg-white text-start">
            <div className="px-3 sm:px-5 pt-3 sm:pt-4">
                <Link
                    to="/app/placement?tab=batches"
                    className="inline-flex items-center gap-1 h-6 -ms-1.5 px-1.5 mb-1 rounded-md text-[11.5px] text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                    <ArrowLeftIcon className="w-3 h-3 rtl:rotate-180" />
                    בדיקות מיקום
                </Link>
            </div>
            {q.isLoading ? (
                <div className="px-3 sm:px-5 pb-6 space-y-3">
                    <div className="h-6 w-72 max-w-full rounded bg-slate-100 animate-pulse" />
                    <div className="h-3 w-96 max-w-full rounded bg-slate-50 animate-pulse" />
                    <div className="h-2 w-full rounded bg-slate-50 animate-pulse" />
                </div>
            ) : q.isError || !q.data ? (
                <EmptyBlock
                    title={err?.status === 404 ? "אצווה זו אינה קיימת" : "לא ניתן לטעון אצווה זו"}
                    body={err?.status === 404 ? "ייתכן שהיא שייכת לסביבת עבודה אחרת." : err ? buildError(err) : undefined}
                />
            ) : (
                <Detail batch={q.data} />
            )}
        </div>
    );
}

function Detail({ batch }: { batch: PlacementBatchDetail }) {
    const confirm = useConfirm();
    const cancel = useCancelPlacementBatch();
    const campaign = useCampaign(batch.campaign_id ?? "");
    const [tab, setTab] = React.useState<Tab>("mailboxes");
    const open = batchOpen(batch.status);
    const p = batch.progress;

    const onCancel = () =>
        confirm.show(
            "לעצור אצווה זו? שולחים שטרם התחילו יבוטלו. עותקים שכבר נשלחו ימשיכו להיות מסווגים.",
            async () => {
                try {
                    await cancel.mutateAsync(batch.id);
                    toast.success("האצווה נעצרה.");
                } catch (e) {
                    const err = e as AppError;
                    toast.error(err?.code === "placement_batch_not_running" ? "אצווה זו כבר הסתיימה." : buildError(err));
                }
            },
        );

    const counts: Record<Tab, number | undefined> = {
        mailboxes: p.total,
        domains: batch.domains.length || undefined,
        providers: batch.providers.length || undefined,
        recipients: batch.recipients.length || undefined,
    };

    return (
        <>
            {/* Header */}
            <div className="px-3 sm:px-5 pb-4 flex flex-wrap items-start gap-3 border-b border-slate-200">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h1 className="min-w-0 max-w-full text-[18px] font-semibold text-slate-900 truncate">{batch.subject || "(ללא נושא)"}</h1>
                        <BatchStatusChip status={batch.status} />
                        <span className="inline-flex items-center h-5 px-1.5 rounded-md bg-slate-100 text-slate-600 text-[10.5px] font-medium whitespace-nowrap">
                            {PANEL_LABEL_HE[batch.panel] ?? batch.panel}
                        </span>
                        <span
                            className={cn(
                                "inline-flex items-center h-5 px-1.5 rounded-md text-[10.5px] font-medium whitespace-nowrap",
                                batch.tracking === "compare" ? "bg-sky-50 text-sky-700" : batch.tracking === "on" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600",
                            )}
                        >
                            {TRACKING_LABEL[batch.tracking] ?? batch.tracking}
                        </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-slate-500">
                        <span>{scopeSummary(batch)}</span>
                        <span>{batch.started_at ? `התחיל ב-${fmtDate(batch.started_at)}` : `בתור מ-${fmtDate(batch.created_at)}`}</span>
                        {batch.finished_at && <span>הסתיים ב-${fmtDate(batch.finished_at)}</span>}
                        {batch.campaign_id && (
                            <Link to={`/app/campaigns/${batch.campaign_id}/steps`} className="inline-flex items-center gap-0.5 text-sky-700 hover:text-sky-800">
                                {campaign.data?.name ?? "קמפיין"}
                                <ArrowUpRightIcon className="w-3 h-3 rtl:-scale-x-100" />
                            </Link>
                        )}
                    </div>
                    {batch.error && <p className="mt-1.5 text-[11.5px] text-rose-600">{batch.error}</p>}
                </div>
                {open && (
                    <PermissionButton
                        permission="SEND_CAMPAIGNS"
                        type="button"
                        onClick={onCancel}
                        disabled={cancel.isPending}
                        className="shrink-0 h-7 px-2.5 rounded-md border border-slate-200 hover:border-slate-300 bg-white text-[12px] font-medium text-slate-700 hover:text-slate-900 inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                    >
                        {cancel.isPending ? <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> : <SquareIcon className="w-3 h-3" />}
                        עצור אצווה
                    </PermissionButton>
                )}
            </div>

            {/* Progress */}
            <section className="px-5 py-4 border-b border-slate-200">
                <div className="flex items-baseline gap-2">
                    <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">שולחים</span>
                    <span className="font-mono text-[10.5px] text-slate-400 tabular-nums">{p.total.toLocaleString("he-IL")}</span>
                </div>
                <BatchProgressBar progress={p} height={8} className="mt-2" />
                <p className="mt-2 text-[11.5px] text-slate-500">
                    {progressLine(p) || "אין שולחים עדיין."}
                    {p.deferred > 0 && open && ` שולחים שנדחו ייבדקו שוב עד ${fmtDate(batch.retry_until)}.`}
                </p>
            </section>

            {/* Overall placement */}
            <section className="border-b border-slate-200">
                <SectionBar label="איפה זה נחת">
                    <PlacementLegend className="hidden md:flex" />
                </SectionBar>
                {batch.untracked ? (
                    <div className="grid sm:grid-cols-2">
                        <Overall title="עם מעקב" counts={batch.summary} className="sm:border-e border-slate-200 max-sm:border-b" />
                        <Overall title="ללא מעקב" counts={batch.untracked} />
                    </div>
                ) : (
                    <Overall counts={batch.summary} />
                )}
            </section>

            {/* Tabs */}
            <div className="border-b border-slate-200 bg-slate-50/50 px-3 sm:px-5 flex gap-1 overflow-x-auto">
                {TABS.map((t) => {
                    const active = tab === t.key;
                    const count = counts[t.key];
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => setTab(t.key)}
                            className={cn(
                                "h-10 px-3 inline-flex items-center gap-1.5 text-[12px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                                active
                                    ? "border-sky-600 text-sky-700 bg-white"
                                    : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300",
                            )}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {t.label}
                            {count != null && <span className="font-mono tabular-nums text-slate-400 text-[11px] ms-1">({count.toLocaleString("he-IL")})</span>}
                        </button>
                    );
                })}
            </div>

            {tab === "mailboxes" && <SendersTab batch={batch} />}
            {tab === "domains" && (
                <GroupTable groups={batch.domains} label="דומיין שולח" empty="לא נבדק עדיין אף דומיין." />
            )}
            {tab === "providers" && (
                <GroupTable groups={batch.providers} label="ספק שולח" empty="לא נבדק עדיין אף ספק." />
            )}
            {tab === "recipients" && <Matrix batch={batch} />}

            {/* Content Check */}
            <ContentCheck batch={batch} />
        </>
    );
}

function Overall({ title, counts, className }: { title?: string; counts: PlacementCounts; className?: string }) {
    const tabs = counts.promotions + counts.other;
    const cells = [
        { label: "דואר נכנס", rate: counts.inbox_rate, n: counts.inbox, tone: FOLDER.inbox.text },
        { label: "לשוניות אחרות", rate: counts.tabs_rate, n: tabs, tone: FOLDER.promotions.text },
        { label: "ספאם", rate: counts.spam_rate, n: counts.spam, tone: FOLDER.spam.text },
        { label: "מעולם לא הגיע", rate: counts.missing_rate, n: counts.missing, tone: FOLDER.missing.text },
    ];
    return (
        <div className={cn("px-5 py-4 min-w-0 text-start", className)}>
            {title && <div className="mb-2 text-[12.5px] font-medium text-slate-900">{title}</div>}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {cells.map((c) => (
                    <div key={c.label}>
                        <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">{c.label}</div>
                        <div className={cn("mt-1 text-[22px] font-light leading-none tabular-nums", c.rate == null ? "text-slate-300" : c.tone)}>
                            {fmtRate(c.rate)}
                        </div>
                        <div className="mt-1 text-[10.5px] text-slate-400 font-mono">
                            {c.n.toLocaleString("he-IL")} עותקים
                        </div>
                    </div>
                ))}
            </div>
            <PlacementBar counts={counts} height={8} className="mt-3" />
            <p className="mt-2 text-[11px] text-slate-500">
                {counts.total === 0
                    ? "טרם נשלחו עותקים."
                    : `${counts.delivered.toLocaleString("he-IL")} מתוך ${counts.total.toLocaleString("he-IL")} עותקים נשלחו וסווגו${counts.pending > 0 ? `, ${counts.pending.toLocaleString("he-IL")} ממתינים` : ""}. השיעורים מחושבים מתוך סך העותקים שנשלחו.`}
            </p>
        </div>
    );
}

const SORTS: { value: PlacementBatchSenderSort; label: string }[] = [
    { value: "worst", label: "שיעור כניסה נמוך תחילה" },
    { value: "best", label: "שיעור כניסה גבוה תחילה" },
    { value: "email", label: "כתובת דוא״ל" },
    { value: "status", label: "סטטוס" },
];

const STATUS_ORDER: PlacementBatchSenderStatus[] = ["running", "queued", "deferred", "completed", "skipped", "failed", "cancelled"];

function SendersTab({ batch }: { batch: PlacementBatchDetail }) {
    const navigate = useNavigate();
    const [sort, setSort] = React.useState<PlacementBatchSenderSort>("worst");
    const [status, setStatus] = React.useState<PlacementBatchSenderStatus | "">("");
    const [q, setQ] = React.useState("");
    const debounced = useDebouncedValue(q.trim(), 300);
    const list = usePlacementBatchSenders(batch.id, { sort, status, q: debounced });
    const p = batch.progress;

    const statusOptions = [
        { value: "", label: `כל הסטטוסים (${p.total.toLocaleString("he-IL")})` },
        ...STATUS_ORDER.filter((s) => p[s] > 0 || s === status).map((s) => ({
            value: s,
            label: `${SENDER_STATUS[s].label} (${p[s].toLocaleString("he-IL")})`,
        })),
    ];
    const showResults = list.senders.some((s) => s.summary.total > 0);

    return (
        <section className="flex flex-col text-start">
            <div className="px-5 py-2 border-b border-slate-200/60 flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-[180px] max-w-sm">
                    <SearchInput value={q} onChange={setQ} placeholder="חיפוש תיבות דואר…" />
                </div>
                <div className="ms-auto flex flex-wrap items-center gap-2">
                    <SelectMenu
                        value={status}
                        onChange={(v) => setStatus(v as PlacementBatchSenderStatus | "")}
                        options={statusOptions}
                        aria-label="סטטוס"
                        align="end"
                    />
                    <SelectMenu
                        value={sort}
                        onChange={(v) => setSort(v as PlacementBatchSenderSort)}
                        options={SORTS}
                        aria-label="מיון"
                        align="end"
                    />
                </div>
            </div>

            {list.isLoading ? (
                <div className="divide-y divide-slate-200/60">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-12 px-5 flex items-center gap-4">
                            <div className="h-3 w-48 rounded bg-slate-100 animate-pulse" />
                            <div className="h-3 flex-1 rounded bg-slate-50 animate-pulse" />
                        </div>
                    ))}
                </div>
            ) : list.isError ? (
                <EmptyBlock title="לא ניתן לטעון תיבות דואר" body={buildError(list.error as unknown as AppError)} />
            ) : list.senders.length === 0 ? (
                <p className="px-5 py-6 text-[12px] text-slate-400">{debounced || status ? "לא נמצאו תיבות דואר תואמות." : "אין שולחים באצווה זו."}</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-start">
                        <thead>
                            <tr className="h-8 border-b border-slate-200/60 text-[10px] uppercase tracking-[0.14em] text-slate-400">
                                <th className="px-5 font-medium text-start">תיבת דואר</th>
                                <th className="px-3 font-medium text-start">סטטוס</th>
                                {showResults && (
                                    <>
                                        <th className="px-3 font-medium hidden sm:table-cell w-[20%] text-start">איפה זה נחת</th>
                                        <th className="px-3 font-medium text-end">דואר נכנס</th>
                                        <th className="px-5 font-medium text-end hidden md:table-cell">ספאם</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/60">
                            {list.senders.map((s) => (
                                <SenderRow
                                    key={s.id}
                                    sender={s}
                                    showResults={showResults}
                                    onOpen={s.test_ids.length > 0 ? () => navigate(`/app/placement/${s.test_ids[0]}`) : undefined}
                                />
                            ))}
                        </tbody>
                    </table>
                    {list.hasNextPage && (
                        <div className="px-5 py-3 flex justify-center">
                            <button
                                type="button"
                                onClick={() => list.fetchNextPage()}
                                disabled={list.isFetchingNextPage}
                                className="h-7 px-3 rounded-md border border-slate-200 hover:border-slate-300 text-[12px] font-medium text-slate-700 inline-flex items-center gap-1.5 disabled:opacity-60"
                            >
                                {list.isFetchingNextPage && <Loader2Icon className="w-3.5 h-3.5 animate-spin" />}
                                טען עוד
                            </button>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}

function SenderRow({ sender: s, showResults, onOpen }: { sender: PlacementBatchSender; showResults: boolean; onOpen?: () => void }) {
    const explained = s.status === "skipped" || s.status === "deferred" || s.status === "failed";
    const reason = s.reason ? (SENDER_REASON[s.reason] ?? s.detail) : s.detail;
    const sub =
        s.status === "deferred"
            ? `${reason ? `${reason}. ` : ""}ניסיון חוזר ב-${fmtDate(s.next_attempt_at)}`
            : explained
              ? reason
              : undefined;
    return (
        <tr
            onClick={onOpen}
            className={cn("h-11 transition-colors", onOpen && "cursor-pointer hover:bg-slate-50")}
        >
            <td className="px-5 py-2 max-w-0">
                <div dir="ltr" className="text-[12.5px] font-medium text-slate-900 truncate text-start">{s.sender_email}</div>
                <div className="text-[11px] text-slate-400 truncate">
                    {s.sender_family_label || s.sender_family}
                    {sub && <span className="ms-1.5 text-slate-500">· {sub}</span>}
                </div>
            </td>
            <td className="px-3 py-2 whitespace-nowrap">
                <SenderStatusChip status={s.status} />
            </td>
            {showResults && (
                <>
                    <td className="px-3 py-2 hidden sm:table-cell">
                        {s.summary.total > 0 && <PlacementBar counts={s.summary} />}
                    </td>
                    <td className={cn("px-3 py-2 text-end font-mono text-[12px] tabular-nums", rateTone(s.summary.inbox_rate))}>
                        {s.summary.inbox_rate == null ? <span className="text-slate-400">—</span> : fmtRate(s.summary.inbox_rate)}
                    </td>
                    <td className="px-5 py-2 text-end font-mono text-[12px] tabular-nums text-rose-600 hidden md:table-cell">
                        {s.summary.spam_rate == null ? <span className="text-slate-400">—</span> : fmtRate(s.summary.spam_rate)}
                    </td>
                </>
            )}
        </tr>
    );
}

function GroupTable({ groups, label, empty }: { groups: PlacementBatchGroup[]; label: string; empty: string }) {
    if (groups.length === 0) return <p className="px-5 py-6 text-[12px] text-slate-400">{empty}</p>;
    return (
        <div className="overflow-x-auto text-start">
            <table className="w-full text-start">
                <thead>
                    <tr className="h-8 border-b border-slate-200/60 text-[10px] uppercase tracking-[0.14em] text-slate-400">
                        <th className="px-5 font-medium text-start">{label}</th>
                        <th className="px-3 font-medium text-end hidden sm:table-cell">נבדקו</th>
                        <th className="px-3 font-medium w-[26%] hidden sm:table-cell text-start" />
                        <th className="px-3 font-medium text-end">דואר נכנס</th>
                        <th className="px-3 font-medium text-end">ספאם</th>
                        <th className="px-5 font-medium text-end hidden md:table-cell">חסר</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60">
                    {groups.map((g) => (
                        <tr key={g.key} className="h-10">
                            <td className="px-5 text-[12.5px] font-medium text-slate-900 whitespace-nowrap text-start">{g.label || g.key}</td>
                            <td className="px-3 text-end font-mono text-[11px] tabular-nums text-slate-500 hidden sm:table-cell">
                                {g.tested.toLocaleString("he-IL")}/{g.senders.toLocaleString("he-IL")}
                            </td>
                            <td className="px-3 hidden sm:table-cell">
                                <PlacementBar counts={g.counts} />
                            </td>
                            <td className={cn("px-3 text-end font-mono text-[11.5px] tabular-nums", rateTone(g.counts.inbox_rate))}>
                                {fmtRate(g.counts.inbox_rate)}
                            </td>
                            <td className="px-3 text-end font-mono text-[11.5px] tabular-nums text-rose-600">{fmtRate(g.counts.spam_rate)}</td>
                            <td className="px-5 text-end font-mono text-[11.5px] tabular-nums text-slate-500 hidden md:table-cell">
                                {fmtRate(g.counts.missing_rate)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// Sending domain by recipient provider: the inbox rate in each cell.
function Matrix({ batch }: { batch: PlacementBatchDetail }) {
    const [all, setAll] = React.useState(false);
    const cols = batch.recipients;
    if (cols.length === 0 || batch.matrix.length === 0) {
        return <p className="px-5 py-6 text-[12px] text-slate-400">אין עדיין הכרעה לאף עותק.</p>;
    }
    const rows = all ? batch.matrix : batch.matrix.slice(0, MATRIX_ROWS);
    const cell = (c: PlacementCounts | undefined) =>
        !c || c.inbox_rate == null ? (
            <span className="text-slate-300">—</span>
        ) : (
            <span className={rateTone(c.inbox_rate)} title={`${c.inbox} מתוך ${c.delivered} בתיבת הדואר הנכנס`}>
                {fmtRate(c.inbox_rate)}
            </span>
        );
    return (
        <div className="text-start">
            <p className="px-5 pt-3 text-[11px] text-slate-400">
                שיעור כניסה לתיבת הדואר הנכנס עבור כל דומיין שולח לפי ספק נמען, מהנמוך לגבוה.
            </p>
            <div className="overflow-x-auto">
                <table className="text-start min-w-full">
                    <thead>
                        <tr className="h-8 border-b border-slate-200/60 text-[10px] uppercase tracking-[0.14em] text-slate-400">
                            <th className="px-5 font-medium sticky start-0 bg-white text-start">דומיין שולח</th>
                            {cols.map((c) => (
                                <th key={c.family} className="px-3 font-medium text-end whitespace-nowrap">
                                    {c.label || c.family}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60">
                        <tr className="h-9 bg-slate-50/60">
                            <td className="px-5 text-[12px] font-medium text-slate-700 whitespace-nowrap sticky start-0 bg-slate-50 text-start">כל הדומיינים</td>
                            {cols.map((c) => (
                                <td key={c.family} className="px-3 text-end font-mono text-[11.5px] tabular-nums">
                                    {cell(c.counts)}
                                </td>
                            ))}
                        </tr>
                        {rows.map((r) => (
                            <tr key={r.domain} className="h-9">
                                <td className="px-5 text-[12px] text-slate-900 whitespace-nowrap sticky start-0 bg-white text-start">{r.domain}</td>
                                {cols.map((c) => (
                                    <td key={c.family} className="px-3 text-end font-mono text-[11.5px] tabular-nums">
                                        {cell(r.recipients.find((x) => x.family === c.family)?.counts)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {batch.matrix.length > MATRIX_ROWS && (
                <div className="px-5 py-3 flex justify-center">
                    <button
                        type="button"
                        onClick={() => setAll((v) => !v)}
                        className="h-7 px-3 rounded-md border border-slate-200 hover:border-slate-300 text-[12px] font-medium text-slate-700"
                    >
                        {all ? `הצג את ${MATRIX_ROWS} הראשונים` : `הצג את כל ${batch.matrix.length.toLocaleString("he-IL")} הדומיינים`}
                    </button>
                </div>
            )}
        </div>
    );
}

function ContentCheck({ batch }: { batch: PlacementBatchDetail }) {
    const { score } = batch.content;
    const issues = batch.content.issues ?? [];
    const tone = score >= 80 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-rose-600";
    const label = score >= 80 ? "נראה טוב" : score >= 50 ? "ניתן לשפר" : "דורש שיפור";
    return (
        <section className="border-t border-slate-200 mt-4 text-start">
            <SectionBar label="בדיקת תוכן" />
            <div className="px-5 py-3">
                <div className="flex items-baseline gap-2">
                    <span className={cn("text-[22px] font-light tabular-nums", tone)}>{score}</span>
                    <span className="text-[11px] text-slate-400">מתוך 100</span>
                    <span className={cn("text-[11.5px] font-medium", tone)}>{label}</span>
                </div>
                {issues.length === 0 ? (
                    <p className="mt-1 text-[11.5px] text-slate-500">שום דבר בנוסח אינו בולט לרעה למסנני ספאם.</p>
                ) : (
                    <ul className="mt-1 divide-y divide-slate-100 max-w-2xl">
                        {issues.map((issue, i) => (
                            <IssueRow key={`${issue.code}-${i}`} issue={issue} />
                        ))}
                    </ul>
                )}
                <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
                    הנוסח זהה עבור כל השולחים, כך ששולח או דומיין שמציגים תוצאה נמוכה מהשאר מעידים על מוניטין השולח, ולא על בעיית תוכן.
                </p>
            </div>
        </section>
    );
}
