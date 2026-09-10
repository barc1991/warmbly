// Billing > Overview — what the workspace is on, what it is consuming, and
// every control that acts on the subscription.
//
// Everything here reads real server state rather than the marketing catalog:
// limits, counts, the mailbox allowance and storage come from
// /organization/current/limits, capability flags from /subscription/features,
// the trial countdown from /subscription/trial. The catalog is only used for
// labels and colours.

import React from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import {
    AlertTriangleIcon,
    ArrowRightIcon,
    CheckIcon,
    CreditCardIcon,
    FileTextIcon,
    InfoIcon,
    Loader2Icon,
    PlayIcon,
    SlidersHorizontalIcon,
    SparklesIcon,
    XIcon,
} from "lucide-react";
import useFeatureAccess from "@/hooks/useFeatureAccess";
import useUpgradeFlow from "@/hooks/useUpgradeFlow";
import { useConfirm } from "@/hooks/context/confirm";
import useSubscription from "@/lib/api/hooks/app/subscription/useSubscription";
import useTrialStatus from "@/lib/api/hooks/app/subscription/useTrialStatus";
import useCancelSubscription from "@/lib/api/hooks/app/subscription/useCancelSubscription";
import useOrganizationLimits from "@/lib/api/hooks/app/organizations/useOrganizationLimits";
import useUsageOverview from "@/lib/api/hooks/app/analytics/useUsageOverview";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import { AnimatedNumber, DitherMeter, type DitherTone } from "@/components/ui/dither";
import { PLAN_ACCENT_CLASSES, getPlan } from "@/lib/plans";
import type OrganizationLimits from "@/lib/api/models/app/organizations/OrganizationLimits";
import { Section } from "../_components/SectionShell";

export default function OverviewTab({ onChangePlan }: { onChangePlan: () => void }) {
    const access = useFeatureAccess();
    const sub = useSubscription();
    const trial = useTrialStatus();
    const orgLimits = useOrganizationLimits();
    const limits = orgLimits.data?.limits;
    const counts = orgLimits.data?.counts;
    const mailboxes = orgLimits.data?.mailboxes;
    const storage = orgLimits.data?.storage;
    const usage = useUsageOverview().data;
    const cancel = useCancelSubscription();
    const flow = useUpgradeFlow();
    const confirm = useConfirm();

    const plan = getPlan(access.plan);
    const accent = PLAN_ACCENT_CLASSES[plan.accent];
    const status = sub.data?.status;
    const cancelAtEnd = sub.data?.cancel_at_period_end;
    const periodEnd = sub.data?.current_period_end
        ? new Date(sub.data.current_period_end as unknown as string)
        : null;
    const onFreeTier = !access.paid;

    async function scheduleCancel() {
        confirm.show(
            `לבטל את תוכנית ${plan.label}? היא תישאר פעילה עד ${fmtDate(periodEnd) || "סוף התקופה הנוכחית"}, ולאחר מכן סביבת העבודה תחזור לתוכנית החינמית. תיבות דואר, חימום והגדרות יישמרו.`,
            async () => {
                await toast.promise(cancel.mutateAsync({ cancel_at_period_end: true }), {
                    loading: "מתזמן ביטול…",
                    success: "הביטול תוזמן לסוף התקופה",
                    error: (e: AppError) => buildError(e),
                });
            },
        );
    }

    async function resume() {
        try {
            await toast.promise(cancel.mutateAsync({ cancel_at_period_end: false }), {
                loading: "מחדש מנוי…",
                success: "המנוי חודש בהצלחה",
                error: (e: AppError) => buildError(e),
            });
        } catch {
            /* surfaced via toast */
        }
    }

    return (
        <>
            {/* Attention strip: only rendered when something needs a decision. */}
            <AnimatePresence initial={false}>
                {status === "past_due" && (
                    <Banner
                        key="past_due"
                        tone="red"
                        icon={AlertTriangleIcon}
                        title="התשלום נכשל"
                        body="Stripe לא הצליחה לחייב את אמצעי התשלום הרשום. השליחה בסיכון עד להסדרת החשבונית."
                        action={{ label: "עדכן אמצעי תשלום", onClick: flow.openPortal }}
                    />
                )}
                {cancelAtEnd && status !== "canceled" && (
                    <Banner
                        key="cancel_at_end"
                        tone="amber"
                        icon={AlertTriangleIcon}
                        title={`מבוטל ב-${fmtDate(periodEnd) || "סוף התקופה"}`}
                        body="התוכנית נשארת פעילה במלואה עד אז. ניתן לחדש בכל עת לפני תאריך זה ושום דבר לא ישתנה."
                        action={{ label: cancel.isPending ? "מחדש…" : "חדש מנוי", onClick: resume }}
                    />
                )}
                {trial.data?.is_trial && (trial.data.days_remaining ?? 0) >= 0 && (
                    <Banner
                        key="trial"
                        tone="sky"
                        icon={SparklesIcon}
                        title={`${trial.data.days_remaining ?? 0} ${(trial.data.days_remaining ?? 0) === 1 ? "יום נותר" : "ימים נותרו"} לתקופת הניסיון`}
                        body={`תקופת הניסיון שלך מסתיימת ב-${fmtDate(toDate(trial.data.trial_end)) || "תאריך סיומה"}. בחר תוכנית לפני כן כדי להמשיך לשלוח ללא הפרעה.`}
                        action={{ label: "בחר תוכנית", onClick: onChangePlan }}
                    />
                )}
            </AnimatePresence>

            {/* ── Subscription ─────────────────────────────────────────── */}
            <Section
                eyebrow="מנוי"
                description="התוכנית הנוכחית של סביבת עבודה זו, וכל הפעולות שניתן לבצע בה."
            >
                {sub.isPending ? (
                    <div className="h-24 rounded bg-slate-100 animate-pulse" />
                ) : (
                    <div className="rounded-lg border border-slate-200 overflow-hidden">
                        <div className="px-4 py-4 flex flex-wrap items-start gap-4 bg-gradient-to-b from-slate-50/60 to-white">
                            <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 border ${accent.pill}`}>
                                <SparklesIcon className="w-4.5 h-4.5" />
                            </div>
                            <div className="min-w-0 flex-1 basis-[220px]">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[17px] font-semibold text-slate-900 tracking-tight">
                                        {plan.label}
                                    </span>
                                    <StatusPill status={status} cancelAtEnd={cancelAtEnd} />
                                </div>
                                <p className="text-[12px] text-slate-500 mt-1 leading-relaxed max-w-md">
                                    {plan.description}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-x-6 gap-y-2 shrink-0">
                                <Stat
                                    label="מחיר"
                                    value={plan.priceMonthly == null ? "מותאם אישית" : `$${plan.priceMonthly}`}
                                    sub={plan.priceMonthly == null ? "פנה למכירות" : "לחודש"}
                                />
                                <Stat
                                    label={cancelAtEnd ? "מסתיים" : "מתחדש"}
                                    value={fmtDate(periodEnd) || "—"}
                                    sub={periodEnd ? relativeDays(periodEnd) : onFreeTier ? "ללא מנוי" : ""}
                                />
                                <Stat
                                    label="שליחות יומיות"
                                    value={
                                        limits?.daily_campaign_limit != null
                                            ? limits.daily_campaign_limit.toLocaleString()
                                            : plan.sendsPerDay === Number.POSITIVE_INFINITY
                                               ? "מותאם אישית"
                                               : plan.sendsPerDay.toLocaleString()
                                    }
                                    sub="בכל סביבת העבודה"
                                />
                            </div>
                        </div>

                        {/* Control cluster — every action that changes the subscription. */}
                        <div className="px-3 py-2.5 border-t border-slate-200 bg-white flex flex-wrap items-center gap-1.5">
                            <button
                                type="button"
                                onClick={onChangePlan}
                                className="h-7 px-3 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors"
                            >
                                <SparklesIcon className="w-3 h-3" />
                                {onFreeTier ? "בחר תוכנית" : "שנה תוכנית"}
                            </button>
                            <button
                                type="button"
                                onClick={flow.openPortal}
                                disabled={flow.portalPending}
                                className="h-7 px-2.5 rounded-md border border-slate-200 hover:border-slate-300 text-[12px] text-slate-700 hover:text-slate-900 inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                            >
                                {flow.portalPending ? (
                                    <Loader2Icon className="w-3 h-3 animate-spin" />
                                ) : (
                                    <CreditCardIcon className="w-3 h-3" />
                                )}
                                אמצעי תשלום
                            </button>
                            <button
                                type="button"
                                onClick={flow.openPortal}
                                disabled={flow.portalPending}
                                className="h-7 px-2.5 rounded-md border border-slate-200 hover:border-slate-300 text-[12px] text-slate-700 hover:text-slate-900 inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                            >
                                <FileTextIcon className="w-3 h-3" />
                                חשבוניות
                            </button>
                            <Link
                                to="/app/settings/limits"
                                className="h-7 px-2.5 rounded-md border border-slate-200 hover:border-slate-300 text-[12px] text-slate-700 hover:text-slate-900 inline-flex items-center gap-1.5 transition-colors"
                            >
                                <SlidersHorizontalIcon className="w-3 h-3" />
                                בקש הגדלת מכסה
                            </Link>
                            {!onFreeTier && (
                                <div className="ms-auto">
                                    {cancelAtEnd ? (
                                        <button
                                            type="button"
                                            onClick={resume}
                                            disabled={cancel.isPending}
                                            className="h-7 px-2.5 rounded-md border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-[12px] font-medium text-emerald-700 inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                                        >
                                            {cancel.isPending ? (
                                                <Loader2Icon className="w-3 h-3 animate-spin" />
                                            ) : (
                                                <PlayIcon className="w-3 h-3" />
                                            )}
                                            חדש מנוי
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={scheduleCancel}
                                            disabled={cancel.isPending}
                                            className="h-7 px-2.5 rounded-md text-[12px] text-slate-500 hover:text-red-700 hover:bg-red-50 inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                                        >
                                            <XIcon className="w-3 h-3" />
                                            בטל תוכנית
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Section>

            {/* ── Usage against real limits ────────────────────────────── */}
            <Section
                eyebrow="שימוש ומכסות"
                description="ספירות חיות מול המכסות שהשרת אוכף בפועל, ולא מספרי השיווק."
                actions={
                    <Link
                        to="/app/settings/limits"
                        className="text-[11.5px] font-medium text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 transition-colors"
                    >
                        בקש הגדלה
                        <ArrowRightIcon className="w-3 h-3 rtl:rotate-180" />
                    </Link>
                }
            >
                {orgLimits.isPending ? (
                    <div className="h-32 rounded bg-slate-100 animate-pulse" />
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                        <UsageMeter
                            label="תיבות דואר"
                            hint={mailboxHint(mailboxes)}
                            current={mailboxes?.used ?? counts?.email_accounts ?? 0}
                            max={mailboxes?.allowance}
                            unmetered="ללא הגבלה"
                        />
                        <UsageMeter
                            label="שליחות היום"
                            hint="הודעות קמפיין שנשלחו היום מתוך המכסה היומית של סביבת העבודה"
                            current={counts?.emails_sent_today ?? 0}
                            max={limits?.daily_campaign_limit}
                        />
                        <UsageMeter
                            label="אנשי קשר"
                            hint="רשומות נמענים השמורות בסביבת עבודה זו"
                            current={counts?.total_contacts ?? usage?.contacts.total ?? 0}
                            max={limits?.max_contacts}
                        />
                        <UsageMeter
                            label="קמפיינים"
                            hint="קמפיינים שנוצרו בסביבת עבודה זו"
                            current={counts?.total_campaigns ?? usage?.campaigns.total ?? 0}
                            max={limits?.max_campaigns}
                        />
                        <UsageMeter
                            label="חברי צוות"
                            hint="מושבים בשימוש בסביבת עבודה זו"
                            current={counts?.total_members ?? 0}
                            max={limits?.max_team_members}
                        />
                        <UsageMeter
                            label="אחסון קבצים מצורפים"
                            hint={
                                storage?.over_quota
                                    ? "חריגה מהמכסה לאחר שינוי תוכנית: קבצים קיימים ממשיכים להישלח, העלאות חדשות ימתינו עד לחזרה למכסה"
                                    : "קבצים המצורפים לשלבי קמפיין, בכל הקמפיינים"
                            }
                            current={storage?.used_bytes ?? 0}
                            max={storage?.limit_bytes}
                            format={formatBytes}
                        />
                        <UsageMeter
                            label="שליחות בתקופה זו"
                            hint="הודעות קמפיין שנמסרו בתקופת החיוב הנוכחית"
                            current={usage?.campaigns.emails_sent ?? 0}
                            max={undefined}
                        />
                        <UsageMeter
                            label="קריאות API היום"
                            hint="בקשות שבוצעו באמצעות מפתחות API מתוך המכסה היומית"
                            current={usage?.api.total_calls ?? 0}
                            max={usage?.api.daily_limit}
                        />
                    </div>
                )}
                <p className="text-[11px] text-slate-400 leading-relaxed pt-1 inline-flex items-start gap-1.5">
                    <InfoIcon className="w-3 h-3 mt-0.5 shrink-0" />
                    מד ללא תקרה מציין שהמגבלה אינה מוגבלת בתוכנית זו. נפח החימום מנוהל לכל תיבת דואר ואינו מוגבל כאן.
                </p>
            </Section>

        </>
    );
}

/* ── pieces ──────────────────────────────────────────────────────── */

function Banner({
    tone,
    icon: Icon,
    title,
    body,
    action,
}: {
    tone: "red" | "amber" | "sky";
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    body: string;
    action?: { label: string; onClick: () => void };
}) {
    const tones = {
        red: "bg-red-50 border-red-200 text-red-900",
        amber: "bg-amber-50 border-amber-200 text-amber-900",
        sky: "bg-sky-50 border-sky-200 text-sky-900",
    } as const;
    const btn = {
        red: "bg-red-600 hover:bg-red-700 text-white",
        amber: "bg-amber-600 hover:bg-amber-700 text-white",
        sky: "bg-sky-600 hover:bg-sky-700 text-white",
    } as const;
    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
        >
            <div className={`mx-4 md:mx-8 mt-4 rounded-lg border px-3.5 py-3 flex flex-wrap items-start gap-3 ${tones[tone]}`}>
                <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1 basis-[200px]">
                    <div className="text-[12.5px] font-semibold">{title}</div>
                    <p className="text-[12px] opacity-80 leading-relaxed mt-0.5">{body}</p>
                </div>
                {action && (
                    <button
                        type="button"
                        onClick={action.onClick}
                        className={`h-7 px-2.5 rounded-md text-[12px] font-medium transition-colors shrink-0 ${btn[tone]}`}
                    >
                        {action.label}
                    </button>
                )}
            </div>
        </motion.div>
    );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-slate-400 font-medium">
                {label}
            </div>
            <div className="text-[14px] font-semibold text-slate-900 tabular-nums mt-0.5">{value}</div>
            {sub && <div className="text-[10.5px] text-slate-400">{sub}</div>}
        </div>
    );
}

// mailboxHint explains the number rather than only stating it, because the
// allowance is fair use and the reader should know what raises it.
function mailboxHint(a: OrganizationLimits["mailboxes"] | undefined): string {
    if (!a) return "תיבות דואר מחוברות לשליחה ולחימום";
    switch (a.basis) {
        case "fair_use":
            return a.sends_per_mailbox <= 1
                ? "שימוש הוגן: תיבת דואר אחת לכל שליחה יומית הכלולה בתוכנית שלך"
                : `שימוש הוגן: תיבת דואר אחת לכל ${a.sends_per_mailbox} שליחות יומיות הכלולות בתוכנית שלך`;
        case "override":
            return "הוגדל עבור סביבת עבודה זו בעקבות בקשה שאושרה";
        case "free":
            return "מכסה של סביבת עבודה חינמית; תוכנית בתשלום כוללת תיבת דואר אחת לכל שליחה יומית";
        case "plan":
            return "נקבע לפי התוכנית שלך";
        default:
            return "ללא תקרה על תיבות דואר מחוברות";
    }
}

function formatBytes(n: number): string {
    if (n >= 1 << 30) return `${(n / (1 << 30)).toFixed(n >= 10 * (1 << 30) ? 0 : 1)} GB`;
    if (n >= 1 << 20) return `${Math.round(n / (1 << 20))} MB`;
    if (n >= 1024) return `${Math.round(n / 1024)} KB`;
    return `${n} B`;
}

function UsageMeter({
    label,
    hint,
    current,
    max,
    unmetered = "ללא הגבלה",
    format,
}: {
    label: string;
    hint: string;
    current: number;
    max?: number | null;
    /** The word shown instead of a cap when there is none. */
    unmetered?: string;
    /** Renders both numbers; defaults to a plain count. */
    format?: (n: number) => string;
}) {
    const capped = typeof max === "number" && max > 0 && Number.isFinite(max);
    const pct = capped ? Math.min(100, Math.round((current / (max as number)) * 100)) : 0;
    const tone: DitherTone = pct >= 90 ? "rose" : pct >= 70 ? "amber" : "sky";
    return (
        <div>
            <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-[12px] text-slate-700 font-medium">{label}</span>
                <span className="text-[11.5px] font-mono tabular-nums text-slate-700">
                    {format ? format(current) : <AnimatedNumber value={current} />}
                    <span className="text-slate-400">
                        {capped ? ` / ${format ? format(max as number) : (max as number).toLocaleString()}` : ` / ${unmetered}`}
                    </span>
                </span>
            </div>
            <DitherMeter frac={capped ? pct / 100 : 0} tone={tone} height={4} />
            <div className="flex items-center justify-between gap-2 mt-1">
                <span className="text-[10.5px] text-slate-400 leading-snug">{hint}</span>
                {capped && pct >= 70 && (
                    <span
                        className={`text-[10px] font-semibold shrink-0 ${pct >= 90 ? "text-red-600" : "text-amber-600"}`}
                    >
                        {pct}% בשימוש
                    </span>
                )}
            </div>
        </div>
    );
}

function StatusPill({
    status,
    cancelAtEnd,
}: {
    status: string | undefined;
    cancelAtEnd: boolean | undefined;
}) {
    const base = "inline-flex items-center gap-1 text-[10px] rounded px-1.5 h-4 uppercase tracking-[0.1em] font-medium border";
    if (!status) {
        return <span className={`${base} bg-slate-100 text-slate-500 border-slate-200`}>חינם</span>;
    }
    if (status === "trialing") {
        return <span className={`${base} bg-emerald-50 text-emerald-700 border-emerald-100`}>ניסיון</span>;
    }
    if (status === "past_due") {
        return <span className={`${base} bg-red-50 text-red-700 border-red-100`}>בפיגור</span>;
    }
    if (status === "canceled") {
        return <span className={`${base} bg-slate-100 text-slate-500 border-slate-200`}>בוטל</span>;
    }
    if (cancelAtEnd) {
        return <span className={`${base} bg-amber-50 text-amber-700 border-amber-100`}>מסתיים בקרוב</span>;
    }
    return (
        <span className={`${base} bg-emerald-50 text-emerald-700 border-emerald-100`}>
            <CheckIcon className="w-2 h-2" />
            פעיל
        </span>
    );
}

/* ── helpers ─────────────────────────────────────────────────────── */

function toDate(v: Date | string | undefined): Date | null {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(d: Date | null): string {
    if (!d || Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("he-IL", { month: "long", day: "numeric", year: "numeric" });
}

function relativeDays(d: Date): string {
    const days = Math.round((d.getTime() - Date.now()) / 86_400_000);
    if (days < 0) return "עבר";
    if (days === 0) return "היום";
    if (days === 1) return "מחר";
    return `בעוד ${days} ימים`;
}
