export type APIPermissionCategory = "read" | "write" | "bulk" | "special";

export default interface APIPermission {
    name: string;
    value: number;
    description: string;
    category: APIPermissionCategory;
}

export interface APIPermissionsResponse {
    permissions: APIPermission[];
    presets: {
        read_only: number;
        full_access: number;
    };
}

export const PERMISSION_HEBREW_DESCRIPTIONS: Record<string, string> = {
    READ_EMAILS: "צפייה בחשבונות אימייל והגדרות",
    READ_CAMPAIGNS: "צפייה בקמפיינים וסדרות אימיילים",
    READ_CONTACTS: "צפייה ברשימות אנשי קשר, סגמנטים, הערות ופעילויות",
    READ_UNIBOX: "גישה לתיבת הדואר המאוחדת",
    READ_ANALYTICS: "צפייה באנליטיקה וסטטיסטיקות",
    READ_TEMPLATES: "צפייה בתבניות מענה",
    READ_CRM: "צפייה בערוצי מכירה, עסקאות ומשימות CRM",
    READ_AUDIT_LOGS: "צפייה ביומן פעילות הארגון",

    WRITE_EMAILS: "שינוי הגדרות חשבונות אימייל",
    WRITE_CAMPAIGNS: "יצירה ושינוי קמפיינים וסדרות אימיילים",
    WRITE_CONTACTS: "יצירה ושינוי אנשי קשר, סגמנטים, הערות ופעילויות",
    WRITE_UNIBOX: "סימון אימיילים כנקרא/לא נקרא ושליחת תגובות",
    WRITE_TEMPLATES: "יצירה ושינוי תבניות מענה",
    WRITE_CRM: "יצירה ושינוי ערוצי מכירה, עסקאות ומשימות CRM",
    SEND_CAMPAIGNS: "הפעלה והשהיית קמפיינים (שולח אימיילים בפועל)",

    BULK_CONTACTS: "ייבוא, ייצוא ומחיקה המונית של אנשי קשר",
    BULK_CAMPAIGNS: "פעולות המוניות על קמפיינים",

    REALTIME_SUBSCRIBE: "הרשמה לאירועי זמן-אמת (Realtime)",
};

export function getPermissionDescription(name: string, fallback?: string): string {
    return PERMISSION_HEBREW_DESCRIPTIONS[name] ?? fallback ?? name;
}

