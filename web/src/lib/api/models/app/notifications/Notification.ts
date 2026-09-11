// In-app notification feed + per-user preferences (mirrors the Go models).

export interface ChannelPrefs {
    in_app: boolean;
    email: boolean;
    slack: boolean;
    push: boolean;
}

export interface CategoryPref {
    enabled: boolean;
    channels: ChannelPrefs;
}

// The email-channel bundling window bounds (also returned by the API so the
// control never hardcodes them): pending notification emails hold for the
// user's window, then flush as one bundled email. The 30 minute floor is
// deliberate — there is no per-event email mode. Security sign-in alerts
// always email immediately.
export const EMAIL_WINDOW_MIN_MINUTES = 30;
export const EMAIL_WINDOW_MAX_MINUTES = 1440;

export interface NotificationPreferences {
    inbound_reply: CategoryPref;
    inbound_out_of_office: CategoryPref;
    health_bounce: CategoryPref;
    health_complaint: CategoryPref;
    health_worker_downtime: CategoryPref;
    security_new_signin: CategoryPref;
    billing_alert: CategoryPref;
    team_activity: CategoryPref;
    campaign_paused: CategoryPref;
    health_domain_auth: CategoryPref;
    email_digest_minutes: number;
}

export type NotificationCategoryKey = Exclude<keyof NotificationPreferences, "email_digest_minutes">;

// Email-channel bounds from the deployment: the window range clients should
// offer, and the rolling 24h per-user email budget (0 = unlimited).
export interface EmailDeliveryInfo {
    min_minutes: number;
    max_minutes: number;
    daily_cap: number;
}

export interface NotificationPreferencesEnvelope {
    preferences: NotificationPreferences;
    email_delivery?: EmailDeliveryInfo;
}

// Client-side mirror of the backend defaults merge: a response from an older
// backend (or a cached one) may miss newer categories or email_digest, and
// consumers index categories directly, so fill any gap before use.
export function normalizeNotificationPreferences(
    p: Partial<NotificationPreferences> | null | undefined,
): NotificationPreferences {
    const on: CategoryPref = { enabled: true, channels: { in_app: true, email: false, slack: false, push: true } };
    const off: CategoryPref = { enabled: false, channels: { in_app: true, email: false, slack: false, push: true } };
    const billing: CategoryPref = { enabled: true, channels: { in_app: true, email: true, slack: false, push: true } };
    const minutes = p?.email_digest_minutes ?? EMAIL_WINDOW_MIN_MINUTES;
    return {
        inbound_reply: p?.inbound_reply ?? off,
        inbound_out_of_office: p?.inbound_out_of_office ?? off,
        health_bounce: p?.health_bounce ?? on,
        health_complaint: p?.health_complaint ?? on,
        health_worker_downtime: p?.health_worker_downtime ?? on,
        security_new_signin: p?.security_new_signin ?? on,
        billing_alert: p?.billing_alert ?? billing,
        team_activity: p?.team_activity ?? on,
        // Emails by default, like billing: a campaign the platform stopped by
        // itself has to reach whoever can restart it.
        campaign_paused: p?.campaign_paused ?? billing,
        // Emails by default too: a sending domain the platform will stop
        // sending from has to reach whoever can edit the DNS.
        health_domain_auth: p?.health_domain_auth ?? billing,
        email_digest_minutes: Math.min(Math.max(minutes, EMAIL_WINDOW_MIN_MINUTES), EMAIL_WINDOW_MAX_MINUTES),
    };
}

export interface AppNotification {
    id: string;
    user_id: string;
    organization_id?: string | null;
    category: string;
    title: string;
    body?: string;
    link?: string;
    metadata?: Record<string, unknown>;
    read_at?: string | null;
    created_at: string;
}

export function localizeNotification(n: AppNotification): { title: string; body?: string } {
    let title = n.title || "";
    let body = n.body;

    switch (n.category) {
        case "security_new_signin": {
            if (!title || title.includes("New sign-in") || title.includes("sign-in")) {
                title = "התחברות חדשה לחשבונך";
            }
            if (body) {
                body = body
                    .replace(/Signed in from/gi, "התחברות זוהתה מ-")
                    .replace(/on Windows/gi, "בווינדוס")
                    .replace(/on macOS/gi, "ב-macOS")
                    .replace(/on Linux/gi, "בלינוקס")
                    .replace(/on iOS/gi, "ב-iOS")
                    .replace(/on Android/gi, "באנדרואיד")
                    .replace(/an unrecognized device/gi, "מכשיר לא מזוהה")
                    .replace(/\.?\s*If this wasn't you, change your password and sign out other sessions\.?/gi, ". אם זה לא היית אתה, מומלץ לשנות סיסמה ולנתק הפעלות אחרות.");
            }
            break;
        }
        case "inbound_reply": {
            if (title.startsWith("New reply from ")) {
                title = `תשובה חדשה מאת ${title.replace("New reply from ", "")}`;
            }
            break;
        }
        case "inbound_out_of_office": {
            if (title.startsWith("Out-of-office from ")) {
                title = `מענה אוטומטי (מחוץ למשרד) מאת ${title.replace("Out-of-office from ", "")}`;
            }
            break;
        }
        case "health_bounce": {
            if (title.startsWith("Bounce: ")) {
                title = `שגיאת מסירה (Bounce): ${title.replace("Bounce: ", "")}`;
            }
            break;
        }
        case "health_complaint": {
            if (title.startsWith("Spam complaint: ")) {
                title = `תלונת ספאם: ${title.replace("Spam complaint: ", "")}`;
            }
            break;
        }
        case "health_worker_downtime": {
            if (title.includes("Sending worker went offline") || title.includes("worker")) {
                title = "שרת שליחה (Worker) התנתק";
            }
            if (body && (body.includes("One of your mailboxes was") || body.includes("stopped responding"))) {
                body = "אחת מתיבות הדואר שלך פעלה על שרת שליחה שהפסיק להגיב. המערכת העבירה אותה לשרת תקין אוטומטית.";
            }
            break;
        }
        case "health_domain_auth": {
            if (title.includes("Sending domain is failing authentication") || title.includes("domain")) {
                title = "אימות דומיין השליחה נכשל (SPF / DKIM)";
            }
            if (body && body.includes("failing authentication")) {
                body = "אחת או יותר מתיבות הדואר פועלות בדומיין שאינו עובר אימות תקין (SPF / DKIM / DMARC). יש לעדכן את רשומות ה-DNS כדי למנוע חסימת שליחה.";
            }
            break;
        }
        case "campaign_paused": {
            if (title.includes("was paused automatically")) {
                title = title.replace("was paused automatically", "הושהה אוטומטית");
            }
            break;
        }
        case "billing_alert": {
            if (title.includes("trial has expired") || title.includes("Warmbly trial")) {
                title = "תקופת הניסיון שלך הסתיימה";
            }
            if (body && body.includes("Campaigns are paused")) {
                body = "הקמפיינים והחימום הושהו עד לשדרוג תוכנית המנוי.";
            }
            break;
        }
        case "team_activity": {
            if (title.includes("joined your workspace")) {
                title = title.replace("joined your workspace", "הצטרף/ה לסביבת העבודה שלך");
            }
            if (body && body.includes("accepted their invitation")) {
                body = body.replace("accepted their invitation.", "אישר/ה את ההזמנה לסביבת העבודה.");
            }
            break;
        }
    }

    return { title, body };
}

