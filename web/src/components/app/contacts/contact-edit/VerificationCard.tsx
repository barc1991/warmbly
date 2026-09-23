// The "why" behind a contact's deliverability verdict: an animated
// confidence ring, the reasons in plain words, and the observations they
// were scored from. Absence of engagement is never listed, because it is not
// evidence of anything.

import { AnimatePresence, motion } from "framer-motion";
import {
    AlertTriangleIcon,
    BadgeCheckIcon,
    CircleDashedIcon,
    Loader2Icon,
    MailCheckIcon,
    MailOpenIcon,
    MailWarningIcon,
    MousePointerClickIcon,
    RefreshCcwIcon,
    ReplyIcon,
    ShieldCheckIcon,
    ShieldXIcon,
    SparklesIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import type { ContactVerificationDetail, VerificationEvidenceKind } from "@/lib/api/models/app/contacts/ContactDetail";
import { useContactVerification, useRequestContactVerification } from "@/lib/api/hooks/app/contacts/useContactVerification";
import { reverifyNotice } from "@/lib/api/client/app/contacts/verification";
import { PROVIDER_LABELS, type IntegrationProvider } from "@/lib/api/models/app/integrations/Integration";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import { useWriteGuard } from "@/hooks/usePermission";
import { verificationSourceLabel } from "../VerificationBadge";
import { fmtAbsolute, fmtRelative } from "./format";
import { cn } from "@/lib/utils";

const STATUS = {
    valid: { label: "בר-מסירה", ring: "stroke-emerald-500", text: "text-emerald-700", Icon: ShieldCheckIcon },
    risky: { label: "בסיכון", ring: "stroke-amber-500", text: "text-amber-700", Icon: AlertTriangleIcon },
    invalid: { label: "לא בר-מסירה", ring: "stroke-rose-500", text: "text-rose-700", Icon: ShieldXIcon },
    unknown: { label: "לא מאומת", ring: "stroke-slate-300", text: "text-slate-500", Icon: CircleDashedIcon },
} as const;

const EVIDENCE: Record<VerificationEvidenceKind, { label: string; Icon: typeof MailCheckIcon; tone: string }> = {
    delivered: { label: "נמסר, ללא דחייה", Icon: MailCheckIcon, tone: "text-emerald-600" },
    opened: { label: "נפתח על ידי אדם", Icon: MailOpenIcon, tone: "text-emerald-600" },
    clicked: { label: "לחיצה על קישור", Icon: MousePointerClickIcon, tone: "text-emerald-600" },
    replied: { label: "נענה", Icon: ReplyIcon, tone: "text-emerald-600" },
    auto_replied: { label: "מענה אוטומטי (תיבה פעילה)", Icon: ReplyIcon, tone: "text-emerald-600" },
    bounced_recipient: { label: "נדחה: תיבת הדואר אינה קיימת", Icon: MailWarningIcon, tone: "text-rose-600" },
    bounced_other: { label: "נדחה מסיבה אחרת", Icon: MailWarningIcon, tone: "text-slate-500" },
};

function translateWhen(when: string): string {
    if (!when) return "";
    const w = when.trim().toLowerCase();
    if (w === "today") return "היום";
    if (w === "yesterday") return "אתמול";
    const daysMatch = w.match(/^(\d+)\s+days?\s+ago$/);
    if (daysMatch) return `לפני ${daysMatch[1]} ימים`;
    const monthsMatch = w.match(/^(\d+)\s+months?\s+ago$/);
    if (monthsMatch) return `לפני ${monthsMatch[1]} חודשים`;
    const yearsMatch = w.match(/^(\d+)\s+years?\s+ago$/);
    if (yearsMatch) return `לפני ${yearsMatch[1]} שנים`;
    return when;
}

export function translateReason(reason: string): string {
    if (!reason) return "";
    const lower = reason.trim().toLowerCase();

    // Exact backend base reasons from verdictBase()
    if (lower === "the mail server accepted the address") return "שרת הדואר אישר את תקינות הכתובת";
    if (lower === "the mail server rejected the address") return "שרת הדואר דחה את הכתובת";
    if (lower === "the domain accepts any address, so the check proves nothing") return "הדומיין מקבל כל כתובת (Catch-all), הבדיקה אינה חד-משמעית";
    if (lower === "marked by a teammate") return "סומן ידנית על ידי חבר צוות";
    if (lower === "checked by the verification service") return "נבדק ואומת על ידי שירות האימות";
    if (lower === "flagged by the verification service") return "סומן בסיכון על ידי שירות האימות";
    if (lower === "the verification service could not decide") return "שירות האימות לא הצליח להכריע";
    if (lower === "verified before it was imported") return "אומת לפני הייבוא";
    if (lower === "flagged before it was imported") return "סומן בסיכון לפני הייבוא";
    if (lower === "imported without a decisive result") return "יובא ללא תוצאה חד-משמעית";
    if (lower === "the check was inconclusive") return "הבדיקה אינה חד-משמעית";
    if (lower === "never checked") return "טרם נבדק";
    if (lower.startsWith("real mail outranks the earlier check")) return "דוא״ל אמיתי גובר על בדיקות קודמות";

    if (lower.startsWith("verified deliverable with ")) {
        return `אומת כניתן למסירה באמצעות ${reason.slice("verified deliverable with ".length)}`;
    }
    if (lower.includes(" reported the address undeliverable")) {
        const parts = reason.split(" reported the address undeliverable");
        return `${parts[0]} דיווח שהכתובת אינה ניתנת למסירה`;
    }
    if (lower.startsWith("flagged risky by ")) {
        return `סומן בסיכון על ידי ${reason.slice("flagged risky by ".length)}`;
    }
    if (lower.endsWith(" could not decide")) {
        const who = reason.slice(0, reason.length - " could not decide".length);
        return `${who} לא הצליח להכריע`;
    }
    const staleMatch = reason.match(/^real mail to it is older than this check \(last (.+)\)$/i);
    if (staleMatch) {
        return `דוא״ל אמיתי לכתובת זו ישן יותר מבדיקה זו (לאחרונה ${translateWhen(staleMatch[1])})`;
    }

    // Evidence reasons:
    const repliedMatch = reason.match(/^replied\s+(.+)$/i);
    if (repliedMatch) return `התקבל מענה ${translateWhen(repliedMatch[1])}`;

    const autoReplyMatch = reason.match(/^sent an automatic reply\s+(.+?)\s*\(the mailbox is live\)$/i);
    if (autoReplyMatch) return `מענה אוטומטי נשלח ${translateWhen(autoReplyMatch[1])} (תיבת הדואר פעילה)`;

    const clickedMatch = reason.match(/^clicked a link\s+(.+)$/i);
    if (clickedMatch) return `נלחץ קישור ${translateWhen(clickedMatch[1])}`;

    const openedMatch = reason.match(/^opened an email\s+(.+)$/i);
    if (openedMatch) return `נפתח אימייל ${translateWhen(openedMatch[1])}`;

    const deliveredMatch = reason.match(/^delivered without a bounce\s+(.+)$/i);
    if (deliveredMatch) return `נמסר ללא דחייה ${translateWhen(deliveredMatch[1])}`;

    const deliveredMultiMatch = reason.match(/^delivered\s+(\d+)\s+times without a bounce,\s*last\s+(.+)$/i);
    if (deliveredMultiMatch) return `נמסר ${deliveredMultiMatch[1]} פעמים ללא דחייה, לאחרונה ${translateWhen(deliveredMultiMatch[2])}`;

    if (lower.includes("the server said the mailbox does not exist")) {
        const m = reason.match(/^bounced\s+(.+?):/i);
        const when = m ? ` ${translateWhen(m[1])}` : "";
        return `נדחה${when}: השרת דיווח שתיבת הדואר אינה קיימת`;
    }

    const bounceDetailMatch = reason.match(/^bounced\s+(.+?):\s*(.+)$/i);
    if (bounceDetailMatch) {
        return `נדחה ${translateWhen(bounceDetailMatch[1])}: ${bounceDetailMatch[2]}`;
    }

    return reason.charAt(0).toUpperCase() + reason.slice(1);
}

export default function VerificationCard({
    contactId,
    detail,
    loading,
}: {
    contactId: string;
    detail?: ContactVerificationDetail | null;
    loading: boolean;
}) {
    const write = useWriteGuard("MANAGE_CONTACTS");
    const request = useRequestContactVerification();
    const pending = request.isPending || !!detail?.requested_at;
    const { data: overview } = useContactVerification(pending);

    if (loading && !detail) {
        return <div className="h-20 rounded-md border border-slate-200 bg-slate-50 animate-pulse" />;
    }
    if (!detail) return null;
    const meta = STATUS[detail.status] ?? STATUS.unknown;
    const Icon = meta.Icon;
    const r = 16;
    const c = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(100, detail.confidence));

    const source = verificationSourceLabel(detail.source, detail.provider, detail.provider_label);
    const checkSaid =
        detail.check_status && detail.check_status !== detail.status && (detail.source === "provider" || detail.source === "probe")
            ? STATUS[detail.check_status]?.label.toLowerCase()
            : "";
    const runner = !overview
        ? ""
        : overview.provider !== "builtin" && !overview.provider_error
          ? PROVIDER_LABELS[overview.provider as IntegrationProvider] ?? overview.provider
          : "הבדיקה המובנית של Warmbly";

    async function reverify() {
        try {
            const res = await request.mutateAsync({ contacts: [contactId], action: "verify" });
            const notice = reverifyNotice(res, "address", "addresses");
            if (notice.warn) toast(notice.text, { icon: "⚠️" });
            else toast.success(notice.text);
        } catch (err) {
            toast.error(buildError(err as AppError));
        }
    }

    return (
        <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
            <div className="px-3 py-2.5 flex items-center gap-3">
                <div className="relative w-11 h-11 shrink-0">
                    <svg viewBox="0 0 40 40" className="w-11 h-11 -rotate-90">
                        <circle cx="20" cy="20" r={r} className="stroke-slate-100" strokeWidth="4" fill="none" />
                        <motion.circle
                            cx="20"
                            cy="20"
                            r={r}
                            className={meta.ring}
                            strokeWidth="4"
                            strokeLinecap="round"
                            fill="none"
                            strokeDasharray={c}
                            initial={{ strokeDashoffset: c }}
                            animate={{ strokeDashoffset: c - (c * pct) / 100 }}
                            transition={{ type: "spring", duration: 1, bounce: 0.15 }}
                        />
                    </svg>
                    <motion.span
                        key={detail.status}
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", duration: 0.4, bounce: 0.5 }}
                        className={cn("absolute inset-0 flex items-center justify-center", meta.text)}
                    >
                        <Icon className="w-4 h-4" />
                    </motion.span>
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <span className={cn("text-[13px] font-semibold", meta.text)}>{meta.label}</span>
                        <span className="text-[11px] text-slate-400 tabular-nums">{pct}% ודאות</span>
                        {detail.decisive && (
                            <span className="hidden sm:inline text-[10px] uppercase tracking-[0.12em] text-slate-400 font-medium">
                                מדוא״ל אמיתי
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={(e) => write.guard(() => void reverify())(e)}
                            disabled={pending}
                            title={pending ? "בדיקה מחדש כבר נמצאת בתור" : "בדוק כתובת זו שוב כעת"}
                            className="ms-auto shrink-0 h-6 px-2 rounded-md border border-slate-200 bg-white text-[11px] font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 inline-flex items-center gap-1 transition-colors disabled:opacity-60 disabled:cursor-default"
                        >
                            {pending ? <Loader2Icon className="w-3 h-3 animate-spin" /> : <RefreshCcwIcon className="w-3 h-3" />}
                            {pending ? "בודק..." : detail.checked_at ? "אימות מחדש" : "אמת כעת"}
                        </button>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500 min-w-0">
                        {detail.source === "provider" ? (
                            <BadgeCheckIcon className="w-3 h-3 shrink-0 text-sky-600" />
                        ) : null}
                        <span className="truncate" title={detail.checked_at ? fmtAbsolute(detail.checked_at) : undefined}>
                            {source ? source.charAt(0).toUpperCase() + source.slice(1) : "טרם נבדק"}
                            {checkSaid ? `, לפיו ${checkSaid}` : ""}
                            {detail.checked_at ? ` · ${fmtRelative(detail.checked_at)}` : ""}
                        </span>
                    </div>
                    <ul className="mt-0.5 space-y-0.5">
                        <AnimatePresence initial={false}>
                            {detail.reasons.slice(0, 3).map((reason, i) => (
                                <motion.li
                                    key={reason}
                                    initial={{ opacity: 0, x: -6 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.06 }}
                                    className="text-[11.5px] text-slate-600 leading-snug"
                                >
                                    {translateReason(reason)}
                                </motion.li>
                            ))}
                        </AnimatePresence>
                    </ul>
                    {detail.suggestion && (
                        <div className="mt-1.5 px-2 py-1 rounded-md bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-center gap-1.5 leading-snug">
                            <SparklesIcon className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>
                                ייתכן שיש שגיאת הקלדה בדומיין – הצעה: <strong className="font-semibold text-amber-900">{detail.suggestion}</strong>
                            </span>
                        </div>
                    )}
                </div>
            </div>
            <AnimatePresence initial={false}>
                {pending && (
                    <motion.div
                        key="pending"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: "spring", duration: 0.35, bounce: 0.1 }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-sky-100 bg-sky-50/70 px-3 py-2 flex items-start gap-2 text-[11.5px] text-sky-800">
                            <Loader2Icon className="w-3 h-3 mt-0.5 shrink-0 animate-spin" />
                            <span className="leading-snug">
                                מאמת מחדש{runner ? ` באמצעות ${runner}` : ""}. הסטטוס הנוכחי נשאר בתוקף עד לקבלת התוצאה, שתתעדכן כאן אוטומטית.
                            </span>
                        </div>
                        {overview?.provider_error && (
                            <div className="border-t border-amber-100 bg-amber-50/70 px-3 py-2 flex items-start gap-2 text-[11.5px] text-amber-800">
                                <AlertTriangleIcon className="w-3 h-3 mt-0.5 shrink-0" />
                                <span className="leading-snug">
                                    {overview.provider_error}{" "}
                                    <Link to="/app/integrations" className="underline underline-offset-2 hover:text-amber-900">
                                        אינטגרציות
                                    </Link>
                                </span>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
            {detail.evidence.length > 0 && (
                <div className="border-t border-slate-100 divide-y divide-slate-100">
                    {detail.evidence.slice(0, 6).map((e, i) => {
                        const m = EVIDENCE[e.kind] ?? EVIDENCE.bounced_other;
                        const EIcon = m.Icon;
                        return (
                            <motion.div
                                key={`${e.kind}-${e.observed_at}-${i}`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.15 + i * 0.05 }}
                                className="px-3 py-1.5 flex items-center gap-2 text-[11.5px]"
                            >
                                <EIcon className={cn("w-3 h-3 shrink-0", m.tone)} />
                                <span className="text-slate-700 truncate">{m.label}</span>
                                <span className="ms-auto text-slate-400 shrink-0">{fmtRelative(e.observed_at)}</span>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
