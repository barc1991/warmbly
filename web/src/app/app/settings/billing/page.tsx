// Billing — owner-only, organization-scoped, split into tabs so the page is
// browsable: Overview (plan, usage, controls), Plans (compare/promo), AI & credits,
// and Payment. Each tab is a real path (/app/settings/billing/ai-credits,
// /plans, /payment) so tabs are linkable and Stripe returns land on the tab
// they left from.
//
// Plan data lives in `lib/plans` so the dashboard mirrors warmbly-web
// exactly — every value here (limits, descriptions, bullets) comes
// from the marketing site's pricing.astro.

import React from "react";
import {
    ArrowUpRightIcon,
    CheckIcon,
    CreditCardIcon,
    ExternalLinkIcon,
    FileTextIcon,
    GaugeIcon,
    LayersIcon,
    Loader2Icon,
    LockIcon,
    SparklesIcon,
    TicketIcon,
    XIcon,
} from "lucide-react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import { TopbarAction } from "@/components/layout/Page";
import useFeatureAccess from "@/hooks/useFeatureAccess";
import useUpgradeFlow from "@/hooks/useUpgradeFlow";
import { useUpgradeDialog } from "@/hooks/context/upgrade";
import useValidateDiscountCode from "@/lib/api/hooks/app/subscription/useValidateDiscountCode";
import useAppliedDiscounts from "@/lib/api/hooks/app/subscription/useAppliedDiscounts";
import usePreviewPlanChange from "@/lib/api/hooks/app/subscription/usePreviewPlanChange";
import { useAppStore } from "@/stores";
import type { AppError } from "@/lib/api/client/normalizeError";
import type DiscountPreview from "@/lib/api/models/app/subscription/DiscountPreview";
import type { DiscountRedemption } from "@/lib/api/models/app/subscription/DiscountRedemption";
import buildError from "@/lib/helper/buildError";
import { TextInput } from "@/components/ui/field";
import BillingIntervalToggle from "@/components/app/billing/BillingIntervalToggle";
import PlanCard from "@/components/app/billing/PlanCard";
import EnterpriseInquiryDialog from "@/components/app/billing/EnterpriseInquiryDialog";
import { Row, Section, SectionShell, TableSurface } from "../_components/SectionShell";
import { PAID_PLANS, getPlan, planOrder, type PlanID } from "@/lib/plans";
import { describeDiscount, fmtMoney, fromMinorUnits, type BillingInterval } from "@/lib/pricing";
import OverviewTab from "./OverviewTab";
import CreditsCard from "./CreditsCard";
import AIUsageCard from "./AIUsageCard";

type BillingTab = "overview" | "plans" | "ai" | "payment";

// Tab slugs are path segments under /app/settings/billing; overview is the
// bare path.
const TABS: { id: BillingTab; slug: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "overview", slug: "", label: "סקירה כללית", icon: GaugeIcon },
    { id: "plans", slug: "plans", label: "תוכניות", icon: LayersIcon },
    { id: "ai", slug: "ai-credits", label: "AI וקרדיטים", icon: SparklesIcon },
    { id: "payment", slug: "payment", label: "תשלום", icon: CreditCardIcon },
];

function tabForSlug(slug: string | undefined): BillingTab | null {
    if (!slug) return "overview";
    const hit = TABS.find((t) => t.slug === slug);
    return hit ? hit.id : null;
}

function pathForTab(t: BillingTab): string {
    const slug = TABS.find((x) => x.id === t)?.slug;
    return slug ? `/app/settings/billing/${slug}` : "/app/settings/billing";
}

export default function BillingSettingsPage() {
    const access = useFeatureAccess();
    const currentOrg = useAppStore((s) => s.currentOrganization);
    const validateCode = useValidateDiscountCode();
    // Checkout / plan change / portal live in useUpgradeFlow, shared with the
    // in-app upgrade dialog.
    const flow = useUpgradeFlow();
    const upgradeDialog = useUpgradeDialog();
    const openPortal = flow.openPortal;
    const redemptions = useAppliedDiscounts();
    const { tab: tabSlug } = useParams();
    const navigate = useNavigate();
    const [codeInput, setCodeInput] = React.useState("");
    const [applied, setApplied] = React.useState<DiscountPreview | null>(null);
    const [billingInterval, setBillingInterval] =
        React.useState<BillingInterval>("annual");
    const [salesOpen, setSalesOpen] = React.useState(false);

    const resolvedTab = tabForSlug(tabSlug);
    const tab: BillingTab = resolvedTab ?? "overview";
    const setTab = (t: BillingTab) => navigate(pathForTab(t));

    // Unknown slug (stale link, typo) — normalize the URL to the overview.
    if (resolvedTab === null) {
        return <Navigate to="/app/settings/billing" replace />;
    }

    // No billing provider on this deployment: there is nothing to manage here.
    if (!access.billing) {
        return <Navigate to="/app/settings/workspace" replace />;
    }

    if (!access.loading && !access.isOwner) {
        return (
            <SectionShell title="חיובים" description="לבעלי סביבת העבודה בלבד.">
                <Section eyebrow="הרשאה נדחתה">
                    <div className="flex items-start gap-3">
                        <div className="size-9 rounded-md bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                            <LockIcon className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="text-[13px] font-semibold text-slate-900">
                                רק בעל סביבת העבודה רשאי לצפות בחיובים
                            </div>
                            <p className="text-[12px] text-slate-500 leading-relaxed mt-1 max-w-md">
                                שינויי תוכנית, חשבוניות ואמצעי תשלום מוגבלים לתפקיד
                                הבעלים. פנה לבעל סביבת העבודה לקבלת עדכון במידת הצורך.
                            </p>
                        </div>
                    </div>
                </Section>
            </SectionShell>
        );
    }

    const currentPlan = getPlan(access.plan);

    async function applyCode() {
        const code = codeInput.trim();
        if (!code) return;
        try {
            const res = await validateCode.mutateAsync({ code });
            if (res.valid) {
                setApplied(res);
                toast.success("קוד קופון הוחל בהצלחה");
            } else {
                setApplied(null);
                toast.error(res.reason || "לא ניתן להחיל קוד זה");
            }
        } catch (e) {
            toast.error(buildError(e as AppError));
        }
    }

    function clearCode() {
        setApplied(null);
        setCodeInput("");
    }

    // Spotlight the best-value plan, but never one at or below what the
    // workspace already pays for: ringing Business as "Best value" for an
    // Enterprise customer reads as a downgrade pitch. Undefined means no card
    // is highlighted, which is the right answer on the top plan.
    const recommendedPlan: PlanID | undefined =
        PAID_PLANS.find(
            (id) => getPlan(id).featured && planOrder(id) > planOrder(currentPlan.id),
        ) ?? PAID_PLANS.find((id) => planOrder(id) > planOrder(currentPlan.id));

    // Overview's "Change plan" opens the same full-screen chooser the locked
    // surfaces use, so there is one upgrade experience everywhere.
    function openPlanChooser() {
        upgradeDialog.open({
            feature: "התוכנית שלך",
            minPlan: "starter",
            blurb: "השווה בין כל התוכניות, החלף מחזור חיוב, ושנה את המנוי שלך בשלב אחד.",
        });
    }

    // Upgrade/switch to a plan. A valid promo code rides along to Stripe; the
    // flow picks Checkout, an in-place change, or the portal.
    function upgrade(catalogId: PlanID) {
        void flow
            .upgrade(catalogId, {
                interval: billingInterval,
                discountCode: applied?.valid ? applied.code : undefined,
                returnTo: "/app/settings/billing/plans",
            })
            .then((outcome) => {
                if (outcome === "contact") setSalesOpen(true);
            });
    }

    return (
        <SectionShell
            title="חיובים"
            description={`תוכנית, תשלום וחשבוניות עבור ${currentOrg?.name ?? "סביבת עבודה זו"}.`}
            actions={
                <TopbarAction
                    icon={<ExternalLinkIcon className="w-3 h-3" />}
                    onClick={openPortal}
                >
                    {flow.portalPending ? "פותח…" : "ניהול חיובים"}
                </TopbarAction>
            }
        >
            <div>
                <div className="sticky top-0 z-20 bg-white/95 backdrop-blur px-2 md:px-6 flex items-center gap-1 border-b border-slate-200/70 overflow-x-auto">
                    {TABS.map(({ id, label, icon: Icon }) => {
                        const active = tab === id;
                        return (
                            <button
                                key={id}
                                type="button"
                                onClick={() => setTab(id)}
                                className={`relative h-10 px-2.5 inline-flex shrink-0 items-center gap-1.5 text-[12.5px] transition-colors ${
                                    active
                                        ? "text-slate-900 font-medium"
                                        : "text-slate-500 hover:text-slate-700"
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {label}
                                {active && (
                                    <motion.span
                                        layoutId="billing-tab-underline"
                                        className="absolute left-1.5 right-1.5 -bottom-px h-0.5 rounded-full bg-sky-600"
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>
                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={tab}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.16, ease: "easeOut" }}
                        className="divide-y divide-slate-200/70"
                    >
                        {tab === "overview" && (
                            <OverviewTab onChangePlan={openPlanChooser} />
                        )}

                        {tab === "plans" && (
                            <>
                                <Section
                                    eyebrow="השוואת תוכניות"
                                    description="אותו מגוון תוכניות כמו בעמוד התמחור הציבורי. המעבר מחושב באופן יחסי ונכנס לתוקף מיידית."
                                    actions={
                                        <BillingIntervalToggle
                                            interval={billingInterval}
                                            onChange={setBillingInterval}
                                        />
                                    }
                                >
                                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 pt-2">
                                        {PAID_PLANS.map((id, i) => (
                                            <PlanCard
                                                key={id}
                                                id={id}
                                                index={i}
                                                current={currentPlan.id}
                                                recommended={id === recommendedPlan}
                                                discount={applied}
                                                interval={billingInterval}
                                                pending={flow.pending === id}
                                                busy={flow.pending !== null || flow.portalPending}
                                                ctaVerb={currentPlan.id === "free" ? "השג" : "עבור אל"}
                                                footer={
                                                    <ProrationNote
                                                        planId={flow.resolveServerPlan(id)?.id}
                                                        enabled={currentPlan.id !== "free" && currentPlan.id !== id}
                                                    />
                                                }
                                                onChoose={() => upgrade(id)}
                                            />
                                        ))}
                                    </div>
                                    <Link
                                        to="/#pricing"
                                        className="inline-flex items-center gap-1 text-[11.5px] text-slate-500 hover:text-slate-900 transition-colors"
                                    >
                                        <ArrowUpRightIcon className="w-3 h-3 rtl:rotate-180" />
                                        פתח את עמוד התמחור המלא
                                    </Link>
                                </Section>

                                <Section
                                    eyebrow="קוד קופון"
                                    description="יש לך קוד הנחה? החל אותו כדי לראות את המחיר מראש. הוא ייושם בעת התשלום."
                                >
                                    <Row
                                        label="קוד הנחה"
                                        description="אנו מאמתים את הקוד מול סביבת העבודה שלך והתוכנית שתבחר."
                                        align="start"
                                    >
                                        <div className="flex flex-col items-stretch gap-2 sm:items-end">
                                            <div className="flex items-center gap-2">
                                                <TextInput
                                                    value={codeInput}
                                                    onChange={(v) => setCodeInput(v.toUpperCase())}
                                                    placeholder="WELCOME10"
                                                    disabled={!!applied}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") applyCode();
                                                    }}
                                                    className="w-full sm:w-[180px] font-mono uppercase"
                                                    dir="ltr"
                                                />
                                                {applied ? (
                                                    <button
                                                        type="button"
                                                        onClick={clearCode}
                                                        className="h-7 px-2.5 rounded-md border border-slate-200 hover:border-slate-300 text-[12px] text-slate-700 hover:text-slate-900 transition-colors inline-flex items-center gap-1 shrink-0"
                                                    >
                                                        <XIcon className="w-3 h-3" />
                                                        נקה
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={applyCode}
                                                        disabled={validateCode.isPending || !codeInput.trim()}
                                                        className="h-7 px-3 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0"
                                                    >
                                                        {validateCode.isPending ? (
                                                            <Loader2Icon className="w-3 h-3 animate-spin" />
                                                        ) : (
                                                            <TicketIcon className="w-3 h-3" />
                                                        )}
                                                        החל
                                                    </button>
                                                )}
                                            </div>
                                            {applied && (
                                                <div className="text-[11.5px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-2 py-1 inline-flex items-center gap-1.5">
                                                    <CheckIcon className="w-3 h-3 shrink-0" />
                                                    <span className="font-mono font-medium" dir="ltr">{applied.code}</span>
                                                    <span>· {describeDiscount(applied)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </Row>
                                </Section>

                                <Section
                                    eyebrow="קודים שמומשו"
                                    description="קודי קופון והפניה שסביבת עבודה זו מימשה."
                                >
                                    {redemptions.isPending ? (
                                        <div className="h-16 rounded bg-slate-100 animate-pulse" />
                                    ) : (redemptions.data?.data.length ?? 0) === 0 ? (
                                        <p className="text-[12px] text-slate-500 leading-relaxed">
                                            אין עדיין קודים שמומשו. החל קוד למעלה כדי לראות אותו כאן.
                                        </p>
                                    ) : (
                                        <TableSurface>
                                            <table className="w-full text-[12px]">
                                                <thead>
                                                    <tr className="text-start text-[10.5px] uppercase tracking-[0.08em] text-slate-400 border-b border-slate-200">
                                                        <th className="font-medium px-3 py-2 text-start">קוד</th>
                                                        <th className="font-medium px-3 py-2 text-start">הנחה</th>
                                                        <th className="font-medium px-3 py-2 text-start">סטטוס</th>
                                                        <th className="font-medium px-3 py-2 text-end">מומש ב-</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {(redemptions.data?.data ?? []).map((d) => (
                                                        <RedemptionRow key={d.id} row={d} />
                                                    ))}
                                                </tbody>
                                            </table>
                                        </TableSurface>
                                    )}
                                </Section>
                            </>
                        )}

                        {tab === "ai" && (
                            <>
                                <CreditsCard isPaid={currentPlan.id !== "free"} />
                                <AIUsageCard />
                            </>
                        )}

                        {tab === "payment" && (
                            <>
                                <Section
                                    eyebrow="תשלום"
                                    description="כרטיס אשראי לחידושים ותוספות. מנוהל באמצעות Stripe."
                                >
                                    <Row
                                        label="אמצעי תשלום"
                                        description="כרטיסים נשמרים ב-Stripe ולעולם אינם נוגעים ב-Warmbly, ולכן נצפים ומשתנים בפורטל התשלומים."
                                    >
                                        <button
                                            type="button"
                                            onClick={openPortal}
                                            disabled={flow.portalPending}
                                            className="h-7 px-2.5 rounded-md border border-slate-200 hover:border-slate-300 text-[12px] text-slate-700 hover:text-slate-900 transition-colors inline-flex items-center gap-1.5 disabled:opacity-60"
                                        >
                                            <CreditCardIcon className="w-3 h-3" />
                                            נהל כרטיסים ב-Stripe
                                        </button>
                                    </Row>
                                    <Row
                                        label="אימייל לחיוב"
                                        description="חשבוניות והודעות חידוש נשלחות לכתובת האימייל של הלקוח ב-Stripe."
                                    >
                                        <button
                                            type="button"
                                            onClick={openPortal}
                                            disabled={flow.portalPending}
                                            className="h-7 px-2.5 rounded-md border border-slate-200 hover:border-slate-300 text-[12px] text-slate-700 hover:text-slate-900 transition-colors disabled:opacity-60"
                                        >
                                            שנה ב-Stripe
                                        </button>
                                    </Row>
                                </Section>

                                <Section
                                    eyebrow="חשבוניות"
                                    description="קבלות מפורטל החיובים שלך."
                                >
                                    <p className="text-[12px] text-slate-500 leading-relaxed">
                                        חשבוניות זמינות בפורטל החיובים של Stripe. פתח את הפורטל כדי להוריד
                                        קבלות בפורמט PDF.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={openPortal}
                                        disabled={flow.portalPending}
                                        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-slate-200 hover:border-slate-300 text-[12px] text-slate-700 hover:text-slate-900 transition-colors disabled:opacity-60"
                                    >
                                        {flow.portalPending ? (
                                            <Loader2Icon className="w-3 h-3 animate-spin" />
                                        ) : (
                                            <FileTextIcon className="w-3 h-3" />
                                        )}
                                        פתח חשבוניות
                                    </button>
                                </Section>
                            </>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
            <EnterpriseInquiryDialog open={salesOpen} onClose={() => setSalesOpen(false)} />
        </SectionShell>
    );
}

function RedemptionRow({ row }: { row: DiscountRedemption }) {
    return (
        <tr className="text-slate-700">
            <td className="px-3 py-2 font-mono uppercase text-slate-900" dir="ltr">{row.code}</td>
            <td className="px-3 py-2 text-slate-600">{describeRedemption(row)}</td>
            <td className="px-3 py-2">
                <RedemptionStatusPill status={row.status} />
            </td>
            <td className="px-3 py-2 text-end text-slate-500 tabular-nums">
                {fmtDate(row.redeemed_at)}
            </td>
        </tr>
    );
}

const REDEMPTION_STATUS_LABELS: Record<string, string> = {
    applied: "הוחל",
    active: "פעיל",
    expired: "פג תוקף",
    revoked: "בוטל",
    void: "מבוטל",
};

function RedemptionStatusPill({ status }: { status: string }) {
    const s = (status ?? "").toLowerCase();
    const cls =
        s === "applied" || s === "active"
            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
            : s === "expired" || s === "revoked" || s === "void"
                ? "bg-slate-100 text-slate-400 border-slate-200"
                : "bg-slate-100 text-slate-500 border-slate-200";
    return (
        <span
            className={`inline-flex items-center text-[10px] uppercase tracking-[0.08em] font-semibold rounded-sm px-1.5 py-0.5 border ${cls}`}
        >
            {REDEMPTION_STATUS_LABELS[s] || status || "—"}
        </span>
    );
}

// describeRedemption renders a short human summary of a redeemed code.
function describeRedemption(d: DiscountRedemption): string {
    if (d.type === "trial_extension") {
        return `+${d.trial_extension_days ?? 0} ימי ניסיון`;
    }
    if (d.type === "percent") {
        return `${d.percent_off ?? 0}% הנחה`;
    }
    if (d.type === "fixed" && d.amount_off != null) {
        return `${(d.currency ?? "usd").toUpperCase()} ${fmtMoney(d.amount_off)} הנחה`;
    }
    return d.type || "הנחה";
}

function fmtDate(value?: string | null): string {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("he-IL", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

// What a switch costs today, shown on each plan card for a paying workspace.
// An empty id disables the query, so free workspaces and the current plan never
// hit /subscription/preview-change.
function ProrationNote({ planId, enabled }: { planId?: string; enabled: boolean }) {
    const preview = usePreviewPlanChange(enabled && planId ? planId : "");
    if (!enabled) return null;
    return (
        <div className="rounded-md border border-slate-200/80 bg-slate-50 px-2.5 py-1.5 text-[11px] leading-snug">
            {preview.isPending ? (
                <span className="text-slate-400">מחשב את עלות המעבר…</span>
            ) : preview.data ? (
                <>
                    <div className="text-slate-700 tabular-nums font-medium">
                        {(() => {
                            // Stripe reports this in the currency's minor unit.
                            const due = fromMinorUnits(
                                preview.data.proration_amount,
                                preview.data.currency,
                            );
                            if (due > 0) return `לתשלום היום $${fmtMoney(due)}`;
                            if (due < 0) return `זיכוי $${fmtMoney(Math.abs(due))}`;
                            return "ללא חיוב היום";
                        })()}
                    </div>
                    <div className="text-slate-400">
                        חיוב הבא ב-{fmtDate(preview.data.next_billing_date as unknown as string)}
                    </div>
                </>
            ) : (
                <span className="text-slate-400">חישוב יחסי בעת המעבר</span>
            )}
        </div>
    );
}
