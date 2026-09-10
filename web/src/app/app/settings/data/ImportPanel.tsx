// Import panel — upload an archive, read what it would do, then apply it.
//
// The preflight step is the point of this screen. It reads the archive and
// reports what lands, what already exists, and who has no account here, all
// without writing anything, so "apply" is never a leap of faith.

import React from "react";
import toast from "react-hot-toast";
import { AlertTriangleIcon, FileArchiveIcon, Loader2Icon } from "lucide-react";
import { TextInput } from "@/components/ui/field";
import { useConfirm } from "@/hooks/context/confirm";
import {
    useCreateOrgImport,
    usePreflightOrgImport,
} from "@/lib/api/hooks/app/orgtransfer/useOrgTransfer";
import type {
    OrgDataGroup,
    OrgDataGroupInfo,
    OrgImportConflict,
    OrgImportPreflight,
} from "@/lib/api/models/app/orgtransfer/OrgTransfer";
import { expandGroups, totalRows } from "@/lib/api/models/app/orgtransfer/OrgTransfer";
import GroupPicker from "./GroupPicker";
import { formatBytes } from "./format";

export default function ImportPanel({
    groups,
    onStarted,
}: {
    groups: OrgDataGroupInfo[];
    onStarted: () => void;
}) {
    const confirm = useConfirm();
    const preflight = usePreflightOrgImport();
    const createImport = useCreateOrgImport();

    const fileRef = React.useRef<HTMLInputElement>(null);
    const [file, setFile] = React.useState<File | null>(null);
    const [passphrase, setPassphrase] = React.useState("");
    const [report, setReport] = React.useState<OrgImportPreflight | null>(null);
    const [selected, setSelected] = React.useState<Set<OrgDataGroup>>(new Set());
    const [conflict, setConflict] = React.useState<OrgImportConflict>("skip");

    function pickFile(next: File | null) {
        setFile(next);
        setReport(null);
    }

    function toggle(key: OrgDataGroup) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            // Re-expand so ticking a group pulls in what it cannot travel
            // without, exactly as the server would.
            return expandGroups(next, groups);
        });
    }

    async function check() {
        if (!file) return;
        try {
            const result = await preflight.mutateAsync({ file, passphrase });
            setReport(result);
            // Default to everything the archive actually carries.
            setSelected(expandGroups(result.archive.groups, groups));
        } catch (e) {
            setReport(null);
            toast.error((e as { message?: string })?.message ?? "לא ניתן היה לקרוא ארכיון זה.");
        }
    }

    async function apply() {
        if (!file || !report) return;
        const conflictTotal = Object.values(report.conflicts).reduce((a, b) => a + b, 0);
        const message =
            conflict === "overwrite" && conflictTotal > 0
                ? `פעולה זו תחליף ${conflictTotal.toLocaleString()} שורות קיימות בסביבת עבודה זו בגרסאות מתוך הארכיון. לא ניתן לבטל פעולה זו. האם להמשיך?`
                : `פעולה זו תוסיף את התוכן של "${report.archive.organization_name}" לסביבת עבודה זו. האם להמשיך?`;

        confirm.show(message, async () => {
            try {
                await createImport.mutateAsync({
                    file,
                    options: {
                        groups: Array.from(selected),
                        conflict_strategy: conflict,
                    },
                    passphrase,
                });
                pickFile(null);
                setPassphrase("");
                if (fileRef.current) fileRef.current.value = "";
                onStarted();
            } catch (e) {
                toast.error((e as { message?: string })?.message ?? "לא ניתן היה להתחיל בייבוא.");
            }
        });
    }

    return (
        <div className="space-y-4">
            <div className="rounded-md border border-dashed border-slate-300 px-3 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <FileArchiveIcon className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium text-slate-900 leading-tight">
                        {file ? file.name : "בחר ארכיון"}
                    </div>
                    <div className="text-[11.5px] text-slate-500 leading-tight mt-0.5">
                        {file
                            ? formatBytes(file.size)
                            : "קובץ .warmbly.zip שיוצא ממופע זה או ממופע אחר."}
                    </div>
                </div>
                <input
                    ref={fileRef}
                    type="file"
                    accept=".zip,application/zip"
                    className="hidden"
                    onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                />
                <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="self-start h-7 px-2.5 rounded-md border border-slate-200 hover:border-slate-300 text-[12px] text-slate-700 hover:text-slate-900 transition-colors shrink-0"
                >
                    {file ? "בחר אחר" : "בחר קובץ"}
                </button>
            </div>

            {file && (
                <div className="space-y-2">
                    <TextInput
                        value={passphrase}
                        onChange={setPassphrase}
                        type="password"
                        autoComplete="current-password"
                        placeholder="סיסמת אבטחה של הייצוא (רק אם הארכיון כולל פרטי התחברות)"
                        className="w-full"
                        dir="ltr"
                    />
                    <button
                        type="button"
                        onClick={check}
                        disabled={preflight.isPending}
                        className="h-7 px-3 rounded-md border border-slate-200 hover:border-slate-300 text-[12px] font-medium text-slate-700 hover:text-slate-900 inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                        {preflight.isPending && <Loader2Icon className="w-3 h-3 animate-spin" />}
                        בדוק ארכיון זה
                    </button>
                </div>
            )}

            {report && (
                <>
                    <ArchiveSummary report={report} />

                    <div>
                        <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400 font-medium mb-1.5">
                            מה ליישם
                        </div>
                        <GroupPicker
                            groups={groups.filter((g) => report.archive.groups.includes(g.key))}
                            selected={selected}
                            onToggle={toggle}
                            disabled={createImport.isPending}
                        />
                    </div>

                    <div>
                        <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400 font-medium mb-1.5">
                            שורות שכבר קיימות כאן
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <ConflictChoice
                                active={conflict === "skip"}
                                onClick={() => setConflict("skip")}
                                title="שמור את מה שקיים כאן"
                                body="הארכיון יוסיף רק שורות שאינן קיימות כבר בסביבת עבודה זו."
                            />
                            <ConflictChoice
                                active={conflict === "overwrite"}
                                onClick={() => setConflict("overwrite")}
                                title="החלף בנתוני הארכיון"
                                body="שורות קיימות יידרסו על ידי הגרסאות מהארכיון. לא ניתן לבטל."
                                danger
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={apply}
                            disabled={createImport.isPending}
                            className="h-7 px-3 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                            {createImport.isPending && <Loader2Icon className="w-3 h-3 animate-spin" />}
                            ייבא לסביבת עבודה זו
                        </button>
                        <span className="text-[11.5px] text-slate-500">
                            מיושם בטרנזקציה אחת: הפעולה תצליח במלואה או שלא תתבצע כלל.
                        </span>
                    </div>
                </>
            )}
        </div>
    );
}

function ArchiveSummary({ report }: { report: OrgImportPreflight }) {
    const a = report.archive;
    const conflictTotal = Object.values(report.conflicts).reduce((x, y) => x + y, 0);

    return (
        <div className="rounded-md border border-slate-200 bg-slate-50/50 px-3 py-2.5 space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Fact label="סביבת עבודה" value={a.organization_name} />
                <Fact label="יוצא ב-" value={new Date(a.exported_at).toLocaleDateString("he-IL")} />
                <Fact label="שורות" value={totalRows(a.row_counts).toLocaleString()} />
                <Fact label="קבצים מצורפים" value={String(a.blob_count)} />
            </div>

            <div className="text-[11.5px] text-slate-600 leading-relaxed">
                {a.has_secrets
                    ? report.secrets_unsealed
                        ? "פרטי ההתחברות נאטמו בארכיון זה וסיסמת האבטחה שלך פותחת אותם, כך שתיבות הדואר יגיעו כשהן מחוברות."
                        : "פרטי ההתחברות נאטמו בארכיון זה, אך סיסמת האבטחה למעלה עדיין אינה פותחת אותם."
                    : "ארכיון זה אינו נושא פרטי התחברות, ולכן תיבות הדואר יגיעו ויידרשו חיבור מחדש."}
            </div>

            {conflictTotal > 0 && (
                <div className="text-[11.5px] text-slate-600">
                    {conflictTotal.toLocaleString()} שורות בארכיון כבר קיימות בסביבת עבודה זו.
                </div>
            )}

            {report.unknown_members.length > 0 && (
                <div className="text-[11.5px] text-slate-600">
                    {report.unknown_members.length} חברים אינם רשומים במופע זה ({report.unknown_members.slice(0, 3).map((m) => m.email).join(", ")}
                    {report.unknown_members.length > 3 ? ", …" : ""}). השורות שלהם ישויכו אליך מחדש.
                </div>
            )}

            {report.warnings.map((w) => (
                <div key={w} className="flex items-start gap-1.5 text-[11.5px] text-amber-700">
                    <AlertTriangleIcon className="w-3 h-3 mt-0.5 shrink-0" />
                    <span className="leading-relaxed">{w}</span>
                </div>
            ))}
        </div>
    );
}

function Fact({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">
                {label}
            </div>
            <div className="text-[12.5px] text-slate-900 truncate">{value}</div>
        </div>
    );
}

function ConflictChoice({
    active,
    onClick,
    title,
    body,
    danger,
}: {
    active: boolean;
    onClick: () => void;
    title: string;
    body: string;
    danger?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex-1 text-start rounded-md border px-3 py-2 transition-colors ${
                active
                    ? danger
                        ? "border-red-300 bg-red-50/60"
                        : "border-sky-400 bg-sky-50/60"
                    : "border-slate-200 hover:border-slate-300"
            }`}
        >
            <div
                className={`text-[12.5px] font-medium leading-tight ${
                    active && danger ? "text-red-700" : "text-slate-900"
                }`}
            >
                {title}
            </div>
            <div className="text-[11.5px] text-slate-500 leading-tight mt-0.5">{body}</div>
        </button>
    );
}
