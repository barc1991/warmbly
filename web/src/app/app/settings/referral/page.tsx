// Referral program — owner-only, organization-scoped.
//
// Invitees get a discount for a few months; the referrer earns account credit
// equal to one month of the invitee's plan, applied to their invoices. This
// page surfaces the share link + code, the running balance, and the two
// ledgers (referrals + earnings history).

import React from "react";
import {
    CheckIcon,
    CopyIcon,
    GiftIcon,
    Loader2Icon,
    LockIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { Navigate } from "react-router-dom";
import useFeatureAccess from "@/hooks/useFeatureAccess";
import useReferral from "@/lib/api/hooks/app/subscription/useReferral";
import useReferralAttributions from "@/lib/api/hooks/app/subscription/useReferralAttributions";
import useReferralEarnings from "@/lib/api/hooks/app/subscription/useReferralEarnings";
import type {
    ReferralAttribution,
    ReferralAttributionStatus,
    ReferralEarningsTransaction,
} from "@/lib/api/models/app/subscription/Referral";
import { Row, Section, SectionShell, TableSurface } from "../_components/SectionShell";

export default function ReferralSettingsPage() {
    const access = useFeatureAccess();
    const referral = useReferral();
    const summary = referral.data;
    const currency = summary?.currency ?? "usd";

    // Referral credit is billing credit; without a billing provider it has no meaning.
    if (!access.billing) {
        return <Navigate to="/app/settings/workspace" replace />;
    }

    if (!access.loading && !access.isOwner) {
        return (
            <SectionShell title="הפנה והרווח" description="לבעלים בלבד.">
                <Section eyebrow="הרשאה נדחתה">
                    <div className="flex items-start gap-3">
                        <div className="size-9 rounded-md bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                            <LockIcon className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="text-[13px] font-semibold text-slate-900">
                                רק בעל סביבת העבודה רשאי לנהל הפניות
                            </div>
                            <p className="text-[12px] text-slate-500 leading-relaxed mt-1 max-w-md">
                                קרדיט ההפניה מוחל על חשבוניות סביבת עבודה זו, ולכן התוכנית מוגבלת לתפקיד הבעלים. בקש מבעל החשבון לשתף את הקישור אם ברצונך להפנות מישהו.
                            </p>
                        </div>
                    </div>
                </Section>
            </SectionShell>
        );
    }

    return (
        <SectionShell
            title="הפנה והרווח"
            description="הזמן צוותים נוספים ל-Warmbly וצבור קרדיט לחשבון על גבי החשבוניות שלך."
        >
            <Section
                eyebrow="כיצד זה עובד"
                description="שתף את הקישור שלך, הם חוסכים, אתה מרוויח."
            >
                <div className="rounded-md border border-sky-100 bg-sky-50/60 p-4">
                    <div className="flex items-start gap-3">
                        <div className="size-9 rounded-md bg-white border border-sky-200 text-sky-700 flex items-center justify-center shrink-0">
                            <GiftIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[13px] font-semibold text-slate-900">
                                הענק {summary?.invitee_percent_off ?? 0}%, קבל חודש של קרדיט
                            </div>
                            <p className="text-[12px] text-slate-600 leading-relaxed mt-1 max-w-lg">
                                כל מי שנרשם דרך הקישור שלך מקבל{" "}
                                <span className="font-medium text-slate-900">
                                    {summary?.invitee_percent_off ?? 0}% הנחה
                                </span>{" "}
                                עבור{" "}
                                <span className="font-medium text-slate-900">
                                    {(summary?.invitee_months ?? 0) === 1
                                        ? "החודש הראשון שלו"
                                        : `${summary?.invitee_months ?? 0} החודשים הראשונים שלו`}
                                </span>
                                . ברגע שהוא הופך ללקוח משלם, תצבור קרדיט לחשבון השווה לחודש אחד בתוכנית שלו, אשר יוחל אוטומטית על החשבוניות שלך.
                            </p>
                        </div>
                    </div>
                </div>
            </Section>

            <Section
                eyebrow="הקישור שלך"
                description="שתף קישור זה או קוד. נרשמים חדשים ישויכו אליך באופן אוטומטי."
            >
                {referral.isPending ? (
                    <div className="h-9 rounded bg-slate-100 animate-pulse" />
                ) : referral.isError || !summary ? (
                    <p className="text-[12px] text-slate-500">
                        לא ניתן היה לטעון את קישור ההפניה שלך. רענן את הדף כדי לנסות שוב.
                    </p>
                ) : (
                    <>
                        <Row
                            label="קישור לשיתוף"
                            description="קישור ישיר להרשמה המכיל את הקוד שלך."
                            align="start"
                        >
                            <CopyChip value={summary.share_url} label="העתק קישור" mono />
                        </Row>
                        <Row
                            label="קוד הפניה"
                            description="עבור מי שמזין קוד באופן ידני בעת ההרשמה."
                            align="start"
                        >
                            <CopyChip value={summary.code} label="העתק קוד" mono uppercase />
                        </Row>
                    </>
                )}
            </Section>

            <Section
                eyebrow="רווחים וקרדיטים"
                description="הקרדיט שצברת. היתרה מוחלת אוטומטית על החשבוניות שלך."
            >
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <StatCard
                        label="קרדיט זמין"
                        value={formatMoney(summary?.balance_cents ?? 0, currency)}
                        loading={referral.isPending}
                        accent
                    />
                    <StatCard
                        label="סך הכל נצבר"
                        value={formatMoney(summary?.lifetime_earned_cents ?? 0, currency)}
                        loading={referral.isPending}
                    />
                    <StatCard
                        label="סך הכל הופנו"
                        value={String(summary?.total_referred ?? 0)}
                        loading={referral.isPending}
                    />
                    <StatCard
                        label="תוגמלו"
                        value={String(summary?.rewarded ?? 0)}
                        loading={referral.isPending}
                    />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-slate-500">
                    <CountPill tone="muted" label="ממתין" value={summary?.pending ?? 0} />
                    <CountPill tone="sky" label="זכאי" value={summary?.qualified ?? 0} />
                    <CountPill tone="emerald" label="תוגמל" value={summary?.rewarded ?? 0} />
                </div>
            </Section>

            <Section
                eyebrow="ההפניות שלך"
                description="צוותים שנרשמו עם הקישור שלך והסטטוס שלהם בתהליך התגמול."
            >
                <AttributionsTable currency={currency} />
            </Section>

            <Section
                eyebrow="היסטוריית רווחים"
                description="כל קרדיט והתאמה שהוחלו על היתרה שלך."
            >
                <EarningsTable currency={currency} />
            </Section>
        </SectionShell>
    );
}

// CopyChip renders a value in a bordered chip with a copy-to-clipboard button.
function CopyChip({
    value,
    label,
    mono,
    uppercase,
}: {
    value: string;
    label: string;
    mono?: boolean;
    uppercase?: boolean;
}) {
    const [copied, setCopied] = React.useState(false);
    function copy() {
        navigator.clipboard.writeText(value).then(
            () => {
                setCopied(true);
                toast.success("הועתק ללוח");
                setTimeout(() => setCopied(false), 2000);
            },
            () => toast.error("לא ניתן היה להעתיק ללוח"),
        );
    }
    return (
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <div
                className={`flex-1 sm:w-[280px] min-w-0 h-7 px-2.5 rounded-md border border-slate-200 bg-slate-50 text-[12px] text-slate-700 flex items-center truncate ${
                    mono ? "font-mono" : ""
                } ${uppercase ? "uppercase" : ""}`}
                title={value}
                dir="ltr"
            >
                <span className="truncate">{value}</span>
            </div>
            <button
                type="button"
                onClick={copy}
                className="h-7 px-2.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors shrink-0"
            >
                {copied ? <CheckIcon className="w-3 h-3" /> : <CopyIcon className="w-3 h-3" />}
                {copied ? "הועתק" : label}
            </button>
        </div>
    );
}

function StatCard({
    label,
    value,
    loading,
    accent,
}: {
    label: string;
    value: string;
    loading?: boolean;
    accent?: boolean;
}) {
    return (
        <div
            className={`rounded-md border p-3 ${
                accent ? "border-sky-200 bg-sky-50/60" : "border-slate-200 bg-white"
            }`}
        >
            <div className="text-[10px] uppercase tracking-[0.1em] font-medium text-slate-400">
                {label}
            </div>
            {loading ? (
                <div className="h-5 mt-1.5 w-16 rounded bg-slate-100 animate-pulse" />
            ) : (
                <div
                    className={`text-[16px] font-semibold tabular-nums mt-0.5 ${
                        accent ? "text-sky-700" : "text-slate-900"
                    }`}
                >
                    {value}
                </div>
            )}
        </div>
    );
}

function CountPill({
    label,
    value,
    tone,
}: {
    label: string;
    value: number;
    tone: "muted" | "sky" | "emerald";
}) {
    const dot =
        tone === "emerald"
            ? "bg-emerald-500"
            : tone === "sky"
              ? "bg-sky-500"
              : "bg-slate-300";
    return (
        <span className="inline-flex items-center gap-1.5">
            <span className={`size-1.5 rounded-full ${dot}`} />
            <span className="text-slate-500">{label}</span>
            <span className="font-mono tabular-nums text-slate-700">{value}</span>
        </span>
    );
}

function AttributionsTable({ currency }: { currency: string }) {
    const query = useReferralAttributions();
    const rows = query.attributions;

    if (query.isPending) {
        return <div className="h-16 rounded bg-slate-100 animate-pulse" />;
    }
    if (rows.length === 0) {
        return (
            <p className="text-[12px] text-slate-500 leading-relaxed">
                אין עדיין הפניות. שתף את הקישור שלך כדי להתחיל.
            </p>
        );
    }

    return (
        <>
            <TableSurface>
                <table className="w-full text-[12px]">
                    <thead>
                        <tr className="text-start text-[10.5px] uppercase tracking-[0.08em] text-slate-400 border-b border-slate-200">
                            <th className="font-medium px-3 py-2 text-start">ארגון מופנה</th>
                            <th className="font-medium px-3 py-2 text-start">סטטוס</th>
                            <th className="font-medium px-3 py-2 text-end">תגמול</th>
                            <th className="font-medium px-3 py-2 text-end">תאריך</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {rows.map((r) => (
                            <AttributionRow key={r.id} row={r} fallbackCurrency={currency} />
                        ))}
                    </tbody>
                </table>
            </TableSurface>
            <LoadMore query={query} />
        </>
    );
}

function AttributionRow({
    row,
    fallbackCurrency,
}: {
    row: ReferralAttribution;
    fallbackCurrency: string;
}) {
    return (
        <tr className="text-slate-700">
            <td className="px-3 py-2 text-start">
                <span className="inline-flex items-center gap-1.5">
                    <span className="text-slate-500">ארגון מופנה</span>
                    <span className="font-mono text-[11px] text-slate-400" dir="ltr">
                        {shortId(row.invitee_org_id)}
                    </span>
                </span>
            </td>
            <td className="px-3 py-2 text-start">
                <AttributionStatusBadge status={row.status} />
            </td>
            <td className="px-3 py-2 text-end font-mono tabular-nums">
                {row.reward_cents > 0
                    ? formatMoney(row.reward_cents, row.reward_currency || fallbackCurrency)
                    : "—"}
            </td>
            <td className="px-3 py-2 text-end text-slate-500 tabular-nums">
                {formatDate(row.rewarded_at ?? row.qualified_at ?? row.created_at)}
            </td>
        </tr>
    );
}

function AttributionStatusBadge({ status }: { status: ReferralAttributionStatus }) {
    const map: Record<ReferralAttributionStatus, { label: string; cls: string }> = {
        pending: { label: "ממתין", cls: "bg-slate-100 text-slate-500 border-slate-200" },
        qualified: { label: "זכאי", cls: "bg-sky-50 text-sky-700 border-sky-100" },
        rewarded: { label: "תוגמל", cls: "bg-emerald-50 text-emerald-700 border-emerald-100" },
        void: { label: "בוטל", cls: "bg-slate-100 text-slate-400 border-slate-200" },
    };
    const { label, cls } = map[status];
    return (
        <span
            className={`inline-flex items-center text-[10px] uppercase tracking-[0.08em] font-semibold rounded-sm px-1.5 py-0.5 border ${cls}`}
        >
            {label}
        </span>
    );
}

function EarningsTable({ currency }: { currency: string }) {
    const query = useReferralEarnings();
    const rows = query.earnings;

    if (query.isPending) {
        return <div className="h-16 rounded bg-slate-100 animate-pulse" />;
    }
    if (rows.length === 0) {
        return (
            <p className="text-[12px] text-slate-500 leading-relaxed">
                אין עדיין רווחים. הקרדיט יוצג כאן ברגע שהפניה תתוגמל.
            </p>
        );
    }

    return (
        <>
            <TableSurface>
                <table className="w-full text-[12px]">
                    <thead>
                        <tr className="text-start text-[10.5px] uppercase tracking-[0.08em] text-slate-400 border-b border-slate-200">
                            <th className="font-medium px-3 py-2 text-start">סיבה</th>
                            <th className="font-medium px-3 py-2 text-end">סכום</th>
                            <th className="font-medium px-3 py-2 text-end">יתרה</th>
                            <th className="font-medium px-3 py-2 text-end">תאריך</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {rows.map((t) => (
                            <EarningsRow key={t.id} row={t} fallbackCurrency={currency} />
                        ))}
                    </tbody>
                </table>
            </TableSurface>
            <LoadMore query={query} />
        </>
    );
}

function EarningsRow({
    row,
    fallbackCurrency,
}: {
    row: ReferralEarningsTransaction;
    fallbackCurrency: string;
}) {
    const positive = row.amount_cents >= 0;
    const cur = row.currency || fallbackCurrency;
    return (
        <tr className="text-slate-700">
            <td className="px-3 py-2 text-start">{humanizeReason(row.reason)}</td>
            <td
                className={`px-3 py-2 text-end font-mono tabular-nums ${
                    positive ? "text-emerald-700" : "text-rose-700"
                }`}
            >
                {positive ? "+" : "−"}
                {formatMoney(Math.abs(row.amount_cents), cur)}
            </td>
            <td className="px-3 py-2 text-end font-mono tabular-nums text-slate-500">
                {formatMoney(row.balance_after_cents, cur)}
            </td>
            <td className="px-3 py-2 text-end text-slate-500 tabular-nums">
                {formatDate(row.created_at)}
            </td>
        </tr>
    );
}

function LoadMore({
    query,
}: {
    query: {
        hasNextPage: boolean;
        isFetchingNextPage: boolean;
        fetchNextPage: () => void;
    };
}) {
    if (!query.hasNextPage) return null;
    return (
        <button
            type="button"
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
            className="mt-2 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-slate-200 hover:border-slate-300 text-[12px] text-slate-700 hover:text-slate-900 transition-colors disabled:opacity-60"
        >
            {query.isFetchingNextPage && <Loader2Icon className="w-3 h-3 animate-spin" />}
            טען עוד
        </button>
    );
}

// shortId masks an org id to a short, non-PII reference.
function shortId(id: string): string {
    if (!id) return "—";
    const trimmed = id.replace(/-/g, "");
    return `#${trimmed.slice(0, 6)}`;
}

function humanizeReason(reason: string): string {
    if (!reason) return "התאמה";
    const map: Record<string, string> = {
        reward: "תגמול הפניה",
        referral_reward: "תגמול הפניה",
        invoice_credit: "זיכוי חשבונית",
        credit_applied: "זיכוי שיושם",
        adjustment: "התאמה",
        manual_adjustment: "התאמה ידנית",
        expired: "פג תוקף",
    };
    if (map[reason]) return map[reason];
    return reason
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

// formatMoney renders minor units (cents) as a localized currency string.
function formatMoney(cents: number, currency: string): string {
    try {
        return new Intl.NumberFormat("he-IL", {
            style: "currency",
            currency: (currency || "usd").toUpperCase(),
        }).format(cents / 100);
    } catch {
        return `${(cents / 100).toFixed(2)} ${(currency || "usd").toUpperCase()}`;
    }
}

function formatDate(value?: string): string {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("he-IL", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}
