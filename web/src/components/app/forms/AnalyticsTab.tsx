// AnalyticsTab — per-form analytics: totals, a daily views/starts/submissions
// trend, the page funnel, source/campaign/country/device breakdowns and the
// identified visitors this form has recognized. Stays live via the realtime
// spine.

import React from "react";
import { useNavigate } from "react-router-dom";
import { CheckIcon } from "lucide-react";

import { EmptyBlock } from "@/components/layout/Page";
import { MultiTrend, type TrendSeries } from "@/components/ui/charts";
import { useFormStats } from "@/lib/api/hooks/app/forms";
import type Form from "@/lib/api/models/app/forms/Form";
import type { FormStatsRange } from "@/lib/api/models/app/forms/FormStats";
import timeAgo from "@/lib/helper/timeAgo";

import { splitPages } from "./designCore";
import { InitialsAvatar, MiniProgress } from "./RowBits";

const RANGES: FormStatsRange[] = ["7d", "30d", "90d"];

function pct(numerator: number, denominator: number): string {
    if (denominator <= 0) return "–";
    return `${Math.min(100, (numerator / denominator) * 100).toFixed(1)}%`;
}

// "US" -> 🇺🇸 via regional indicator characters; non-2-letter keys get no flag.
function flagEmoji(code: string): string {
    const cc = code.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(cc)) return "";
    return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export default function AnalyticsTab({ form }: { form: Form }) {
    const navigate = useNavigate();
    const [range, setRange] = React.useState<FormStatsRange>("30d");
    const stats = useFormStats(form.id, range);
    const totalPages = React.useMemo(() => splitPages(form.fields).length, [form.fields]);

    const rangePills = (
        <div className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 p-0.5 shrink-0">
            {RANGES.map((o) => (
                <button
                    key={o}
                    type="button"
                    onClick={() => setRange(o)}
                    className={`h-7 px-2.5 rounded text-[12px] font-medium transition-colors ${
                        range === o ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                    }`}
                >
                    {o === "7d" ? "7 ימים" : o === "30d" ? "30 יום" : "90 יום"}
                </button>
            ))}
        </div>
    );

    const header = (
        <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">
                צפיות, התחלות והשלמות
            </span>
            {rangePills}
        </div>
    );

    if (stats.isPending) {
        return (
            <div className="p-4 lg:p-6 space-y-4">
                {header}
                <div className="h-20 rounded-md bg-slate-100 animate-pulse" />
                <div className="h-56 rounded-md bg-slate-100 animate-pulse" />
            </div>
        );
    }

    if (stats.isError || !stats.data) {
        return (
            <div className="p-4 lg:p-6 space-y-4">
                {header}
                <EmptyBlock
                    title="לא ניתן לטעון נתוני אנליטיקה"
                    body="נסה שוב בעוד רגע."
                    cta={
                        <button
                            type="button"
                            onClick={() => void stats.refetch()}
                            className="h-7 px-2.5 rounded-md border border-slate-200 hover:border-slate-300 bg-white text-[12px] font-medium text-slate-700 hover:text-slate-900 transition-colors"
                        >
                            נסה שוב
                        </button>
                    }
                />
            </div>
        );
    }

    const s = stats.data;
    const totals = s.totals;
    const daily = s.daily ?? [];
    const labels = daily.map((d) => d.date);
    const series: TrendSeries[] = [
        { key: "views", label: "צפיות", tone: "sky", values: daily.map((d) => d.views) },
        { key: "starts", label: "התחלות", tone: "violet", values: daily.map((d) => d.starts) },
        { key: "submissions", label: "הגשות", tone: "emerald", values: daily.map((d) => d.submissions) },
    ];
    const funnelBase = Math.max(1, s.pages[0]?.reached ?? 0);

    return (
        <div className="p-4 lg:p-6 space-y-5">
            {header}

            <div className="grid grid-cols-2 md:grid-cols-5 rounded-md border border-slate-200 overflow-hidden max-md:[&>*:nth-child(2n)]:border-e-0 max-md:[&>*:last-child]:col-span-2">
                <StatCell label="צפיות" value={totals.views.toLocaleString()} />
                <StatCell label="התחלות" value={totals.starts.toLocaleString()} />
                <StatCell label="הגשות" value={totals.submissions.toLocaleString()} />
                <StatCell
                    label="שיעור השלמה"
                    value={totals.starts > 0 ? `${Math.min(100, totals.completion_rate * 100).toFixed(1)}%` : "–"}
                />
                <StatCell label="מבקרים מזוהים" value={totals.identified_visitors.toLocaleString()} last />
            </div>

            <MultiTrend labels={labels} series={series} height={240} emptyLabel="אין פעילות בטווח תאריכים זה" />

            {s.pages.length > 1 && (
                <section className="space-y-2">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">משפך עמודים</div>
                    <div className="rounded-md border border-slate-200 bg-white p-4 space-y-2">
                        {s.pages.map((p) => (
                            <div key={p.page_index} className="flex items-center gap-3">
                                <span className="w-32 lg:w-48 shrink-0 text-[12px] text-slate-700 truncate">
                                    {p.title || `עמוד ${p.page_index + 1}`}
                                </span>
                                <div className="flex-1 h-5 rounded bg-slate-100 overflow-hidden">
                                    <div
                                        className="h-full rounded bg-sky-500/80"
                                        style={{ width: `${Math.min(100, (p.reached / funnelBase) * 100)}%` }}
                                    />
                                </div>
                                <span className="w-16 shrink-0 text-end font-mono text-[12px] tabular-nums text-slate-700">
                                    {p.reached.toLocaleString()}
                                </span>
                                <span
                                    className="w-16 shrink-0 text-end font-mono text-[11px] tabular-nums text-slate-400"
                                    title="מתוך המבקרים שהגיעו לשלב זה, שיעור הממשיכים להגשה"
                                >
                                    {pct(p.completed_from, p.reached)}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <CountList label="מקורות תנועה" items={s.sources} render={(k) => k} />
                <CountList label="קמפיינים" items={s.campaigns} render={(k) => k} />
                <CountList
                    label="מדינות"
                    items={s.countries}
                    render={(k) => `${flagEmoji(k)} ${k.toUpperCase()}`.trim()}
                />
                <CountList
                    label="מכשירים"
                    items={s.devices}
                    render={(k) => (k ? k.charAt(0).toUpperCase() + k.slice(1) : k)}
                />
            </div>

            <section className="space-y-2">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">
                    מבקרים מזוהים
                </div>
                {s.identified.length === 0 ? (
                    <EmptyBlock
                        title="אין עדיין מבקרים מזוהים"
                        body="שלח טופס זה באמצעות קמפיין, או העתק קישור אישי בלשונית השיתוף."
                    />
                ) : (
                    <div className="rounded-md border border-slate-200 overflow-hidden bg-white">
                        <table className="w-full text-start">
                            <thead>
                                <tr className="border-b border-slate-200">
                                    <Vth className="max-w-0 w-full text-start">איש קשר</Vth>
                                    <Vth className="w-40 hidden md:table-cell text-start">קמפיין</Vth>
                                    <Vth className="w-40 hidden sm:table-cell text-start">התקדמות</Vth>
                                    <Vth className="w-24 text-start">נראה לאחרונה</Vth>
                                    <Vth className="w-24 text-start">הושלם</Vth>
                                </tr>
                            </thead>
                            <tbody>
                                {s.identified.map((v) => (
                                    <tr
                                        key={v.contact_id}
                                        onClick={() => navigate("/app/contacts")}
                                        className="h-11 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/80 cursor-pointer transition-colors"
                                    >
                                        <td className="px-3 max-w-0 w-full text-start">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <InitialsAvatar name={v.name} email={v.email} />
                                                <div className="min-w-0">
                                                    <div className="text-[12.5px] font-medium text-slate-900 truncate leading-tight">
                                                        {v.name || v.email || "אנונימי"}
                                                    </div>
                                                    {v.email && v.name && (
                                                        <div className="text-[11px] text-slate-500 truncate">{v.email}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 hidden md:table-cell">
                                            {v.campaign ? (
                                                <span className="inline-flex items-center h-4 px-1.5 rounded bg-sky-50 text-sky-700 text-[10px] font-medium max-w-36">
                                                    <span className="truncate">{v.campaign}</span>
                                                </span>
                                            ) : (
                                                <span className="text-[11px] text-slate-300">–</span>
                                            )}
                                        </td>
                                        <td className="px-3 hidden sm:table-cell">
                                            {totalPages > 1 ? (
                                                <MiniProgress
                                                    done={v.completed ? totalPages : v.furthest_page + 1}
                                                    total={totalPages}
                                                />
                                            ) : (
                                                <span className="text-[11px] text-slate-300">–</span>
                                            )}
                                        </td>
                                        <td
                                            className="px-3 text-[12px] text-slate-500 whitespace-nowrap"
                                            title={new Date(v.last_seen).toLocaleString("he-IL")}
                                        >
                                            {timeAgo(v.last_seen)}
                                        </td>
                                        <td className="px-3">
                                            {v.completed ? (
                                                <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
                                            ) : (
                                                <span className="text-[12px] text-slate-400">–</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}

function StatCell({ label, value, last = false }: { label: string; value: React.ReactNode; last?: boolean }) {
    return (
        <div className={`px-4 py-3 ${last ? "" : "border-e border-slate-200"}`}>
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">{label}</div>
            <div className="text-[20px] text-slate-900 font-light leading-none mt-1.5 tabular-nums">{value}</div>
        </div>
    );
}

// One breakdown card: label header, top 8 keys with a proportional hairline bar.
function CountList({
    label,
    items,
    render,
}: {
    label: string;
    items: { key: string; count: number }[];
    render: (key: string) => string;
}) {
    const top = (items ?? []).slice(0, 8);
    const max = Math.max(1, ...top.map((i) => i.count));
    return (
        <div className="rounded-md border border-slate-200 bg-white p-3 min-h-32">
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium mb-2">{label}</div>
            {top.length === 0 ? (
                <div className="py-6 text-center text-[11.5px] text-slate-400">אין נתונים עדיין</div>
            ) : (
                <div className="space-y-1.5">
                    {top.map((i) => (
                        <div key={i.key}>
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[12px] text-slate-700 truncate">{render(i.key) || "לא ידוע"}</span>
                                <span className="font-mono text-[11px] tabular-nums text-slate-500 shrink-0">
                                    {i.count.toLocaleString()}
                                </span>
                            </div>
                            <div className="mt-0.5 h-px bg-slate-100">
                                <div className="h-px bg-sky-400/70" style={{ width: `${(i.count / max) * 100}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function Vth({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <th
            className={`px-3 py-2 text-[10px] font-medium text-slate-400 uppercase tracking-[0.14em] ${className ?? ""}`}
        >
            {children}
        </th>
    );
}
