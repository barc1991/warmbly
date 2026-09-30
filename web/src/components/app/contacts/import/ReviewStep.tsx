// Review: one line on what the import will do, the choice about contacts you
// already have (only when there are some), and where the contacts go.

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    AlertTriangleIcon,
    BanIcon,
    ChevronDownIcon,
    FolderTreeIcon,
    Loader2Icon,
    MegaphoneIcon,
    ShieldAlertIcon,
    SlidersHorizontalIcon,
    TagsIcon,
    UserPlusIcon,
    type LucideIcon,
} from "lucide-react";

import type { ImportDedupStrategy } from "@/lib/api/client/app/contacts/importContacts";
import type { ContactImportAnalysis } from "@/lib/api/models/app/contacts/ContactImport";
import CategoryPicker from "../CategoryPicker";
import { CampaignMultiPicker, SegmentMultiPicker } from "@/components/app/segments/SegmentPickers";
import { Toggle } from "@/components/app/campaigns/preferences/components/CampaignPreferenceBoolBox";
import { describeError } from "../importShared";

const n = (v: number) => v.toLocaleString("he-IL");

export default function ReviewStep({
    analysis,
    analysisLoading,
    analysisError,
    onRetryAnalysis,
    fileName: _fileName,
    dedup,
    setDedup,
    subscribedDefault,
    setSubscribedDefault,
    categoryIds,
    setCategoryIds,
    campaignIds,
    setCampaignIds,
    segmentIds,
    setSegmentIds,
    lockedCampaign,
    lockedSegment,
}: {
    analysis?: ContactImportAnalysis;
    analysisLoading: boolean;
    analysisError: unknown;
    onRetryAnalysis: () => void;
    /** The uploaded file's name, offered as the name of a new segment. */
    fileName: string;
    dedup: ImportDedupStrategy;
    setDedup: (v: ImportDedupStrategy) => void;
    subscribedDefault: boolean;
    setSubscribedDefault: (v: boolean) => void;
    categoryIds: string[];
    setCategoryIds: (v: string[]) => void;
    campaignIds: string[];
    setCampaignIds: (v: string[]) => void;
    segmentIds: string[];
    setSegmentIds: (v: string[]) => void;
    // From a campaign's Leads tab the target campaign is fixed.
    lockedCampaign?: { id: string; name: string };
    // From a segment's member list the segment is fixed and always applied.
    lockedSegment?: { id: string; name: string; color?: string };
}) {
    const [more, setMore] = React.useState(!subscribedDefault);

    return (
        <div className="space-y-4 max-w-[680px] mx-auto text-start">
            <Summary analysis={analysis} loading={analysisLoading} error={analysisError} onRetry={onRetryAnalysis} dedup={dedup} />

            <AnimatePresence initial={false}>
                {analysis && analysis.existing > 0 && (
                    <motion.section
                        key="existing"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="rounded-lg border border-slate-200 px-4 py-3">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                <div className="min-w-0 flex-1">
                                    <p className="text-[12.5px] font-medium text-slate-900">
                                        {analysis.existing === 1
                                            ? "איש קשר אחד כבר קיים בסביבת העבודה שלך"
                                            : `${n(analysis.existing)} אנשי קשר כבר קיימים בסביבת העבודה שלך`}
                                    </p>
                                    <p className="text-[11.5px] text-slate-500 mt-0.5">
                                        {dedup === "skip"
                                            ? "הפרטים שלהם יישארו כפי שהם. הם עדיין יתווספו לסגמנטים, לתוויות ולקמפיינים שלמטה."
                                            : "פרטים ריקים ימולאו מתוך הקובץ. שום מידע שכבר קיים אצלם לא יימחק."}
                                    </p>
                                </div>
                                <Segmented
                                    value={dedup === "skip" ? "skip" : "update"}
                                    onChange={(v) => setDedup(v)}
                                    options={[
                                        { id: "skip", label: "השאר ללא שינוי" },
                                        { id: "update", label: "עדכן פרטים" },
                                    ]}
                                />
                            </div>
                        </div>
                    </motion.section>
                )}
            </AnimatePresence>

            <section className="rounded-lg border border-slate-200 divide-y divide-slate-100">
                <div className="px-4 pt-3 pb-2">
                    <h2 className="text-[12.5px] font-medium text-slate-900">הוספה אל</h2>
                    <p className="text-[11.5px] text-slate-500">אופציונלי. כל מה שמיובא מקובץ זה יקבל הגדרות אלו.</p>
                </div>
                <Row icon={FolderTreeIcon} label="סגמנטים" hint="רשימה שאליה ניתן לשלוח קמפיין">
                    {lockedSegment && (
                        <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-md border border-sky-200 bg-sky-50/60 px-2 h-6 max-w-full">
                            <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: lockedSegment.color ?? "#0284c7" }} />
                            <span className="text-[11.5px] font-medium text-sky-900 truncate">{lockedSegment.name}</span>
                            <span className="text-[10px] uppercase tracking-[0.14em] text-sky-700 shrink-0">תמיד</span>
                        </div>
                    )}
                    <SegmentMultiPicker
                        value={segmentIds}
                        onChange={setSegmentIds}
                        exclude={lockedSegment?.id}
                    />
                </Row>
                <Row icon={TagsIcon} label="תוויות" hint="תוויות לסינון ופילוח">
                    <CategoryPicker value={categoryIds} onChange={setCategoryIds} />
                </Row>
                <Row icon={MegaphoneIcon} label="קמפיינים" hint="נרשמים כלידים; קמפיין פעיל יתחיל לשלוח אליהם מיילים">
                    {lockedCampaign ? (
                        <div className="inline-flex items-center gap-1.5 rounded-md border border-sky-200 bg-sky-50/60 px-2 h-7 max-w-full">
                            <MegaphoneIcon className="w-3 h-3 text-sky-700 shrink-0" />
                            <span className="text-[12px] font-medium text-sky-900 truncate">{lockedCampaign.name}</span>
                        </div>
                    ) : (
                        <CampaignMultiPicker value={campaignIds} onChange={setCampaignIds} />
                    )}
                </Row>
            </section>

            <div>
                <button
                    type="button"
                    onClick={() => setMore((v) => !v)}
                    aria-expanded={more}
                    className="inline-flex items-center gap-1.5 h-7 px-1 text-[12px] text-slate-500 hover:text-slate-900 transition-colors"
                >
                    <SlidersHorizontalIcon className="w-3 h-3" />
                    אפשרויות נוספות
                    <ChevronDownIcon className={`w-3 h-3 transition-transform ${more ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence initial={false}>
                    {more && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="mt-1 rounded-lg border border-slate-200 px-4 py-3 flex items-center gap-3">
                                <div className="min-w-0 flex-1">
                                    <p className="text-[12.5px] font-medium text-slate-900">אנשי קשר חדשים רשומים לדיוור</p>
                                    <p className="text-[11.5px] text-slate-500">
                                        משמש כאשר לקובץ אין עמודת הרשמה לדיוור. כבה זאת כדי לייבא אנשים שעדיין אינך רשאי לשלוח להם מיילים.
                                    </p>
                                </div>
                                <Toggle value={subscribedDefault} onChange={setSubscribedDefault} ariaLabel="אנשי קשר חדשים רשומים לדיוור" />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

function Row({ icon: Icon, label, hint, children }: { icon: LucideIcon; label: string; hint: string; children: React.ReactNode }) {
    return (
        <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-[180px_minmax(0,1fr)] gap-x-4 gap-y-1.5 items-start text-start">
            <div className="flex items-start gap-2 pt-1">
                <Icon className="w-3.5 h-3.5 text-slate-400 mt-px shrink-0" />
                <div className="min-w-0">
                    <p className="text-[12px] font-medium text-slate-800">{label}</p>
                    <p className="text-[11px] text-slate-400 leading-snug">{hint}</p>
                </div>
            </div>
            <div className="min-w-0">{children}</div>
        </div>
    );
}

function Segmented<T extends string>({
    value,
    onChange,
    options,
}: {
    value: T;
    onChange: (v: T) => void;
    options: { id: T; label: string }[];
}) {
    return (
        <div role="radiogroup" className="inline-flex items-center rounded-md border border-slate-200 p-0.5 bg-slate-50/60 shrink-0">
            {options.map((o) => (
                <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={value === o.id}
                    onClick={() => onChange(o.id)}
                    className={`h-6 px-2.5 rounded text-[12px] transition-colors ${
                        value === o.id ? "bg-white text-slate-900 font-medium shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

// Summary is the whole-file check in one headline: how many contacts arrive,
// then only the extras that are not zero, and the rows that can't come in.
function Summary({
    analysis,
    loading,
    error,
    onRetry,
    dedup,
}: {
    analysis?: ContactImportAnalysis;
    loading: boolean;
    error: unknown;
    onRetry: () => void;
    dedup: ImportDedupStrategy;
}) {
    const [showSkipped, setShowSkipped] = React.useState(false);

    if (loading && !analysis) {
        return (
            <div className="rounded-lg border border-slate-200 px-4 py-5 flex items-center gap-3 text-start">
                <Loader2Icon className="w-5 h-5 text-sky-600 animate-spin shrink-0" />
                <div>
                    <p className="text-[13px] font-medium text-slate-900">בודק כל שורה…</p>
                    <p className="text-[11.5px] text-slate-500">כתובות, כפילויות ומי כבר קיים בסביבת העבודה שלך.</p>
                </div>
            </div>
        );
    }
    if (error && !analysis) {
        return (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2 text-start">
                <AlertTriangleIcon className="w-4 h-4 mt-px shrink-0 text-red-600" />
                <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium text-red-900">לא ניתן היה לבדוק את הקובץ</p>
                    <p className="text-[11.5px] text-red-800/90 mt-0.5">{describeError(error, "נסה שוב.")}</p>
                </div>
                <button
                    type="button"
                    onClick={onRetry}
                    className="h-7 px-2.5 rounded-md bg-white border border-red-200 text-[12px] font-medium text-red-800 hover:border-red-300"
                >
                    נסה שוב
                </button>
            </div>
        );
    }
    if (!analysis) return null;

    const cannot = analysis.invalid + analysis.conflicts;
    const extras = [
        analysis.existing > 0 &&
            `${analysis.existing === 1 ? "איש קשר אחד כבר קיים" : `${n(analysis.existing)} כבר קיימים`} באנשי הקשר שלך${dedup === "skip" ? "" : " ויעודכנו"}`,
        analysis.duplicates_in_file > 0 &&
            `${analysis.duplicates_in_file === 1 ? "שורה חוזרת אחת מוזגה" : `${n(analysis.duplicates_in_file)} שורות חוזרות מוזגו`}`,
    ].filter(Boolean) as string[];

    return (
        <section className={`rounded-lg border border-slate-200 overflow-hidden transition-opacity text-start ${loading ? "opacity-60" : ""}`}>
            <div className="px-4 py-4 flex items-start gap-3">
                <div className="size-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <UserPlusIcon className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-slate-900 leading-tight">
                        {analysis.new > 0
                            ? analysis.new === 1
                                ? "איש קשר חדש אחד יתווסף"
                                : `${n(analysis.new)} אנשי קשר חדשים יתווספו`
                            : "אין אנשי קשר חדשים בקובץ זה"}
                    </p>
                    {extras.length > 0 && <p className="text-[12px] text-slate-500 mt-1">{extras.join(" · ")}</p>}
                    {cannot > 0 && (
                        <button
                            type="button"
                            onClick={() => setShowSkipped((v) => !v)}
                            aria-expanded={showSkipped}
                            className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-amber-700 hover:text-amber-900"
                        >
                            <AlertTriangleIcon className="w-3 h-3" />
                            {cannot === 1 ? "לא ניתן לייבא שורה אחת" : `לא ניתן לייבא ${n(cannot)} שורות`}
                            <ChevronDownIcon className={`w-3 h-3 transition-transform ${showSkipped ? "rotate-180" : ""}`} />
                        </button>
                    )}
                </div>
            </div>

            <AnimatePresence initial={false}>
                {showSkipped && analysis.invalid_samples.length > 0 && (
                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className="max-h-44 overflow-y-auto border-t border-slate-100 bg-slate-50/40">
                            {analysis.invalid_samples.map((e, i) => (
                                <div key={i} className="px-4 py-1.5 flex items-baseline gap-3 border-b border-slate-100 last:border-b-0 text-start">
                                    <span className="text-[10.5px] text-slate-400 font-mono w-14 shrink-0">שורה {e.line}</span>
                                    <span dir="ltr" className="text-[11.5px] text-slate-700 font-mono truncate max-w-[40%] text-start">
                                        {e.email || <span className="text-slate-300">ריק</span>}
                                    </span>
                                    <span className="text-[11.5px] text-slate-500 truncate">{e.reason}</span>
                                </div>
                            ))}
                            {cannot > analysis.invalid_samples.length && (
                                <p className="px-4 py-1.5 text-[11px] text-slate-400 text-start">
                                    ועוד {n(cannot - analysis.invalid_samples.length)}; לאחר היבוא תוכל להוריד את כולן לתיקון.
                                </p>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {analysis.problem && (
                <div className="px-4 py-2.5 border-t border-red-200 bg-red-50 flex items-start gap-2 text-start">
                    <BanIcon className="w-3.5 h-3.5 mt-px shrink-0 text-red-600" />
                    <p className="text-[12px] text-red-900 leading-snug">
                        <span className="font-medium">יבוא זה אינו יכול להתחיל עדיין.</span> {analysis.problem}
                    </p>
                </div>
            )}
            {analysis.quality?.flagged && (
                <div className="px-4 py-2.5 border-t border-amber-200 bg-amber-50 flex items-start gap-2 text-start">
                    <ShieldAlertIcon className="w-3.5 h-3.5 mt-px shrink-0 text-amber-600" />
                    <p className="text-[12px] text-amber-900 leading-snug">
                        <span className="font-medium">נראה שאיכות הרשימה נמוכה.</span> {analysis.quality.summary} שליחה
                        אליה מסכנת את המוניטין של כל תיבות הדואר שלך; נקה אותה לפני יציאה לקמפיין.
                    </p>
                </div>
            )}
        </section>
    );
}
