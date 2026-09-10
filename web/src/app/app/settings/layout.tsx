// Settings layout — grouped left rail with real router links.
//
// Each section is a real route (/app/settings/<section>). The rail groups them
// under small section labels, marks the active row with a single framer-motion
// pill that slides between rows, and cross-fades the right pane on every section
// change. Visiting bare /app/settings redirects to /profile so a deep link or
// back-button always lands on a real section. Navigating away from a tab with
// unsaved auto-save changes is blocked by the dialog at the bottom.

import React from "react";
import { Navigate, NavLink, Outlet, useBlocker, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import {
    AlertOctagonIcon,
    BellIcon,
    BoxesIcon,
    BriefcaseIcon,
    CreditCardIcon,
    CpuIcon,
    CloudIcon,
    DatabaseIcon,
    GaugeIcon,
    GiftIcon,
    Loader2Icon,
    PlugIcon,
    ShieldCheckIcon,
    ShieldIcon,
    SendIcon,
    SparklesIcon,
    UserIcon,
    UsersIcon,
    WebhookIcon,
    GlobeIcon,
} from "lucide-react";
import { UnsavedProvider, useUnsavedRegistry } from "@/hooks/context/unsaved";
import { usePermission, type PermissionKey } from "@/hooks/usePermission";
import { Page, PageTopbar } from "@/components/layout/Page";
import useFeatureAccess from "@/hooks/useFeatureAccess";

interface SectionDef {
    path: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
    ownerOnly?: boolean;
    permission?: PermissionKey;
    /** Only meaningful when the deployment runs a billing provider. */
    billingOnly?: boolean;
}

interface SectionGroup {
    label: string;
    items: SectionDef[];
}

const GROUPS: SectionGroup[] = [
    {
        label: "חשבון",
        items: [
            { path: "profile", label: "פרופיל", icon: UserIcon, description: "פרטים אישיים והגדרות חשבון." },
            { path: "notifications", label: "התראות", icon: BellIcon, description: "הגדרת אירועים וערוצי התראה." },
            { path: "security", label: "אבטחה", icon: ShieldIcon, description: "סיסמה, אימות דו-שלבי והפעלות פעילות." },
        ],
    },
    {
        label: "סביבת עבודה",
        items: [
            { path: "members", label: "חברי צוות", icon: UsersIcon, description: "ניהול צוות והזמנות חברים." },
            { path: "teams", label: "צוותים", icon: UsersIcon, description: "חלוקת חברים לצוותים ייעודיים." },
            { path: "roles", label: "תפקידים והרשאות", icon: ShieldCheckIcon, description: "ניהול הרשאות וסמכויות.", ownerOnly: true },
            { path: "workspace", label: "סביבת עבודה", icon: BriefcaseIcon, description: "הגדרות כלל-ארגוניות ומיתוג.", ownerOnly: true },
            { path: "sending", label: "שליחה", icon: SendIcon, description: "מועדי מסירה, אימות כתובות והסרות.", permission: "MANAGE_SETTINGS" },
            { path: "tracking", label: "מעקב אתר", icon: GlobeIcon, description: "צפיות באתר בציר הזמן של אנשי הקשר.", permission: "MANAGE_SETTINGS" },
            { path: "ai-skills", label: "כישורי AI", icon: SparklesIcon, description: "הוראות ונהלים לתכונות ה-AI.", permission: "MANAGE_SETTINGS" },
            { path: "ai-models", label: "מודלי AI ומפתחות", icon: CpuIcon, description: "הגדרת מודל ג'מיני, שרשרת Fallback ומפתחות API מרובים.", permission: "MANAGE_SETTINGS" },
            { path: "billing", label: "חיוב ומנוי", icon: CreditCardIcon, description: "תוכנית, תשלום וחשבוניות.", ownerOnly: true, billingOnly: true },
            { path: "referral", label: "הפנה והרווח", icon: GiftIcon, description: "הזמן צוותים וצבור קרדיט לחשבון.", ownerOnly: true, billingOnly: true },
            { path: "limits", label: "מגבלות", icon: GaugeIcon, description: "בקשת הגדלת מכסות לתיבות, אנשי קשר או שליחות.", ownerOnly: true },
        ],
    },
    {
        label: "מפתחים",
        items: [
            { path: "oauth-apps", label: "יישומי OAuth", icon: BoxesIcon, description: "אפליקציות מחוברות והרשאות OAuth2.", permission: "MANAGE_API_KEYS" },
            { path: "webhooks", label: "וובהוקים", icon: WebhookIcon, description: "התראות HTTP בזמן אמת על אירועי המערכת.", permission: "MANAGE_SETTINGS" },
            { path: "connections", label: "חיבורים", icon: PlugIcon, description: "שרתי MCP חיצוניים להרחבת כלי ה-AI.", permission: "MANAGE_SETTINGS" },
        ],
    },
    {
        label: "מתקדם",
        items: [
            { path: "warmbly-cloud", label: "ענן Warmbly", icon: CloudIcon, description: "חימום תיבות דואר במאגר הקהילתי המשותף.", permission: "MANAGE_SETTINGS" },
            { path: "data", label: "נתונים", icon: DatabaseIcon, description: "ייצוא או ייבוא ארכיון נתונים של הארגון.", ownerOnly: true },
            { path: "danger", label: "אזור מסוכן", icon: AlertOctagonIcon, description: "פעולות בלתי הפיכות ומחיקת סביבת עבודה." },
        ],
    },
];

export default function SettingsLayout() {
    return (
        <UnsavedProvider>
            <SettingsLayoutInner />
        </UnsavedProvider>
    );
}

function SettingsLayoutInner() {
    const location = useLocation();
    const access = useFeatureAccess();
    const canManageApiKeys = usePermission("MANAGE_API_KEYS");
    const canManageSettings = usePermission("MANAGE_SETTINGS");
    const navRef = React.useRef<HTMLElement>(null);
    const unsaved = useUnsavedRegistry();
    const [savingLeave, setSavingLeave] = React.useState(false);

    // Block in-app navigation away from a tab with unsaved/pending/failed
    // auto-save changes; the dialog below offers save or discard.
    const blocker = useBlocker(
        React.useCallback(
            ({ currentLocation, nextLocation }: { currentLocation: { pathname: string }; nextLocation: { pathname: string } }) =>
                !!unsaved?.anyDirty() && currentLocation.pathname !== nextLocation.pathname,
            [unsaved],
        ),
    );

    // Native guard for hard navigations (reload / close tab).
    React.useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (unsaved?.anyDirty()) {
                e.preventDefault();
                e.returnValue = "";
            }
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [unsaved]);

    async function saveAndLeave() {
        if (!unsaved) return;
        setSavingLeave(true);
        try {
            await unsaved.saveAll();
            setSavingLeave(false);
            blocker.proceed?.();
        } catch {
            setSavingLeave(false);
            toast.error("לא ניתן היה לשמור את השינויים — תקן אותם או בטל כדי לעזוב.");
        }
    }
    function discardAndLeave() {
        unsaved?.discardAll();
        blocker.proceed?.();
    }

    // On phones the nav is a horizontal tab strip; deep links or navigation to a
    // later section should bring the active tab into view, otherwise the strip
    // sits scrolled to the start with no hint of where you are. No-op on >=md.
    React.useEffect(() => {
        if (window.matchMedia("(min-width: 768px)").matches) return;
        const el = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
        el?.scrollIntoView({ inline: "center", block: "nearest" });
    }, [location.pathname]);

    if (
        location.pathname === "/app/settings" ||
        location.pathname === "/app/settings/"
    ) {
        return <Navigate to="/app/settings/profile" replace />;
    }

    const visibleGroups = GROUPS.map((g) => ({
        ...g,
        items: g.items.filter(
            (s) =>
                (!s.ownerOnly || access.isOwner) &&
                (!s.billingOnly || access.billing) &&
                (s.permission !== "MANAGE_API_KEYS" || canManageApiKeys) &&
                (s.permission !== "MANAGE_SETTINGS" || canManageSettings),
        ),
    })).filter((g) => g.items.length > 0);

    const currentPath = location.pathname.replace(/^\/app\/settings\//, "");
    const allItems = visibleGroups.flatMap((g) => g.items);
    const current =
        allItems.find((s) => s.path === currentPath || currentPath.startsWith(`${s.path}/`)) ??
        allItems[0];

    return (
        <Page className="h-full min-h-0">
            <PageTopbar
                eyebrow="הגדרות"
                subtitle={current?.description ?? "חשבון וסביבת עבודה"}
            />

            <div className="flex-1 min-h-0 flex flex-col md:flex-row">
                {/* Mobile: a horizontally-scrollable tab strip. >=md: vertical rail. */}
                <nav
                    ref={navRef}
                    className="flex md:flex-col shrink-0 gap-0.5 md:gap-0 overflow-x-auto md:overflow-y-auto border-b md:border-b-0 md:border-r rtl:md:border-r-0 rtl:md:border-l border-slate-200/70 px-2 md:px-2.5 py-2 md:py-3 md:w-[236px]"
                >
                    {visibleGroups.map((g, gi) => (
                        <div key={g.label} className="contents md:block md:mb-1">
                            <div className={`hidden md:block px-2 ${gi === 0 ? "mb-1" : "mt-3 mb-1"}`}>
                                <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">
                                    {g.label}
                                </span>
                            </div>
                            {g.items.map((s) => (
                                <SectionLink key={s.path} section={s} />
                            ))}
                        </div>
                    ))}
                </nav>

                <div className="flex-1 min-w-0 overflow-y-auto">
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={location.pathname}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.16, ease: "easeOut" }}
                        >
                            <Outlet />
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            <AnimatePresence>
                {blocker.state === "blocked" && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-slate-900/30 flex items-center justify-center p-4"
                        onMouseDown={(e) => {
                            if (e.target === e.currentTarget && !savingLeave) blocker.reset?.();
                        }}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.98 }}
                            className="w-full max-w-sm rounded-lg bg-white border border-slate-200 shadow-xl p-5"
                        >
                            <h3 className="text-[14px] font-semibold text-slate-900">שינויים שלא נשמרו</h3>
                            <p className="text-[12.5px] text-slate-500 leading-relaxed mt-1">
                                חלק מהשינויים בלשונית זו עדיין לא נשמרו. שמור אותם לפני עזיבה, או בטל אותם.
                            </p>
                            <div className="mt-4 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => blocker.reset?.()}
                                    disabled={savingLeave}
                                    className="h-8 px-3 rounded-md text-[12.5px] font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-60 cursor-pointer"
                                >
                                    הישאר
                                </button>
                                <button
                                    type="button"
                                    onClick={discardAndLeave}
                                    disabled={savingLeave}
                                    className="h-8 px-3 rounded-md text-[12.5px] font-medium text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-60 cursor-pointer"
                                >
                                    בטל שינויים
                                </button>
                                <button
                                    type="button"
                                    onClick={saveAndLeave}
                                    disabled={savingLeave}
                                    className="h-8 px-3 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-[12.5px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-60 cursor-pointer"
                                >
                                    {savingLeave && <Loader2Icon className="w-3.5 h-3.5 animate-spin" />}
                                    שמור שינויים
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Page>
    );
}

function SectionLink({ section }: { section: SectionDef }) {
    return (
        <NavLink
            to={`/app/settings/${section.path}`}
            className={({ isActive }) =>
                `group relative shrink-0 md:w-full flex items-center gap-2.5 px-2.5 h-8 rounded-md text-[12.5px] whitespace-nowrap text-left rtl:text-right transition-colors ${
                    isActive ? "text-slate-900 font-medium" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/40"
                }`
            }
        >
            {({ isActive }) => (
                <>
                    {isActive && (
                        <motion.span
                            layoutId="settings-active-pill"
                            className="absolute inset-0 rounded-md bg-slate-200/70"
                            transition={{ type: "spring", stiffness: 520, damping: 42 }}
                        />
                    )}
                    <section.icon
                        className={`relative z-10 w-[14px] h-[14px] shrink-0 ${
                            isActive ? "text-slate-700" : "text-slate-400 group-hover:text-slate-600"
                        }`}
                    />
                    <span className="relative z-10 truncate">{section.label}</span>
                </>
            )}
        </NavLink>
    );
}
