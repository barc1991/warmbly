import { useLocation } from "react-router-dom";

const labelMap: Record<string, string> = {
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
    slack: "סלאק",
    link: "קישור חשבון",
    leads: "לידים",
    preferences: "העדפות",
    schedule: "לוח זמנים",
    steps: "שלבים",
    placement: "בדיקות מיקום",
    batches: "אצוות",
    "ai-skills": "מיומנויות AI",
    "warmbly-cloud": "ענן Warmbly",
    "oauth-apps": "יישומי OAuth",
    "inbox-tagging": "תיוג תיבה",
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
        const words = segment.replaceAll("-", " ");
        const label = labelMap[segment] ?? words.charAt(0).toUpperCase() + words.slice(1);
        const current = targetTo.replace(/\/$/, "") === pathname.replace(/\/$/, "") || index === appSegments.length - 1;

        crumbs.push({
            label,
            to: targetTo,
            current,
        });
    });

    return crumbs;
}
