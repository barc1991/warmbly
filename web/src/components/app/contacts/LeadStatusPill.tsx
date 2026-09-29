import type { LeadStatus } from "@/lib/api/models/app/contacts/Contact";

// A lead's state in one campaign, for the contact drawer and the unibox contact panel.
export default function LeadStatusPill({ status }: { status: LeadStatus }) {
    const map: Record<LeadStatus, { label: string; cls: string }> = {
        pending: { label: "בתור", cls: "bg-slate-100 text-slate-600" },
        active: { label: "בטיפול", cls: "bg-sky-50 text-sky-700" },
        completed: { label: "הושלם", cls: "bg-emerald-50 text-emerald-700" },
        replied: { label: "השיב", cls: "bg-emerald-50 text-emerald-700" },
        bounced: { label: "חזר", cls: "bg-red-50 text-red-700" },
        failed: { label: "נכשל", cls: "bg-red-50 text-red-700" },
        unsubscribed: { label: "הוסר מדיוור", cls: "bg-slate-100 text-slate-600" },
        paused: { label: "מושהה", cls: "bg-violet-50 text-violet-700" },
        undeliverable: { label: "לא ניתן למסירה", cls: "bg-amber-50 text-amber-700" },
    };
    const m = map[status] ?? { label: status, cls: "bg-slate-100 text-slate-600" };
    return (
        <span
            className={`inline-flex h-4 items-center px-1.5 rounded text-[10.5px] font-medium shrink-0 ${m.cls}`}
        >
            {m.label}
        </span>
    );
}
