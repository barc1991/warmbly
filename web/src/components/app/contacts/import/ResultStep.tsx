// The result of a synchronous import (the Google Sheets "sync now"). The file
// import runs in the background and reports through RunStep instead.

import {
    AlertTriangleIcon,
    CheckCircle2Icon,
    CircleSlashIcon,
    DownloadIcon,
    RefreshCwIcon,
    UserPlusIcon,
    XCircleIcon,
} from "lucide-react";
import type { ImportResult } from "@/lib/api/client/app/contacts/importContacts";
import { downloadBlob } from "@/lib/api/client/app/contacts/exportContacts";
import StatCard from "./StatCard";

export default function ResultStep({
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
            rows.push([String(e.line), csvSafe(e.email ?? ""), csvSafe(e.reason.replace(/\r?\n/g, " "))]);
        }
        const csv = rows
            .map((r) =>
                r
                    .map((v) => (/[,"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v))
                    .join(","),
            )
            .join("\n");
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
        downloadBlob(blob, filename.replace(/\.[^.]+$/, "") + "-errors.csv");
    }

    return (
        <div className="space-y-4 text-start">
            <div className="flex items-center gap-3">
                {result.failed === 0 ? (
                    <CheckCircle2Icon className="w-8 h-8 text-emerald-600 shrink-0" />
                ) : (
                    <AlertTriangleIcon className="w-8 h-8 text-amber-600 shrink-0" />
                )}
                <div className="flex-1">
                    <p className="text-[13.5px] text-slate-900 font-semibold">
                        {result.failed === 0 ? "היבוא הושלם בהצלחה" : "היבוא הסתיים עם שגיאות"}
                    </p>
                    <p className="text-[11.5px] text-slate-500 leading-snug mt-0.5">
                        עובדו {result.total.toLocaleString("he-IL")} שורות תוך{" "}
                        {durationText(result.started_at, result.ended_at)}.
                        {result.segments_pinned && pinnedSegments && pinnedSegments.length > 0 && (
                            <> שויכו אל {pinnedSegments.join(", ")}.</>
                        )}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <StatCard label="יובאו" value={result.imported} accent="emerald" icon={UserPlusIcon} />
                <StatCard label="עודכנו" value={result.updated} accent="sky" icon={RefreshCwIcon} />
                <StatCard label="דולגו" value={result.skipped} accent="slate" icon={CircleSlashIcon} />
                <StatCard label="נכשלו" value={result.failed} accent={result.failed > 0 ? "red" : "slate"} icon={XCircleIcon} />
            </div>

            {result.segments_pinned === false && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 flex items-start gap-2 text-start">
                    <AlertTriangleIcon className="w-3.5 h-3.5 mt-px shrink-0 text-amber-600" />
                    <div className="min-w-0">
                        <p className="text-[12.5px] font-medium text-amber-900">
                            אנשי הקשר יובאו, אך לא נוספו לסגמנט
                        </p>
                        <p className="text-[11.5px] text-amber-800/90 leading-relaxed mt-0.5">
                            השורות יובאו בהצלחה; כתיבת השיוך לסגמנט נכשלה. הסיבה מופיעה בהערות שלמטה. בחר אותם ברשימת אנשי הקשר והשתמש ב-
                            <span className="font-medium">סגמנט</span> כדי להוסיף אותם, או הרץ את היבוא שוב.
                        </p>
                    </div>
                </div>
            )}

            {result.quality?.flagged && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 flex items-start gap-2 text-start">
                    <AlertTriangleIcon className="w-3.5 h-3.5 mt-px shrink-0 text-amber-600" />
                    <div className="min-w-0">
                        <p className="text-[12.5px] font-medium text-amber-900">נראה שאיכות הרשימה נמוכה</p>
                        <p className="text-[11.5px] text-amber-800/90 leading-relaxed mt-0.5">
                            {result.quality.summary} הם יובאו, אך שליחה אליהם מסכנת את המוניטין של כל תיבות הדואר בסביבת עבודה זו.
                            נקה את הרשימה לפני הפעלת קמפיין.
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
                        <span className="text-[11px] text-slate-500 tabular-nums">
                            {result.errors_truncated
                                ? `${result.errors.length.toLocaleString("he-IL")} מתוך ${result.failed.toLocaleString("he-IL")}`
                                : result.errors.length.toLocaleString("he-IL")}
                        </span>
                        <button
                            type="button"
                            onClick={downloadErrors}
                            className="ms-auto h-6 px-2 rounded text-[11px] text-slate-700 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center gap-1 transition-colors"
                        >
                            <DownloadIcon className="w-3 h-3" />
                            הורד שגיאות
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
                                        <td className="px-3 py-1.5 text-[11px] text-slate-500 font-mono text-start">
                                            {e.line > 0 ? e.line : <span className="text-slate-300">—</span>}
                                        </td>
                                        <td dir="ltr" className="hidden md:table-cell px-3 py-1.5 text-[11.5px] text-slate-700 truncate max-w-[180px] text-start">
                                            {e.email || <span className="text-slate-300">—</span>}
                                        </td>
                                        <td className="px-3 py-1.5 text-[11.5px] text-slate-700 leading-snug text-start">{e.reason}</td>
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

// csvSafe keeps a spreadsheet from reading an uploaded value as a formula.
function csvSafe(v: string): string {
    return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

function durationText(start: string | Date, end: string | Date): string {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (Number.isNaN(s) || Number.isNaN(e)) return "—";
    const ms = e - s;
    if (ms < 1000) return `${ms} מילישניות`;
    const sec = ms / 1000;
    if (sec < 60) return `${sec.toFixed(1)} שנ׳`;
    return `${(sec / 60).toFixed(1)} דק׳`;
}
