import React from "react";
import {
    AlertTriangleIcon,
    CheckCircle2Icon,
    ChevronRightIcon,
    CircleSlashIcon,
    ClockIcon,
    FileSpreadsheetIcon,
    Loader2Icon,
    PencilLineIcon,
    XIcon,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { CONTACT_IMPORTS_KEY, useContactImports } from "@/lib/api/hooks/app/contacts/useContactImports";
import { cancelContactImport } from "@/lib/api/client/app/contacts/contactImports";
import { useUserProfile } from "@/hooks/context/user";
import { useConfirm } from "@/hooks/context/confirm";
import type { ContactImport, ContactImportStatus } from "@/lib/api/models/app/contacts/ContactImport";

const STATUS: Record<ContactImportStatus, { label: string; tone: string; icon: typeof ClockIcon }> = {
    draft: { label: "המשך", tone: "text-sky-700", icon: PencilLineIcon },
    queued: { label: "בתור", tone: "text-sky-700", icon: ClockIcon },
    running: { label: "מייבא", tone: "text-sky-700", icon: Loader2Icon },
    completed: { label: "הושלם", tone: "text-emerald-700", icon: CheckCircle2Icon },
    failed: { label: "נעצר", tone: "text-red-700", icon: AlertTriangleIcon },
    cancelled: { label: "בוטל", tone: "text-slate-500", icon: CircleSlashIcon },
};

// RecentImports lists your unfinished drafts first, then the workspace's last
// imports, whoever ran them; picking one continues it or opens its progress.
export default function RecentImports({ onOpen }: { onOpen: (imp: ContactImport) => void }) {
    const { data, isLoading } = useContactImports(true, 10);
    const me = useUserProfile().user.id;
    const confirm = useConfirm();
    const queryClient = useQueryClient();
    const all = data?.data ?? [];
    // Someone else's draft is theirs to finish; a discarded one was never an import.
    const drafts = all.filter((i) => i.status === "draft" && i.created_by === me);
    const runs = all.filter((i) => i.status !== "draft" && !(i.status === "cancelled" && !i.started_at)).slice(0, 6);
    const items = [...drafts, ...runs];
    if (isLoading || items.length === 0) return null;

    function discard(e: React.MouseEvent, imp: ContactImport) {
        e.stopPropagation();
        confirm.show(`לבטל את טיוטת היבוא של ${imp.filename}?`, async () => {
            await cancelContactImport(imp.id);
            await queryClient.invalidateQueries({ queryKey: [...CONTACT_IMPORTS_KEY, "list"] });
        });
    }
    return (
        <section className="text-start">
            <h3 className="text-[10px] uppercase tracking-[0.14em] font-medium text-slate-400 mb-1.5 text-start">יבואים אחרונים</h3>
            <div className="rounded-md border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                {items.map((imp) => {
                    const s = STATUS[imp.status];
                    const pct = imp.total > 0 ? Math.round((imp.processed / imp.total) * 100) : 0;
                    const live = imp.status === "running" || imp.status === "queued";
                    const isDraft = imp.status === "draft";
                    return (
                        <div key={imp.id} className="flex items-center hover:bg-slate-50 transition-colors group">
                            <button
                                type="button"
                                onClick={() => onOpen(imp)}
                                className="flex-1 min-w-0 px-3 py-2 flex items-center gap-2.5 text-start"
                            >
                                <FileSpreadsheetIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <p dir="ltr" className="text-[12px] text-slate-900 font-medium truncate text-start">{imp.filename || "קובץ ללא שם"}</p>
                                    <p className="text-[11px] text-slate-500 truncate">
                                        {isDraft
                                            ? `טרם התחיל · ${imp.total.toLocaleString("he-IL")} שורות, המיפוי נשמר`
                                            : live
                                              ? `${imp.processed.toLocaleString("he-IL")} מתוך ${imp.total.toLocaleString("he-IL")} שורות`
                                              : `${imp.imported.toLocaleString("he-IL")} חדשים · ${imp.updated.toLocaleString("he-IL")} עודכנו${
                                                    imp.failed > 0 ? ` · ${imp.failed.toLocaleString("he-IL")} נכשלו` : ""
                                                }`}
                                        {" · "}
                                        {timeAgo(isDraft ? imp.updated_at : imp.created_at)}
                                    </p>
                                </div>
                                {live && (
                                    <div className="hidden sm:block h-1 w-16 rounded-full bg-slate-100 overflow-hidden">
                                        <div className="h-full bg-sky-500 transition-[width] duration-500" style={{ width: `${pct}%` }} />
                                    </div>
                                )}
                                <span className={`inline-flex items-center gap-1 text-[11px] font-medium shrink-0 ${s.tone}`}>
                                    <s.icon className={`w-3 h-3 ${imp.status === "running" ? "animate-spin" : ""}`} />
                                    {s.label}
                                </span>
                                <ChevronRightIcon className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 shrink-0 rtl:rotate-180" />
                            </button>
                            {isDraft && (
                                <button
                                    type="button"
                                    aria-label={`בטל את טיוטת היבוא של ${imp.filename}`}
                                    title="בטל טיוטה"
                                    onClick={(e) => discard(e, imp)}
                                    className="me-2 size-6 rounded-md inline-flex items-center justify-center text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors shrink-0"
                                >
                                    <XIcon className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

function timeAgo(d: Date | string): string {
    const ms = Date.now() - new Date(d).getTime();
    if (Number.isNaN(ms)) return "";
    const min = Math.round(ms / 60000);
    if (min < 1) return "זה עתה";
    if (min < 60) return `לפני ${min} דק'`;
    const h = Math.round(min / 60);
    if (h < 24) return h === 1 ? "לפני שעה" : h === 2 ? "לפני שעתיים" : `לפני ${h} שעות`;
    const days = Math.round(h / 24);
    return days === 1 ? "אתמול" : days === 2 ? "שלשום" : `לפני ${days} ימים`;
}
