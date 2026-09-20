// Cell content shared by the contacts table's columns: the subscription pill,
// the per-lead processing pill, and the engagement counts of the Leads view.
// Localized to Hebrew and styled for RTL.

import { AlertTriangleIcon, BanIcon, CheckIcon, ClockIcon, CornerUpLeftIcon, InfoIcon, PauseIcon, type LucideIcon } from "lucide-react";
import clippedTitle from "@/lib/helper/clippedTitle";
import { holdSummary } from "@/lib/api/models/app/contacts/Contact";
import type { ContactCampaignProgress, LeadStatus } from "@/lib/api/models/app/contacts/Contact";

export function Dash() {
    return <span className="text-slate-300">—</span>;
}

export function InfoHeader({ label, title, aria }: { label: string; title: string; aria: string }) {
    return (
        <span className="inline-flex items-center gap-1">
            {label}
            <span className="inline-flex cursor-help text-slate-300 hover:text-slate-500" title={title}>
                <InfoIcon className="w-3 h-3" aria-label={aria} />
            </span>
        </span>
    );
}

export function StatusPill({ subscribed }: { subscribed: boolean }) {
    const label = subscribed ? "מנוי" : "הוסר";
    return (
        <span
            className={`inline-flex items-center gap-1 max-w-full text-[10.5px] font-medium uppercase tracking-[0.08em] ${
                subscribed ? "text-emerald-700" : "text-slate-500"
            }`}
        >
            <span
                className={`size-1.5 shrink-0 rounded-full ${subscribed ? "bg-emerald-500" : "bg-slate-300"}`}
            />
            <span className="sr-only">{label}</span>
            <span aria-hidden className="hidden sm:inline truncate" {...clippedTitle}>
                {label}
            </span>
        </span>
    );
}

export function EngagementValue({
    n,
    sent,
    Icon,
    label,
    auto = false,
}: {
    n: number;
    sent: boolean;
    Icon: LucideIcon;
    label: string;
    auto?: boolean;
}) {
    if (n > 0) {
        return (
            <span
                className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 tabular-nums"
                title={`${label}: ${n} אימיילים`}
            >
                <Icon className="w-3 h-3 shrink-0" />
                {n}
            </span>
        );
    }
    if (auto) {
        return (
            <span
                className="text-[10.5px] text-slate-400"
                title="נפתח אוטומטית ע״י תוכנת הדואר, לא ע״י אדם"
            >
                אוטומטי
            </span>
        );
    }
    if (sent) {
        return (
            <span className="text-slate-300 text-[11px]" aria-label={`לא ${label}`}>
                —
            </span>
        );
    }
    return null;
}

const LEAD_META: Record<
    LeadStatus,
    { label: string; dot: string; text: string; Icon: LucideIcon }
> = {
    pending: { label: "בתור", dot: "bg-slate-300", text: "text-slate-500", Icon: ClockIcon },
    active: { label: "בעיבוד", dot: "bg-sky-500", text: "text-sky-700", Icon: ClockIcon },
    completed: { label: "הושלם", dot: "bg-indigo-500", text: "text-indigo-700", Icon: CheckIcon },
    replied: { label: "השיב", dot: "bg-emerald-500", text: "text-emerald-700", Icon: CornerUpLeftIcon },
    bounced: { label: "נדחה", dot: "bg-rose-500", text: "text-rose-600", Icon: AlertTriangleIcon },
    failed: { label: "נכשל", dot: "bg-rose-500", text: "text-rose-600", Icon: AlertTriangleIcon },
    unsubscribed: { label: "ביטל הרשמה", dot: "bg-slate-300", text: "text-slate-400", Icon: BanIcon },
    paused: { label: "מושהה", dot: "bg-violet-400", text: "text-violet-600", Icon: PauseIcon },
    undeliverable: { label: "לא ניתן למסירה", dot: "bg-amber-500", text: "text-amber-600", Icon: AlertTriangleIcon },
};

export function LeadStatusPill({ lead }: { lead?: ContactCampaignProgress | null }) {
    const status: LeadStatus = lead?.status ?? "pending";
    const meta = LEAD_META[status];
    const Icon = meta.Icon;
    const title =
        status === "failed" && lead?.failure_reason
            ? `שליחה נכשלה: ${lead.failure_reason}`
            : status === "undeliverable"
                ? "אימות הכתובת דחה נמען זה, ולכן הקמפיין מדלג עליו"
                : lead?.hold
                    ? holdSummary(lead.hold)
                    : undefined;
    return (
        <span
            className={`inline-flex items-center gap-1.5 max-w-full text-[10.5px] font-medium uppercase tracking-[0.08em] ${meta.text}`}
            title={title}
        >
            {status === "active" ? (
                <span className="campaign-grid text-sky-600 shrink-0" aria-hidden />
            ) : (
                <Icon className="w-3 h-3 shrink-0" />
            )}
            <span className="sr-only">{meta.label}</span>
            <span aria-hidden className="hidden sm:inline truncate" title={title} {...(title ? {} : clippedTitle)}>
                {meta.label}
            </span>
        </span>
    );
}
