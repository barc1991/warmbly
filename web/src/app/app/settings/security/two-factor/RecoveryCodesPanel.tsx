// The one place recovery codes are ever shown. Numbered grid plus the three
// ways to keep them (download a text file, copy, print) and the "I have saved
// them" acknowledgement the parent gates its Done button on.

import React from "react";
import toast from "react-hot-toast";
import { CheckIcon, CopyIcon, DownloadIcon, PrinterIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const fileStamp = () => new Date().toISOString().slice(0, 10);

function sheet(codes: string[], account: string): string {
    return [
        "Warmbly - קודי שחזור אימות דו-שלבי",
        `חשבון: ${account}`,
        `תאריך הפקה: ${fileStamp()}`,
        "",
        "כל קוד מאפשר התחברות חד-פעמית במקרה של אובדן אפליקציית האימות.",
        "שמור קובץ זה במקום מאובטח, כגון מנהל סיסמאות.",
        "",
        ...codes.map((c) => `  ${c}`),
        "",
    ].join("\n");
}

function downloadRecoveryCodes(codes: string[], account: string) {
    const blob = new Blob([sheet(codes, account)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `warmbly-recovery-codes-${fileStamp()}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function printRecoveryCodes(codes: string[], account: string) {
    const w = window.open("", "_blank", "width=520,height=640");
    if (!w) {
        toast.error("הדפדפן חסם את חלון ההדפסה. יש לאפשר חלונות קופצים ולנסות שוב.");
        return;
    }
    const esc = (s: string) => s.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch] ?? ch);
    w.document.open();
    w.document.write(
        `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>קודי שחזור Warmbly</title>` +
            `<style>body{font-family:ui-sans-serif,system-ui,sans-serif;color:#0f172a;padding:32px;max-width:480px;direction:rtl}` +
            `h1{font-size:18px;margin:0 0 4px}p{font-size:12px;color:#475569;margin:0 0 6px}` +
            `ol{columns:2;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;padding-right:24px;margin-top:20px;direction:ltr}` +
            `li{margin:0 0 8px;break-inside:avoid}</style></head><body>` +
            `<h1>Warmbly - קודי שחזור אימות דו-שלבי</h1>` +
            `<p>חשבון: ${esc(account)}</p><p>תאריך הפקה: ${fileStamp()}</p>` +
            `<p>כל קוד מאפשר התחברות חד-פעמית במקרה של אובדן אפליקציית האימות. שמור דף זה במקום מאובטח.</p>` +
            `<ol>${codes.map((c) => `<li>${esc(c)}</li>`).join("")}</ol></body></html>`,
    );
    w.document.close();
    w.focus();
    w.print();
}

export default function RecoveryCodesPanel({
    codes,
    account,
    saved,
    onSavedChange,
}: {
    codes: string[];
    account: string;
    saved: boolean;
    onSavedChange: (next: boolean) => void;
}) {
    const [copied, setCopied] = React.useState(false);
    const [downloaded, setDownloaded] = React.useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(codes.join("\n"));
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch {
            toast.error("לא ניתן להעתיק. בחר את הקודים והעתק אותם ידנית.");
        }
    };

    return (
        <div className="space-y-3">
            <ol className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md border border-slate-200 bg-slate-50 px-3.5 py-3 font-mono text-[12.5px] text-slate-800" dir="ltr">
                {codes.map((c, i) => (
                    <li key={c} className="flex items-baseline gap-2 tabular-nums">
                        <span className="w-4 text-right text-[10.5px] text-slate-400 select-none">{i + 1}.</span>
                        <span className="tracking-wide">{c}</span>
                    </li>
                ))}
            </ol>

            <div className="grid grid-cols-3 gap-2">
                <ActionButton
                    onClick={() => {
                        downloadRecoveryCodes(codes, account);
                        setDownloaded(true);
                    }}
                    icon={downloaded ? <CheckIcon className="w-3.5 h-3.5 text-emerald-500" /> : <DownloadIcon className="w-3.5 h-3.5" />}
                    label={downloaded ? "הורד בהצלחה" : "הורד קובץ"}
                />
                <ActionButton
                    onClick={copy}
                    icon={copied ? <CheckIcon className="w-3.5 h-3.5 text-emerald-500" /> : <CopyIcon className="w-3.5 h-3.5" />}
                    label={copied ? "הועתק" : "העתק"}
                />
                <ActionButton
                    onClick={() => printRecoveryCodes(codes, account)}
                    icon={<PrinterIcon className="w-3.5 h-3.5" />}
                    label="הדפס"
                />
            </div>

            <label className="flex items-start gap-2.5 rounded-md border border-slate-200 px-3 py-2.5 cursor-pointer select-none hover:border-slate-300 transition-colors text-right">
                <input
                    type="checkbox"
                    checked={saved}
                    onChange={(e) => onSavedChange(e.target.checked)}
                    className="mt-0.5 size-3.5 rounded-sm border-slate-300 accent-sky-600 shrink-0"
                />
                <span className="text-[12px] leading-snug text-slate-700">
                    שמרתי את קודי השחזור שלי במקום מאובטח.
                    <span className="block text-[11px] text-slate-500 mt-0.5">
                        הם לא יוצגו שוב. ללא קודים אלה וללא אפליקציית האימות, חשבונך יינעל.
                    </span>
                </span>
            </label>
        </div>
    );
}

function ActionButton({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "h-8 rounded-md border border-slate-200 bg-white text-[12px] text-slate-700 inline-flex items-center justify-center gap-1.5",
                "hover:border-slate-300 hover:text-slate-900 transition-colors",
            )}
        >
            {icon}
            {label}
        </button>
    );
}
