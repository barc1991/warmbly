// Inbox placement tests: the workspace's tests, batches, the seed panels it can test
// against, and its own seed inboxes. Live through PLACEMENT_TEST_UPDATED and
// the audit spine; nothing here polls.
//
// 100% natural Israeli Hebrew localization, unmetered & free, strict RTL.

import React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { InboxIcon, Layers3Icon, Loader2Icon, ListIcon, PlusIcon, XIcon } from "lucide-react";
import { EmptyBlock, Page, PageTopbar, SectionBar, TopbarAction } from "@/components/layout/Page";
import ScrollStrip from "@/components/ui/scroll-strip";
import { usePermission, showPermissionDenied } from "@/hooks/usePermission";
import useCampaign from "@/lib/api/hooks/app/campaigns/useCampaign";
import {
    usePlacementBatches,
    usePlacementCoverage,
    usePlacementOverview,
    usePlacementTests,
} from "@/lib/api/hooks/app/placement/usePlacement";
import { PANEL_LABEL, type PlacementBatch, type PlacementTest } from "@/lib/api/models/app/placement/Placement";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import NewPlacementTestDialog from "@/components/app/placement/tests/NewPlacementTestDialog";
import NewPlacementBatchDialog, { type NewPlacementBatchPrefill } from "@/components/app/placement/batches/NewPlacementBatchDialog";
import SeedInboxes from "@/components/app/placement/tests/SeedInboxes";
import {
    PanelStrip,
    PlacementBar,
    PlacementCaveat,
    PlacementLegend,
    StatusChip,
    TrackingBadge,
} from "@/components/app/placement/tests/PlacementParts";
import {
    BatchProgressBar,
    BatchStatusChip,
} from "@/components/app/placement/batches/BatchParts";
import { scopeSummary } from "@/components/app/placement/batches/placementBatches";
import { ORIGIN_LABEL, PANEL_LABEL_HE, fmtDate, fmtRate, rateTone, usageLabel } from "@/components/app/placement/tests/placementTests";
import { cn } from "@/lib/utils";

type Tab = "tests" | "batches" | "seeds";

const TABS: { key: Tab; label: string; icon: typeof ListIcon }[] = [
    { key: "tests", label: "בדיקות", icon: ListIcon },
    { key: "batches", label: "אצוות", icon: Layers3Icon },
    { key: "seeds", label: "תיבות בדיקה", icon: InboxIcon },
];

export default function PlacementPage() {
    const [params, setParams] = useSearchParams();
    const tab: Tab = params.get("tab") === "seeds" ? "seeds" : params.get("tab") === "batches" ? "batches" : "tests";
    const campaignId = params.get("campaign_id");
    const canStart = usePermission("SEND_CAMPAIGNS");
    const overview = usePlacementOverview();
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [batchDialogOpen, setBatchDialogOpen] = React.useState(false);
    const [batchPrefill, setBatchPrefill] = React.useState<NewPlacementBatchPrefill | undefined>();

    const setTab = (t: Tab) => {
        const next = new URLSearchParams(params);
        if (t === "tests") next.delete("tab");
        else next.set("tab", t);
        setParams(next, { replace: true });
    };

    const openNew = () => {
        if (!canStart) {
            showPermissionDenied("SEND_CAMPAIGNS");
            return;
        }
        setDialogOpen(true);
    };

    const openNewBatch = (prefill?: NewPlacementBatchPrefill) => {
        if (!canStart) {
            showPermissionDenied("SEND_CAMPAIGNS");
            return;
        }
        setBatchPrefill(prefill);
        setBatchDialogOpen(true);
    };

    return (
        <Page>
            <PageTopbar
                eyebrow="בדיקות מיקום בתיבת הדואר"
                subtitle={overview.data ? usageLabel(overview.data) : undefined}
            >
                <TopbarAction icon={<Layers3Icon className="w-3.5 h-3.5" />} onClick={() => openNewBatch()}>
                    אצווה חדשה
                </TopbarAction>
                <TopbarAction icon={<PlusIcon className="w-3.5 h-3.5" />} onClick={openNew}>
                    בדיקה חדשה
                </TopbarAction>
            </PageTopbar>

            <CoverageLine onTest={() => openNewBatch({ untestedDays: 30 })} />

            <ScrollStrip activeKey={tab} className="shrink-0 border-b border-slate-200" innerClassName="px-3 gap-1">
                {TABS.map((t) => {
                    const active = tab === t.key;
                    return (
                        <button
                            key={t.key}
                            type="button"
                            data-active={active}
                            onClick={() => setTab(t.key)}
                            className={cn(
                                "relative h-10 px-2.5 inline-flex shrink-0 items-center gap-1.5 text-[12.5px] transition-colors",
                                active ? "text-slate-900 font-medium" : "text-slate-500 hover:text-slate-800",
                            )}
                        >
                            <t.icon className="w-3.5 h-3.5" />
                            {t.label}
                            {t.key === "seeds" && overview.data && (
                                <span className="font-mono text-[10.5px] text-slate-400 tabular-nums ms-1">{overview.data.workspace_seeds}</span>
                            )}
                            {active && (
                                <motion.span
                                    layoutId="placement-tab-underline"
                                    className="absolute left-1.5 right-1.5 bottom-0 h-0.5 rounded-full bg-sky-600"
                                    transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
                                />
                            )}
                        </button>
                    );
                })}
            </ScrollStrip>

            {tab === "seeds" ? (
                <SeedInboxes />
            ) : tab === "batches" ? (
                <BatchesTable onNew={() => openNewBatch()} />
            ) : (
                <>
                    {overview.data && <PanelStrip overview={overview.data} />}
                    <TestsTable
                        campaignId={campaignId}
                        onClearCampaign={() => {
                            const next = new URLSearchParams(params);
                            next.delete("campaign_id");
                            setParams(next, { replace: true });
                        }}
                        onNew={openNew}
                    />
                </>
            )}

            <NewPlacementTestDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                prefill={campaignId ? { campaignId } : undefined}
            />

            <NewPlacementBatchDialog
                open={batchDialogOpen}
                onClose={() => {
                    setBatchDialogOpen(false);
                    setBatchPrefill(undefined);
                }}
                prefill={batchPrefill}
            />
        </Page>
    );
}

// How much of the sending fleet has a recent placement result, in one line.
function CoverageLine({ onTest }: { onTest: () => void }) {
    const coverage = usePlacementCoverage();
    const c = coverage.data;
    if (!c || c.mailboxes === 0) return null;
    const untested30 = Math.max(0, c.mailboxes - c.tested_30d);
    return (
        <div className="px-5 min-h-10 py-1.5 border-b border-slate-200 flex flex-wrap items-center gap-x-3 gap-y-1 text-start">
            <span className="text-[12px] text-slate-600">
                {untested30 === 0 ? (
                    `כל ${c.mailboxes.toLocaleString("he-IL")} תיבות הדואר שלך נבדקו ב-30 הימים האחרונים.`
                ) : (
                    <>
                        נבדקו ב-30 הימים האחרונים:{" "}
                        <b className="font-medium text-slate-900">
                            {c.tested_30d.toLocaleString("he-IL")} מתוך {c.mailboxes.toLocaleString("he-IL")}
                        </b>{" "}
                        תיבות דואר
                        {c.tested_7d > 0 && c.tested_7d < c.tested_30d && ` (${c.tested_7d.toLocaleString("he-IL")} ב-7 הימים האחרונים)`}
                        {c.never_tested > 0 && <span className="text-slate-400"> · {c.never_tested.toLocaleString("he-IL")} מעולם לא נבדקו</span>}
                    </>
                )}
            </span>
            {untested30 > 0 && (
                <button
                    type="button"
                    onClick={onTest}
                    className="ms-auto h-6 px-2 rounded-md border border-slate-200 hover:border-slate-300 bg-white text-[11.5px] font-medium text-slate-700 hover:text-slate-900 inline-flex items-center gap-1.5 transition-colors"
                >
                    <Layers3Icon className="w-3 h-3" />
                    בדוק תיבות שלא נבדקו
                </button>
            )}
        </div>
    );
}

function BatchesTable({ onNew }: { onNew: () => void }) {
    const navigate = useNavigate();
    const list = usePlacementBatches();

    return (
        <section className="flex-1 min-h-0 flex flex-col text-start">
            <SectionBar label="אצוות" count={list.total ?? undefined}>
                <PlacementLegend className="hidden lg:flex" />
            </SectionBar>

            {list.isLoading ? (
                <div className="divide-y divide-slate-200/60">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-12 px-5 flex items-center gap-4">
                            <div className="h-3 w-40 rounded bg-slate-100 animate-pulse" />
                            <div className="h-3 flex-1 rounded bg-slate-50 animate-pulse" />
                        </div>
                    ))}
                </div>
            ) : list.isError ? (
                <EmptyBlock title="לא ניתן לטעון אצוות" body={buildError(list.error as unknown as AppError)} />
            ) : list.batches.length === 0 ? (
                <EmptyBlock
                    title="עדיין אין אצוות בדיקות מיקום"
                    body="הפעל את אותה בדיקה ממספר רב של תיבות דואר בו-זמנית, ובדוק האם תיבת דואר מסוימת, דומיין שלם או ספק נוחתים בספאם."
                    cta={
                        <button
                            type="button"
                            onClick={onNew}
                            className="h-7 px-2.5 rounded-md inline-flex items-center gap-1.5 text-[12px] font-medium bg-sky-600 hover:bg-sky-700 text-white transition-colors"
                        >
                            <Layers3Icon className="w-3.5 h-3.5" />
                            אצווה חדשה
                        </button>
                    }
                />
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-start">
                        <thead>
                            <tr className="h-8 border-b border-slate-200/60 text-[10px] uppercase tracking-[0.14em] text-slate-400">
                                <th className="px-5 font-medium text-start">נושא ושולחים</th>
                                <th className="px-3 font-medium text-start">סטטוס</th>
                                <th className="px-3 font-medium hidden sm:table-cell w-[18%] text-start">איפה זה נחת</th>
                                <th className="px-3 font-medium text-end">דואר נכנס</th>
                                <th className="px-5 font-medium text-end hidden md:table-cell">התחיל</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/60">
                            {list.batches.map((b) => (
                                <BatchRow key={b.id} batch={b} onOpen={() => navigate(`/app/placement/batches/${b.id}`)} />
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

            {list.batches.length > 0 && <PlacementCaveat className="mx-5 my-4" />}
        </section>
    );
}

function BatchRow({ batch, onOpen }: { batch: PlacementBatch; onOpen: () => void }) {
    const s = batch.summary;
    const scope = scopeSummary(batch);
    const running = batch.status === "running" || batch.status === "queued";
    return (
        <tr
            onClick={onOpen}
            onKeyDown={(e) => {
                if (e.key === "Enter") onOpen();
            }}
            tabIndex={0}
            className="h-12 cursor-pointer hover:bg-slate-50/80 transition-colors outline-none focus-visible:bg-slate-50 text-start"
        >
            <td className="px-5 py-2 max-w-0 w-[40%]">
                <div className="text-[12.5px] font-medium text-slate-900 truncate text-start">{batch.subject || "(ללא נושא)"}</div>
                <div className="text-[11.5px] text-slate-500 truncate text-start">
                    {batch.sender_count.toLocaleString("he-IL")} שולחים
                    {scope && ` · ${scope}`}
                </div>
            </td>
            <td className="px-3 py-2">
                <BatchStatusChip status={batch.status} progress={batch.progress} />
                {running && batch.progress.total > 0 && <BatchProgressBar progress={batch.progress} height={3} className="mt-1 w-24" />}
            </td>
            <td className="px-3 py-2 hidden sm:table-cell">{s.total > 0 && <PlacementBar counts={s} />}</td>
            <td className={cn("px-3 py-2 text-end font-mono text-[12px] tabular-nums", rateTone(s.inbox_rate))}>{fmtRate(s.inbox_rate)}</td>
            <td className="px-5 py-2 text-end hidden md:table-cell text-[11px] text-slate-400 whitespace-nowrap">
                <Link to={`/app/placement/batches/${batch.id}`} onClick={(e) => e.stopPropagation()} className="hover:text-slate-700">
                    {fmtDate(batch.started_at ?? batch.created_at)}
                </Link>
            </td>
        </tr>
    );
}

function TestsTable({
    campaignId,
    onClearCampaign,
    onNew,
}: {
    campaignId: string | null;
    onClearCampaign: () => void;
    onNew: () => void;
}) {
    const navigate = useNavigate();
    const list = usePlacementTests(campaignId);
    const campaign = useCampaign(campaignId ?? "");

    return (
        <section className="flex-1 min-h-0 flex flex-col text-start">
            <SectionBar label="בדיקות" count={list.total ?? undefined}>
                {campaignId && (
                    <span className="inline-flex items-center gap-1 h-6 ps-2 pe-1 rounded-md bg-sky-50 text-sky-700 text-[11.5px] max-w-[260px]">
                        <span className="truncate">קמפיין: {campaign.data?.name ?? "…"}</span>
                        <button
                            type="button"
                            onClick={onClearCampaign}
                            aria-label="הצג את כל הבדיקות"
                            className="size-4 rounded inline-flex items-center justify-center hover:bg-sky-100"
                        >
                            <XIcon className="w-3 h-3" />
                        </button>
                    </span>
                )}
                <PlacementLegend className="hidden lg:flex" />
            </SectionBar>

            {list.isLoading ? (
                <div className="divide-y divide-slate-200/60">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-12 px-5 flex items-center gap-4">
                            <div className="h-3 w-40 rounded bg-slate-100 animate-pulse" />
                            <div className="h-3 flex-1 rounded bg-slate-50 animate-pulse" />
                        </div>
                    ))}
                </div>
            ) : list.isError ? (
                <EmptyBlock title="לא ניתן לטעון את הבדיקות" body={buildError(list.error as unknown as AppError)} />
            ) : list.tests.length === 0 ? (
                <EmptyBlock
                    title={campaignId ? "עדיין אין בדיקות עבור קמפיין זה" : "עדיין אין בדיקות מיקום"}
                    body="שלח שלב קמפיין או נוסח משלך לפאנל של תיבות בדיקה ובדוק אם הוא מגיע לתיבת הדואר הנכנס, ללשונית ב-Gmail או לספאם."
                    cta={
                        <button
                            type="button"
                            onClick={onNew}
                            className="h-7 px-2.5 rounded-md inline-flex items-center gap-1.5 text-[12px] font-medium bg-sky-600 hover:bg-sky-700 text-white transition-colors"
                        >
                            <PlusIcon className="w-3.5 h-3.5" />
                            בדיקה חדשה
                        </button>
                    }
                />
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-start">
                        <thead>
                            <tr className="h-8 border-b border-slate-200/60 text-[10px] uppercase tracking-[0.14em] text-slate-400">
                                <th className="px-5 font-medium text-start">שולח ונושא</th>
                                <th className="px-3 font-medium hidden lg:table-cell text-start">פאנל</th>
                                <th className="px-3 font-medium hidden md:table-cell text-start">מעקב</th>
                                <th className="px-3 font-medium text-start">סטטוס</th>
                                <th className="px-3 font-medium hidden sm:table-cell w-[18%] text-start">איפה זה נחת</th>
                                <th className="px-3 font-medium text-end">דואר נכנס</th>
                                <th className="px-5 font-medium text-end hidden md:table-cell">התחיל</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/60">
                            {list.tests.map((t) => (
                                <TestRow key={t.id} test={t} onOpen={() => navigate(`/app/placement/${t.id}`)} />
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

            {list.tests.length > 0 && <PlacementCaveat className="mx-5 my-4" />}
        </section>
    );
}

function TestRow({ test, onOpen }: { test: PlacementTest; onOpen: () => void }) {
    const s = test.summary;
    return (
        <tr
            onClick={onOpen}
            onKeyDown={(e) => {
                if (e.key === "Enter") onOpen();
            }}
            tabIndex={0}
            className="h-12 cursor-pointer hover:bg-slate-50/80 transition-colors outline-none focus-visible:bg-slate-50 text-start"
        >
            <td className="px-5 py-2 max-w-0 w-[34%]">
                <div className="flex items-center gap-1.5 min-w-0">
                    <span dir={test.sender_email ? "ltr" : undefined} className="text-[12.5px] font-medium text-slate-900 truncate text-start">
                        {test.sender_email || "תיבת דואר שנמחקה"}
                    </span>
                    {test.origin !== "manual" && test.origin !== "batch" && (
                        <span className="shrink-0 h-4 px-1.5 rounded bg-slate-100 text-[10px] text-slate-500 inline-flex items-center">
                            {ORIGIN_LABEL[test.origin] ?? test.origin}
                        </span>
                    )}
                    {test.pace === "quick" && (
                        <span className="shrink-0 h-4 px-1.5 rounded bg-sky-50 text-sky-700 text-[10px] inline-flex items-center">
                            קצב מהיר
                        </span>
                    )}
                </div>
                <div className="text-[11.5px] text-slate-500 truncate text-start">{test.subject || "(ללא נושא)"}</div>
            </td>
            <td className="px-3 py-2 hidden lg:table-cell text-[11.5px] text-slate-600 whitespace-nowrap text-start">
                {PANEL_LABEL_HE[test.panel] ?? PANEL_LABEL[test.panel] ?? test.panel}
            </td>
            <td className="px-3 py-2 hidden md:table-cell text-start">
                <TrackingBadge test={test} />
            </td>
            <td className="px-3 py-2 text-start">
                <StatusChip status={test.status} counts={s} />
            </td>
            <td className="px-3 py-2 hidden sm:table-cell text-start">
                <PlacementBar counts={s} />
            </td>
            <td className={cn("px-3 py-2 text-end font-mono text-[12px] tabular-nums", rateTone(s.inbox_rate))}>
                {fmtRate(s.inbox_rate)}
            </td>
            <td className="px-5 py-2 text-end hidden md:table-cell text-[11px] text-slate-400 whitespace-nowrap">
                <Link to={`/app/placement/${test.id}`} onClick={(e) => e.stopPropagation()} className="hover:text-slate-700">
                    {fmtDate(test.created_at)}
                </Link>
            </td>
        </tr>
    );
}
