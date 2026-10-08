// Workspace-wide outreach controls, mirroring models.AdvancedOutreachSettings.
// PATCH /outreach/settings replaces the whole object, so an edit must send the
// blocks it is not changing back unmodified.

export interface SendTimeOptimizationSettings {
    enabled: boolean;
    use_contact_timezone: boolean;
    default_contact_timezone: string;
    preferred_hours: number[];
    weekend_weight_multiplier: number;
}

export interface PreflightSettings {
    enabled: boolean;
    check_tracking_domain: boolean;
    check_unsubscribe_header: boolean;
    check_ab_variant_configured: boolean;
    check_daily_limit: boolean;
    check_schedule_window: boolean;
    check_content_score: boolean;
    min_content_score: number;
}

// The classifier buckets a reply can land in. "automated" is a machine reply
// that is not a vacation notice: an autoresponder, a ticket acknowledgement,
// a bounce or a delivery report.
export type ReplyIntent =
    | "positive"
    | "question"
    | "neutral"
    | "negative"
    | "out_of_office"
    | "automated";

export interface ReplyIntentSettings {
    enabled: boolean;
    positive_keywords: string[];
    negative_keywords: string[];
    out_of_office_keywords: string[];
    question_keywords: string[];
    auto_create_crm_task: boolean;
    // Which intents get a follow-up task. null/absent means the default set.
    crm_task_intents?: ReplyIntent[] | null;
    auto_pause_on_negative: boolean;
    auto_suppress_on_unsubscribe_keyword: boolean;
    // Park a contact's next step while their mailbox says they are away.
    hold_on_out_of_office: boolean;
    // The fallback hold, used when the auto-reply names no return date.
    out_of_office_hold_days: number;
}

// What a classified reply may do beyond labelling, from automatic inbox
// tagging. The reversible three default on; the suppression waits for the
// workspace to turn it on.
export interface InboxTaggingSettings {
    hold_on_not_now: boolean;
    not_now_hold_days: number;
    stop_on_declined: boolean;
    task_on_call_request: boolean;
    suppress_on_removal_request: boolean;
    questions?: InboxTagQuestion[] | null;
    // models.MailLanguageNames codes tagging reads mail in.
    languages?: string[] | null;
    // Ask automated notifications whether they need action, and keep the ones
    // that do in the inbox instead of the Automated view.
    action_required_in_inbox: boolean;
}

export type InboxTagActionType = "" | "hold" | "stop" | "task";

export interface InboxTagQuestionAction {
    type: InboxTagActionType;
    hold_days?: number;
}

export interface InboxTagChoice {
    label: string;
    description: string;
    action: InboxTagQuestionAction;
}

// A workspace question. Yes/no applies `label` on yes; a choice applies the
// label of the option it picked.
export interface InboxTagQuestion {
    id: string;
    type: "yes_no" | "choice";
    question: string;
    label?: string;
    action: InboxTagQuestionAction;
    choices?: InboxTagChoice[];
    // Also asked of automated notifications; a match keeps the conversation in
    // the inbox. Never acts on one.
    automated?: boolean;
}

export const DEFAULT_INBOX_TAGGING: InboxTaggingSettings = {
    hold_on_not_now: true,
    not_now_hold_days: 30,
    stop_on_declined: true,
    task_on_call_request: true,
    suppress_on_removal_request: false,
    questions: [],
    languages: [],
    action_required_in_inbox: true,
};

// Bounds matching internal/models/advanced_outreach.go.
export const INBOX_TAG_QUESTIONS_MAX = 10;
export const INBOX_TAG_QUESTION_MAX_LEN = 300;
export const INBOX_TAG_CHOICE_DESC_MAX_LEN = 200;
export const INBOX_TAG_LABEL_MAX_LEN = 40;
export const INBOX_TAG_CHOICES_MIN = 2;
export const INBOX_TAG_CHOICES_MAX = 8;
export const INBOX_TAG_HOLD_MIN = 1;
export const INBOX_TAG_HOLD_MAX = 365;
export const INBOX_TAG_HOLD_DEFAULT = 30;

// models.MailLanguageNames, sorted by name.
export const MAIL_LANGUAGES: { code: string; name: string }[] = [
    { code: "ar", name: "ערבית (Arabic)" },
    { code: "bn", name: "בנגלית (Bengali)" },
    { code: "bg", name: "בולגרית (Bulgarian)" },
    { code: "ca", name: "קטלאנית (Catalan)" },
    { code: "zh", name: "סינית (Chinese)" },
    { code: "hr", name: "קרואטית (Croatian)" },
    { code: "cs", name: "צ'כית (Czech)" },
    { code: "da", name: "דנית (Danish)" },
    { code: "nl", name: "הולנדית (Dutch)" },
    { code: "en", name: "אנגלית (English)" },
    { code: "et", name: "אסטונית (Estonian)" },
    { code: "fil", name: "פיליפינית (Filipino)" },
    { code: "fi", name: "פינית (Finnish)" },
    { code: "fr", name: "צרפתית (French)" },
    { code: "de", name: "גרמנית (German)" },
    { code: "el", name: "יוונית (Greek)" },
    { code: "he", name: "עברית (Hebrew)" },
    { code: "hi", name: "הינדי (Hindi)" },
    { code: "hu", name: "הונגרית (Hungarian)" },
    { code: "id", name: "אינדונזית (Indonesian)" },
    { code: "it", name: "איטלקית (Italian)" },
    { code: "ja", name: "יפנית (Japanese)" },
    { code: "ko", name: "קוריאנית (Korean)" },
    { code: "lv", name: "לטבית (Latvian)" },
    { code: "lt", name: "ליטאית (Lithuanian)" },
    { code: "ms", name: "מלאית (Malay)" },
    { code: "nb", name: "נורווגית (Norwegian)" },
    { code: "fa", name: "פרסית (Persian)" },
    { code: "pl", name: "פולנית (Polish)" },
    { code: "pt", name: "פורטוגזית (Portuguese)" },
    { code: "ro", name: "רומנית (Romanian)" },
    { code: "ru", name: "רוסית (Russian)" },
    { code: "sr", name: "סרבית (Serbian)" },
    { code: "sk", name: "סלובקית (Slovak)" },
    { code: "sl", name: "סלובנית (Slovenian)" },
    { code: "es", name: "ספרדית (Spanish)" },
    { code: "sw", name: "סוואהילי (Swahili)" },
    { code: "sv", name: "שוודית (Swedish)" },
    { code: "ta", name: "טמילית (Tamil)" },
    { code: "th", name: "תאית (Thai)" },
    { code: "tr", name: "טורקית (Turkish)" },
    { code: "uk", name: "אוקראינית (Ukrainian)" },
    { code: "ur", name: "אורדו (Urdu)" },
    { code: "vi", name: "וייטנאמית (Vietnamese)" },
];

// replyclassify.LanguagesWithRules: the languages whose reply formats, away
// messages and dates are read offline. The rest are only named to the classifier.
export const OFFLINE_RULE_LANGUAGES = new Set([
    "ar", "bg", "bn", "ca", "cs", "da", "de", "el", "es", "et", "fa", "fi", "fil", "fr",
    "he", "hi", "hr", "hu", "id", "it", "ja", "ko", "lt", "lv", "ms", "nb", "nl", "pl",
    "pt", "ro", "ru", "sk", "sl", "sr", "sv", "sw", "ta", "th", "tr", "uk", "ur", "vi", "zh",
]);

// Mirrors models.InboxTagLabelName: plain words like the built-in labels,
// letters and digits in any script with single spaces or hyphens between.
export function inboxTagLabelName(name: string): string {
    let out = "";
    let pending = "";
    for (const ch of name.normalize("NFC")) {
        if (/[\p{L}\p{Nd}]/u.test(ch)) {
            if (pending && out) out += pending;
            pending = "";
            out += ch;
        } else if (ch === "-" && pending !== " ") {
            pending = "-";
        } else {
            pending = " ";
        }
    }
    return out;
}

// Matches models.DefaultCRMTaskIntents: every human intent, no automated one.
export const DEFAULT_CRM_TASK_INTENTS: ReplyIntent[] = [
    "positive",
    "question",
    "neutral",
    "negative",
];

// The two machine classes are one choice in the UI: a vacation notice and a
// helpdesk autoresponder are the same kind of noise on a task list.
export const AUTOMATED_INTENTS: ReplyIntent[] = ["out_of_office", "automated"];

export const REPLY_INTENT_CHOICES: { id: ReplyIntent; label: string; hint: string }[] = [
    { id: "positive", label: "חיובי", hint: "מעוניין, מעוניין בשיחה" },
    { id: "question", label: "שאלה", hint: "שאל שאלה או ביקש פרטים" },
    { id: "neutral", label: "ניטרלי", hint: "תשובה אנושית שלא סווגה באופן מובהק" },
    { id: "negative", label: "שלילי", hint: "לא מעוניין" },
    { id: "out_of_office", label: "אוטומטי", hint: "הודעת חופשה, מענה אוטומטי, שגיאות מסירה" },
];

/** The effective set: an unset list means the default, not "none". */
export function taskIntents(s?: ReplyIntentSettings): ReplyIntent[] {
    return s?.crm_task_intents ?? DEFAULT_CRM_TASK_INTENTS;
}

// The in-body opt-out every campaign email carries unless a campaign
// overrides it. "text" is a reply-to-opt-out sentence, "link" a sentence with
// a real unsubscribe link, "off" nothing.
export type UnsubscribeMode = "text" | "link" | "off";

export interface UnsubscribeSettings {
    mode: UnsubscribeMode;
    text: string;
    link_intro: string;
    link_text: string;
}

export const DEFAULT_UNSUBSCRIBE: UnsubscribeSettings = {
    mode: "text",
    text: "אם זה לא רלוונטי, פשוט השב והודע לי ולא אפנה אליך שוב במייל.",
    link_intro: "לא האדם הנכון, או לא מעוניין?",
    link_text: "הסר אותי מרשימת התפוצה",
};

export interface OutreachSettings {
    bounce_pipeline: Record<string, unknown>;
    task_reliability: Record<string, unknown>;
    ab_testing: Record<string, unknown>;
    reply_intent: ReplyIntentSettings;
    send_time_optimization: SendTimeOptimizationSettings;
    preflight: PreflightSettings;
    dashboard: Record<string, unknown>;
    unsubscribe: UnsubscribeSettings;
    inbox_tagging?: InboxTaggingSettings;
    custom?: Record<string, unknown>;
}

// Business hours, matching the backend default.
export const DEFAULT_PREFERRED_HOURS = [9, 10, 11, 14, 15, 16];

export function formatHour(h: number): string {
    return `${h.toString().padStart(2, "0")}:00`;
}

// Collapses a sorted hour list into "09:00-11:00, 14:00-16:00" for the summary line.
export function describeHours(hours: number[]): string {
    const sorted = [...new Set(hours)].filter((h) => h >= 0 && h <= 23).sort((a, b) => a - b);
    if (sorted.length === 0) return "לא נבחרו שעות";
    const runs: number[][] = [];
    for (const h of sorted) {
        const last = runs[runs.length - 1];
        if (last && h === last[last.length - 1] + 1) last.push(h);
        else runs.push([h]);
    }
    return runs
        .map((run) => (run.length === 1 ? formatHour(run[0]) : `${formatHour(run[0])}-${formatHour(run[run.length - 1])}`))
        .join(", ");
}
