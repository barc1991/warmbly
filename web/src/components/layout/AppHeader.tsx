// Top breadcrumb bar.
//
// Reads as one continuous line across the entire top of the shell:
//
//   [Warmbly logo]  >  [Org picker]  >  [Current section]      [⌘K  ⚡]
//
// The logo sits over the sidebar column, the org picker + section live
// in the open area, the right side has connection indicator + search.
// All on the sky-colored chrome — text is white-ish, dividers are faint.
//
// This component is purely the row. Layout (where it sits) is decided by
// AppShell, not here.

import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Menu, Search } from "lucide-react";
import { Logo } from "@/components/svg";
import AgentMark from "@/components/app/agent/AgentMark";
import { useAppStore } from "@/stores";
import { ConnectionIndicator } from "@/components/shared/ConnectionIndicator";
import { usePermission } from "@/hooks/usePermission";
import ShortcutTooltip from "@/components/ui/shortcut-tooltip";
import PresenceAvatars from "@/components/app/presence/PresenceAvatars";
import OutboxIndicator from "@/components/app/unibox/compose/OutboxIndicator";
import { NotificationBell } from "./NotificationBell";
import { OrgSwitcher } from "./OrgSwitcher";
import { PlanPill } from "./PlanPill";
import { VersionPill } from "./VersionPill";
import { CreditsMeter } from "./CreditsMeter";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";

// Pretty labels for path segments. Anything missing falls back to the
// raw segment with its first letter capitalised.
const labelMap: Record<string, string> = {
    app: "בית",
    emails: "תיבות דואר",
    unibox: "תיבת דואר מאוחדת",
    contacts: "אנשי קשר",
    segments: "סגמנטים",
    categories: "קטגוריות",
    campaigns: "קמפיינים",
    analytics: "אנליטיקה",
    crm: "ניהול לקוחות",
    pipelines: "צינורות מכירה",
    deals: "עסקאות",
    tasks: "משימות",
    templates: "תבניות",
    "api-keys": "מפתחות API",
    settings: "הגדרות",
    billing: "חיוב ומנוי",
    team: "צוות",
    admin: "ניהול",
    workers: "עובדים",
    credentials: "אישורים",
    audit: "יומן פעילות",
    leads: "לידים",
    preferences: "העדפות",
    schedule: "לוח זמנים",
    steps: "שלבים",
    suppressions: "רשימת חסימה",
    integrations: "אינטגרציות",
    automations: "אוטומציות",
    deliverability: "דיוור",
    all: "הכל",
    inbox: "דואר נכנס",
    unread: "לא נקרא",
    starred: "מסומן בכוכב",
    sent: "נשלח",
    drafts: "טיוטות",
    scheduled: "מתוזמן",
    positive: "חיובי",
    interested: "מתעניין",
    meeting_booked: "נקבעה פגישה",
    not_interested: "לא מעוניין",
    auto_reply: "מענה אוטומטי",
    bounced: "שגיאות מסירה",
    spam: "ספאם",
    archive: "ארכיון",
    mailbox: "תיבת דואר",
    trash: "אשפה",
    today: "היום",
    week: "השבוע",
    agent_drafts: "טיוטות סוכן",
    "agent-drafts": "טיוטות סוכן",
    agentdrafts: "טיוטות סוכן",
    snoozed: "נודניק",
    awaiting: "ממתין לתשובה",
    awaiting_reply: "ממתין לתשובה",
    awaiting_agent_draft: "טיוטות סוכן",
    tag: "תגית",
    category: "קטגוריה",
    followup: "מעקב",
};

const segToI18n: Record<string, string> = {
    emails: "nav:items.mailboxes",
    unibox: "nav:items.unibox",
    contacts: "nav:items.contacts",
    segments: "nav:items.segments",
    categories: "nav:items.categories",
    suppressions: "nav:items.suppressions",
    campaigns: "nav:items.campaigns",
    analytics: "nav:items.analytics",
    crm: "nav:items.crm",
    pipelines: "nav:items.pipelines",
    deals: "nav:items.deals",
    tasks: "nav:items.tasks",
    meetings: "nav:items.meetings",
    templates: "nav:items.templates",
    "api-keys": "nav:items.apiKeys",
    settings: "nav:items.settings",
    billing: "nav:userNav.billing",
    audit: "nav:items.auditLog",
    forms: "nav:items.forms",
    integrations: "nav:items.integrations",
    automations: "nav:items.automations",
    deliverability: "nav:items.deliverability",
};

function pretty(segment: string): string {
    return labelMap[segment.toLowerCase()] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function AppHeader({ onMenu }: { onMenu?: () => void }) {
    const { pathname } = useLocation();
    const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);
    const { t, i18n } = useTranslation();
    const isHe = i18n.language === "he";

    const getCrumbTitle = (seg: string) => {
        const i18nKey = segToI18n[seg.toLowerCase()];
        if (i18nKey) return t(i18nKey, isHe ? (labelMap[seg.toLowerCase()] ?? pretty(seg)) : pretty(seg));
        return isHe ? (labelMap[seg.toLowerCase()] ?? pretty(seg)) : pretty(seg);
    };

    // Path under /app — first segment is the section ("emails", "admin", ...),
    // subsequent ones are subpages. Don't show UUID-looking or hex thread segments verbatim
    // because nobody wants "Campaigns > 47a3-..." or "Unibox > All > 1a06..." in their chrome.
    const segments = pathname
        .split("/")
        .filter(Boolean)
        .filter((s) => s !== "app");
    // Each crumb links to its own path prefix so "Campaigns > Leads" gets you
    // back to the list; hidden UUID/hex segments still count toward the prefix.
    const crumbs = segments
        .map((seg, i) => ({ seg, to: `/app/${segments.slice(0, i + 1).join("/")}`, index: i }))
        .filter(({ seg, index }) => {
            if ((segments[0] === "unibox" || segments[0] === "inbox") && index >= 2) return false;
            if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(seg)) return false;
            if (/^[0-9a-f]{8,}$/i.test(seg)) return false;
            return true;
        });
    // A crumb whose prefix is the page itself is a label; every other one is a
    // link (so "Campaigns" stays clickable on /campaigns/<id>, where the hidden
    // id is the real last segment).
    const currentPath = `/app/${segments.join("/")}`;

    return (
        <div className="h-14 flex items-center shrink-0">
            {/* Logo zone — sidebar-width on >=md, compact with a menu button
                on mobile (the sidebar collapses into a drawer below md). */}
            <button
                type="button"
                onClick={onMenu}
                aria-label="Open menu"
                className="md:hidden ms-1.5 w-9 h-9 rounded-md flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors shrink-0"
            >
                <Menu className="w-5 h-5" />
            </button>
            <Link
                to="/app/emails"
                className="h-full flex items-center gap-2.5 shrink-0 group ps-2 pe-3 md:w-64 md:px-5"
            >
                <Logo className="w-7 text-slate-900 group-hover:text-slate-700 transition-colors duration-150" />
                <span
                    style={{ fontFamily: "var(--font-display)" }}
                    className="hidden md:inline font-extrabold text-[15.5px] tracking-tight text-slate-900"
                >
                    Warmbly
                </span>
            </Link>

            {/* Breadcrumb: org switcher (always) > section > subpages. The
                section crumbs are redundant with each page's own title on a
                phone, so they only show on >=md. */}
            <div className="flex items-center gap-1.5 min-w-0 flex-1 pe-2 md:pe-4">
                <Crumb>
                    <OrgSwitcher />
                </Crumb>
                {crumbs.map(({ seg, to }) => (
                    <div key={to} className="hidden md:flex items-center gap-2 min-w-0">
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0 rtl:rotate-180" />
                        {to === currentPath ? (
                            <span className="text-[13px] font-medium text-slate-900 truncate">
                                {getCrumbTitle(seg)}
                            </span>
                        ) : (
                            <Link
                                to={to}
                                className="text-[13px] text-slate-500 hover:text-slate-900 truncate transition-colors"
                            >
                                {getCrumbTitle(seg)}
                            </Link>
                        )}
                    </div>
                ))}
            </div>

            <div className="flex items-center gap-2 px-2 sm:px-4 shrink-0">
                <div className="hidden sm:flex items-center gap-2">
                    <PlanPill />
                    <VersionPill />
                    <CreditsMeter />
                    <div className="h-4 w-px bg-slate-200/80" />
                </div>
                <OutboxIndicator />
                <PresenceAvatars />
                <ConnectionIndicator />
                <NotificationBell />
                <AssistantButton />
                <LanguageSwitcher compact />
                <button
                    onClick={() => setCommandPaletteOpen(true)}
                    className="flex items-center gap-2 px-2 h-7 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-colors text-[12.5px]"
                >
                    <Search className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">חיפוש בכל המערכת...</span>
                    <kbd className="hidden md:inline-flex h-4 items-center gap-0.5 px-1.5 rounded border border-slate-300/70 bg-white/60 font-sans text-[10px] text-slate-500 ms-0.5 select-none">
                        <span className="text-[9px] leading-none opacity-70">⌘</span>
                        <span className="text-[10px] font-semibold leading-none">K</span>
                    </kbd>
                </button>
            </div>
        </div>
    );
}

function Crumb({ children }: { children: React.ReactNode }) {
    return <div className="flex items-center gap-2 min-w-0">{children}</div>;
}

// The assistant toggle, with a live status badge so background work is never
// invisible: pulsing sky while a run streams, amber when a tool waits for
// approval, solid sky when a finished response hasn't been read yet.
function AssistantButton() {
    const open = useAppStore((s) => s.aiAssistantOpen);
    const minimized = useAppStore((s) => s.agentMinimized);
    const setOpen = useAppStore((s) => s.setAIAssistantOpen);
    const setMinimized = useAppStore((s) => s.setAgentMinimized);
    const tabs = useAppStore((s) => s.agentTabs);
    const canAI = usePermission("USE_AI");

    if (!canAI) return null;

    const running = tabs.some((t) => t.running);
    const pending = tabs.some((t) => t.pending);
    const unseen = tabs.some((t) => t.unseen);

    return (
        <ShortcutTooltip label="עוזר AI" combo="mod+I" side="bottom">
        <button
            onClick={() => {
                if (open && minimized) {
                    // Docked: bring the panel back instead of closing it.
                    setMinimized(false);
                } else if (open) {
                    setOpen(false);
                } else {
                    setMinimized(false);
                    setOpen(true);
                }
            }}
            aria-label="עוזר AI"
            className="relative flex items-center justify-center size-7 rounded-md text-slate-500 hover:text-sky-700 hover:bg-sky-50 transition-colors"
        >
            <AgentMark className="w-4 h-4" />
            {(running || pending || unseen) && (
                <span
                    className={
                        "absolute top-0.5 ltr:right-0.5 rtl:left-0.5 size-1.5 rounded-full ring-2 ring-white " +
                        (running
                            ? "bg-sky-500 animate-pulse"
                            : pending
                              ? "bg-amber-500"
                              : "bg-sky-500")
                    }
                />
            )}
        </button>
        </ShortcutTooltip>
    );
}
