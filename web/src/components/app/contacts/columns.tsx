// The contacts table's column registry. Every column the standalone list and
// the campaign Leads view can show is defined once here: its header, width,
// breakpoint, sort key and cell. The table renders whatever ordered subset the
// member's saved view names, in Hebrew and formatted for RTL.

import React from "react";
import {
    Building2Icon,
    CornerUpLeftIcon,
    MailIcon,
    MailOpenIcon,
    MousePointerClickIcon,
    PhoneIcon,
    type LucideIcon,
} from "lucide-react";
import clippedTitle from "@/lib/helper/clippedTitle";
import type { ContactCampaignProgress, VerificationSource, VerificationStatus } from "@/lib/api/models/app/contacts/Contact";
import type { SearchContactsSortBy } from "@/lib/api/models/app/contacts/search-contacts.types";
import type { ViewName } from "@/lib/api/models/app/views/ViewPreferences";
import { CategoryChip } from "./CategoryPicker";
import VerificationBadge from "./VerificationBadge";
import { Dash, EngagementValue, InfoHeader, LeadStatusPill, StatusPill } from "./cells";

export interface ContactRow {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    company: string;
    phone: string;
    subscribed: boolean;
    campaigns: { id: string }[];
    categories?: { id: string; title: string; color: string }[];
    campaign_lead?: ContactCampaignProgress | null;
    custom_fields?: Record<string, string>;
    verification_status?: VerificationStatus;
    verification_sub_status?: string;
    verification_source?: VerificationSource;
    verification_provider?: string;
    verification_checked_at?: string | null;
    verification_confidence?: number;
    verification_requested_at?: string | null;
    created_at: Date;
    updated_at?: Date;
}

export interface CellContext {
    c: ContactRow;
    lead: ContactCampaignProgress | null | undefined;
    processed?: boolean;
    embedded?: boolean;
}

export type Breakpoint = "sm" | "md" | "lg" | "xl" | "2xl";

export interface ContactColumn {
    id: string;
    label: string;
    header?: React.ReactNode;
    width: string;
    hideBelow?: Breakpoint;
    align?: "right";
    sortKey?: SearchContactsSortBy;
    sortAsc?: boolean;
    cellClassName?: string;
    cell: (ctx: CellContext) => React.ReactNode;
    locked?: boolean;
    custom?: string;
}

const HIDE: Record<Breakpoint, string> = {
    sm: "hidden sm:table-cell",
    md: "hidden md:table-cell",
    lg: "hidden lg:table-cell",
    xl: "hidden xl:table-cell",
    "2xl": "hidden 2xl:table-cell",
};

export function columnClass(col: ContactColumn): string {
    return [col.width, col.hideBelow ? HIDE[col.hideBelow] : "", col.align === "right" ? "text-start" : ""]
        .filter(Boolean)
        .join(" ");
}

export const CUSTOM_COLUMN_PREFIX = "custom:";
export const customColumnId = (key: string) => `${CUSTOM_COLUMN_PREFIX}${key}`;
export const isCustomColumnId = (id: string) => id.startsWith(CUSTOM_COLUMN_PREFIX);
export const customKeyOf = (id: string) => id.slice(CUSTOM_COLUMN_PREFIX.length);

function shortDate(d: Date | string | null | undefined): string {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("he-IL", { month: "short", day: "numeric" });
}

const nameColumn: ContactColumn = {
    id: "name",
    label: "שם",
    width: "",
    sortKey: "first_name",
    sortAsc: true,
    locked: true,
    cell: ({ c, processed }) => {
        const name =
            (c.first_name || c.last_name)
                ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()
                : c.email;
        return (
            <div className="flex items-center gap-2.5 min-w-0 text-start">
                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                    <span className="text-[9.5px] font-semibold text-slate-600">
                        {(c.first_name || c.email)?.slice(0, 2).toUpperCase()}
                    </span>
                </div>
                <div className="flex-1 min-w-0">
                    <div className={`text-[12.5px] font-medium truncate leading-tight flex items-center gap-1.5 ${processed ? "text-slate-400" : "text-slate-900"}`}>
                        <span className="truncate" {...clippedTitle}>{name}</span>
                        {c.categories && c.categories.length > 0 && (
                            <span className="inline-flex items-center gap-0.5 min-w-0 max-w-[45%]">
                                <CategoryChip category={c.categories[0]} compact />
                                {c.categories.length > 1 && (
                                    <span
                                        className="inline-flex items-center h-4 px-1 shrink-0 rounded text-[10px] font-medium bg-slate-100 text-slate-500"
                                        title={c.categories.slice(1).map((x) => x.title).join(", ")}
                                    >
                                        +{c.categories.length - 1}
                                    </span>
                                )}
                            </span>
                        )}
                    </div>
                    <div className="text-[10.5px] text-slate-400 truncate font-mono leading-tight flex items-center gap-1" dir="ltr">
                        <MailIcon className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate" {...clippedTitle}>{c.email}</span>
                        <VerificationBadge contact={c} />
                    </div>
                </div>
            </div>
        );
    },
};

function companyColumn(view: ViewName): ContactColumn {
    return {
        id: "company",
        label: "חברה",
        width: view === "campaign_leads" ? "w-40" : "w-36",
        hideBelow: view === "campaign_leads" ? "xl" : "lg",
        cellClassName: "text-[12px] text-slate-600",
        cell: ({ c }) =>
            c.company ? (
                <div className="flex items-center gap-1.5 min-w-0">
                    <Building2Icon className="w-3 h-3 shrink-0 text-slate-400" />
                    <span className="truncate" {...clippedTitle}>{c.company}</span>
                </div>
            ) : (
                <Dash />
            ),
    };
}

const phoneColumn: ContactColumn = {
    id: "phone",
    label: "טלפון",
    width: "w-36",
    hideBelow: "xl",
    cellClassName: "text-[12px] text-slate-600 font-mono",
    cell: ({ c }) =>
        c.phone ? (
            <div className="flex items-center gap-1.5 min-w-0" dir="ltr">
                <PhoneIcon className="w-3 h-3 shrink-0 text-slate-400" />
                <span className="truncate" {...clippedTitle}>{c.phone}</span>
            </div>
        ) : (
            <Dash />
        ),
};

function statusHeader(label: string) {
    return (
        <>
            <span className="sr-only">{label}</span>
            <span aria-hidden className="hidden sm:inline">{label}</span>
        </>
    );
}

const statusColumn: ContactColumn = {
    id: "status",
    label: "סטטוס",
    header: statusHeader("סטטוס"),
    width: "w-12 sm:w-32",
    cell: ({ c }) => <StatusPill subscribed={c.subscribed} />,
};

const progressColumn: ContactColumn = {
    id: "progress",
    label: "התקדמות",
    header: statusHeader("התקדמות"),
    width: "w-12 sm:w-32",
    cell: ({ lead }) => <LeadStatusPill lead={lead} />,
};

const engagement = (
    id: "opened" | "clicked" | "replied",
    label: string,
    Icon: LucideIcon,
    header?: React.ReactNode,
): ContactColumn => ({
    id,
    label,
    header,
    width: "w-24",
    hideBelow: "lg",
    cell: ({ lead }) => (
        <EngagementValue
            n={lead?.[id] ?? 0}
            sent={(lead?.sent ?? 0) > 0}
            Icon={Icon}
            label={label}
            auto={id === "opened" && (lead?.machine_opened ?? 0) > 0}
        />
    ),
});

const currentStepColumn: ContactColumn = {
    id: "current_step",
    label: "שלב נוכחי",
    width: "w-32",
    hideBelow: "xl",
    cell: ({ lead, processed }) =>
        lead?.current_step ? (
            <span
                title={lead.current_step}
                className={`inline-flex items-center h-5 px-1.5 rounded text-[11px] font-medium max-w-full ${
                    processed ? "bg-slate-100 text-slate-400" : "bg-sky-100 text-sky-700"
                }`}
            >
                <span className="truncate">{lead.current_step}</span>
            </span>
        ) : (
            <span className="text-[11px] text-slate-300">טרם התחיל</span>
        ),
};

const senderColumn: ContactColumn = {
    id: "sender",
    label: "שולח",
    header: (
        <InfoHeader
            label="שולח"
            title="תיבת הדואר שממנה נשלח כל הרצף של ליד זה. היא נבחרת כשהאימייל הראשון יוצא וכל המשכי המעקב ממשיכים ממנה, כך שהנמען תמיד מתכתב עם אותה הכתובת."
            aria="כיצד נבחרת תיבת השולח"
        />
    ),
    width: "w-36",
    hideBelow: "2xl",
    cell: ({ lead }) =>
        lead?.sender ? (
            <span
                title={`כל שלב ברצף של ליד זה נשלח מ-${lead.sender}`}
                className="block truncate text-[11.5px] text-slate-600"
                dir="ltr"
            >
                {lead.sender}
            </span>
        ) : (
            <span className="text-[11px] text-slate-300">לא הוקצה</span>
        ),
};

const campaignsColumn: ContactColumn = {
    id: "campaigns",
    label: "קמפיינים",
    width: "w-28",
    hideBelow: "lg",
    align: "right",
    sortKey: "campaign_count",
    cellClassName: "font-mono text-[12px] text-slate-600 tabular-nums",
    cell: ({ c }) => c.campaigns?.length ?? 0,
};

const dateCell = "font-mono text-[11px] text-slate-500 tabular-nums";

const addedColumn = (view: ViewName): ContactColumn => ({
    id: "created_at",
    label: "נוסף",
    width: view === "campaign_leads" ? "w-32" : "w-24",
    hideBelow: view === "campaign_leads" ? "2xl" : "md",
    align: "right",
    sortKey: "created_at",
    cellClassName: dateCell,
    cell: ({ c }) => shortDate(c.created_at),
});

const updatedColumn: ContactColumn = {
    id: "updated_at",
    label: "עודכן",
    width: "w-24",
    hideBelow: "md",
    align: "right",
    sortKey: "updated_at",
    cellClassName: dateCell,
    cell: ({ c }) => shortDate(c.updated_at),
};

const lastActivityColumn: ContactColumn = {
    id: "last_activity",
    label: "פעילות אחרונה",
    width: "w-32",
    hideBelow: "2xl",
    align: "right",
    cellClassName: dateCell,
    cell: ({ lead }) => shortDate(lead?.last_activity_at),
};

export function customColumn(key: string): ContactColumn {
    return {
        id: customColumnId(key),
        label: key,
        width: "w-36",
        hideBelow: "md",
        sortKey: customColumnId(key) as SearchContactsSortBy,
        sortAsc: true,
        custom: key,
        cellClassName: "text-[12px] text-slate-600",
        cell: ({ c }) => {
            const v = c.custom_fields?.[key];
            return v ? <span className="block truncate" {...clippedTitle}>{v}</span> : <Dash />;
        },
    };
}

export function builtinColumns(view: ViewName): ContactColumn[] {
    if (view === "campaign_leads") {
        return [
            nameColumn,
            companyColumn(view),
            phoneColumn,
            progressColumn,
            engagement(
                "opened",
                "נפתח",
                MailOpenIcon,
                <InfoHeader
                    label="נפתח"
                    title="פתיחות מבוססות על טעינת תמונות ע״י תוכנת הדואר. תוכנות החוסמות תמונות לא יציגו פתיחה גם אם האימייל נקרא. לחיצה של הנמען תמיד נספרת גם כפתיחה."
                    aria="כיצד נספרות פתיחות"
                />,
            ),
            engagement("clicked", "נלחץ", MousePointerClickIcon),
            engagement("replied", "הושב", CornerUpLeftIcon),
            currentStepColumn,
            senderColumn,
            lastActivityColumn,
            addedColumn(view),
            updatedColumn,
        ];
    }
    return [nameColumn, companyColumn(view), phoneColumn, statusColumn, campaignsColumn, addedColumn(view), updatedColumn];
}

export const DEFAULT_COLUMNS: Record<ViewName, string[]> = {
    contacts: ["name", "company", "phone", "status", "campaigns", "created_at"],
    campaign_leads: ["name", "company", "progress", "opened", "clicked", "replied", "current_step", "sender", "last_activity"],
};

export function resolveColumns(
    view: ViewName,
    saved: string[] | undefined,
    customKeys: string[],
): { visible: ContactColumn[]; available: ContactColumn[] } {
    const catalogue = builtinColumns(view);
    const byId = new Map(catalogue.map((c) => [c.id, c]));
    const chosen = saved && saved.length > 0 ? saved : DEFAULT_COLUMNS[view];
    const visible: ContactColumn[] = [];
    const seen = new Set<string>();
    for (const id of chosen) {
        if (seen.has(id)) continue;
        const col = byId.get(id) ?? (isCustomColumnId(id) ? customColumn(customKeyOf(id)) : undefined);
        if (!col || col.locked) continue;
        visible.push(col);
        seen.add(id);
    }
    visible.unshift(nameColumn);
    const available = [
        ...catalogue.filter((c) => !c.locked && !seen.has(c.id)),
        ...customKeys.filter((k) => !seen.has(customColumnId(k))).map(customColumn),
    ];
    return { visible, available };
}

export interface SortOption {
    key: SearchContactsSortBy;
    label: string;
    asc: boolean;
}

export function sortOptions(view: ViewName): SortOption[] {
    const base: SortOption[] = [
        { key: "created_at", label: "תאריך הוספה", asc: false },
        { key: "updated_at", label: "עדכון אחרון", asc: false },
        { key: "first_name", label: "שם פרטי", asc: true },
        { key: "last_name", label: "שם משפחה", asc: true },
        { key: "email", label: "אימייל", asc: true },
    ];
    if (view === "contacts") base.push({ key: "campaign_count", label: "קמפיינים", asc: false });
    return base;
}
