import { useLocation } from "react-router-dom";

export const labelMap: Record<string, string> = {
    // Top-level sections
    app: "בית",
    emails: "תיבות דואר",
    domains: "דומיינים לשליחה",
    unibox: "תיבת דואר מאוחדת",
    contacts: "אנשי קשר",
    segments: "סגמנטים",
    labels: "תוויות",
    categories: "תוויות",
    campaigns: "קמפיינים",
    analytics: "אנליטיקה",
    deliverability: "עבירות דואר",
    placement: "בדיקות מיקום",
    batches: "אצוות",
    crm: "ניהול לקוחות",
    pipelines: "צינורות מכירה",
    deals: "עסקאות",
    tasks: "משימות",
    meetings: "פגישות",
    templates: "תבניות",
    automations: "אוטומציות",
    forms: "טפסים",
    "api-keys": "מפתחות API",
    settings: "הגדרות",
    integrations: "אינטגרציות",
    audit: "יומן פעילות",

    // Unibox folders, views & scopes
    all: "כל הדואר",
    inbox: "דואר נכנס",
    unread: "לא נקראו",
    awaiting: "ממתין לתשובה",
    awaiting_reply: "ממתין לתשובה",
    agent_drafts: "טיוטות סוכן",
    "agent-drafts": "טיוטות סוכן",
    agentdrafts: "טיוטות סוכן",
    snoozed: "מושהה",
    drafts: "טיוטות",
    sent: "נשלחו",
    scheduled: "מתוזמן",
    archive: "ארכיון",
    spam: "ספאם",
    trash: "אשפה",
    starred: "מסומן בכוכב",
    today: "היום",
    week: "השבוע",
    action_required: "נדרשת פעולה",
    hot: "לידים חמים",
    needs_reply: "דורש מענה",
    follow_up: "פולו-אפ",
    declined: "לא מעוניין",
    automated: "מענה אוטומטי",
    positive: "חיובי",
    interested: "מעוניין",
    meeting_booked: "נקבעה פגישה",
    not_interested: "לא מעוניין",
    auto_reply: "מענה אוטומטי",
    bounced: "שגיאות מסירה",

    // Contacts & Lists
    suppressions: "רשימת חסימה",
    leads: "לידים",

    // Settings sub-pages
    profile: "פרופיל",
    notifications: "התראות",
    security: "אבטחה",
    members: "חברי צוות",
    teams: "צוותים",
    roles: "תפקידים והרשאות",
    workspace: "סביבת עבודה",
    sending: "שליחה",
    tracking: "מעקב אתר",
    "inbox-tagging": "תיוג תיבה אוטומטי",
    ai: "בינה מלאכותית",
    "ai-models": "מודלי AI ומפתחות",
    "ai-skills": "מיומנויות AI",
    "oauth-slots": "סלוטים לחיבורי מייל (OAuth)",
    "oauth-apps": "יישומי OAuth",
    billing: "חיוב ומנוי",
    referral: "הפנה והרווח",
    webhooks: "וובהוקים",
    connections: "חיבורים",
    data: "נתונים",
    danger: "אזור מסוכן",
    limits: "מגבלות",
    team: "צוות",
    admin: "ניהול",
    workers: "עובדים",
    credentials: "אישורים",
    preferences: "העדפות",
    schedule: "לוח זמנים",
    steps: "שלבים",
    link: "קישור חשבון",
    slack: "סלאק",
    hubspot: "HubSpot",
    pipedrive: "Pipedrive",
    salesforce: "Salesforce",
};

const crumbTargets: Record<string, string> = {
    "/app/placement/batches": "/app/placement?tab=batches",
};

export interface BreadcrumbItem {
    label: string;
    to: string;
    current: boolean;
}

export function useHeaderBreadcrumbs(): BreadcrumbItem[] {
    const location = useLocation();
    const pathname = location.pathname;

    const segments = pathname.split("/").filter(Boolean);
    if (segments.length === 0) return [];

    const isApp = segments[0] === "app";
    const appSegments = isApp ? segments.slice(1) : segments;

    const crumbs: BreadcrumbItem[] = [];

    appSegments.forEach((segment, index) => {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(segment) || segment.startsWith("$")) {
            return;
        }

        const fullSubPath = `/app/${appSegments.slice(0, index + 1).join("/")}`;
        const targetTo = crumbTargets[fullSubPath] ?? fullSubPath;
        const key = segment.toLowerCase();
        const normalizedKey = key.replaceAll("-", "_");
        const words = segment.replaceAll("-", " ").replaceAll("_", " ");
        const label =
            labelMap[segment] ??
            labelMap[key] ??
            labelMap[normalizedKey] ??
            labelMap[key.replaceAll("_", "-")] ??
            words.charAt(0).toUpperCase() + words.slice(1);
        const current = targetTo.replace(/\/$/, "") === pathname.replace(/\/$/, "") || index === appSegments.length - 1;

        crumbs.push({
            label,
            to: targetTo,
            current,
        });
    });

    return crumbs;
}
