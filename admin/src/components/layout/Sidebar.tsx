// Left rail navigation. Mirrors the dashboard's general structure
// (icon + label rows, grouped sections) but uses the admin-tinted
// sidebar background and amber accent for active items so it never
// gets confused with the dashboard's sidebar.
//
// NAV_GROUPS is the one nav model: the mobile drawer, the command palette
// and the document title all read it, so a route added here is reachable
// and titled everywhere at once.

import { NavLink } from "react-router-dom";
import {
    Activity,
    ArrowLeftRight,
    Building2,
    CalendarClock,
    FileText,
    Flame,
    Gauge,
    HeartPulse,
    Inbox,
    LayoutDashboard,
    Mailbox,
    Megaphone,
    Network,
    Radio,
    RefreshCw,
    Send,
    SendHorizonal,
    Server,
    ShieldCheck,
    SlidersHorizontal,
    Sparkles,
    TicketPercent,
    UserCog,
    FlaskConical,
    Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { useMe } from "@/hooks/useMe";
import { AdminPerm, hasAdminPerm } from "@/lib/auth/permissions";
import { findingCount, useInstanceHealth, worstSeverity } from "@/hooks/useInstanceHealth";
import type { CheckSeverity } from "@/lib/api/client/admin/instance";
import { AdminBadge } from "./AdminBadge";

export interface NavItem {
    to: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    end?: boolean;
    // Admin permission bit the backend gates this route's data on.
    perm?: number;
    // Renders the live count of instance findings next to the label.
    healthBadge?: boolean;
}

export interface NavGroup {
    label: string;
    items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
    {
        label: "סקירה כללית",
        items: [{ to: "/", label: "סקירה כללית", icon: LayoutDashboard, end: true }],
    },
    {
        label: "תפעול",
        items: [
            { to: "/workers", label: "תהליכי עבודה (Workers)", icon: Server, end: true, perm: AdminPerm.ViewWorkers },
            { to: "/fleet", label: "צי שרתים (Fleet)", icon: Network, perm: AdminPerm.ViewWorkers },
            { to: "/mailboxes", label: "תיבות דואר", icon: Mailbox, perm: AdminPerm.ViewUsers },
            { to: "/sync", label: "סנכרון", icon: RefreshCw, perm: AdminPerm.ViewUsers },
            { to: "/warmup", label: "חימום", icon: Flame, end: true, perm: AdminPerm.ViewWarmupPool },
            { to: "/warmup/appeals", label: "ערעורי חימום", icon: ShieldCheck, perm: AdminPerm.ReviewAppeals },
            { to: "/warmup-content", label: "תוכן חימום", icon: Sparkles, perm: AdminPerm.ViewWarmupPool },
            { to: "/placement", label: "פאנל תיבות בדיקה", icon: Inbox, perm: AdminPerm.ViewWarmupPool },
            { to: "/campaigns", label: "קמפיינים", icon: Megaphone, perm: AdminPerm.ViewCampaigns },
            { to: "/sends", label: "שליחות", icon: SendHorizonal, perm: AdminPerm.ViewCampaigns },
        ],
    },
    {
        label: "חשבונות",
        items: [
            { to: "/users", label: "משתמשים", icon: Users, perm: AdminPerm.ViewUsers },
            { to: "/organizations", label: "ארגונים", icon: Building2, perm: AdminPerm.ViewOrganizations },
            { to: "/limit-requests", label: "בקשות להגדלת מכסה", icon: Gauge, perm: AdminPerm.ViewOrganizations },
            { to: "/discounts", label: "קודי קופון", icon: TicketPercent, perm: AdminPerm.ViewOrganizations },
            { to: "/outreach", label: "דיוור יזום", icon: Send, perm: AdminPerm.ViewOrganizations },
            { to: "/admins", label: "מנהלי מערכת", icon: UserCog, perm: AdminPerm.GrantAdminAccess },
            { to: "/testers", label: "נסיינים", icon: FlaskConical, perm: AdminPerm.ViewUsers },
        ],
    },
    {
        label: "תובנות ובקרה",
        items: [
            { to: "/events", label: "אירועים בזמן אמת", icon: Radio },
            { to: "/audit", label: "יומן ביקורת", icon: FileText, perm: AdminPerm.ViewAuditLogs },
            { to: "/jobs", label: "משימות רקע", icon: CalendarClock, perm: AdminPerm.ViewAnalytics },
        ],
    },
    {
        label: "מופע מערכת",
        items: [
            {
                to: "/health",
                label: "הגדרה ותקינות",
                icon: HeartPulse,
                perm: AdminPerm.ViewAnalytics,
                healthBadge: true,
            },
            {
                to: "/configuration",
                label: "תצורה והגדרות",
                icon: SlidersHorizontal,
                perm: AdminPerm.ManageSettings,
            },
            {
                to: "/transfers",
                label: "העברות נתונים",
                icon: ArrowLeftRight,
                perm: AdminPerm.ViewOrganizations,
            },
        ],
    },
];

// visibleNavGroups drops every item the signed-in admin cannot open and
// every group that ends up empty.
export function visibleNavGroups(mask: number | undefined): NavGroup[] {
    return NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter(
            (item) => item.perm === undefined || hasAdminPerm(mask, item.perm),
        ),
    })).filter((group) => group.items.length > 0);
}

export function Sidebar() {
    return (
        <aside
            className={cn(
                "hidden md:flex md:w-64 lg:w-72 shrink-0 flex-col",
                "border-e border-sidebar-border bg-sidebar admin-sidebar-pattern",
            )}
        >
            {/* h-14 matches the Topbar so the two headers sit on one line. */}
            <div className="flex h-14 shrink-0 items-center justify-between gap-2 px-4 border-b border-sidebar-border">
                <SidebarBrand />
                <AdminBadge compact />
            </div>

            <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-5">
                <NavList />
            </nav>

            <div className="px-4 py-3 border-t border-sidebar-border flex items-center gap-2 text-[11px] text-muted-foreground">
                <Activity className="size-3" />
                <span>ממשק ניהול מערכת · אין לשתף</span>
            </div>
        </aside>
    );
}

export function SidebarBrand() {
    return (
        <div className="flex items-center gap-2 min-w-0">
            <Logo className="size-6 shrink-0 text-foreground" />
            <div className="min-w-0 leading-none">
                <div className="text-sm font-semibold text-sidebar-foreground leading-none truncate">
                    Warmbly
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                    מישור בקרה
                </div>
            </div>
        </div>
    );
}

// NavList renders the permission-filtered groups. Shared by the desktop rail
// and the mobile drawer; onNavigate lets the drawer close itself on a tap.
export function NavList({ onNavigate }: { onNavigate?: () => void }) {
    const { data: me } = useMe();
    const mask = me?.admin_permissions;
    const canReadHealth = hasAdminPerm(mask, AdminPerm.ViewAnalytics);
    const healthQ = useInstanceHealth({ enabled: canReadHealth });
    const findings = findingCount(healthQ.data);
    const worst = worstSeverity(healthQ.data);

    return (
        <>
            {visibleNavGroups(mask).map((group) => (
                <div key={group.label}>
                    {group.label !== "סקירה כללית" && (
                        <div className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {group.label}
                        </div>
                    )}
                    <ul className="space-y-0.5">
                        {group.items.map((item) => (
                            <li key={item.to}>
                                <SidebarLink
                                    {...item}
                                    onNavigate={onNavigate}
                                    badge={
                                        item.healthBadge && findings > 0
                                            ? { count: findings, severity: worst }
                                            : undefined
                                    }
                                />
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </>
    );
}

interface CountBadge {
    count: number;
    severity: CheckSeverity | null;
}

const BADGE_TONES: Record<CheckSeverity, string> = {
    error: "bg-red-600 text-white",
    warning: "bg-amber-500 text-white",
    info: "bg-sky-600 text-white",
};

function SidebarLink({
    to,
    label,
    icon: Icon,
    end,
    badge,
    onNavigate,
}: NavItem & { badge?: CountBadge; onNavigate?: () => void }) {
    return (
        <NavLink
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
                cn(
                    "group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                    "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                    isActive &&
                        // Active state uses the admin accent on the leading edge and a
                        // soft amber wash. Distinct from the dashboard's blue active
                        // state without losing the same shape.
                        "bg-[var(--admin-accent-soft)] text-[var(--admin-accent-strong)] font-medium relative " +
                            "before:absolute before:start-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-e before:bg-[var(--admin-accent)]",
                )
            }
        >
            <Icon className="size-4 shrink-0 opacity-80 group-hover:opacity-100" />
            <span className="truncate">{label}</span>
            {badge && (
                <span
                    className={cn(
                        "ms-auto shrink-0 rounded-full px-1.5 text-[10px] font-semibold leading-4 tabular-nums",
                        BADGE_TONES[badge.severity ?? "info"],
                    )}
                >
                    {badge.count}
                </span>
            )}
        </NavLink>
    );
}
