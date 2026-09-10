import { useMemo, useState } from "react";
import {
    MailCheckIcon,
    MousePointerClickIcon,
    ReplyIcon,
    SendIcon,
    TriangleAlertIcon,
} from "lucide-react";
import { useCampaign } from "@/hooks/context/campaign";
import useCampaignAnalytics from "@/lib/api/hooks/app/analytics/useCampaignAnalytics";
import type { CampaignEngagementBreakdown, EngagementBucket } from "@/lib/api/models/app/analytics/CampaignAnalytics";
import useCampaignDailyStats from "@/lib/api/hooks/app/analytics/useCampaignDailyStats";
import { SectionBar, Stat, StatStrip } from "@/components/layout/Page";
import { MultiTrend, type TrendSeries } from "@/components/ui/charts";
import { TONE_DOT } from "@/components/ui/tones";
import type { DitherTone } from "@/components/ui/dither";
import AnalyticsShareButton from "@/components/app/analytics/AnalyticsShareButton";
import TaskPreview from "@/components/app/campaigns/TaskPreview";
import CampaignFormsPanel from "@/components/app/campaigns/CampaignFormsPanel";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import AdvisorStrip from "@/components/app/advisor/AdvisorStrip";

const AUTO_OPENS_TIP = "פתיחות אוטומטיות: טעינת פיקסל מפרוקסי פרטיות (כגון Apple Mail) או תוך שניות מהשליחה, לא קריאה של אדם אמיתי";
const AUTO_CLICKS_TIP = "לחיצות אוטומטיות: קישורים שנסרקו על ידי שער אבטחה הסורק את האימייל; אינן נספרות כלחיצות של אדם אמיתי";

const pctFmt = (v: number) => `${v.toFixed(1)}%`;

type Metric = "sent" | "opens" | "clicks" | "replies";

const METRICS: { key: Metric; label: string; tone: DitherTone }[] = [
    { key: "sent", label: "נשלחו", tone: "sky" },
    { key: "opens", label: "פתיחות", tone: "emerald" },
    { key: "clicks", label: "לחיצות", tone: "violet" },
    { key: "replies", label: "מענים", tone: "amber" },
];

function pct(v: number | undefined): string {
    return v == null ? "—" : `${v.toFixed(1)}%`;
}
function num(v: number | undefined): string {
    return (v ?? 0).toLocaleString();
}

export default function CampaignOverview() {
    const campaign = useCampaign();
    const id = campaign?.id ?? "";

    const analytics = useCampaignAnalytics(id);
    const daily = useCampaignDailyStats(id);

    // Legend toggles: every metric charts together; hidden ones drop out.
    const [hiddenMetrics, setHiddenMetrics] = useState<Metric[]>([]);
    const toggleMetric = (k: Metric) =>
        setHiddenMetrics((cur) => {
            if (cur.includes(k)) return cur.filter((x) => x !== k);
            // Keep at least one series on the graph.
            if (cur.length >= METRICS.length - 1) return cur;
            return [...cur, k];
        });

    const summary = analytics.data?.summary;
    const sequences = analytics.data?.steps ?? [];
    const dailyStats = daily.data ?? [];

    const trend = useMemo(() => {
        const rows = daily.data ?? [];
        const series: TrendSeries[] = METRICS.filter((m) => !hiddenMetrics.includes(m.key)).map((m) => ({
            key: m.key,
            label: m.label,
            tone: m.tone,
            values: rows.map((d) => d[m.key] ?? 0),
        }));
        return { labels: rows.map((d) => d.date), series };
    }, [daily.data, hiddenMetrics]);

    const loading = analytics.isPending || daily.isPending;
    const hasSends = (summary?.emails_sent ?? 0) > 0;

    const shareData = {
        title: campaign?.name ?? "קמפיין",
        subtitle: "קמפיין",
        metrics: [
            { label: "נשלחו", value: num(summary?.emails_sent), sub: "הודעות" },
            { label: "אחוז פתיחה", value: pct(summary?.open_rate) },
            { label: "אחוז מענה", value: pct(summary?.reply_rate) },
            { label: "אחוז החזרות", value: pct(summary?.bounce_rate) },
        ],
        daily: dailyStats.map((d) => ({ label: d.date, value: d.sent })),
    };

    if (!campaign) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-slate-200 rounded-md overflow-hidden">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-20 bg-white animate-pulse" />
                    ))}
                </div>
                <div className="h-56 bg-slate-100 rounded-md animate-pulse" />
            </div>
        );
    }

    const breakdown = [
        { label: "נשלחו", value: summary?.emails_sent, icon: SendIcon, dot: "bg-slate-400" },
        { label: "פתיחות", value: summary?.unique_opens, icon: MailCheckIcon, dot: "bg-emerald-500", note: summary?.machine_opens ? `${summary.machine_opens} אוטומטי` : undefined, noteTitle: AUTO_OPENS_TIP },
        { label: "לחיצות", value: summary?.unique_clicks, icon: MousePointerClickIcon, dot: "bg-violet-500", note: summary?.machine_clicks ? `${summary.machine_clicks} אוטומטי` : undefined, noteTitle: AUTO_CLICKS_TIP },
        { label: "מענים", value: summary?.replies, icon: ReplyIcon, dot: "bg-amber-500" },
        { label: "החזרות", value: summary?.bounces, icon: TriangleAlertIcon, dot: "bg-rose-500" },
    ];

    return (
        <div className="space-y-5">
            {/* What the Advisor has found about THIS campaign, above the numbers
                that motivated it. Renders nothing when there is nothing wrong. */}
            <AdvisorStrip entityType="campaign" entityId={id} title="" limit={3} compact />

            <div className="grid lg:grid-cols-[1fr_340px] gap-5 items-start">
                {/* Main analytics column */}
                <div className="space-y-5 min-w-0">
                    <div className="rounded-md border border-slate-200 overflow-hidden bg-white">
                        <SectionBar label="ביצועים">
                            {campaign.status === "active" && (
                                <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-emerald-600 me-1">
                                    <span className="relative flex size-1.5">
                                        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 animate-ping" />
                                        <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                                    </span>
                                    פעיל עכשיו
                                </span>
                            )}
                            <AnalyticsShareButton
                                data={shareData}
                                filename={`warmbly-${campaign.id}.png`}
                            />
                        </SectionBar>
                        <StatStrip cols={5}>
                            <Stat
                                label="נשלחו"
                                value={loading ? "—" : <AnimatedNumber value={summary?.emails_sent ?? 0} />}
                                sub="הודעות"
                                accent={hasSends}
                            />
                            <Stat
                                label="אחוז פתיחה"
                                value={loading ? "—" : <AnimatedNumber value={summary?.open_rate ?? 0} format={pctFmt} />}
                                sub="לאחר מסירה"
                            />
                            <Stat
                                label="אחוז לחיצה"
                                value={loading ? "—" : <AnimatedNumber value={summary?.click_rate ?? 0} format={pctFmt} />}
                                sub="מהנמסרות"
                            />
                            <Stat
                                label="אחוז מענה"
                                value={loading ? "—" : <AnimatedNumber value={summary?.reply_rate ?? 0} format={pctFmt} />}
                                sub="כולל חיובי"
                            />
                            <Stat
                                label="אחוז החזרות"
                                value={loading ? "—" : <AnimatedNumber value={summary?.bounce_rate ?? 0} format={pctFmt} />}
                                sub="קשות ורכות"
                                last
                            />
                        </StatStrip>
                    </div>

                    {analytics.isError ? (
                        <div className="rounded-md border border-rose-200 bg-rose-50/40 px-5 py-8 text-center">
                            <p className="text-[12.5px] text-slate-900 font-medium">לא ניתן לטעון נתוני ניתוח</p>
                            <p className="text-[11.5px] text-slate-500 mt-1">הבקשה נכשלה — נסה לרענן את העמוד.</p>
                        </div>
                    ) : (
                        <div className="rounded-md border border-slate-200 overflow-hidden bg-white">
                            <SectionBar label="ביצועים יומיים">
                                <div className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 p-0.5">
                                    {METRICS.map((m) => {
                                        const visible = !hiddenMetrics.includes(m.key);
                                        return (
                                            <button
                                                key={m.key}
                                                type="button"
                                                onClick={() => toggleMetric(m.key)}
                                                className={`h-6 px-2 rounded text-[11px] font-medium transition-colors inline-flex items-center gap-1.5 ${
                                                    visible
                                                        ? "bg-white text-slate-900 shadow-sm"
                                                        : "text-slate-400 hover:text-slate-600"
                                                }`}
                                            >
                                                <span className={`size-1.5 rounded-full ${visible ? TONE_DOT[m.tone] : "bg-slate-300"}`} />
                                                {m.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </SectionBar>
                            <div className="px-5 py-4">
                                {loading ? (
                                    <div className="h-[280px] rounded-md bg-slate-50 animate-pulse" />
                                ) : (
                                    <MultiTrend
                                        labels={trend.labels}
                                        series={trend.series}
                                        height={280}
                                        emptyLabel={
                                            hasSends
                                                ? "אין פעילות בחלון זמנים זה עדיין"
                                                : "אין שליחות עדיין — הפעל את הקמפיין כדי לצפות בביצועים"
                                        }
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    <div className="rounded-md border border-slate-200 overflow-hidden bg-white">
                        <SectionBar label="ביצועי שלבים" count={sequences.length || undefined} />
                        {loading ? (
                            <div className="divide-y divide-slate-200/60">
                                {[...Array(2)].map((_, i) => (
                                    <div key={i} className="h-11 px-5 flex items-center gap-3">
                                        <div className="size-1.5 rounded-full bg-slate-200" />
                                        <div className="h-3 w-40 bg-slate-100 rounded animate-pulse" />
                                        <div className="ms-auto h-3 w-48 bg-slate-100 rounded animate-pulse" />
                                    </div>
                                ))}
                            </div>
                        ) : sequences.length === 0 ? (
                            <div className="px-5 py-10 text-center">
                                <p className="text-[12.5px] text-slate-700 font-medium mb-1">אין נתוני שלבים עדיין</p>
                                <p className="text-[11.5px] text-slate-400 max-w-[34ch] mx-auto leading-relaxed">
                                    ברגע שהשלבים יתחילו לשלוח, פתיחות, לחיצות ומענים לפי שלב יוצגו כאן.
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-200/60">
                                {/* header row */}
                                <div className="h-8 px-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.12em] text-slate-400 font-medium">
                                    <span className="flex-1 min-w-0">שלב</span>
                                    <span className="w-14 text-end">נשלחו</span>
                                    <span className="w-14 text-end">פתיחות</span>
                                    <span className="w-14 text-end hidden md:block">לחיצות</span>
                                    <span className="w-14 text-end">מענים</span>
                                    <span className="w-16 text-end hidden md:block">החזרות</span>
                                </div>
                                {sequences.map((s) => (
                                    <div key={s.step_id} className="h-11 px-5 flex items-center gap-3">
                                        <span className="flex items-center gap-2 flex-1 min-w-0">
                                            <span className="font-mono text-[10.5px] text-slate-400 tabular-nums shrink-0">
                                                {s.position}
                                            </span>
                                            <span className="text-[12.5px] text-slate-900 truncate">{s.name}</span>
                                        </span>
                                        <span className="w-14 text-end font-mono text-[11.5px] text-slate-700 tabular-nums">
                                            <AnimatedNumber value={s.emails_sent ?? 0} />
                                        </span>
                                        <span className="w-14 text-end font-mono text-[11.5px] text-emerald-600 tabular-nums">
                                            <AnimatedNumber value={s.opens ?? 0} />
                                        </span>
                                        <span className="w-14 text-end font-mono text-[11.5px] text-violet-600 tabular-nums hidden md:block">
                                            <AnimatedNumber value={s.clicks ?? 0} />
                                        </span>
                                        <span className="w-14 text-end font-mono text-[11.5px] text-amber-600 tabular-nums">
                                            <AnimatedNumber value={s.replies ?? 0} />
                                        </span>
                                        <span className="w-16 text-end font-mono text-[11.5px] text-rose-600 tabular-nums hidden md:block">
                                            <AnimatedNumber value={s.bounces ?? 0} />
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <EngagementAudience breakdown={analytics.data?.engagement ?? null} loading={loading} />

                    <CampaignFormsPanel campaignId={id} />

                    {/* quick breakdown strip below sequence table, mobile-friendly summary */}
                    <div className="rounded-md border border-slate-200 overflow-hidden bg-white lg:hidden">
                        <SectionBar label="סיכומים" />
                        <div className="divide-y divide-slate-200/60">
                            {breakdown.map((q) => (
                                <div key={q.label} className="h-9 px-5 flex items-center gap-2">
                                    <span className={`size-1.5 rounded-full ${q.dot}`} />
                                    <span className="text-[12px] text-slate-700">{q.label}</span>
                                    {q.note && (
                                        <span
                                            className="text-[9.5px] text-slate-400 font-mono"
                                            title={q.noteTitle}
                                        >
                                            {q.note}
                                        </span>
                                    )}
                                    <span className="ms-auto font-mono text-[11px] text-slate-500 tabular-nums">
                                        {loading ? "—" : <AnimatedNumber value={q.value ?? 0} />}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Live panel */}
                <aside className="space-y-5">
                    <TaskPreview campaignId={campaign.id} campaignStatus={campaign.status} idle={!!campaign.idle_since} />

                    <div className="rounded-md border border-slate-200 overflow-hidden bg-white hidden lg:block">
                        <SectionBar label="סיכומים" />
                        <div className="divide-y divide-slate-200/60">
                            {breakdown.map((q) => (
                                <div key={q.label} className="h-9 px-5 flex items-center gap-2">
                                    <span className={`size-1.5 rounded-full ${q.dot}`} />
                                    <span className="text-[12px] text-slate-700">{q.label}</span>
                                    {q.note && (
                                        <span
                                            className="text-[9.5px] text-slate-400 font-mono"
                                            title={q.noteTitle}
                                        >
                                            {q.note}
                                        </span>
                                    )}
                                    <span className="ms-auto font-mono text-[11px] text-slate-500 tabular-nums">
                                        {loading ? "—" : <AnimatedNumber value={q.value ?? 0} />}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}

// Country names from the browser's own locale data; the code stays as the
// fallback for anything it does not know.
const REGION_NAMES = (() => {
    try {
        return new Intl.DisplayNames(["he", "en"], { type: "region" });
    } catch {
        return null;
    }
})();

function countryName(code: string): string {
    if (!code) return "לא ידוע";
    try {
        return REGION_NAMES?.of(code.toUpperCase()) ?? code;
    } catch {
        return code;
    }
}

function bucketLabel(kind: "countries" | "clients" | "devices", key: string): string {
    if (kind === "countries") return countryName(key);
    if (!key) return "לא ידוע";
    if (kind === "devices") return key.charAt(0).toUpperCase() + key.slice(1);
    return key;
}

// Where and on what people opened and clicked: the busiest countries, mail
// clients and devices, from the per-event logs (human events only, so a
// security scanner's data centre never leads the list).
function EngagementAudience({
    breakdown,
    loading,
}: {
    breakdown: CampaignEngagementBreakdown | null;
    loading: boolean;
}) {
    const columns: { kind: "countries" | "clients" | "devices"; label: string; rows: EngagementBucket[] }[] = [
        { kind: "countries", label: "מדינה", rows: breakdown?.countries ?? [] },
        { kind: "clients", label: "תוכנת דואר", rows: breakdown?.clients ?? [] },
        { kind: "devices", label: "מכשיר", rows: breakdown?.devices ?? [] },
    ];
    const empty = columns.every((c) => c.rows.length === 0);
    return (
        <div className="rounded-md border border-slate-200 overflow-hidden bg-white">
            <SectionBar label="מי הגיב ומהיכן" />
            {loading ? (
                <div className="h-24 animate-pulse bg-slate-50" />
            ) : empty ? (
                <div className="px-5 py-8 text-center">
                    <p className="text-[12.5px] text-slate-700 font-medium mb-1">אין פתיחות או לחיצות עדיין</p>
                    <p className="text-[11.5px] text-slate-400 max-w-[36ch] mx-auto leading-relaxed">
                        ברגע שנמענים יפתחו וילחצו, כאן יוצגו המדינות, תוכנות הדואר והמכשירים שמהם הם פעלו.
                    </p>
                </div>
            ) : (
                <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x rtl:md:divide-x-reverse divide-slate-200/60">
                    {columns.map((c) => (
                        <div key={c.kind} className="min-w-0">
                            <div className="h-8 px-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.12em] text-slate-400 font-medium">
                                <span className="flex-1 min-w-0">{c.label}</span>
                                <span className="w-12 text-end">פתיחות</span>
                                <span className="w-12 text-end">לחיצות</span>
                            </div>
                            {c.rows.length === 0 ? (
                                <div className="px-5 py-3 text-[11.5px] text-slate-400">אין עדיין נתונים</div>
                            ) : (
                                <div className="divide-y divide-slate-200/60">
                                    {c.rows.map((r) => (
                                        <div key={r.key || "unknown"} className="h-9 px-5 flex items-center gap-3">
                                            <span className="flex-1 min-w-0 text-[12px] text-slate-700 truncate" title={r.key || undefined}>
                                                {bucketLabel(c.kind, r.key)}
                                            </span>
                                            <span className="w-12 text-end font-mono text-[11.5px] text-emerald-600 tabular-nums">
                                                {r.opens}
                                            </span>
                                            <span className="w-12 text-end font-mono text-[11.5px] text-violet-600 tabular-nums">
                                                {r.clicks}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
