// Mirror of internal/models/organization_permission.go.
//
// Permission bits are a uint16 — keep this file in lock-step with the
// backend constants. Changing a value here without changing it there
// silently corrupts the role matrix.
//
// The user-facing label + description live here too so the Roles
// settings page has a single source of truth.

export const PERMISSION_BITS = {
    MANAGE_TEAM:        1 << 0,
    MANAGE_BILLING:     1 << 1,
    MANAGE_CAMPAIGNS:   1 << 2,
    MANAGE_CONTACTS:    1 << 3,
    MANAGE_EMAILS:      1 << 4,
    VIEW_ANALYTICS:     1 << 5,
    SEND_CAMPAIGNS:     1 << 6,
    ACCESS_UNIBOX:      1 << 7,
    MANAGE_SEQUENCES:   1 << 8,
    MANAGE_SETTINGS:    1 << 9,
    VIEW_CAMPAIGNS:     1 << 10,
    VIEW_CONTACTS:      1 << 11,
    TRANSFER_OWNERSHIP: 1 << 12,
    MANAGE_API_KEYS:    1 << 13,
    USE_INTEGRATIONS:   1 << 14,
    USE_AI:             1 << 15,
} as const;

export const ALL_PERMISSIONS = 0xffff;

export type PermissionKey = keyof typeof PERMISSION_BITS;

export interface PermissionDef {
    key: PermissionKey;
    bit: number;
    label: string;
    description: string;
    category: "data" | "people" | "send" | "admin";
}

export const PERMISSION_CATALOG: PermissionDef[] = [
    // Data
    { key: "VIEW_CAMPAIGNS",     bit: PERMISSION_BITS.VIEW_CAMPAIGNS,     label: "צפייה בקמפיינים",    description: "קריאת הגדרות קמפיין, שלבים ודוחות ביצועים.",      category: "data" },
    { key: "MANAGE_CAMPAIGNS",   bit: PERMISSION_BITS.MANAGE_CAMPAIGNS,   label: "ניהול קמפיינים",  description: "יצירה, עריכה והעברה לארכיון של קמפיינים.",                     category: "data" },
    { key: "VIEW_CONTACTS",      bit: PERMISSION_BITS.VIEW_CONTACTS,      label: "צפייה באנשי קשר",     description: "קריאת אנשי קשר, פלחים ותגיות.",                       category: "data" },
    { key: "MANAGE_CONTACTS",    bit: PERMISSION_BITS.MANAGE_CONTACTS,    label: "ניהול אנשי קשר",   description: "יצירה, עריכה ומחיקה של אנשי קשר.",                       category: "data" },
    { key: "MANAGE_SEQUENCES",   bit: PERMISSION_BITS.MANAGE_SEQUENCES,   label: "ניהול שלבים ורצפים",  description: "עריכת תוכן השלבים ומרווחי הזמנים בתוך קמפיין.",          category: "data" },
    { key: "VIEW_ANALYTICS",     bit: PERMISSION_BITS.VIEW_ANALYTICS,     label: "צפייה בדוחות ואנליטיקה",    description: "צפייה בדוחות עבירות, פתיחות ומעורבות.",                category: "data" },
    { key: "USE_INTEGRATIONS",   bit: PERMISSION_BITS.USE_INTEGRATIONS,   label: "שימוש באינטגרציות",  description: "סנכרון אנשי קשר ועסקאות למערכות CRM וכלים מחוברים.",    category: "data" },
    { key: "USE_AI",             bit: PERMISSION_BITS.USE_AI,             label: "שימוש ב-AI",            description: "שימוש בעוזר הבינה המלאכותית ובניסוח הודעות (צורך קרדיטים).", category: "data" },
    // People
    { key: "MANAGE_TEAM",        bit: PERMISSION_BITS.MANAGE_TEAM,        label: "ניהול צוות",       description: "הזמנה, הסרה ושינוי תפקידים של חברי צוות.",                     category: "people" },
    { key: "TRANSFER_OWNERSHIP", bit: PERMISSION_BITS.TRANSFER_OWNERSHIP, label: "העברת בעלות", description: "העברת בעלות על סביבת העבודה לחבר צוות אחר.",            category: "people" },
    // Send
    { key: "MANAGE_EMAILS",      bit: PERMISSION_BITS.MANAGE_EMAILS,      label: "ניהול תיבות דואר",  description: "חיבור, ניתוק והגדרת תיבות דואר לשליחה.",    category: "send" },
    { key: "SEND_CAMPAIGNS",     bit: PERMISSION_BITS.SEND_CAMPAIGNS,     label: "שליחת קמפיינים",    description: "הפעלה, השהיה וחידוש שליחה של קמפיינים.",                      category: "send" },
    { key: "ACCESS_UNIBOX",      bit: PERMISSION_BITS.ACCESS_UNIBOX,      label: "שימוש בתיבה המאוחדת", description: "קריאה ומענה להודעות מהתיבה המשותפת (Unibox).",                   category: "send" },
    // Admin
    { key: "MANAGE_SETTINGS",    bit: PERMISSION_BITS.MANAGE_SETTINGS,    label: "ניהול הגדרות",   description: "עריכת הגדרות ברמת סביבת העבודה כולה.",                           category: "admin" },
    { key: "MANAGE_BILLING",     bit: PERMISSION_BITS.MANAGE_BILLING,     label: "ניהול חיוב ומנוי",    description: "צפייה בחשבוניות ושינוי תוכנית המנוי.",         category: "admin" },
    { key: "MANAGE_API_KEYS",    bit: PERMISSION_BITS.MANAGE_API_KEYS,    label: "ניהול מפתחות API",   description: "יצירה וביטול של מפתחות API.",                   category: "admin" },
];

export const CATEGORY_LABEL = {
    data:   { label: "נתונים",         description: "קמפיינים, אנשי קשר, דוחות." },
    people: { label: "צוות ואנשים",       description: "חברים ובעלות." },
    send:   { label: "שליחה",          description: "תיבות דואר ומסירת קמפיינים." },
    admin:  { label: "סביבת עבודה",    description: "הגדרות, חיוב, API." },
} as const;

// Roles are workspace data (see /organization/roles). The only hardcoded
// concept left is the OWNER membership status and the permission templates
// the role editor can start from.
export const OWNER_DEF = {
    label: "בעלים",
    description: "שליטה מלאה בסביבת העבודה. קיים בעלים יחיד בלבד; ניתן להעברה בהגדרות סביבת העבודה.",
    color: "#0ea5e9",
    permissions: ALL_PERMISSIONS,
} as const;

const ALL_DEFINED = PERMISSION_CATALOG.reduce((m, p) => m | p.bit, 0);

export const ROLE_TEMPLATES = [
    { id: "admin", label: "מנהל מערכת", color: "#8b5cf6", permissions: ALL_DEFINED & ~PERMISSION_BITS.TRANSFER_OWNERSHIP },
    {
        id: "manager",
        label: "מנהל",
        color: "#10b981",
        permissions:
            PERMISSION_BITS.MANAGE_CAMPAIGNS | PERMISSION_BITS.MANAGE_CONTACTS | PERMISSION_BITS.MANAGE_EMAILS |
            PERMISSION_BITS.SEND_CAMPAIGNS | PERMISSION_BITS.MANAGE_SEQUENCES | PERMISSION_BITS.VIEW_ANALYTICS |
            PERMISSION_BITS.VIEW_CAMPAIGNS | PERMISSION_BITS.VIEW_CONTACTS | PERMISSION_BITS.ACCESS_UNIBOX |
            PERMISSION_BITS.USE_INTEGRATIONS,
    },
    {
        id: "viewer",
        label: "צופה",
        color: "#f59e0b",
        permissions: PERMISSION_BITS.VIEW_CAMPAIGNS | PERMISSION_BITS.VIEW_CONTACTS | PERMISSION_BITS.VIEW_ANALYTICS,
    },
] as const;

export function hasPermission(mask: number | undefined, bit: number): boolean {
    if (mask === undefined) return false;
    return (mask & bit) === bit;
}




