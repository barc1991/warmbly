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
    "invalid request body": "נתוני הבקשה אינם תקינים",
    "invalid email or password": "כתובת אימייל או סיסמה שגויים",
    "user not found": "משתמש לא נמצא",
    "rate limit exceeded": "חרגת ממגבלת הבקשות. אנא המתן מספר רגעים ונסה שוב",
};

export function localizeErrorMessage(msg: string): string {
    if (!msg) return "אירעה שגיאה בלתי צפויה";
    if (ERROR_TRANSLATIONS[msg]) return ERROR_TRANSLATIONS[msg];
    for (const [en, he] of Object.entries(ERROR_TRANSLATIONS)) {
        if (msg.toLowerCase() === en.toLowerCase()) return he;
    }
    return msg;
}

export default function buildError(err: AppError): string {
    const rawMsg = err.message || err.error || "אירעה שגיאה בלתי צפויה";
    const localized = localizeErrorMessage(rawMsg);
    const id = err.request_id ? ` (${err.request_id})` : "";
    return `${localized}${id}`;
}
