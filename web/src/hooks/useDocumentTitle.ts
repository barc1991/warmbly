import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useCurrentOrg, useUnseenCount } from "@/stores";
import { setFaviconBadge } from "@/lib/faviconBadge";

/*
 * Dynamic document titles for the SPA.
 *
 * react-router is used here in declarative/library mode (createBrowserRouter +
 * RouterProvider, no SSR), so the framework-mode `meta` export does not apply.
 * Instead we keep one central route -> label map and set `document.title` on
 * every navigation. Titles read "Section | Warmbly" (mirrors the marketing
 * site's separator); the bare brand is the fallback for unmapped routes.
 *
 * Called once from RootLayout, which renders the <Outlet/> for every route, so
 * a single hook covers auth, onboarding and the whole /app dashboard.
 */

const BRAND = "Warmbly";

// Static routes: exact pathname -> label. Dynamic segments (:id) are handled
// by the parameterised list below.
const ROUTE_TITLES: Record<string, string> = {
  "/": BRAND,

  // Auth
  "/auth/login": "כניסה",
  "/auth/login/confirm": "אמת את הדוא״ל שלך",
  "/auth/register": "צור חשבון",
  "/auth/register/confirm": "אשר את הדוא״ל שלך",
  "/auth/reset-password": "איפוס סיסמה",
  "/auth/reset-password/confirm": "הגדר סיסמה חדשה",
  "/auth/sso": "מחבר אותך",

  // Onboarding / workspace selection
  "/onboarding": "ברוכים הבאים",
  "/select-org": "בחר סביבת עבודה",
  "/invite": "הצטרף לסביבת עבודה",
  "/setup": "הגדרת Warmbly",
  "/oauth/authorize": "אשר אפליקציה",
  "/cloud-oauth/done": "תיבת דואר חוברה",

  // App
  "/app/emails": "תיבות דואר",
  "/app/contacts": "אנשי קשר",
  "/app/contacts/segments": "פלחים",
  "/app/contacts/categories": "קטגוריות",
  "/app/contacts/suppressions": "רשימת חסימות",
  "/app/campaigns": "קמפיינים",
  "/app/analytics": "אנליטיקה",
  "/app/deliverability": "יכולת מסירה",
  "/app/crm/pipelines": "צינורות",
  "/app/crm/deals": "עסקאות",
  "/app/crm/tasks": "משימות",
  "/app/crm/meetings": "פגישות",
  "/app/templates": "תבניות",
  "/app/automations": "אוטומציות",
  "/app/forms": "טפסים",
  "/app/api-keys": "מפתחות API",
  "/app/oauth-apps": "אפליקציות OAuth",
  "/app/integrations": "אינטגרציות",
  "/app/audit": "יומן ביקורת",
  "/app/unibox": "תיבת דואר",

  // Settings
  "/app/settings/profile": "פרופיל",
  "/app/settings/warmbly-cloud": "Warmbly Cloud",
  "/connect": "חיבור",
  "/cli": "אישור CLI",
  "/app/settings/notifications": "התראות",
  "/app/settings/security": "אבטחה",
  "/app/settings/members": "חברים",
  "/app/settings/teams": "צוותות",
  "/app/settings/workspace": "סביבת עבודה",
  "/app/settings/sending": "שליחה",
  "/app/settings/tracking": "מעקב אתר",
  "/app/settings/inbox-tagging": "תיוג תיבת דואר אוטומטי",
  "/app/settings/ai-skills": "כישורי AI",
  "/app/settings/billing": "חיוב",
  "/app/settings/referral": "הפנה והרווח",
  "/app/settings/limits": "תוכנית ומגבלות",
  "/app/settings/roles": "תפקידים",
  "/app/settings/oauth-apps": "אפליקציות OAuth",
  "/app/settings/webhooks": "Webhooks",
  "/app/settings/connections": "חיבורים",
  "/app/settings/data": "נתונים",
  "/app/settings/danger": "אזור סכנה",
};

// Parameterised routes: [regex, label]. Ordered most-specific first so a
// nested path matches its own entry before the shorter parent pattern.
const PARAM_ROUTES: ReadonlyArray<readonly [RegExp, string]> = [
  [/^\/app\/contacts\/segments\/[^/]+$/, "פלח"],
  [/^\/app\/campaigns\/[^/]+\/leads$/, "לידים של קמפיין"],
  [/^\/app\/campaigns\/[^/]+\/preferences$/, "הגדרות קמפיין"],
  [/^\/app\/campaigns\/[^/]+\/schedule$/, "לוח זמנים של קמפיין"],
  [/^\/app\/campaigns\/[^/]+\/steps$/, "שלבי קמפיין"],
  [/^\/app\/campaigns\/[^/]+$/, "קמפיין"],
  [/^\/app\/automations\/[^/]+$/, "אוטומציה"],
  [/^\/app\/forms\/[^/]+$/, "טופס"],
  [/^\/app\/contacts\/segments\/[^/]+$/, "פלח"],
  [/^\/app\/unibox(\/.*)?$/, "תיבת דואר"],
  [/^\/app\/settings\/billing\/[^/]+$/, "חיוב"],
  [/^\/app\/admin\/workers\/[^/]+$/, "עובד"],
];

function titleForPath(pathname: string): string {
  const label = ROUTE_TITLES[pathname];
  if (label !== undefined) return label === BRAND ? BRAND : `${label} | ${BRAND}`;

  for (const [pattern, paramLabel] of PARAM_ROUTES) {
    if (pattern.test(pathname)) return `${paramLabel} | ${BRAND}`;
  }
  // Unmatched pathname = a genuine 404; surface that in the tab title.
  return `עמוד לא נמצא | ${BRAND}`;
}

// Fold the current workspace in as context, before the brand:
//   "Mailboxes | Warmbly"  ->  "Mailboxes · Acme | Warmbly"
//   "Warmbly"              ->  "Acme | Warmbly"
function withOrg(base: string, org?: string): string {
  if (!org) return base;
  const suffix = ` | ${BRAND}`;
  if (base === BRAND) return `${org}${suffix}`;
  if (base.endsWith(suffix)) return `${base.slice(0, -suffix.length)} · ${org}${suffix}`;
  return `${base} · ${org}`;
}

/**
 * Sets document.title from the current route, folding in the current workspace
 * and a leading unread-count prefix ("(3) …") on the dashboard, and mirrors the
 * unread count onto the favicon as a red badge. Pass an explicit `override` to
 * title a page from loaded data (e.g. a campaign name) instead of the map.
 */
export function useDocumentTitle(override?: string) {
  const { pathname } = useLocation();
  const org = useCurrentOrg();
  const unread = useUnseenCount();

  useEffect(() => {
    // Workspace context + the unread badge are dashboard-only; on auth /
    // marketing routes (or with no selected workspace) use the plain title.
    const onApp = pathname.startsWith("/app");
    const count = onApp ? unread : 0;

    const base = override ? `${override} | ${BRAND}` : titleForPath(pathname);
    const titled = withOrg(base, onApp ? org?.name : undefined);
    const prefix = count > 0 ? `(${count > 99 ? "99+" : count}) ` : "";
    document.title = `${prefix}${titled}`;

    setFaviconBadge(count);
  }, [pathname, override, org?.name, unread]);
}
