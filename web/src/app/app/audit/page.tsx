// Audit log — organization-wide activity trail ("who did what").
//
// Visible to owners + admins (gated in the sidebar + on the page).
// Reads from /audit-logs, which returns every member's activity in the
// caller's current organization (member/role changes, and CRUD across
// campaigns, contacts, email accounts, API keys, webhooks, CRM, and more).
// Personal auth events (login/logout) are deliberately excluded. Updates
// live via the realtime AUDIT event.
//
// Layout matches the rest of the dashboard chrome: dense table with
// hairline borders, an actor ("Who") column, expandable rows for the JSON
// changes payload, and filters in the topbar.

import React from "react";
import {
    AlertCircleIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    FilterXIcon,
    InfoIcon,
    Loader2Icon,
    RefreshCwIcon,
    SearchIcon,
    ShieldCheckIcon,
    XIcon,
} from "lucide-react";
import {
    EmptyBlock,
    Page,
    PageBody,
    PageTopbar,
    SectionBar,
    Stat,
    StatStrip,
} from "@/components/layout/Page";
import { DatePicker } from "@/components/ui/DatePicker";
import useFeatureAccess from "@/hooks/useFeatureAccess";
import useAuditLogs from "@/lib/api/hooks/app/audit/useAuditLogs";
import {
    PopoverMenu,
    PopoverMenuContent,
    PopoverMenuItem,
    PopoverMenuTrigger,
} from "@/components/ui/popover-menu";
import type AuditLog from "@/lib/api/models/app/audit/AuditLog";
import type { AuditAction, AuditEntityType } from "@/lib/api/models/app/audit/AuditLog";

const ACTION_LABELS: Record<string, string> = {
    create:     "יצירה",
    update:     "עדכון",
    delete:     "מחיקה",
    invite:     "הזמנה",
    remove:     "הסרה",
    transfer:   "העברה",
    start:      "הפעלה",
    stop:       "עצירה",
    pause:      "השהיה",
    resume:     "חידוש",
    send:       "שליחה",
    connect:    "חיבור",
    disconnect: "ניתוק",
    rotate:     "החלפה",
    revoke:     "ביטול",
    duplicate:  "שכפול",
    export:     "ייצוא",
    import:     "ייבוא",
    api_call:   "קריאת API",
};

const ENTITY_LABELS: Record<string, string> = {
    campaign:             "קמפיין",
    contact:              "איש קשר",
    email_account:        "תיבת אימייל",
    step:                 "שלב",
    template:             "תבנית",
    email_image:          "תמונת אימייל",
    api_key:              "מפתח API",
    webhook:              "וובהוק",
    integration:          "אינטגרציה",
    warmup_routing_rule:  "כלל ניתוב חימום",
    organization:         "ארגון",
    organization_member:  "חבר ארגון",
    invitation:           "הזמנה",
    folder:               "תיקייה",
    tag:                  "תגית",
    category:             "קטגוריה",
    subscription:         "מנוי",
    settings:             "הגדרות",
    crm_pipeline:         "צינור CRM",
    crm_stage:            "שלב CRM",
    crm_deal:             "עסקה",
    crm_task:             "משימה",
    crm_note:             "הערה",
    unibox:               "תיבה מאוחדת",
    user:                 "משתמש",
};

const ACTIONS: AuditAction[] = [
    "create", "update", "delete",
    "invite", "remove", "transfer",
    "start", "stop", "pause", "resume", "send",
    "connect", "disconnect", "rotate", "revoke",
    "duplicate", "export", "import", "api_call",
];

const ENTITY_TYPES: AuditEntityType[] = [
    "campaign", "contact", "email_account", "step", "template", "email_image",
    "api_key", "webhook", "integration", "warmup_routing_rule",
    "organization", "organization_member", "invitation",
    "folder", "tag", "category", "subscription", "settings",
    "crm_pipeline", "crm_stage", "crm_deal", "crm_task", "crm_note",
    "unibox", "user",
];

const ACTION_TONE: Record<string, { dot: string; text: string }> = {
    create:     { dot: "bg-emerald-500", text: "text-emerald-700" },
    update:     { dot: "bg-sky-500",     text: "text-sky-700" },
    delete:     { dot: "bg-red-500",     text: "text-red-700" },
    api_call:   { dot: "bg-amber-500",   text: "text-amber-700" },
    export:     { dot: "bg-sky-500",     text: "text-sky-700" },
    import:     { dot: "bg-sky-500",     text: "text-sky-700" },
    revoke:     { dot: "bg-red-500",     text: "text-red-700" },
    connect:    { dot: "bg-emerald-500", text: "text-emerald-700" },
    disconnect: { dot: "bg-red-500",     text: "text-red-700" },
    invite:     { dot: "bg-emerald-500", text: "text-emerald-700" },
    remove:     { dot: "bg-red-500",     text: "text-red-700" },
    transfer:   { dot: "bg-violet-500",  text: "text-violet-700" },
    start:      { dot: "bg-emerald-500", text: "text-emerald-700" },
    stop:       { dot: "bg-red-500",     text: "text-red-700" },
    pause:      { dot: "bg-amber-500",   text: "text-amber-700" },
    resume:     { dot: "bg-emerald-500", text: "text-emerald-700" },
    send:       { dot: "bg-sky-500",     text: "text-sky-700" },
    duplicate:  { dot: "bg-sky-500",     text: "text-sky-700" },
    rotate:     { dot: "bg-amber-500",   text: "text-amber-700" },
};

export default function AuditPage() {
    const access = useFeatureAccess();
    const [action, setAction] = React.useState<AuditAction | undefined>();
    const [entityType, setEntityType] = React.useState<AuditEntityType | undefined>();
    const [date, setDate] = React.useState<string>("");
    const [search, setSearch] = React.useState("");
    const [cursors, setCursors] = React.useState<string[]>([]);

    const params = React.useMemo(
        () => ({
            action,
            entity_type: entityType,
            date: date || undefined,
            cursor: cursors.length > 0 ? cursors[cursors.length - 1] : undefined,
            limit: 50,
        }),
        [action, entityType, date, cursors],
    );

    const audit = useAuditLogs(params);

    function reset() {
        setAction(undefined);
        setEntityType(undefined);
        setDate("");
        setCursors([]);
    }

    function nextPage() {
        const next = audit.data?.pagination?.next_cursor ?? audit.data?.pagination?.cursor;
        if (next) setCursors((c) => [...c, next]);
    }
    function prevPage() {
        setCursors((c) => c.slice(0, -1));
    }

    if (!access.loading && !access.canManage) {
        return (
            <Page>
                <PageTopbar eyebrow="יומן ביקורת" subtitle="לבעלים ומנהלים בלבד" />
                <PageBody>
                    <EmptyBlock
                        title="רק בעלים ומנהלים יכולים לצפות ביומן הביקורת"
                        body="רשומות ביקורת עשויות להכיל מזהים רגישים. פנה לבעל הארגון אם אתה זקוק לגישה."
                    />
                </PageBody>
            </Page>
        );
    }

    const all = audit.data?.data ?? [];
    const q = search.trim().toLowerCase();
    const filtered = q
        ? all.filter(
              (l) =>
                  l.action.toLowerCase().includes(q) ||
                  l.entity_type.toLowerCase().includes(q) ||
                  actorLabel(l).toLowerCase().includes(q) ||
                  (l.actor?.email ?? "").toLowerCase().includes(q) ||
                  (l.entity_id ?? "").toLowerCase().includes(q) ||
                  (l.ip_address ?? "").toLowerCase().includes(q),
          )
        : all;

    const stats = React.useMemo(() => {
        const out: Record<string, number> = { total: all.length };
        for (const l of all) out[l.action] = (out[l.action] ?? 0) + 1;
        return out;
    }, [all]);

    const activeFilterCount =
        (action ? 1 : 0) + (entityType ? 1 : 0) + (date ? 1 : 0) + (search ? 1 : 0);

    const filterControls = (
        <>
            <SearchPill value={search} onChange={setSearch} />
            <FilterPopover
                label="פעולה"
                value={action ?? ""}
                options={ACTIONS}
                optionLabels={ACTION_LABELS}
                onChange={(v) => setAction(v ? (v as AuditAction) : undefined)}
            />
            <FilterPopover
                label="ישות"
                value={entityType ?? ""}
                options={ENTITY_TYPES}
                optionLabels={ENTITY_LABELS}
                onChange={(v) => setEntityType(v ? (v as AuditEntityType) : undefined)}
            />
            <DatePill value={date} onChange={setDate} />
            {activeFilterCount > 0 && (
                <button
                    type="button"
                    onClick={reset}
                    title="נקה מסננים"
                    className="h-7 px-2 rounded-md border border-slate-200 hover:border-slate-300 text-[11.5px] text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 transition-colors"
                >
                    <FilterXIcon className="w-3 h-3" />
                    נקה ({activeFilterCount})
                </button>
            )}
        </>
    );

    return (
        <Page>
            <PageTopbar eyebrow="יומן ביקורת" subtitle="פעולות שינוי במרחב עבודה זה · 90 הימים האחרונים">
                <div className="hidden md:contents">{filterControls}</div>
                <button
                    type="button"
                    onClick={() => audit.refetch()}
                    aria-label="רענן"
                    className="h-7 w-7 rounded-md border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-900 inline-flex items-center justify-center transition-colors"
                >
                    {audit.isFetching ? (
                        <Loader2Icon className="w-3 h-3 animate-spin" />
                    ) : (
                        <RefreshCwIcon className="w-3 h-3" />
                    )}
                </button>
            </PageTopbar>

            <div className="flex md:hidden flex-wrap items-center gap-1.5 px-5 py-2 border-b border-slate-200">
                {filterControls}
            </div>

            <StatStrip cols={4}>
                <Stat label="סה״כ אירועים" value={stats.total ?? 0} sub="בעמוד זה" />
                <Stat label="יצירות" value={stats.create ?? 0} sub="אובייקטים חדשים" />
                <Stat label="עדכונים" value={stats.update ?? 0} sub="עריכות" />
                <Stat label="מחיקות" value={stats.delete ?? 0} sub="הוסרו" last />
            </StatStrip>

            <SectionBar
                label={audit.isPending ? "טוען…" : `${filtered.length} רשומות${cursors.length ? ` · עמוד ${cursors.length + 1}` : ""}`}
            />
            <PageBody>
                {audit.isPending ? (
                    <div className="px-5 py-5 space-y-2">
                        {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="h-10 rounded bg-slate-100 animate-pulse" />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="px-5 py-12">
                        <EmptyBlock
                            title="אין רשומות ביקורת"
                            body={
                                activeFilterCount > 0
                                    ? "לא נמצאו תוצאות עבור המסננים הפעילים."
                                    : "פעולות נרשמות באופן אוטומטי. בצע שינוי והוא יופיע כאן."
                            }
                        />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-start">
                            <thead className="border-b border-slate-200">
                                <tr>
                                    <th className="w-6"></th>
                                    <Th className="md:w-40">מתי</Th>
                                    <Th className="md:w-48">מי</Th>
                                    <Th className="md:w-32">פעולה</Th>
                                    <Th>ישות</Th>
                                    <Th className="hidden md:table-cell w-32">כתובת IP</Th>
                                    <th className="hidden md:table-cell w-12" aria-label="פרטים"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((l) => (
                                    <AuditRow key={l.id} log={l} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {filtered.length > 0 && (
                    <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">
                            {filtered.length} {filtered.length === 1 ? "רשומה" : "רשומות"}
                            {cursors.length > 0 && ` · עמוד ${cursors.length + 1}`}
                        </span>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={prevPage}
                                disabled={cursors.length === 0}
                                className="h-7 px-2.5 rounded-md border border-slate-200 hover:border-slate-300 text-[12px] text-slate-700 hover:text-slate-900 transition-colors disabled:opacity-40"
                            >
                                הקודם
                            </button>
                            <button
                                type="button"
                                onClick={nextPage}
                                disabled={!(audit.data?.pagination?.next_cursor || audit.data?.pagination?.cursor)}
                                className="h-7 px-2.5 rounded-md border border-slate-200 hover:border-slate-300 text-[12px] text-slate-700 hover:text-slate-900 transition-colors disabled:opacity-40"
                            >
                                הבא
                            </button>
                        </div>
                    </div>
                )}
            </PageBody>
        </Page>
    );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
    return (
        <th
            className={`px-3 py-2 text-start text-[10px] font-medium text-slate-400 uppercase tracking-[0.14em] ${className ?? ""}`}
        >
            {children}
        </th>
    );
}

function AuditRow({ log }: { log: AuditLog }) {
    const [open, setOpen] = React.useState(false);
    const hasDetails =
        (log.changes && Object.keys(log.changes).length > 0) ||
        (log.metadata && Object.keys(log.metadata).length > 0) ||
        !!log.user_agent;
    const tone = ACTION_TONE[log.action] ?? { dot: "bg-slate-400", text: "text-slate-600" };

    return (
        <>
            <tr
                className="group h-11 border-b border-slate-200/60 hover:bg-slate-50/80 transition-colors cursor-pointer"
                onClick={() => hasDetails && setOpen(!open)}
            >
                <td className="px-2 text-center text-slate-300">
                    {hasDetails ? (
                        open ? (
                            <ChevronDownIcon className="w-3 h-3 inline" />
                        ) : (
                            <ChevronRightIcon className="w-3 h-3 inline rtl:rotate-180" />
                        )
                    ) : null}
                </td>
                <td className="px-3 font-mono text-[11px] text-slate-500 tabular-nums whitespace-nowrap text-start" dir="ltr">
                    {fmt(log.timestamp || log.action_date)}
                </td>
                <td className="px-3 text-start">
                    <div className="flex flex-col leading-tight min-w-0">
                        <span className="text-[12px] text-slate-900 font-medium truncate">
                            {actorLabel(log)}
                        </span>
                        {log.actor?.email && (
                            <span className="text-[10.5px] text-slate-400 truncate" dir="ltr">
                                {log.actor.email}
                            </span>
                        )}
                    </div>
                </td>
                <td className="px-3 text-start">
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${tone.text}`}>
                        <span className={`size-1.5 rounded-full ${tone.dot}`} />
                        {ACTION_LABELS[log.action] ?? log.action}
                    </span>
                </td>
                <td className="px-3 text-start">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[12px] text-slate-900 font-medium">{ENTITY_LABELS[log.entity_type] ?? log.entity_type}</span>
                        {log.entity_id && (
                            <span className="font-mono text-[10.5px] text-slate-400 truncate" dir="ltr">
                                {log.entity_id.slice(0, 8)}…
                            </span>
                        )}
                    </div>
                </td>
                <td className="hidden md:table-cell px-3 font-mono text-[10.5px] text-slate-500 truncate text-start" dir="ltr">
                    {log.ip_address || "-"}
                </td>
                <td className="hidden md:table-cell px-3 text-end">
                    {hasDetails && (
                        <InfoIcon className="w-3 h-3 text-slate-300 group-hover:text-slate-500 inline" />
                    )}
                </td>
            </tr>
            {open && hasDetails && (
                <tr className="bg-slate-50/60 border-b border-slate-200/60">
                    <td></td>
                    <td colSpan={6} className="px-3 py-3">
                        <div className="space-y-2">
                            {log.changes && Object.keys(log.changes).length > 0 && (
                                <DetailsBlock label="שינויים" data={log.changes} />
                            )}
                            {log.metadata && Object.keys(log.metadata).length > 0 && (
                                <DetailsBlock label="מטא-נתונים" data={log.metadata} />
                            )}
                            {log.user_agent && (
                                <div className="text-[11px] text-slate-500">
                                    <span className="text-slate-400">סוכן משתמש: </span>
                                    <span className="font-mono break-all" dir="ltr">{log.user_agent}</span>
                                </div>
                            )}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

function DetailsBlock({ label, data }: { label: string; data: Record<string, string> }) {
    return (
        <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium mb-1">
                {label}
            </div>
            <pre className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-700 font-mono overflow-x-auto text-start" dir="ltr">
                {JSON.stringify(data, null, 2)}
            </pre>
        </div>
    );
}

function actorLabel(log: AuditLog): string {
    const a = log.actor;
    if (a) {
        const name = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim();
        if (name) return name;
        if (a.email) return a.email;
    }
    if (log.user_id && log.user_id !== "00000000-0000-0000-0000-000000000000") {
        return `${log.user_id.slice(0, 8)}…`;
    }
    return "מערכת";
}

function fmt(d: string) {
    if (!d) return "-";
    try {
        const dt = new Date(d);
        return dt.toLocaleString("he-IL", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    } catch {
        return "-";
    }
}

function SearchPill({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <div className="h-7 px-2 rounded-md border border-slate-200 bg-white flex items-center gap-1.5 focus-within:border-sky-400 transition-colors">
            <SearchIcon className="w-3 h-3 text-slate-400" />
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="חיפוש…"
                className="w-[100px] sm:w-[140px] h-5 bg-transparent text-[12px] text-slate-900 placeholder:text-slate-400 outline-none text-start"
            />
            {value && (
                <button
                    type="button"
                    onClick={() => onChange("")}
                    aria-label="נקה"
                    className="text-slate-400 hover:text-slate-700"
                >
                    <XIcon className="w-3 h-3" />
                </button>
            )}
        </div>
    );
}

function FilterPopover({
    label,
    value,
    options,
    optionLabels,
    onChange,
}: {
    label: string;
    value: string;
    options: string[];
    optionLabels?: Record<string, string>;
    onChange: (v: string) => void;
}) {
    const [open, setOpen] = React.useState(false);

    return (
        <PopoverMenu open={open} onOpenChange={setOpen} align="end">
            <PopoverMenuTrigger asChild>
                <button
                    type="button"
                    className={`h-7 px-2.5 rounded-md border text-[12px] inline-flex items-center gap-1.5 transition-colors ${
                        value
                            ? "border-slate-300 bg-slate-100 text-slate-900"
                            : "border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300"
                    }`}
                >
                    {label}
                    {value && (
                        <span className="text-[11px] font-medium text-slate-700 max-w-[90px] truncate">
                            {optionLabels?.[value] ?? value}
                        </span>
                    )}
                    <ChevronDownIcon className="w-3 h-3 opacity-60" />
                </button>
            </PopoverMenuTrigger>
            <PopoverMenuContent minWidth={180} className="max-h-72 overflow-y-auto text-start">
                <PopoverMenuItem onSelect={() => onChange("")} selected={value === ""}>
                    הכל
                </PopoverMenuItem>
                {options.map((o) => (
                    <PopoverMenuItem key={o} onSelect={() => onChange(o)} selected={value === o}>
                        {optionLabels?.[o] ?? o}
                    </PopoverMenuItem>
                ))}
            </PopoverMenuContent>
        </PopoverMenu>
    );
}

function DatePill({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return <DatePicker value={value} onChange={onChange} placeholder="כל תאריך" />;
}

void AlertCircleIcon;
void ShieldCheckIcon;
