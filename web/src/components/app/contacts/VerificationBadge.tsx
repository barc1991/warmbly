// The pre-send verdict on a contact's address, as a small animated mark next
// to the email. Verdicts land in the background, so the mark springs in when
// a row's status changes rather than just appearing.

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangleIcon, CircleDashedIcon, ShieldCheckIcon, ShieldXIcon } from "lucide-react";
import type Contact from "@/lib/api/models/app/contacts/Contact";
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
    probe: "נבדק ע״י Warmbly",
    provider: "נבדק ע״י MillionVerifier",
    imported: "יובא עם הרשימה",
    manual: "סומן ידנית ע״י חבר צוות",
};

export function verificationTitle(c: Pick<Contact, "verification_status" | "verification_sub_status" | "verification_source" | "verification_provider" | "verification_confidence">): string {
    const status = c.verification_status ?? "unknown";
    const meta = META[status] ?? META.unknown;
    const parts: string[] = [c.verification_confidence ? `${meta.label} (${c.verification_confidence}% ביטחון)` : meta.label];
    if (c.verification_sub_status && SUB_LABEL[c.verification_sub_status]) parts.push(SUB_LABEL[c.verification_sub_status]);
    if (c.verification_source && SOURCE_LABEL[c.verification_source]) {
        const src = c.verification_source === "imported" && c.verification_provider && c.verification_provider !== "imported"
            ? `יובא מ-${c.verification_provider}`
            : SOURCE_LABEL[c.verification_source];
        parts.push(src);
    }
    return parts.join(" · ");
}

export default function VerificationBadge({
    contact,
    className,
}: {
    contact: Pick<Contact, "verification_status" | "verification_sub_status" | "verification_source" | "verification_provider" | "verification_checked_at" | "verification_confidence">;
    className?: string;
}) {
    const status = contact.verification_status ?? "unknown";
    const meta = META[status] ?? META.unknown;
    const Icon = meta.Icon;
    const pending = status === "unknown" && !contact.verification_checked_at;
    return (
        <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
                key={status}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={{ type: "spring", duration: 0.35, bounce: 0.45 }}
                title={pending ? "אימות בתור" : verificationTitle(contact)}
                aria-label={verificationTitle(contact)}
                className={cn("inline-flex shrink-0", meta.tone, pending && "animate-[spin_3s_linear_infinite]", className)}
            >
                <Icon className="w-2.5 h-2.5" />
            </motion.span>
        </AnimatePresence>
    );
}
