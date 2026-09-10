// SheetSyncWizard — multi-step modal for creating (or editing) an on-demand
// Google-Sheet → contacts "sync source", and optionally running the first
// "Sync now". Mirrors ImportWizard's dialog shell + house theme, and REUSES
// its column-mapper verbatim (TargetPicker + MapStep + DEDUP_OPTIONS) so the
// /lead-sync/google/preview ImportPreview is mapped with the exact same UI as
// a CSV import.
//
// Steps:
//   1. connect — if no hidden google_sheets OAuth connection exists, run the
//      EXISTING integration OAuth popup (provider "google_sheets").
//   2. sheet   — paste a Sheet ID, fetch its tabs, pick a tab.
//   3. map     — preview first rows + map columns (reused MapStep).
//   4. options — dedup strategy, optional target campaign, optional categories,
//      optional target segments.
//   5. save    — POST /lead-sync/sources, then optionally Sync now → result.

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    AlertTriangleIcon,
    ArrowLeftIcon,
    ArrowRightIcon,
    CheckIcon,
    Loader2Icon,
    PlugZapIcon,
    RefreshCwIcon,
    SaveIcon,
    SheetIcon,
    XIcon,
} from "lucide-react";
import toast from "react-hot-toast";

import { MapStep, ResultStep } from "./ImportWizard";
import { DEDUP_OPTIONS, announceResult, describeError, mappingProblem } from "./importShared";
import CategoryPicker from "./CategoryPicker";
import { Label, TextInput } from "@/components/ui/field";
import {
    PopoverMenu,
    PopoverMenuContent,
    PopoverMenuItem,
    PopoverMenuLabel,
    PopoverMenuTrigger,
    SelectButton,
} from "@/components/ui/popover-menu";
import {
    useFinishIntegrationOAuth,
    useStartIntegrationOAuth,
} from "@/lib/api/hooks/app/integrations/useIntegrationOAuth";
import { openOAuthPopup } from "@/lib/integrations/oauthPopup";
import CampaignPicker from "@/components/app/campaigns/CampaignPicker";
import { SegmentMultiPicker } from "@/components/app/segments/SegmentPickers";
import useGoogleConnection from "@/lib/api/hooks/app/leadsync/useGoogleConnection";
import {
    useGetSpreadsheet,
    usePreviewSheet,
} from "@/lib/api/hooks/app/leadsync/useSheetMeta";
import useCreateLeadSyncSource from "@/lib/api/hooks/app/leadsync/useCreateLeadSyncSource";
import useSyncLeadSyncSource from "@/lib/api/hooks/app/leadsync/useSyncLeadSyncSource";
import { useQueryClient } from "@tanstack/react-query";
import type {
    ImportColumnMapping,
    ImportDedupStrategy,
    ImportPreview,
    ImportResult,
    LeadSyncSource,
    SheetMeta,
} from "@/lib/api/models/app/leadsync/LeadSync";

type Step = "connect" | "sheet" | "map" | "options" | "result";

interface Props {
    open: boolean;
    onClose: () => void;
    // When set, the source is pre-targeted to this campaign and the campaign
    // picker is hidden — used by the per-campaign "Connect a Google Sheet".
    lockedCampaign?: { id: string; name: string };
    // When set (a segment's member list), every synced row is pinned into this
    // segment on each run, the same way the file importer's target works.
    lockedSegment?: { id: string; name: string; color?: string };
    // Notified after a source is saved so callers can refresh their list.
    onSaved?: (source: LeadSyncSource) => void;
}

const STEP_ORDER: Step[] = ["connect", "sheet", "map", "options", "result"];

export default function SheetSyncWizard({ open, onClose, lockedCampaign, lockedSegment, onSaved }: Props) {
    const connection = useGoogleConnection();
    const connectionId = connection.data?.connection?.id ?? null;
    const connected = !!connection.data?.connected && !!connectionId;

    const [step, setStep] = React.useState<Step>("connect");
    const [sheetId, setSheetId] = React.useState("");
    const [meta, setMeta] = React.useState<SheetMeta | null>(null);
    const [tabTitle, setTabTitle] = React.useState("");
    const [preview, setPreview] = React.useState<ImportPreview | null>(null);
    const [mapping, setMapping] = React.useState<ImportColumnMapping[]>([]);
    const [hasHeader, setHasHeader] = React.useState(true);
    const [dedup, setDedup] = React.useState<ImportDedupStrategy>("update");
    const [campaignId, setCampaignId] = React.useState<string | null>(lockedCampaign?.id ?? null);
    const [campaignName, setCampaignName] = React.useState<string>(lockedCampaign?.name ?? "");
    const [categoryIds, setCategoryIds] = React.useState<string[]>([]);
    const [segmentIds, setSegmentIds] = React.useState<string[]>([]);
    const [label, setLabel] = React.useState("");
    const [result, setResult] = React.useState<ImportResult | null>(null);
    const [busy, setBusy] = React.useState(false);

    const startOAuth = useStartIntegrationOAuth();
    const finishOAuth = useFinishIntegrationOAuth();
    const getSpreadsheet = useGetSpreadsheet();
    const previewSheet = usePreviewSheet();
    const createSource = useCreateLeadSyncSource();
    const syncSource = useSyncLeadSyncSource();
    const queryClient = useQueryClient();

    const reset = React.useCallback(() => {
        setStep("connect");
        setSheetId("");
        setMeta(null);
        setTabTitle("");
        setPreview(null);
        setMapping([]);
        setHasHeader(true);
        setDedup("update");
        setCampaignId(lockedCampaign?.id ?? null);
        setCampaignName(lockedCampaign?.name ?? "");
        setCategoryIds([]);
        setSegmentIds([]);
        setLabel("");
        setResult(null);
        setBusy(false);
    }, [lockedCampaign]);

    React.useEffect(() => {
        if (!open) reset();
    }, [open, reset]);

    // Skip straight to the sheet step once we know a connection exists.
    React.useEffect(() => {
        if (open && step === "connect" && connected) setStep("sheet");
    }, [open, step, connected]);

    async function runConnect() {
        setBusy(true);
        try {
            const { url } = await startOAuth.mutateAsync({
                provider: "google_sheets",
                label: "Google Sheets",
            });
            const { code, state } = await openOAuthPopup(url);
            await finishOAuth.mutateAsync({ code, state });
            await connection.refetch();
            await queryClient.invalidateQueries({ queryKey: ["lead-sync", "google", "connection"] });
            toast.success("החיבור ל-Google Sheets הצליח");
            setStep("sheet");
        } catch (err) {
            toast.error(describeError(err, "החיבור נכשל."));
        } finally {
            setBusy(false);
        }
    }

    async function loadTabs() {
        if (!connectionId) return;
        const id = sheetId.trim();
        if (!id) {
            toast.error("יש להדביק מזהה גיליון תחילה.");
            return;
        }
        setBusy(true);
        try {
            const m = await getSpreadsheet.mutateAsync({ connection_id: connectionId, sheet_id: id });
            setMeta(m);
            // Auto-select the first tab so the picker is never empty.
            const first = m.tabs[0]?.title ?? "";
            setTabTitle(first);
            if (!label.trim()) setLabel(m.title);
        } catch (err) {
            toast.error(describeError(err, "לא ניתן היה לקרוא את הגיליון."));
            setMeta(null);
        } finally {
            setBusy(false);
        }
    }

    async function loadPreview() {
        if (!connectionId || !meta) return;
        if (!tabTitle) {
            toast.error("יש לבחור לשונית תחילה.");
            return;
        }
        setBusy(true);
        try {
            const p = await previewSheet.mutateAsync({
                connection_id: connectionId,
                sheet_id: meta.sheet_id,
                tab_title: tabTitle,
            });
            setPreview(p);
            setMapping(p.suggested_mapping);
            setHasHeader(p.has_header);
            setStep("map");
        } catch (err) {
            toast.error(describeError(err, "לא ניתן היה לקרוא את הלשונית."));
        } finally {
            setBusy(false);
        }
    }

    // Same gate as the file importer: a saved source with an unusable custom
    // field name is rejected by the API, so catch it on the mapping screen.
    const mapProblem = mappingProblem(mapping);

    // The segment the wizard was opened inside always travels with the source.
    const targetSegmentIds = React.useMemo(
        () => (lockedSegment ? [lockedSegment.id, ...segmentIds.filter((id) => id !== lockedSegment.id)] : segmentIds),
        [lockedSegment, segmentIds],
    );

    async function save(runSync: boolean) {
        if (!connectionId || !meta) return;
        setBusy(true);
        try {
            const source = await createSource.mutateAsync({
                connection_id: connectionId,
                sheet_id: meta.sheet_id,
                sheet_title: meta.title,
                tab_title: tabTitle,
                has_header: hasHeader,
                column_mapping: mapping,
                dedup,
                target_campaign_id: campaignId ?? undefined,
                category_ids: categoryIds,
                segment_ids: targetSegmentIds,
                subscribed_default: true,
                label: label.trim() || meta.title,
            });
            onSaved?.(source);
            if (runSync) {
                const res = await syncSource.mutateAsync(source.id);
                setResult(res.result);
                setStep("result");
                announceResult(res.result);
            } else {
                toast.success("מקור הסנכרון נשמר");
                onClose();
            }
        } catch (err) {
            toast.error(describeError(err, "לא ניתן היה לשמור את מקור הסנכרון."));
        } finally {
            setBusy(false);
        }
    }

    function stepIndex(): number {
        // Hide the connect dot once connected — the visible flow is 4 steps.
        const visible = connected ? STEP_ORDER.filter((s) => s !== "connect") : STEP_ORDER;
        return Math.max(0, visible.indexOf(step));
    }
    const visibleSteps = connected ? STEP_ORDER.filter((s) => s !== "connect") : STEP_ORDER;

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    key="overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onClick={onClose}
                    className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/30 backdrop-blur-[2px] px-4"
                >
                    <motion.div
                        key="card"
                        initial={{ y: 8, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 8, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-[760px] rounded-lg bg-white border border-slate-200 shadow-[0_24px_48px_-12px_rgba(15,23,42,0.18),0_8px_16px_-8px_rgba(15,23,42,0.1)] overflow-hidden flex flex-col max-h-[90dvh]"
                    >
                        <header className="h-12 px-4 border-b border-slate-200 flex items-center gap-2.5 shrink-0">
                            <div className="size-5 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <SheetIcon className="w-3 h-3" />
                            </div>
                            <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">
                                מקור סנכרון
                            </span>
                            <div className="h-4 w-px bg-slate-200" />
                            <span className="text-[12.5px] text-slate-900 font-medium">Google Sheets</span>
                            <div className="hidden sm:flex items-center gap-1 ms-2">
                                {visibleSteps.map((_, idx) => (
                                    <span
                                        key={idx}
                                        className={`h-1 w-5 rounded-full transition-colors ${
                                            idx <= stepIndex() ? "bg-slate-900" : "bg-slate-200"
                                        }`}
                                    />
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="סגירה"
                                className="ms-auto size-7 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center justify-center transition-colors"
                            >
                                <XIcon className="w-3.5 h-3.5" />
                            </button>
                        </header>

                        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
                            {step === "connect" && (
                                <ConnectStep busy={busy || connection.isLoading} onConnect={runConnect} />
                            )}
                            {step === "sheet" && (
                                <SheetStep
                                    sheetId={sheetId}
                                    setSheetId={setSheetId}
                                    meta={meta}
                                    tabTitle={tabTitle}
                                    setTabTitle={setTabTitle}
                                    onLoadTabs={loadTabs}
                                    busy={busy}
                                />
                            )}
                            {step === "map" && preview && (
                                <MapStep
                                    preview={preview}
                                    mapping={mapping}
                                    setMapping={setMapping}
                                    hasHeader={hasHeader}
                                    setHasHeader={setHasHeader}
                                />
                            )}
                            {step === "options" && (
                                <OptionsStep
                                    dedup={dedup}
                                    setDedup={setDedup}
                                    label={label}
                                    setLabel={setLabel}
                                    campaignId={campaignId}
                                    campaignName={campaignName}
                                    onCampaign={(id, name) => {
                                        setCampaignId(id);
                                        setCampaignName(name);
                                    }}
                                    lockedCampaign={lockedCampaign}
                                    categoryIds={categoryIds}
                                    setCategoryIds={setCategoryIds}
                                    segmentIds={segmentIds}
                                    setSegmentIds={setSegmentIds}
                                    lockedSegment={lockedSegment}
                                />
                            )}
                            {step === "result" && result && (
                                <ResultStep result={result} filename={meta?.title ?? "sync"} />
                            )}
                        </div>

                        <footer className="min-h-12 py-1.5 md:py-0 px-3 border-t border-slate-200 flex flex-wrap items-center gap-1.5 shrink-0 bg-slate-50/30">
                            {step === "connect" && (
                                <span className="ms-auto text-[11px] text-slate-400">
                                    אנו משתמשים בהרשאת Google Sheets הקיימת שלך.
                                </span>
                            )}
                            {step === "sheet" && (
                                <>
                                    {connected && !lockedCampaign && (
                                        <span className="text-[11px] text-slate-400">
                                            מחובר ל-Google.
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={loadPreview}
                                        disabled={busy || !meta || !tabTitle}
                                        className="ms-auto h-7 px-3 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                                    >
                                        {busy ? (
                                            <Loader2Icon className="w-3 h-3 animate-spin" />
                                        ) : (
                                            <ArrowRightIcon className="w-3 h-3 rtl:rotate-180" />
                                        )}
                                        תצוגה מקדימה של שורות
                                    </button>
                                </>
                            )}
                            {step === "map" && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setStep("sheet")}
                                        className="h-7 px-2.5 rounded-md text-[12px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center gap-1.5 transition-colors"
                                    >
                                        <ArrowLeftIcon className="w-3 h-3 rtl:rotate-180" />
                                        חזרה
                                    </button>
                                    {mapProblem && (
                                        <span className="text-[11px] text-amber-700 inline-flex items-center gap-1">
                                            <AlertTriangleIcon className="w-3 h-3 shrink-0" />
                                            {mapProblem}
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setStep("options")}
                                        disabled={!!mapProblem}
                                        className="ms-auto h-7 px-3 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                                    >
                                        המשך
                                        <ArrowRightIcon className="w-3 h-3 rtl:rotate-180" />
                                    </button>
                                </>
                            )}
                            {step === "options" && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setStep("map")}
                                        className="h-7 px-2.5 rounded-md text-[12px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center gap-1.5 transition-colors"
                                    >
                                        <ArrowLeftIcon className="w-3 h-3 rtl:rotate-180" />
                                        חזרה
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => save(false)}
                                        disabled={busy}
                                        className="ms-auto h-7 px-3 rounded-md border border-slate-200 text-[12px] text-slate-700 hover:border-slate-300 hover:text-slate-900 inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                                    >
                                        <SaveIcon className="w-3 h-3" />
                                        שמירה בלבד
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => save(true)}
                                        disabled={busy}
                                        className="h-7 px-3 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                                    >
                                        {busy ? (
                                            <Loader2Icon className="w-3 h-3 animate-spin" />
                                        ) : (
                                            <RefreshCwIcon className="w-3 h-3" />
                                        )}
                                        שמירה וסנכרון עכשיו
                                    </button>
                                </>
                            )}
                            {step === "result" && (
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="ms-auto h-7 px-3 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-medium transition-colors"
                                >
                                    סיום
                                </button>
                            )}
                        </footer>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// ----- Connect step ----------------------------------------------

function ConnectStep({ busy, onConnect }: { busy: boolean; onConnect: () => void }) {
    return (
        <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 p-6 text-center">
                <div className="mx-auto size-10 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <SheetIcon className="w-5 h-5" />
                </div>
                <p className="text-[13px] text-slate-900 font-medium mt-3">חיבור Google Sheets</p>
                <p className="text-[11.5px] text-slate-500 mt-1 max-w-[42ch] mx-auto leading-relaxed">
                    הרשאת Warmbly לקריאת גיליונות אלקטרוניים. אנו קוראים רק את השורות בלשונית שתבחר: שום דבר אינו נכתב בחזרה.
                </p>
                <button
                    type="button"
                    onClick={onConnect}
                    disabled={busy}
                    className="mt-4 h-8 px-4 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                >
                    {busy ? (
                        <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        <PlugZapIcon className="w-3.5 h-3.5" />
                    )}
                    {busy ? "מתחבר..." : "התחברות באמצעות Google"}
                </button>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50/40 p-3">
                <ul className="text-[11px] text-slate-500 space-y-0.5 list-disc ps-4 leading-snug">
                    <li>שורה אחת לכל איש קשר: השורה הראשונה צריכה להכיל את כותרות העמודות.</li>
                    <li>לפחות עמודה אחת המכילה כתובות אימייל.</li>
                    <li>הסנכרון הוא לפי דרישה: דבר לא יסונכרן עד שתלחץ על 'סנכרן עכשיו'.</li>
                </ul>
            </div>
        </div>
    );
}

// ----- Sheet + tab step ------------------------------------------

function SheetStep({
    sheetId,
    setSheetId,
    meta,
    tabTitle,
    setTabTitle,
    onLoadTabs,
    busy,
}: {
    sheetId: string;
    setSheetId: (v: string) => void;
    meta: SheetMeta | null;
    tabTitle: string;
    setTabTitle: (v: string) => void;
    onLoadTabs: () => void;
    busy: boolean;
}) {
    return (
        <div className="space-y-4">
            <section>
                <Label>מזהה גיליון (Spreadsheet ID)</Label>
                <div className="flex items-center gap-1.5">
                    <TextInput
                        value={sheetId}
                        onChange={setSheetId}
                        placeholder="1AbC…XyZ"
                        className="font-mono flex-1 text-start"
                    />
                    <button
                        type="button"
                        onClick={onLoadTabs}
                        disabled={busy || !sheetId.trim()}
                        className="h-7 px-3 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0"
                    >
                        {busy ? <Loader2Icon className="w-3 h-3 animate-spin" /> : null}
                        טעינת לשוניות
                    </button>
                </div>
                <p className="text-[10.5px] text-slate-400 mt-1 leading-relaxed">
                    המזהה הארוך בכתובת ה-URL של הגיליון בין <code className="font-mono">/d/</code> לבין{" "}
                    <code className="font-mono">/edit</code>.
                </p>
            </section>

            {meta && (
                <section className="space-y-2">
                    <div className="flex items-center gap-2">
                        <SheetIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="text-[12.5px] text-slate-900 font-medium truncate">{meta.title}</span>
                        <span className="text-[11px] text-slate-400">{meta.tabs.length} לשוניות</span>
                    </div>
                    <Label>לשונית לייבוא</Label>
                    <PopoverMenu align="start">
                        <PopoverMenuTrigger asChild>
                            <SelectButton label={tabTitle || "בחר לשונית..."} className="w-full" />
                        </PopoverMenuTrigger>
                        <PopoverMenuContent minWidth={260}>
                            <PopoverMenuLabel>לשוניות</PopoverMenuLabel>
                            {meta.tabs.map((t) => (
                                <PopoverMenuItem
                                    key={`${t.index}-${t.title}`}
                                    selected={t.title === tabTitle}
                                    onSelect={() => setTabTitle(t.title)}
                                >
                                    {t.title}
                                </PopoverMenuItem>
                            ))}
                        </PopoverMenuContent>
                    </PopoverMenu>
                </section>
            )}
        </div>
    );
}

// ----- Options step ----------------------------------------------

function OptionsStep({
    dedup,
    setDedup,
    label,
    setLabel,
    campaignId,
    campaignName,
    onCampaign,
    lockedCampaign,
    categoryIds,
    setCategoryIds,
    segmentIds,
    setSegmentIds,
    lockedSegment,
}: {
    dedup: ImportDedupStrategy;
    setDedup: (v: ImportDedupStrategy) => void;
    label: string;
    setLabel: (v: string) => void;
    campaignId: string | null;
    campaignName: string;
    onCampaign: (id: string | null, name: string) => void;
    lockedCampaign?: { id: string; name: string };
    categoryIds: string[];
    setCategoryIds: (v: string[]) => void;
    segmentIds: string[];
    setSegmentIds: (v: string[]) => void;
    lockedSegment?: { id: string; name: string; color?: string };
}) {
    return (
        <div className="space-y-5">
            <section>
                <Label>תווית מקור</Label>
                <TextInput value={label} onChange={setLabel} placeholder="גיליון הלידים שלי" />
                <p className="text-[10.5px] text-slate-400 mt-1">
                    מוצג ברשימת מקורות הסנכרון שלך. ברירת המחדל היא שם הגיליון.
                </p>
            </section>

            <section>
                <h2 className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500 mb-2">
                    טיפול בכפילויות
                </h2>
                <p className="text-[11px] text-slate-400 leading-tight mb-3">
                    מניעת כפילויות מתבצעת לפי כתובת אימייל באותיות קטנות בכל סנכרון. בחר כיצד לנהוג כאשר שורה תואמת לאיש קשר קיים.
                </p>
                <div className="space-y-2">
                    {DEDUP_OPTIONS.map((opt) => (
                        <label
                            key={opt.id}
                            className={`block rounded-md border p-2.5 cursor-pointer transition-colors ${
                                dedup === opt.id
                                    ? "border-slate-900 bg-slate-50"
                                    : "border-slate-200 hover:border-slate-300"
                            }`}
                        >
                            <div className="flex items-start gap-2">
                                <input
                                    type="radio"
                                    name="leadsync-dedup"
                                    className="mt-0.5 accent-slate-900"
                                    checked={dedup === opt.id}
                                    onChange={() => setDedup(opt.id)}
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="text-[12px] font-medium text-slate-900 leading-tight">
                                        {opt.label}
                                    </div>
                                    <div className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                        {opt.hint}
                                    </div>
                                </div>
                            </div>
                        </label>
                    ))}
                </div>
            </section>

            <section>
                <h2 className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500 mb-2">
                    רישום לקמפיין
                </h2>
                {lockedCampaign ? (
                    <div className="rounded-md border border-sky-200 bg-sky-50/60 px-3 py-2 flex items-center gap-2">
                        <CheckIcon className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        <span className="text-[12px] text-slate-800">
                            לידים חדשים ומעודכנים יצטרפו ל-{" "}
                            <span className="font-medium">{lockedCampaign.name}</span>.
                        </span>
                    </div>
                ) : (
                    <>
                        <p className="text-[11px] text-slate-400 leading-tight mb-2">
                            רישום אופציונלי של כל איש קשר מסונכרן לקמפיין.
                        </p>
                        <CampaignPicker
                            campaignId={campaignId}
                            campaignName={campaignName}
                            onChange={onCampaign}
                        />
                    </>
                )}
            </section>

            <section>
                <h2 className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500 mb-2">
                    החלת קטגוריות
                </h2>
                <p className="text-[11px] text-slate-400 leading-tight mb-2">
                    כל איש קשר מסונכרן יקבל קטגוריות אלו. דלג כדי להשאירם ללא תיוג.
                </p>
                <CategoryPicker value={categoryIds} onChange={setCategoryIds} />
            </section>

            <section>
                <h2 className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500 mb-2">
                    הוספה למקטעים
                </h2>
                <p className="text-[11px] text-slate-400 leading-tight mb-2">
                    {lockedSegment
                        ? "כל איש קשר מסונכרן יוצמד למקטע זה בכל הרצה, ללא תלות בתנאי המקטע. ניתן להוסיף מקטעים נוספים למטה."
                        : "כל איש קשר מסונכרן יוצמד למקטעים אלו בכל הרצה. מקטע המקושר לקמפיין ירשום אותם אליו אוטומטית."}
                </p>
                {lockedSegment && (
                    <div className="mb-2 flex items-center gap-1.5 rounded-md border border-sky-200 bg-sky-50/60 px-2 h-7">
                        <span
                            className="size-2 rounded-full shrink-0"
                            style={{ backgroundColor: lockedSegment.color ?? "#0284c7" }}
                        />
                        <span className="text-[12px] font-medium text-sky-900 truncate">{lockedSegment.name}</span>
                        <span className="ms-auto text-[10px] uppercase tracking-[0.14em] text-sky-700 shrink-0">
                            תמיד
                        </span>
                    </div>
                )}
                <SegmentMultiPicker value={segmentIds} onChange={setSegmentIds} exclude={lockedSegment?.id} />
            </section>
        </div>
    );
}

