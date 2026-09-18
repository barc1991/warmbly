import type { AppError } from "../api/client/normalizeError";

const ERROR_TRANSLATIONS: Record<string, string> = {
    "Network Error": "שגיאת תקשורת",
    "Please check your connection.": "אנא בדוק את החיבור לרשת שלך.",
    "Authentication Required": "נדרשת התחברות",
    "Your session is invalid or expired.": "פג תוקף ההתחברות שלך. יש להתחבר מחדש.",
    "Unauthorized": "אין לך הרשאה לבצע פעולה זו",
    "Forbidden": "הגישה נדחתה",
    "Not Found": "הפריט המבוקש לא נמצא",
    "Internal Server Error": "שגיאת שרת פנימית",
    "Bad Request": "בקשה לא תקינה",
    "Conflict": "הפריט כבר קיים או שיש התנגשות נתונים",
    "Request Timeout": "תם הזמן המוקצב לבקשה",
    "Service Unavailable": "השירות אינו זמין כעת. אנא נסה שוב מאוחר יותר",
    "Gateway Timeout": "תם הזמן המוקצב לתקשורת עם השרת",
    "Method Not Allowed": "פעולה אינה מורשית",
    "Too Many Requests": "יותר מדי בקשות. אנא המתן מעט ונסה שוב",
    "invalid request body": "נתוני הבקשה אינם תקינים",
    "invalid email or password": "כתובת אימייל או סיסמה שגויים",
    "user not found": "משתמש לא נמצא",
    "mailbox not found": "תיבת הדואר לא נמצאה",
    "campaign not found": "הקמפיין לא נמצא",
    "contact not found": "איש הקשר לא נמצא",
    "organization not found": "סביבת העבודה לא נמצאה",
    "insufficient credits": "אין מספיק קרדיטים לביצוע הפעולה",
    "payment required": "נדרש תשלום או שדרוג תוכנית",
    "rate limit exceeded": "חרגת ממגבלת הבקשות. אנא המתן מספר רגעים ונסה שוב",
    "failed to save": "שמירת השינויים נכשלה",
    "failed to update": "עדכון הנתונים נכשל",
    "failed to delete": "מחיקת הפריט נכשלה",
    "failed to create": "יצירת הפריט נכשלה",
    "invalid credentials": "פרטי גישה שגויים",
    "token expired": "פג תוקף האסימון",
    "invalid token": "אסימון גישה לא תקין",
    "permission denied": "אין לך הרשאה לבצע פעולה זו",
};

export function localizeErrorMessage(msg: string): string {
    if (!msg) return "אירעה שגיאה בלתי צפויה";
    if (ERROR_TRANSLATIONS[msg]) return ERROR_TRANSLATIONS[msg];
    const lower = msg.toLowerCase();
    for (const [en, he] of Object.entries(ERROR_TRANSLATIONS)) {
        if (lower === en.toLowerCase()) return he;
    }
    // Check if error contains known key phrases
    if (lower.includes("network error") || lower.includes("failed to fetch")) {
        return "שגיאת תקשורת. אנא בדוק את החיבור לרשת.";
    }
    if (lower.includes("rate limit") || lower.includes("too many requests") || lower.includes("429")) {
        return "חרגת ממגבלת הבקשות. אנא המתן מעט ונסה שוב.";
    }
    if (lower.includes("unauthorized") || lower.includes("unauthenticated") || lower.includes("401")) {
        return "נדרשת התחברות. פג תוקף ההתחברות שלך.";
    }
    if (lower.includes("forbidden") || lower.includes("permission denied") || lower.includes("403")) {
        return "אין לך הרשאה לבצע פעולה זו.";
    }
    return msg;
}

export default function buildError(err: AppError): string {
    const rawMsg = err.message || err.error || "אירעה שגיאה בלתי צפויה";
    const localized = localizeErrorMessage(rawMsg);
    const id = err.request_id ? ` (${err.request_id})` : "";
    return `${localized}${id}`;
}
