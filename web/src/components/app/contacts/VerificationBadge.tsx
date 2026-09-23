// The pre-send verdict on a contact's address, as a small animated mark next
// to the email. Verdicts land in the background, so the mark springs in when
// a row's status changes rather than just appearing.

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangleIcon, CircleDashedIcon, ShieldCheckIcon, ShieldXIcon } from "lucide-react";
import type Contact from "@/lib/api/models/app/contacts/Contact";
import { PROVIDER_LABELS, type IntegrationProvider } from "@/lib/api/models/app/integrations/Integration";
import { cn } from "@/lib/utils";

const META = {
    valid: { label: "ניתן למסירה", tone: "text-emerald-600", Icon: ShieldCheckIcon },
    risky: { label: "בסיכון", tone: "text-amber-600", Icon: AlertTriangleIcon },
    invalid: { label: "לא ניתן למסירה", tone: "text-rose-600", Icon: ShieldXIcon },
    unknown: { label: "טרם אומת", tone: "text-slate-300", Icon: CircleDashedIcon },
} as const;

const SUB_LABEL: Record<string, string> = {
    catch_all: "דומיין catch-all",
    disposable: "דומיין זמני",
    role: "תיבה משותפת (תפקיד)",
    spamtrap: "מלכודת ספאם",
    mailbox_full: "תיבת דואר מלאה",
    no_mx: "אין שרת דואר (MX)",
    syntax: "תחביר שגוי",
    undisclosed: "הספק אינו חושף תיבות דואר",
};

const SOURCE_LABEL: Record<string, string> = {
    probe: "נבדק באמצעות הבדיקה המובנית של Warmbly",
    provider: "אומת באמצעות שירות אימות חיצוני",
    imported: "יובא עם הרשימה",
    manual: "סומן ע״י חבר צוות",
};

// Who produced a verdict, in the words a member reads: "אומת באמצעות MillionVerifier".
// Only a verifier we have a name for is named; anything else keeps the generic label.
export function verificationSourceLabel(source?: string, provider?: string, providerLabel?: string): string {
    if (!source || !SOURCE_LABEL[source]) return "";
    const name = providerLabel || PROVIDER_LABELS[provider as IntegrationProvider];
    if (source === "provider" && name) return `אומת באמצעות ${name}`;
    if (source === "imported" && provider && provider !== "imported" && provider !== "builtin") {
        return `יובא מ-${name || provider}`;
    }
    return SOURCE_LABEL[source];
}

type TitleFields = "verification_status" | "verification_sub_status" | "verification_source" | "verification_provider" | "verification_confidence" | "verification_requested_at";

export function verificationTitle(c: Pick<Contact, TitleFields>): string {
    const status = c.verification_status ?? "unknown";
    const meta = META[status] ?? META.unknown;
    const parts: string[] = [c.verification_confidence ? `${meta.label} (${c.verification_confidence}% ביטחון)` : meta.label];
    if (c.verification_sub_status && SUB_LABEL[c.verification_sub_status]) parts.push(SUB_LABEL[c.verification_sub_status]);
    const src = verificationSourceLabel(c.verification_source, c.verification_provider);
    if (src) parts.push(src);
    if (c.verification_requested_at) parts.push("בדיקה מחדש בתור");
    return parts.join(" · ");
}

export default function VerificationBadge({
    contact,
    className,
}: {
    contact: Pick<Contact, TitleFields | "verification_checked_at">;
    className?: string;
}) {
    const status = contact.verification_status ?? "unknown";
    const meta = META[status] ?? META.unknown;
    const Icon = meta.Icon;
    const pending = !!contact.verification_requested_at || (status === "unknown" && !contact.verification_checked_at);
    return (
        <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
                key={status}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={{ type: "spring", duration: 0.35, bounce: 0.45 }}
                title={pending && !contact.verification_checked_at ? "אימות בתור" : verificationTitle(contact)}
                aria-label={verificationTitle(contact)}
                className={cn("inline-flex shrink-0", meta.tone, pending && "animate-[spin_3s_linear_infinite]", className)}
            >
                <Icon className="w-2.5 h-2.5" />
            </motion.span>
        </AnimatePresence>
    );
}
