// Shared, non-component pieces of the contact-import flow. Kept in their own
// module (not exported from ImportWizard.tsx) so both the CSV ImportWizard and
// the Google-Sheet SheetSyncWizard can reuse the exact same column targets,
// dedup options, and error formatter without tripping react-refresh's
// "only export components" rule.

import toast from "react-hot-toast";
import type {
    ImportColumnMapping,
    ImportDedupStrategy,
    ImportResult,
} from "@/lib/api/client/app/contacts/importContacts";

export const STANDARD_TARGETS: { id: string; label: string }[] = [
    { id: "ignore", label: "התעלמות" },
    { id: "email", label: "אימייל" },
    { id: "first_name", label: "שם פרטי" },
    { id: "last_name", label: "שם משפחה" },
    { id: "company", label: "חברה" },
    { id: "phone", label: "טלפון" },
    { id: "subscribed", label: "רשום לדיוור" },
    { id: "categories", label: "קטגוריות" },
    { id: "verification_status", label: "סטטוס אימות" },
];

// Vocabularies the verification_status target can read, for the mapping
// row's "recognised as" badge. Mirrors emailverify.KnownVocabulary.
export const VERIFICATION_VOCABULARY_LABELS: Record<string, string> = {
    zerobounce: "ZeroBounce",
    millionverifier: "MillionVerifier",
    cleanmylist: "CleanMyList",
    neverbounce: "NeverBounce",
    bouncer: "Bouncer",
    kickbox: "Kickbox",
    emailable: "Emailable",
    debounce: "DeBounce",
    clearout: "Clearout",
    emaillistverify: "EmailListVerify",
    builtin: "Warmbly",
};

export const DEDUP_OPTIONS: { id: ImportDedupStrategy; label: string; hint: string }[] = [
    { id: "skip", label: "דילוג על קיימים", hint: "אם קיים איש קשר עם כתובת אימייל זו, השאר אותו ללא שינוי." },
    { id: "update", label: "עדכון קיימים", hint: "מיזוג ערכים חדשים לתוך איש הקשר הקיים." },
    {
        id: "create_duplicate",
        label: "יצירת כפילויות",
        hint: "כפיית יצירת איש קשר חדש. במקרה של חסימת ייחודיות יבוצע עדכון.",
    },
];

// Extract a human-readable message from whatever the API client throws.
// Client.ts rethrows AppError (a plain object), not an Error instance —
// so `err instanceof Error` silently fails and you lose the real reason.
export function describeError(err: unknown, fallback: string): string {
    if (err && typeof err === "object") {
        const e = err as { message?: unknown; error?: unknown; status?: unknown };
        const msg = typeof e.message === "string" ? e.message.trim() : "";
        const title = typeof e.error === "string" ? e.error.trim() : "";
        const status = typeof e.status === "number" ? e.status : undefined;
        if (msg && title && msg !== title) {
            return status ? `${status} ${title}: ${msg}` : `${title}: ${msg}`;
        }
        if (msg) return status ? `${status}: ${msg}` : msg;
        if (title) return status ? `${status} ${title}` : title;
    }
    if (err instanceof Error && err.message) return err.message;
    return fallback;
}

// announceResult toasts a contact-import / sheet-sync result with the standard
// imported/updated/skipped summary (or a warning when rows failed).
export function announceResult(res: ImportResult) {
    if (res.failed === 0) {
        toast.success(
            `יובאו ${res.imported} · עודכנו ${res.updated} · דולגו ${res.skipped}`,
        );
    } else {
        toast(`סונכרן עם ${res.failed} שגיאות`, { icon: "⚠️" });
    }
}

// ----- Custom-field names -----------------------------------------
//
// Mirrors internal/utils.IsValidJSONKey. A custom field is addressable in
// campaign copy either as {{.Role}} or, for a spaced/dashed name, through the
// server-side rewrite to (index . "Company Mobile"). Anything else would make
// a field the user can store but never merge into an email, so the API rejects
// it — we catch it here so a mistyped name never costs a whole import.
const CUSTOM_KEY_RE = /^[A-Za-z0-9_]+(?:[ -]+[A-Za-z0-9_]+)*$/;

export const CUSTOM_KEY_RULES = "יש להשתמש באותיות, מספרים, קווים תחתונים, רווחים או מקפים.";

export function normalizeCustomKey(key: string): string {
    return key.trim().split(/\s+/).filter(Boolean).join(" ");
}

export function isValidCustomKey(key: string): boolean {
    const k = normalizeCustomKey(key);
    return k.length > 0 && k.length <= 255 && CUSTOM_KEY_RE.test(k);
}

// suggestCustomKey turns a raw spreadsheet header into a name the API accepts,
// so picking "Use as custom field" on a "Company Mobile" column just works.
// Returns "" when nothing usable survives and the user has to type a name.
export function suggestCustomKey(header: string): string {
    const cleaned = normalizeCustomKey(header.replace(/[^A-Za-z0-9_ -]+/g, " "))
        .replace(/^[-\s]+/, "")
        .replace(/[-\s]+$/, "");
    return isValidCustomKey(cleaned) ? cleaned : "";
}

export function isCustomTarget(target: string): boolean {
    return target === "custom" || target.startsWith("custom:");
}

// customKeyOf is the field a custom mapping writes to, reading the legacy
// "custom:<key>" spelling too. "" for a non-custom mapping.
export function customKeyOf(m: ImportColumnMapping): string {
    if (!isCustomTarget(m.target)) return "";
    const explicit = normalizeCustomKey(m.custom_key ?? "");
    return explicit || normalizeCustomKey(m.target.startsWith("custom:") ? m.target.slice(7) : "");
}

// Mirrors contact.FoldCustomFieldKey: the form two spellings of one field
// ("Company URL", "company_url") share.
export function foldCustomKey(key: string): string {
    return key.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

// matchExistingKey finds the workspace field a header or typed name refers to:
// the exact name first, then one that differs only in case or separators.
// `existing` is most-used first, so of two such spellings the common one wins.
export function matchExistingKey(name: string, existing: string[]): string | undefined {
    const n = normalizeCustomKey(name);
    if (n === "") return undefined;
    if (existing.includes(n)) return n;
    const f = foldCustomKey(n);
    if (f === "") return undefined;
    return existing.find((k) => foldCustomKey(k) === f);
}

export type CustomKeyStatus =
    | { kind: "existing" }
    | { kind: "similar"; existing: string }
    | { kind: "new" };

// customKeyStatus says whether a custom mapping writes into a field the
// workspace already has, a near-duplicate of one, or a brand new field.
export function customKeyStatus(key: string, existing: string[]): CustomKeyStatus {
    const k = normalizeCustomKey(key);
    if (existing.includes(k)) return { kind: "existing" };
    const match = matchExistingKey(k, existing);
    return match ? { kind: "similar", existing: match } : { kind: "new" };
}

// targetIdentity names where a mapping writes, so two columns writing to the
// same place can be spotted. null for targets that take any number of columns.
export function targetIdentity(m: ImportColumnMapping): string | null {
    if (m.target === "ignore" || m.target === "categories") return null;
    if (isCustomTarget(m.target)) {
        const key = customKeyOf(m);
        return key ? `custom:${key}` : null;
    }
    return m.target;
}

// mappingProblem returns the first reason the mapping cannot be committed, or
// null when it is good to go. Same order of checks as the server so the two
// never disagree about which column is at fault.
export function mappingProblem(mapping: ImportColumnMapping[]): string | null {
    for (const m of mapping) {
        if (!isCustomTarget(m.target)) continue;
        const key = m.custom_key ?? (m.target.startsWith("custom:") ? m.target.slice(7) : "");
        if (normalizeCustomKey(key) === "") {
            return `עמודה ${m.index + 1} דורשת שם שדה מותאם אישית.`;
        }
        if (!isValidCustomKey(key)) {
            return `"${key.trim()}" אינו שם שדה חוקי. ${CUSTOM_KEY_RULES}`;
        }
    }
    if (!mapping.some((m) => m.target === "email")) {
        return "יש למפות עמודה לאימייל.";
    }
    return null;
}
