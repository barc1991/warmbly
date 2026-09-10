// ImportWizard — multi-step modal for importing contacts from
// CSV / XLSX. Driven by the two-step backend API:
//
//   1. Upload  — drag & drop or file picker. We do NOT parse the file
//      on the client; the server is the source of truth, and re-doing
//      the work in JS just to "preview" introduces format-handling
//      drift. We do show a friendly waiting state.
//   2. Map     — the server returns columns + suggestions; the user
//      reviews and tweaks. Email is required and auto-mapped if
//      anything looks like an email column.
//   3. Options — dedup strategy, categories to apply, campaigns and
//      segments to join. These are global to the import; per-row
//      overrides happen post-import via bulk edit.
//   4. Result  — summary counts + per-row errors. Errors can be
//      downloaded as a CSV the user can fix and re-import.
//
// The same file is re-uploaded on commit so we don't need session
// state. The user can navigate back through steps without losing
// their mapping work.

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    AlertTriangleIcon,
    ArrowLeftIcon,
    ArrowRightIcon,
    CheckCircle2Icon,
    DownloadIcon,
    FileSpreadsheetIcon,
    Loader2Icon,
    ShieldCheckIcon,
    UploadCloudIcon,
    XIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";

import {
    importPreviewContacts,
    importCommitContacts,
    type ImportColumnMapping,
    type ImportDedupStrategy,
    type ImportPreview,
    type ImportResult,
} from "@/lib/api/client/app/contacts/importContacts";
import {
    PopoverMenu,
    PopoverMenuContent,
    PopoverMenuItem,
    PopoverMenuLabel,
    PopoverMenuTrigger,
    SelectButton,
} from "@/components/ui/popover-menu";
import { Label, TextInput } from "@/components/ui/field";
import CategoryPicker from "./CategoryPicker";
import { CampaignMultiPicker, SegmentMultiPicker } from "@/components/app/segments/SegmentPickers";
import { useSegments } from "@/lib/api/hooks/app/segments";
import { downloadBlob } from "@/lib/api/client/app/contacts/exportContacts";
import {
    CUSTOM_KEY_RULES,
    DEDUP_OPTIONS,
    STANDARD_TARGETS,
    VERIFICATION_VOCABULARY_LABELS,
    describeError,
    isCustomTarget,
    isValidCustomKey,
    mappingProblem,
    suggestCustomKey,
} from "./importShared";

interface Props {
    open: boolean;
    onClose: () => void;
    // When set (the campaign Leads tab), imported contacts are attached to this
    // campaign and the wizard shows a read-only "Adding to …" indicator.
    lockedCampaign?: { id: string; name: string };
    // When set (a segment's member list), every imported row is pinned into
    // this segment, the same way the campaign target works. Without it an
    // import started from inside a segment created contacts that were nowhere
    // in it (issue #381).
    lockedSegment?: { id: string; name: string; color?: string };
}

type Step = "upload" | "map" | "options" | "result";

export default function ImportWizard({ open, onClose, lockedCampaign, lockedSegment }: Props) {
    const [step, setStep] = React.useState<Step>("upload");
    const [file, setFile] = React.useState<File | null>(null);
    const [preview, setPreview] = React.useState<ImportPreview | null>(null);
    const [mapping, setMapping] = React.useState<ImportColumnMapping[]>([]);
    const [hasHeader, setHasHeader] = React.useState<boolean>(true);
    const [dedup, setDedup] = React.useState<ImportDedupStrategy>("skip");
    const [categoryIds, setCategoryIds] = React.useState<string[]>([]);
    const [campaignIds, setCampaignIds] = React.useState<string[]>([]);
    const [segmentIds, setSegmentIds] = React.useState<string[]>([]);
    const [previewBusy, setPreviewBusy] = React.useState<boolean>(false);
    const [commitBusy, setCommitBusy] = React.useState<boolean>(false);
    const [result, setResult] = React.useState<ImportResult | null>(null);
    const queryClient = useQueryClient();
    const segments = useSegments(open);

    function reset() {
        setStep("upload");
        setFile(null);
        setPreview(null);
        setMapping([]);
        setHasHeader(true);
        setDedup("skip");
        setCategoryIds([]);
        setCampaignIds([]);
        setSegmentIds([]);
        setResult(null);
    }

    React.useEffect(() => {
        if (!open) reset();
    }, [open]);

    async function onFileChosen(f: File) {
        setFile(f);
        setPreviewBusy(true);
        try {
            const p = await importPreviewContacts(f);
            setPreview(p);
            setMapping(p.suggested_mapping);
            setHasHeader(p.has_header);
            setStep("map");
        } catch (err) {
            const msg = describeError(err, "Failed to read file.");
            toast.error(msg);
            setFile(null);
        } finally {
            setPreviewBusy(false);
        }
    }

    // The segment the wizard was opened inside always travels with the
    // import, whether or not the user opened the options step.
    const targetSegmentIds = React.useMemo(
        () => (lockedSegment ? [lockedSegment.id, ...segmentIds.filter((id) => id !== lockedSegment.id)] : segmentIds),
        [lockedSegment, segmentIds],
    );

    // What the result step names back. A segment the list has not loaded
    // falls back to the locked one's name rather than showing an id.
    const pinnedSegmentNames = React.useMemo(() => {
        const byId = new Map((segments.data ?? []).map((seg) => [seg.id, seg.name]));
        return targetSegmentIds.map((id) => byId.get(id) ?? (id === lockedSegment?.id ? lockedSegment.name : "a segment"));
    }, [segments.data, targetSegmentIds, lockedSegment]);

    async function commit() {
        if (!file || !preview) return;
        setCommitBusy(true);
        try {
            const res = await importCommitContacts(file, {
                mapping,
                dedup,
                has_header: hasHeader,
                category_ids: categoryIds.length > 0 ? categoryIds : undefined,
                campaign_ids: lockedCampaign ? [lockedCampaign.id] : campaignIds.length > 0 ? campaignIds : undefined,
                segment_ids: targetSegmentIds.length > 0 ? targetSegmentIds : undefined,
            });
            setResult(res);
            setStep("result");
            // Segment counts and pinned-member lists move with the import, so
            // the page behind the wizard is right before the spine event lands.
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["contacts"] }),
                queryClient.invalidateQueries({ queryKey: ["segments"] }),
            ]);
            if (res.failed === 0) {
                toast.success(`יובאו ${res.imported} · עודכנו ${res.updated} · דולגו ${res.skipped}`);
            } else {
                toast(`הסתיים עם ${res.failed} שגיאות`, { icon: "⚠️" });
            }
        } catch (err) {
            toast.error(describeError(err, "הייבוא נכשל."));
        } finally {
            setCommitBusy(false);
        }
    }

    // Any reason the mapping can't be committed (missing email, an unnamed or
    // unusable custom-field name). Caught here so a mistyped field name costs
    // one glance instead of a whole import.
    const mapProblem = mappingProblem(mapping);

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
                            <div className="size-5 rounded bg-slate-100 text-slate-600 flex items-center justify-center">
                                <UploadCloudIcon className="w-3 h-3" />
                            </div>
                            <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">
                                ייבוא
                            </span>
                            <div className="h-4 w-px bg-slate-200" />
                            <span className="text-[12.5px] text-slate-900 font-medium">
                                {lockedCampaign ? "לידים" : "אנשי קשר"}
                            </span>
                            {lockedCampaign && (
                                <span className="hidden sm:inline-flex items-center h-5 px-1.5 rounded bg-sky-50 text-sky-700 text-[10px] font-medium max-w-[180px] truncate">
                                    ← {lockedCampaign.name}
                                </span>
                            )}
                            {lockedSegment && (
                                <span className="hidden sm:inline-flex items-center gap-1 h-5 px-1.5 rounded bg-sky-50 text-sky-700 text-[10px] font-medium max-w-[180px]">
                                    <span className="shrink-0">←</span>
                                    {lockedSegment.color && (
                                        <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: lockedSegment.color }} />
                                    )}
                                    <span className="truncate">{lockedSegment.name}</span>
                                </span>
                            )}
                            <StepDots step={step} />
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
                            {step === "upload" && (
                                <UploadStep
                                    file={file}
                                    onFile={onFileChosen}
                                    busy={previewBusy}
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
                                    categoryIds={categoryIds}
                                    setCategoryIds={setCategoryIds}
                                    campaignIds={campaignIds}
                                    setCampaignIds={setCampaignIds}
                                    segmentIds={segmentIds}
                                    setSegmentIds={setSegmentIds}
                                    campaignLocked={!!lockedCampaign}
                                    lockedSegment={lockedSegment}
                                />
                            )}
                            {step === "result" && result && (
                                <ResultStep
                                    result={result}
                                    filename={file?.name ?? "import"}
                                    pinnedSegments={pinnedSegmentNames}
                                />
                            )}
                        </div>

                        <footer className="min-h-12 py-1.5 md:py-0 px-3 border-t border-slate-200 flex flex-wrap items-center gap-1.5 shrink-0 bg-slate-50/30">
                            {step === "upload" && (
                                <>
                                    <span className="text-[11px] text-slate-400">
                                        קובצי CSV, TSV או XLSX. עד 50 מ״ב · 50,000 שורות.
                                    </span>
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="ms-auto h-7 px-2.5 rounded-md text-[12px] text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                                    >
                                        ביטול
                                    </button>
                                </>
                            )}
                            {step === "map" && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setStep("upload")}
                                        className="h-7 px-2.5 rounded-md text-[12px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center gap-1.5 transition-colors"
                                    >
                                        <ArrowLeftIcon className="w-3 h-3 rtl:rotate-180" />
                                        העלאה מחדש
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
                                        onClick={commit}
                                        disabled={commitBusy}
                                        className="ms-auto h-7 px-3 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                                    >
                                        {commitBusy ? (
                                            <Loader2Icon className="w-3 h-3 animate-spin" />
                                        ) : (
                                            <UploadCloudIcon className="w-3 h-3" />
                                        )}
                                        ייבוא {preview ? preview.total_rows.toLocaleString() : ""} שורות
                                    </button>
                                </>
                            )}
                            {step === "result" && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            reset();
                                        }}
                                        className="h-7 px-2.5 rounded-md text-[12px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                                    >
                                        ייבוא קובץ נוסף
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="ms-auto h-7 px-3 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-medium transition-colors"
                                    >
                                        סיום
                                    </button>
                                </>
                            )}
                        </footer>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

function StepDots({ step }: { step: Step }) {
    const order: Step[] = ["upload", "map", "options", "result"];
    const i = order.indexOf(step);
    return (
        <div className="hidden sm:flex items-center gap-1 ms-2">
            {order.map((_, idx) => (
                <span
                    key={idx}
                    className={`h-1 w-5 rounded-full transition-colors ${
                        idx <= i ? "bg-slate-900" : "bg-slate-200"
                    }`}
                />
            ))}
        </div>
    );
}

// ----- Upload step ------------------------------------------------

function UploadStep({
    file,
    onFile,
    busy,
}: {
    file: File | null;
    onFile: (f: File) => void;
    busy: boolean;
}) {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = React.useState(false);

    function pickFile() {
        inputRef.current?.click();
    }

    function onDrop(e: React.DragEvent<HTMLDivElement>) {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
    }

    return (
        <div className="space-y-3">
            <input
                ref={inputRef}
                type="file"
                accept=".csv,.tsv,.txt,.xlsx,.xlsm"
                className="hidden"
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onFile(f);
                    e.target.value = "";
                }}
            />
            <div
                onClick={pickFile}
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={`rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
                    dragging
                        ? "border-slate-900 bg-slate-50"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                }`}
            >
                {busy ? (
                    <>
                        <Loader2Icon className="w-7 h-7 mx-auto text-slate-400 animate-spin" />
                        <p className="text-[12.5px] text-slate-700 font-medium mt-3">
                            קורא את הקובץ...
                        </p>
                    </>
                ) : file ? (
                    <>
                        <FileSpreadsheetIcon className="w-7 h-7 mx-auto text-emerald-600" />
                        <p className="text-[12.5px] text-slate-900 font-medium mt-3">
                            {file.name}
                        </p>
                        <p className="text-[11.5px] text-slate-500 mt-1">
                            {(file.size / 1024).toFixed(1)} KB · לחץ לבחירת קובץ אחר להחלפה
                        </p>
                    </>
                ) : (
                    <>
                        <UploadCloudIcon className="w-7 h-7 mx-auto text-slate-400" />
                        <p className="text-[13px] text-slate-900 font-medium mt-3">
                            גרור ושחרר קובץ לכאן
                        </p>
                        <p className="text-[11.5px] text-slate-500 mt-1">
                            או לחץ לעיון בקבצים (CSV, TSV או XLSX)
                        </p>
                    </>
                )}
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50/40 p-3">
                <p className="text-[11px] text-slate-700 font-medium mb-1">
                    הנחיות למבנה הקובץ
                </p>
                <ul className="text-[11px] text-slate-500 space-y-0.5 list-disc ps-4 leading-snug">
                    <li>שורה אחת לכל איש קשר. השורה הראשונה צריכה להכיל כותרות עמודות.</li>
                    <li>לפחות עמודה אחת המכילה כתובות אימייל.</li>
                    <li>עמודות שלא נזהה יישארו ללא שינוי: תוכל למפות אותן בשלב הבא.</li>
                    <li>מניעת כפילויות מבוססת על כתובת אימייל באותיות קטנות. בחר כיצד לטפל בהתאמות קיימות במסך הבא.</li>
                </ul>
            </div>
        </div>
    );
}

// ----- Map step --------------------------------------------------

export function MapStep({
    preview,
    mapping,
    setMapping,
    hasHeader,
    setHasHeader,
}: {
    preview: ImportPreview;
    mapping: ImportColumnMapping[];
    setMapping: React.Dispatch<React.SetStateAction<ImportColumnMapping[]>>;
    hasHeader: boolean;
    setHasHeader: (v: boolean) => void;
}) {
    function updateMapping(idx: number, next: ImportColumnMapping) {
        setMapping((cur) =>
            cur.map((m) => (m.index === idx ? next : m)).concat(cur.some((m) => m.index === idx) ? [] : [next]),
        );
    }

    function getMapping(idx: number): ImportColumnMapping {
        return mapping.find((m) => m.index === idx) ?? { index: idx, target: "ignore" };
    }

    // Columns we didn't recognise default to Ignore, which means a CRM export
    // with a dozen extra columns is a dozen dropdowns. Offer the obvious bulk
    // action for the ones whose header is already a usable field name.
    // Only with a real header row: without one the columns are synthesised
    // ("Column 4"), which is a legal field name but never the one you want.
    const claimable = !hasHeader
        ? []
        : preview.columns
              .map((header, idx) => ({ idx, key: suggestCustomKey(header) }))
              .filter(({ idx, key }) => key !== "" && getMapping(idx).target === "ignore");

    function claimAllAsCustom() {
        setMapping((cur) => {
            const next = [...cur];
            for (const { idx, key } of claimable) {
                const at = next.findIndex((m) => m.index === idx);
                const entry: ImportColumnMapping = { index: idx, target: "custom", custom_key: key };
                if (at >= 0) next[at] = entry;
                else next.push(entry);
            }
            return next;
        });
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <div className="flex-1">
                    <p className="text-[12.5px] text-slate-900 font-medium">{preview.filename}</p>
                    <p className="text-[11px] text-slate-500">
                        {preview.format.toUpperCase()} · {preview.total_rows.toLocaleString()} שורות · {preview.columns.length} עמודות
                    </p>
                </div>
                {claimable.length > 0 && (
                    <button
                        type="button"
                        onClick={claimAllAsCustom}
                        className="h-7 px-2.5 rounded-md border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 text-[11.5px] font-medium transition-colors shrink-0"
                    >
                        שמור עוד {claimable.length} כשדות מותאמים אישית
                    </button>
                )}
                <label className="inline-flex items-center gap-1.5 text-[11.5px] text-slate-700 cursor-pointer">
                    <input
                        type="checkbox"
                        className="w-3.5 h-3.5 rounded accent-slate-900"
                        checked={hasHeader}
                        onChange={(e) => setHasHeader(e.target.checked)}
                    />
                    השורה הראשונה היא כותרת
                </label>
            </div>

            <div className="rounded-md border border-slate-200 overflow-x-auto">
                <table className="w-full text-start">
                    <thead className="bg-slate-50/60">
                        <tr className="border-b border-slate-200">
                            <th className="px-3 py-2 text-[10px] font-medium text-slate-400 uppercase tracking-[0.14em] w-12 text-start">#</th>
                            <th className="px-3 py-2 text-[10px] font-medium text-slate-400 uppercase tracking-[0.14em] text-start">עמודה</th>
                            <th className="hidden md:table-cell px-3 py-2 text-[10px] font-medium text-slate-400 uppercase tracking-[0.14em] text-start">דוגמה</th>
                            <th className="px-3 py-2 text-[10px] font-medium text-slate-400 uppercase tracking-[0.14em] md:w-56 text-start">מיפוי אל</th>
                        </tr>
                    </thead>
                    <tbody>
                        {preview.columns.map((col, idx) => {
                            const m = getMapping(idx);
                            const sample = (preview.sample_rows[0]?.[idx] ?? "").toString();
                            return (
                                <tr key={idx} className="border-b border-slate-100 last:border-b-0">
                                    <td className="px-3 py-2 text-[11px] text-slate-400 font-mono">{idx + 1}</td>
                                    <td className="px-3 py-2 text-[12px] text-slate-900 font-medium truncate max-w-[140px]">
                                        {col}
                                    </td>
                                    <td className="hidden md:table-cell px-3 py-2 text-[11.5px] text-slate-500 truncate max-w-[200px] font-mono">
                                        {sample || <span className="text-slate-300">—</span>}
                                    </td>
                                    <td className="px-3 py-2">
                                        <TargetPicker
                                            value={m}
                                            header={col}
                                            onChange={(next) => updateMapping(idx, next)}
                                        />
                                        <AnimatePresence initial={false}>
                                            {m.target === "verification_status" && (
                                                <motion.p
                                                    key="vocab"
                                                    initial={{ opacity: 0, y: -4 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -4 }}
                                                    className="mt-1 text-[10.5px] text-emerald-700 inline-flex items-center gap-1"
                                                >
                                                    <ShieldCheckIcon className="w-3 h-3" />
                                                    {m.verification_provider && VERIFICATION_VOCABULARY_LABELS[m.verification_provider]
                                                        ? `תוצאות אימות זוהו מ-${VERIFICATION_VOCABULARY_LABELS[m.verification_provider]}`
                                                        : "תוצאות אימות זוהו; לידים אלו ידלגו על הבדיקה המובנית"}
                                                </motion.p>
                                            )}
                                        </AnimatePresence>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export function TargetPicker({
    value,
    onChange,
    header,
}: {
    value: ImportColumnMapping;
    onChange: (next: ImportColumnMapping) => void;
    /** The column's header, used to pre-fill the custom-field name. */
    header?: string;
}) {
    // Custom-field rows are tagged with target="custom" (sentinel); the
    // user-typed name lives in custom_key. We also accept the legacy
    // "custom:<key>" form in case a saved mapping comes in that shape.
    const isCustom = isCustomTarget(value.target.toString());
    const stdLabel = STANDARD_TARGETS.find((t) => t.id === value.target)?.label;
    const customKey = value.custom_key ?? "";
    const keyInvalid = isCustom && customKey.trim() !== "" && !isValidCustomKey(customKey);
    const label = isCustom
        ? customKey
            ? `מותאם אישית: ${customKey}`
            : "שדה מותאם אישית..."
        : stdLabel ?? "התעלמות";

    return (
        <div className="flex items-center gap-1.5">
            <PopoverMenu align="start">
                <PopoverMenuTrigger asChild>
                    <SelectButton label={label} className="flex-1" />
                </PopoverMenuTrigger>
                <PopoverMenuContent minWidth={200}>
                    <PopoverMenuLabel>שדות סטנדרטיים</PopoverMenuLabel>
                    {STANDARD_TARGETS.map((t) => (
                        <PopoverMenuItem
                            key={t.id}
                            selected={value.target === t.id && !isCustom}
                            onSelect={() =>
                                onChange({ index: value.index, target: t.id })
                            }
                        >
                            {t.label}
                        </PopoverMenuItem>
                    ))}
                    <PopoverMenuLabel>מותאם אישית</PopoverMenuLabel>
                    <PopoverMenuItem
                        selected={isCustom}
                        onSelect={() =>
                            onChange({
                                index: value.index,
                                target: "custom",
                                // Start from the column header: "Company Mobile"
                                // is a valid field name, so there is nothing to
                                // type in the common case.
                                custom_key: customKey || suggestCustomKey(header ?? ""),
                            })
                        }
                    >
                        שימוש כשדה מותאם אישית...
                    </PopoverMenuItem>
                </PopoverMenuContent>
            </PopoverMenu>
            {isCustom && (
                <TextInput
                    value={customKey}
                    onChange={(v) =>
                        onChange({ index: value.index, target: "custom", custom_key: v })
                    }
                    placeholder="שם שדה"
                    invalid={keyInvalid}
                    title={keyInvalid ? CUSTOM_KEY_RULES : undefined}
                    className="w-24 md:w-32"
                />
            )}
        </div>
    );
}

// ----- Options step ----------------------------------------------

function OptionsStep({
    dedup,
    setDedup,
    categoryIds,
    setCategoryIds,
    campaignIds,
    setCampaignIds,
    segmentIds,
    setSegmentIds,
    campaignLocked,
    lockedSegment,
}: {
    dedup: ImportDedupStrategy;
    setDedup: (v: ImportDedupStrategy) => void;
    categoryIds: string[];
    setCategoryIds: (v: string[]) => void;
    campaignIds: string[];
    setCampaignIds: (v: string[]) => void;
    segmentIds: string[];
    setSegmentIds: (v: string[]) => void;
    // From a campaign's Leads tab the target campaign is fixed, so the
    // campaign picker is hidden and the header chip shows the target instead.
    campaignLocked: boolean;
    // From a segment's member list the segment is fixed and always applied;
    // the picker stays so more segments can be added alongside it.
    lockedSegment?: { id: string; name: string; color?: string };
}) {
    return (
        <div className="space-y-5">
            <section>
                <h2 className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500 mb-2">
                    טיפול בכפילויות
                </h2>
                <p className="text-[11px] text-slate-400 leading-tight mb-3">
                    מניעת כפילויות מתבצעת לפי כתובת אימייל באותיות קטנות. בחר כיצד לנהוג כאשר שורה בקובץ תואמת לאיש קשר קיים.
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
                                    name="dedup"
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
                    החלת קטגוריות
                </h2>
                <p className="text-[11px] text-slate-400 leading-tight mb-2">
                    כל איש קשר שיובא יקבל קטגוריות אלו. דלג אם אין ברצונך לתייג את כל הקבוצה.
                </p>
                <CategoryPicker value={categoryIds} onChange={setCategoryIds} />
            </section>

            {!campaignLocked && (
                <section>
                    <h2 className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500 mb-2">
                        הוספה לקמפיינים
                    </h2>
                    <p className="text-[11px] text-slate-400 leading-tight mb-2">
                        כל איש קשר שיובא יצטרף לקמפיינים אלו כליד. קמפיין פעיל יתחיל לשלוח אליהם אימיילים לפי לוח הזמנים שלו.
                    </p>
                    <CampaignMultiPicker value={campaignIds} onChange={setCampaignIds} />
                </section>
            )}

            <section>
                <h2 className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500 mb-2">
                    הוספה למקטעים
                </h2>
                <p className="text-[11px] text-slate-400 leading-tight mb-2">
                    {lockedSegment
                        ? "כל איש קשר שיובא יוצמד למקטע זה, ללא קשר לתנאי המקטע. ניתן להוסיף מקטעים נוספים למטה."
                        : "כל איש קשר שיובא יוצמד למקטעים אלו. מקטע המקושר לקמפיין ירשום אותם אליו אוטומטית."}
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

            <section className="rounded-md border border-slate-200 bg-slate-50/40 p-3">
                <Label className="text-[10.5px] text-slate-500">לתשומת לבך</Label>
                <p className="text-[11px] text-slate-600 leading-snug mt-1">
                    שורות ללא כתובת אימייל או עם כתובת לא תקינה ידווחו כשגיאות ולא ייובאו.
                    תוכל להוריד קובץ CSV של השגיאות בסיום ולייבא אותן שוב לאחר תיקון.
                </p>
            </section>
        </div>
    );
}

// ----- Result step ----------------------------------------------

export function ResultStep({
    result,
    filename,
    pinnedSegments,
}: {
    result: ImportResult;
    filename: string;
    // Names of the segments every imported, updated and skipped row was
    // pinned into, so the wizard confirms the membership it just wrote.
    pinnedSegments?: string[];
}) {
    function downloadErrors() {
        if (!result.errors || result.errors.length === 0) return;
        const rows = [["line", "email", "reason"]];
        for (const e of result.errors) {
            rows.push([String(e.line), e.email ?? "", e.reason.replace(/\r?\n/g, " ")]);
        }
        const csv = rows
            .map((r) =>
                r
                    .map((v) => (/[,"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v))
                    .join(","),
            )
            .join("\n");
        const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
        downloadBlob(blob, filename.replace(/\.[^.]+$/, "") + "-errors.csv");
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                {result.failed === 0 ? (
                    <CheckCircle2Icon className="w-8 h-8 text-emerald-600 shrink-0" />
                ) : (
                    <AlertTriangleIcon className="w-8 h-8 text-amber-600 shrink-0" />
                )}
                <div className="flex-1">
                    <p className="text-[13.5px] text-slate-900 font-semibold">
                        {result.failed === 0 ? "הייבוא הושלם בהצלחה" : "הייבוא הסתיים עם שגיאות"}
                    </p>
                    <p className="text-[11.5px] text-slate-500 leading-snug mt-0.5">
                        עובדו {result.total.toLocaleString()} שורות בתוך{" "}
                        {durationText(result.started_at, result.ended_at)}.
                        {result.segments_pinned && pinnedSegments && pinnedSegments.length > 0 && (
                            <> הוצמדו למקטעים {pinnedSegments.join(", ")}.</>
                        )}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <StatCard label="יובאו"   value={result.imported} accent="emerald" />
                <StatCard label="עודכנו"  value={result.updated}  accent="sky" />
                <StatCard label="דולגו"   value={result.skipped}  accent="slate" />
                <StatCard label="נכשלו"   value={result.failed}   accent={result.failed > 0 ? "red" : "slate"} />
            </div>

            {result.segments_pinned === false && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 flex items-start gap-2">
                    <AlertTriangleIcon className="w-3.5 h-3.5 mt-px shrink-0 text-amber-600" />
                    <div className="min-w-0">
                        <p className="text-[12.5px] font-medium text-amber-900">
                            אנשי הקשר יובאו, אך לא נוספו למקטע
                        </p>
                        <p className="text-[11.5px] text-amber-800/90 leading-relaxed mt-0.5">
                            השורות יובאו בהצלחה; אך רישום החברות במקטע נכשל. הסיבה מפורטת בהערות למטה. בחר
                            אותם ברשימת אנשי הקשר והשתמש ב<span className="font-medium">מקטעים</span> להוספתם,
                            או הפעל את הייבוא שוב.
                        </p>
                    </div>
                </div>
            )}

            {result.quality?.flagged && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 flex items-start gap-2">
                    <AlertTriangleIcon className="w-3.5 h-3.5 mt-px shrink-0 text-amber-600" />
                    <div className="min-w-0">
                        <p className="text-[12.5px] font-medium text-amber-900">נראה שאיכות הרשימה נמוכה</p>
                        <p className="text-[11.5px] text-amber-800/90 leading-relaxed mt-0.5">
                            {result.quality.summary} אנשי הקשר יובאו, אך שליחת אימיילים אליהם עלולה לסכן את המוניטין
                            של כל תיבות הדואר במרחב עבודה זה. מומלץ לנקות את הרשימה לפני השקת קמפיין עמה.
                        </p>
                    </div>
                </div>
            )}

            {result.errors && result.errors.length > 0 && (
                <div className="rounded-md border border-slate-200 overflow-hidden">
                    <div className="px-3 h-9 border-b border-slate-200 bg-slate-50/60 flex items-center gap-2">
                        <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-medium">
                            {result.failed === 0 ? "הערות" : "שגיאות"}
                        </span>
                        <span className="text-[11px] text-slate-500">
                            {result.errors_truncated
                                ? `${result.errors.length.toLocaleString()} מתוך ${result.failed.toLocaleString()}`
                                : result.errors.length.toLocaleString()}
                        </span>
                        <button
                            type="button"
                            onClick={downloadErrors}
                            className="ms-auto h-6 px-2 rounded text-[11px] text-slate-700 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center gap-1 transition-colors"
                        >
                            <DownloadIcon className="w-3 h-3" />
                            הורדת שגיאות
                        </button>
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                        <table className="w-full text-start">
                            <thead className="bg-white sticky top-0">
                                <tr className="border-b border-slate-100">
                                    <th className="px-3 py-1.5 text-[10px] font-medium text-slate-400 uppercase tracking-[0.14em] w-12 text-start">שורה</th>
                                    <th className="hidden md:table-cell px-3 py-1.5 text-[10px] font-medium text-slate-400 uppercase tracking-[0.14em] text-start">אימייל</th>
                                    <th className="px-3 py-1.5 text-[10px] font-medium text-slate-400 uppercase tracking-[0.14em] text-start">סיבה</th>
                                </tr>
                            </thead>
                            <tbody>
                                {result.errors.slice(0, 200).map((e, i) => (
                                    <tr key={i} className="border-b border-slate-100 last:border-b-0">
                                        <td className="px-3 py-1.5 text-[11px] text-slate-500 font-mono">
                                            {e.line > 0 ? e.line : <span className="text-slate-300">—</span>}
                                        </td>
                                        <td className="hidden md:table-cell px-3 py-1.5 text-[11.5px] text-slate-700 truncate max-w-[180px]">
                                            {e.email || <span className="text-slate-300">—</span>}
                                        </td>
                                        <td className="px-3 py-1.5 text-[11.5px] text-slate-700 leading-snug">{e.reason}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({
    label,
    value,
    accent,
}: {
    label: string;
    value: number;
    accent: "emerald" | "sky" | "slate" | "red";
}) {
    const ring = {
        emerald: "ring-emerald-200 bg-emerald-50 text-emerald-700",
        sky:     "ring-sky-200 bg-sky-50 text-sky-700",
        slate:   "ring-slate-200 bg-slate-50 text-slate-700",
        red:     "ring-red-200 bg-red-50 text-red-700",
    }[accent];
    return (
        <div className={`rounded-md ring-1 p-2.5 ${ring}`}>
            <div className="text-[10px] uppercase tracking-[0.14em] font-medium opacity-75">
                {label}
            </div>
            <div className="text-[18px] font-semibold tabular-nums mt-0.5">
                {value.toLocaleString()}
            </div>
        </div>
    );
}

function durationText(start: string, end: string): string {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (Number.isNaN(s) || Number.isNaN(e)) return "—";
    const ms = e - s;
    if (ms < 1000) return `${ms} מילישניות`;
    const sec = ms / 1000;
    if (sec < 60) return `${sec.toFixed(1)} שנ'`;
    return `${(sec / 60).toFixed(1)} דק'`;
}
