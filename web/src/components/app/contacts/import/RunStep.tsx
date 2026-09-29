// Run: a background import as it moves, then what it did. Everything here is
// read from the import itself, so it is the same view for whoever opens it.

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    AlertTriangleIcon,
    CheckCircle2Icon,
    CircleSlashIcon,
    ClockIcon,
    DownloadIcon,
    InfoIcon,
    Loader2Icon,
    RefreshCwIcon,
    ShieldAlertIcon,
    UserPlusIcon,
    XCircleIcon,
    XIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useContactImport, CONTACT_IMPORTS_KEY } from "@/lib/api/hooks/app/contacts/useContactImports";
import { cancelContactImport, downloadContactImportFailures } from "@/lib/api/client/app/contacts/contactImports";
import { downloadBlob } from "@/lib/api/client/app/contacts/exportContacts";
import { isImportActive, type ContactImport } from "@/lib/api/models/app/contacts/ContactImport";
import { SearchInput } from "@/components/ui/field";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { useConfirm } from "@/hooks/context/confirm";
import { describeError } from "../importShared";
import StatCard from "./StatCard";

export default function RunStep({ importId, segmentNames }: { importId: string; segmentNames?: Map<string, string> }) {
    const { data: imp, error } = useContactImport(importId);

    if (!imp) {
        return error ? (
            <p className="py-10 text-center text-[12px] text-red-600">{describeError(error, "לא ניתן היה לטעון את היבוא.")}</p>
        ) : (
            <div className="py-12 flex justify-center">
                <Loader2Icon className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
        );
    }
    return isImportActive(imp.status) || imp.status === "draft" ? (
        <Progress imp={imp} />
    ) : (
        <Finished imp={imp} pinned={(imp.options?.segment_ids ?? []).map((id) => segmentNames?.get(id) ?? "סגמנט")} />
    );
}

function Progress({ imp }: { imp: ContactImport }) {
    const confirm = useConfirm();
    const queryClient = useQueryClient();
    const cancel = useMutation({
        mutationFn: () => cancelContactImport(imp.id),
        onSuccess: (next) => {
            queryClient.setQueryData([...CONTACT_IMPORTS_KEY, imp.id], next);
            void queryClient.invalidateQueries({ queryKey: ["contacts"] });
        },
        onError: (err) => toast.error(describeError(err, "לא ניתן היה לבטל את היבוא.")),
    });

    const pct = imp.total > 0 ? Math.min(100, (imp.processed / imp.total) * 100) : 0;
    const eta = estimate(imp);

    return (
        <div className="space-y-4 text-start">
            <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                    {imp.status === "queued" ? <ClockIcon className="w-5 h-5" /> : <Loader2Icon className="w-5 h-5 animate-spin" />}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold text-slate-900">
                        {imp.status === "queued" ? "ממתין להתחלה…" : "מייבא אנשי קשר"}
                    </p>
                    <p dir="ltr" className="text-[11.5px] text-slate-500 truncate text-start">{imp.filename}</p>
                </div>
                <button
                    type="button"
                    disabled={cancel.isPending}
                    onClick={() =>
                        confirm.show(
                            "לעצור את היבוא הזה? שורות שכבר יובאו יישארו באנשי הקשר שלך.",
                            async () => {
                                await cancel.mutateAsync();
                            },
                        )
                    }
                    className="h-7 px-2.5 rounded-md border border-slate-200 hover:border-red-200 hover:bg-red-50 text-[12px] text-slate-700 hover:text-red-700 inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                    <XIcon className="w-3 h-3" />
                    עצור
                </button>
            </div>

            <div>
                <div className="flex items-baseline justify-between gap-2 mb-1.5">
                    <span className="text-[12px] text-slate-700 tabular-nums">
                        <AnimatedNumber value={imp.processed} /> מתוך {imp.total.toLocaleString("he-IL")} שורות
                    </span>
                    <span className="text-[11.5px] text-slate-500 tabular-nums">
                        {eta ?? `${Math.floor(pct)}%`}
                    </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden relative">
                    {imp.status === "queued" || imp.processed === 0 ? (
                        <div className="absolute inset-y-0 w-1/3 bg-sky-400 rounded-full progress-sweep" />
                    ) : (
                        <motion.div
                            className="h-full bg-sky-500 rounded-full"
                            initial={false}
                            animate={{ width: `${Math.max(2, pct)}%` }}
                            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        />
                    )}
                </div>
            </div>

            <Counts imp={imp} />

            <div className="rounded-md border border-slate-200 bg-slate-50/40 px-3 py-2.5 flex items-start gap-2">
                <InfoIcon className="w-3.5 h-3.5 mt-px text-slate-400 shrink-0" />
                <p className="text-[11.5px] text-slate-600 leading-snug">
                    ניתן לסגור חלון זה. היבוא ימשיך לפעול ברקע, יישמר ברענון הדף, וחברי הצוות שלך יראו את סיומו גם
                    כן. פתח שוב את מסך היבוא כדי לבדוק את התקדמותו.
                </p>
            </div>
        </div>
    );
}

function Counts({ imp }: { imp: ContactImport }) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <StatCard label="יובאו" value={imp.imported} accent="emerald" icon={UserPlusIcon} />
            <StatCard label="עודכנו" value={imp.updated} accent="sky" icon={RefreshCwIcon} />
            <StatCard label="דולגו" value={imp.skipped} accent="slate" icon={CircleSlashIcon} />
            <StatCard label="נכשלו" value={imp.failed} accent={imp.failed > 0 ? "red" : "slate"} icon={XCircleIcon} />
        </div>
    );
}

function Finished({ imp, pinned }: { imp: ContactImport; pinned: string[] }) {
    const [query, setQuery] = React.useState("");
    const [downloading, setDownloading] = React.useState(false);

    async function download() {
        setDownloading(true);
        try {
            const blob = await downloadContactImportFailures(imp.id);
            downloadBlob(blob, imp.filename.replace(/\.[^.]+$/, "") + "-failed.csv");
        } catch (err) {
            toast.error(describeError(err, "לא ניתן היה להוריד את השורות שנכשלו."));
        } finally {
            setDownloading(false);
        }
    }

    const head =
        imp.status === "completed"
            ? imp.failed === 0
                ? { icon: CheckCircle2Icon, tone: "text-emerald-600", title: "היבוא הושלם בהצלחה" }
                : { icon: AlertTriangleIcon, tone: "text-amber-600", title: "היבוא הסתיים עם שורות שלא נכללו" }
            : imp.status === "cancelled"
              ? { icon: CircleSlashIcon, tone: "text-slate-500", title: "היבוא נעצר" }
              : { icon: XCircleIcon, tone: "text-red-600", title: "היבוא לא הצליח להסתיים" };

    const q = query.trim().toLowerCase();
    const failures = (imp.failures ?? []).filter(
        (f) => q === "" || (f.email ?? "").toLowerCase().includes(q) || f.reason.toLowerCase().includes(q) || String(f.line) === q,
    );

    return (
        <div className="space-y-4 text-start">
            <div className="flex items-center gap-3">
                <head.icon className={`w-8 h-8 shrink-0 ${head.tone}`} />
                <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold text-slate-900">{head.title}</p>
                    <p className="text-[11.5px] text-slate-500 leading-snug mt-0.5">
                        <span dir="ltr">{imp.filename}</span> · {imp.processed.toLocaleString("he-IL")} מתוך {imp.total.toLocaleString("he-IL")} שורות
                        {imp.started_at && imp.finished_at && <> תוך {durationText(imp.started_at, imp.finished_at)}</>}.
                        {imp.segments_pinned && pinned.length > 0 && <> שויכו אל {pinned.join(", ")}.</>}
                    </p>
                </div>
            </div>

            <Counts imp={imp} />

            {imp.status === "cancelled" && imp.processed < imp.total && (
                <Notice tone="slate" icon={CircleSlashIcon} title={`${(imp.total - imp.processed).toLocaleString("he-IL")} שורות לא יובאו`}>
                    כל מה שעובד לפני העצירה נמצא כבר באנשי הקשר שלך. יבא את הקובץ שוב כדי להוסיף את השאר; שורות שכבר קיימות
                    יותאמו ולא ישוכפלו.
                </Notice>
            )}
            {imp.error && (
                <Notice tone="red" icon={XCircleIcon} title="מדוע היבוא נעצר">
                    {imp.error}
                </Notice>
            )}
            {imp.segments_pinned === false && (
                <Notice tone="amber" icon={AlertTriangleIcon} title="אנשי הקשר יובאו, אך לא נוספו לסגמנט">
                    השורות יובאו בהצלחה, אך כתיבת השיוך לסגמנט נכשלה. בחר אותם ברשימת אנשי הקשר והשתמש ב-{" "}
                    <span className="font-medium">סגמנט</span> כדי להוסיף אותם, או הרץ את היבוא שוב.
                </Notice>
            )}
            {imp.notes.length > 0 &&
                imp.notes.map((n, i) => (
                    <Notice key={i} tone="amber" icon={InfoIcon} title="הערה">
                        {n}
                    </Notice>
                ))}
            {imp.quality?.flagged && (
                <Notice tone="amber" icon={ShieldAlertIcon} title="נראה שאיכות הרשימה נמוכה">
                    {imp.quality.summary} הם יובאו, אך שליחה אליהם מסכנת את המוניטין של כל תיבות הדואר בסביבת עבודה זו.
                    נקה את הרשימה לפני הפעלת קמפיין.
                </Notice>
            )}

            {imp.failed > 0 && (
                <div className="rounded-md border border-slate-200 overflow-hidden">
                    <div className="px-3 min-h-9 py-1 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-center gap-2">
                        <XCircleIcon className="w-3 h-3 text-red-500" />
                        <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-medium">שורות שנכשלו</span>
                        <span className="text-[11px] text-slate-500 tabular-nums">
                            {(imp.failures?.length ?? 0) < imp.failed
                                ? `${(imp.failures?.length ?? 0).toLocaleString("he-IL")} ראשונות מתוך ${imp.failed.toLocaleString("he-IL")}`
                                : imp.failed.toLocaleString("he-IL")}
                        </span>
                        <div className="ms-auto flex items-center gap-1.5">
                            {(imp.failures?.length ?? 0) > 8 && (
                                <SearchInput value={query} onChange={setQuery} placeholder="סינון…" className="w-36" />
                            )}
                            <button
                                type="button"
                                onClick={download}
                                disabled={downloading}
                                className="h-7 px-2 rounded-md border border-slate-200 bg-white text-[11.5px] text-slate-700 hover:text-slate-900 hover:border-slate-300 inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                                title="כל שורה שנכשלה בדיוק כפי שהועלתה, עם הסיבה בעמודה האחרונה. תקן אותה ויבא שוב."
                            >
                                {downloading ? <Loader2Icon className="w-3 h-3 animate-spin" /> : <DownloadIcon className="w-3 h-3" />}
                                הורד לתיקון
                            </button>
                        </div>
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                        <table className="w-full text-start">
                            <thead className="bg-white sticky top-0">
                                <tr className="border-b border-slate-100">
                                    <th className="px-3 py-1.5 text-[10px] font-medium text-slate-400 uppercase tracking-[0.14em] w-14 text-start">שורה</th>
                                    <th className="hidden md:table-cell px-3 py-1.5 text-[10px] font-medium text-slate-400 uppercase tracking-[0.14em] text-start">אימייל</th>
                                    <th className="px-3 py-1.5 text-[10px] font-medium text-slate-400 uppercase tracking-[0.14em] text-start">סיבה</th>
                                </tr>
                            </thead>
                            <tbody>
                                <AnimatePresence initial={false}>
                                    {failures.map((f) => (
                                        <motion.tr
                                            key={f.line}
                                            layout="position"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="border-b border-slate-100 last:border-b-0"
                                        >
                                            <td className="px-3 py-1.5 text-[11px] text-slate-500 font-mono text-start">{f.line}</td>
                                            <td dir="ltr" className="hidden md:table-cell px-3 py-1.5 text-[11.5px] text-slate-700 truncate max-w-[200px] text-start">
                                                {f.email || <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="px-3 py-1.5 text-[11.5px] text-slate-700 leading-snug text-start">{f.reason}</td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            </tbody>
                        </table>
                        {failures.length === 0 && <p className="px-3 py-4 text-center text-[11.5px] text-slate-400">אין שורות תואמות.</p>}
                    </div>
                </div>
            )}
        </div>
    );
}

function Notice({
    tone,
    icon: Icon,
    title,
    children,
}: {
    tone: "amber" | "red" | "slate";
    icon: typeof InfoIcon;
    title: string;
    children: React.ReactNode;
}) {
    const t = {
        amber: { box: "border-amber-200 bg-amber-50", icon: "text-amber-600", title: "text-amber-900", body: "text-amber-800/90" },
        red: { box: "border-red-200 bg-red-50", icon: "text-red-600", title: "text-red-900", body: "text-red-800/90" },
        slate: { box: "border-slate-200 bg-slate-50", icon: "text-slate-500", title: "text-slate-900", body: "text-slate-600" },
    }[tone];
    return (
        <div className={`rounded-md border px-3 py-2.5 flex items-start gap-2 ${t.box} text-start`}>
            <Icon className={`w-3.5 h-3.5 mt-px shrink-0 ${t.icon}`} />
            <div className="min-w-0">
                <p className={`text-[12.5px] font-medium ${t.title}`}>{title}</p>
                <p className={`text-[11.5px] leading-relaxed mt-0.5 ${t.body}`}>{children}</p>
            </div>
        </div>
    );
}

// estimate is the time left at the rate the import has kept so far, from the
// server's own clock, so every viewer reads the same figure.
function estimate(imp: ContactImport): string | null {
    if (imp.status !== "running" || !imp.started_at || imp.processed <= 0) return null;
    const elapsed = (new Date(imp.updated_at).getTime() - new Date(imp.started_at).getTime()) / 1000;
    if (!(elapsed > 1)) return null;
    const rate = imp.processed / elapsed;
    const left = (imp.total - imp.processed) / rate;
    const perSec = rate >= 10 ? `${Math.round(rate).toLocaleString("he-IL")} שורות/שנ׳` : `${rate.toFixed(1)} שורות/שנ׳`;
    if (left < 1) return `${perSec} · מסיים`;
    if (left < 60) return `${perSec} · נותרו כ-${Math.ceil(left)} שנ׳`;
    return `${perSec} · נותרו כ-${Math.ceil(left / 60)} דק׳`;
}

function durationText(start: Date | string, end: Date | string): string {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (Number.isNaN(ms) || ms < 0) return "רגע אחד";
    if (ms < 1000) return `${ms} מילישניות`;
    const sec = ms / 1000;
    if (sec < 60) return `${sec.toFixed(1)} שנ׳`;
    return `${(sec / 60).toFixed(1)} דק׳`;
}
