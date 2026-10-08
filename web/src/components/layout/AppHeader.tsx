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

import { Link } from "react-router-dom";
import { ChevronRight, Menu, Search } from "lucide-react";
import { useHeaderBreadcrumbs } from "@/hooks/useHeaderBreadcrumbs";
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
import { BetaPill } from "./BetaPill";
import { PlanPill } from "./PlanPill";
import { VersionPill } from "./VersionPill";
import { CreditsMeter } from "./CreditsMeter";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

// Pretty labels for path segments. Anything missing falls back to the
// raw segment with its first letter capitalised.
const labelMap: Record<string, string> = {
    app: "בית",
    emails: "תיבות דואר",
    unibox: "תיבת דואר מאוחדת",
    contacts: "אנשי קשר",
    segments: "סגמנטים",
    labels: "תוויות",
    categories: "תוויות",
    campaigns: "קמפיינים",
    analytics: "אנליטיקה",
    crm: "ניהול לקוחות",
    pipelines: "צינורות מכירה",
    deals: "עסקאות",
    tasks: "משימות",
    templates: "תבניות",
    "api-keys": "מפתחות API",
    settings: "הגדרות",
    profile: "פרופיל",
    notifications: "התראות",
    security: "אבטחה",
    members: "חברי צוות",
    teams: "צוותים",
    roles: "תפקידים והרשאות",
    workspace: "סביבת עבודה",
    sending: "שליחה",
    tracking: "מעקב אתר",
    ai: "בינה מלאכותית",
    "ai-models": "מודלי AI ומפתחות",
    "ai-skills": "מיומנויות AI",
    "oauth-slots": "סלוטים לחיבורי מייל (OAuth)",
    "oauth-apps": "יישומי OAuth",
    webhooks: "וובהוקים",
    connections: "חיבורים",
    data: "נתונים",
    danger: "אזור מסוכן",
    referral: "הפנה והרווח",
    limits: "מגבלות",
    "warmbly-cloud": "ענן Warmbly",
    forms: "טפסים",
    meetings: "פגישות",
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
    label: "תווית",
    category: "תווית",
    followup: "מעקב",
};

function pretty(segment: string): string {
    return labelMap[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function AppHeader({ onMenu }: { onMenu?: () => void }) {
    const crumbs = useHeaderBreadcrumbs();
    const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);
    // The logo zone spans the sidebar column, so it has to collapse with it or
    // the breadcrumb stops lining up with the content panel below.
    const isMobile = useIsMobile();
    const navCollapsed = useAppStore((s) => s.navCollapsed) && !isMobile;

    return (
        <div className="h-14 flex items-center shrink-0">
            {/* Logo zone — sidebar-width on >=md, compact with a menu button
                on mobile (the sidebar collapses into a drawer below md). */}
            <button
                type="button"
                onClick={onMenu}
                aria-label="פתח תפריט"
                className="md:hidden ml-1.5 w-9 h-9 rounded-md flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors shrink-0"
            >
                <Menu className="w-5 h-5" />
            </button>
            <Link
                to="/app/emails"
                className={cn(
                    "h-full flex items-center gap-2.5 shrink-0 group pl-2 pr-3 md:transition-[width,padding] md:duration-200 md:ease-out",
                    navCollapsed ? "md:w-14 md:px-0 md:justify-center" : "md:w-64 md:px-5",
                )}
            >
                <Logo className="w-7 text-slate-900 group-hover:text-slate-700 transition-colors duration-150" />
                <span
                    style={{ fontFamily: "var(--font-display)" }}
                    className={cn(
                        "font-extrabold text-[15.5px] tracking-tight text-slate-900",
                        navCollapsed ? "hidden" : "hidden md:inline",
                    )}
                >
                    Warmbly
                </span>
            </Link>

            {/* Breadcrumb: org switcher (always) > section > subpages */}
            <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-2 md:pr-4">
                <div className="min-w-0 md:shrink-0 max-w-32 lg:max-w-48">
                    <OrgSwitcher />
                </div>
                <nav aria-label="פירורי לחם" className="hidden md:block min-w-0">
                    <ol className="flex items-center gap-2 min-w-0">
                        {crumbs.map(({ label, to, current }, index) => (
                            <li key={to} className="flex items-center gap-2 min-w-0">
                                <ChevronRight aria-hidden="true" className="w-3.5 h-3.5 text-slate-300 shrink-0 rtl:rotate-180" />
                                {current ? (
                                    <span aria-current="page" title={label} className="text-[13px] font-medium text-slate-900 truncate">
                                        {label}
                                    </span>
                                ) : (
                                    <Link
                                        to={to}
                                        title={label}
                                        className={cn(
                                            "text-[13px] hover:text-slate-900 truncate transition-colors",
                                            index === crumbs.length - 1 ? "font-medium text-slate-900" : "text-slate-500",
                                        )}
                                    >
                                        {label}
                                    </Link>
                                )}
                            </li>
                        ))}
                    </ol>
                </nav>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 shrink-0">
                <BetaPill />
                <div className="hidden sm:flex items-center gap-2">
                    <div className="hidden lg:contents"><PlanPill /></div>
                    <VersionPill />
                    <div className="hidden lg:contents"><CreditsMeter /></div>
                    <div className="hidden lg:block h-4 w-px bg-slate-200/80" />
                </div>
                <OutboxIndicator />
                <PresenceAvatars />
                <ConnectionIndicator />
                <NotificationBell />
                <AssistantButton />
                <button
                    type="button"
                    aria-label="חיפוש"
                    onClick={() => setCommandPaletteOpen(true)}
                    className="flex items-center gap-2 px-2 h-7 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-colors text-[12.5px]"
                >
                    <Search className="w-3.5 h-3.5" />
                    <span className="hidden xl:inline">חיפוש בכל המערכת...</span>
                    <kbd className="hidden xl:inline-flex h-4 items-center px-1 rounded border border-slate-300/70 bg-white/60 font-mono text-[10px] text-slate-500 ml-0.5">
                        ⌘K
                    </kbd>
                </button>
            </div>
        </div>
    );
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
                        "absolute top-0.5 right-0.5 size-1.5 rounded-full ring-2 ring-white " +
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
