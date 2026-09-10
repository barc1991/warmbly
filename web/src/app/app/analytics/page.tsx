import { NoAccess } from "@/components/layout/NoAccess";
import { usePermission } from "@/hooks/usePermission";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    ActivityIcon,
    AlertTriangleIcon,
    ArrowUpRightIcon,
    Loader2Icon,
    MailCheckIcon,
    MousePointerClickIcon,
    RefreshCcwIcon,
    ReplyIcon,
    SendIcon,
    TriangleAlertIcon,
} from "lucide-react";
import {
    EmptyBlock,
    Page,
    PageBody,
    PageTopbar,
    SectionBar,
    Stat,
    StatStrip,
} from "@/components/layout/Page";
import { MultiTrend, type TrendSeries } from "@/components/ui/charts";
import { TONE_DOT } from "@/components/ui/tones";
import type { DitherTone } from "@/components/ui/dither";
import AnalyticsShareButton from "@/components/app/analytics/AnalyticsShareButton";
import useDashboard from "@/lib/api/hooks/app/analytics/useDashboard";

const AUTO_OPENS_TIP = "פתיחות אוטומטיות: טעינת פיקסל משרתי פרוקסי של פרטיות (כגון Apple Mail) או שניות ספורות לאחר השליחה, לא קריאה אנושית";
const AUTO_CLICKS_TIP = "לחיצות אוטומטיות: קישורים שנפתחו על ידי שער אבטחה הסורק את הדוא״ל, לא אדם; לא נספרות כלחיצות";

type Range = "7d" | "30d" | "90d";
type Metric = "sent" | "opens" | "clicks" | "replies";

const RANGE_LABEL: Record<Range, string> = {
    "7d": "7 הימים האחרונים",
    "30d": "30 הימים האחרונים",
    "90d": "90 הימים האחרונים",
};

const METRICS: { key: Metric; label: string; tone: DitherTone }[] = [
    { key: "sent", label: "נשלחו", tone: "sky" },
    { key: "opens", label: "נפתחו", tone: "emerald" },
    { key: "clicks", label: "נלחצו", tone: "violet" },
    { key: "replies", label: "נענו", tone: "amber" },
];

function pct(v: number | undefined): string {
    return v == null ? "-" : `${v.toFixed(1)}%`;
}
function num(v: number | undefined): string {
    return (v ?? 0).toLocaleString();
}

export default function AnalyticsPage() {
    const canView = usePermission("VIEW_ANALYTICS");
    const [range, setRange] = useState<Range>("7d");
    // Legend toggles: every metric charts together; hidden ones drop out.
    const [hiddenMetrics, setHiddenMetrics] = useState<Metric[]>([]);
    const dash = useDashboard(range);
    const d = dash.data;
    const os = d?.overall_stats;

    const toggleMetric = (k: Metric) =>
        setHiddenMetrics((cur) => {
            if (cur.includes(k)) return cur.filter((x) => x !== k);
            // Keep at least one series on the graph.
            if (cur.length >= METRICS.length - 1) return cur;
            return [...cur, k];
        });

    const trend = useMemo(() => {
        const rows = d?.daily_trend ?? [];
        const series: TrendSeries[] = METRICS.filter((m) => !hiddenMetrics.includes(m.key)).map((m) => ({
            key: m.key,
            label: m.label,
            tone: m.tone,
            values: rows.map((p) => p[m.key] ?? 0),
        }));
        return { labels: rows.map((p) => p.date), series };
    }, [d?.daily_trend, hiddenMetrics]);

    const breakdown = [
        { label: "נשלחו", value: os?.total_emails_sent, icon: SendIcon, dot: "bg-slate-400" },
        { label: "נפתחו", value: os?.total_opens, icon: MailCheckIcon, dot: "bg-emerald-500", note: os?.machine_opens ? `${num(os.machine_opens)} אוטומטי` : undefined, noteTitle: AUTO_OPENS_TIP },
        { label: "נלחצו", value: os?.total_clicks, icon: MousePointerClickIcon, dot: "bg-violet-500", note: os?.machine_clicks ? `${num(os.machine_clicks)} אוטומטי` : undefined, noteTitle: AUTO_CLICKS_TIP },
        { label: "תשובות", value: os?.total_replies, icon: ReplyIcon, dot: "bg-amber-500" },
        { label: "החזרות (Bounces)", value: os?.total_bounces, icon: TriangleAlertIcon, dot: "bg-rose-500" },
    ];

    const shareData = {
        title: "ביצועי סביבת העבודה",
        subtitle: RANGE_LABEL[range],
        metrics: [
            { label: "נשלחו", value: num(os?.total_emails_sent), sub: "הודעות דוא״ל" },
            { label: "שיעור פתיחה", value: pct(os?.open_rate) },
            { label: "שיעור מענה", value: pct(os?.reply_rate) },
            { label: "שיעור החזרות", value: pct(os?.bounce_rate) },
        ],
        daily: (d?.daily_trend ?? []).map((p) => ({ label: p.date, value: p.sent })),
    };

    if (!canView) return <NoAccess feature="analytics" permissionLabel="צפייה בניתוחים ונתונים" />;

    return (
        <Page>
            <PageTopbar eyebrow="ניתוח נתונים" subtitle="עבירות וביצועי מסירה בסביבת העבודה">
                <RangeTabs value={range} onChange={setRange} />
                <AnalyticsShareButton data={shareData} filename={`warmbly-analytics-${range}.png`} />
            </PageTopbar>

            <StatStrip cols={4}>
                <Stat label="סך הכל נשלחו" value={num(os?.total_emails_sent)} sub="בטווח שנבחר" accent={!!os && os.total_emails_sent > 0} />
                <Stat label="שיעור פתיחה" value={pct(os?.open_rate)} sub="לאחר מסירה" />
                <Stat label="שיעור מענה" value={pct(os?.reply_rate)} sub="כולל מענה חיובי" />
                <Stat label="שיעור החזרות" value={pct(os?.bounce_rate)} sub="קשות ורכות" last />
            </StatStrip>

            {dash.isError ? (
                <PageBody>
                    <ErrorState onRetry={() => dash.refetch()} isRefetching={dash.isFetching} />
                </PageBody>
            ) : (
                <>
                    <div className="grid lg:grid-cols-[1fr_300px] min-h-0 flex-1">
                        <section className="flex flex-col min-h-0 lg:border-e lg:border-slate-200">
                            <SectionBar label="ביצועי דוא״ל">
                                <div className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 p-0.5 max-w-full overflow-x-auto">
                                    {METRICS.map((m) => {
                                        const visible = !hiddenMetrics.includes(m.key);
                                        return (
                                            <button
                                                key={m.key}
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
                            <div className="flex-1 px-5 py-4">
                                {dash.isPending ? (
                                    <div className="h-[280px] rounded-md bg-slate-50 animate-pulse" />
                                ) : (
                                    <MultiTrend
                                        labels={trend.labels}
                                        series={trend.series}
                                        height={280}
                                        emptyLabel="אין שליחות בטווח זמנים זה עדיין"
                                    />
                                )}
                            </div>
                        </section>

                        <aside className="flex flex-col min-h-0 bg-slate-50/40">
                            <SectionBar label="פילוח נתונים" />
                            <div className="divide-y divide-slate-200/60">
                                {breakdown.map((q) => (
                                    <div key={q.label} className="h-9 px-4 flex items-center gap-2">
                                        <span className={`size-1.5 rounded-full ${q.dot}`} />
                                        <span className="text-[12px] text-slate-700">{q.label}</span>
                                        {"note" in q && q.note && (
                                            <span
                                                className="text-[9.5px] text-slate-400 font-mono"
                                                title={q.noteTitle}
                                            >
                                                {q.note}
                                            </span>
                                        )}
                                        <span className="ms-auto font-mono text-[11px] text-slate-500 tabular-nums">
                                            {dash.isPending ? "-" : num(q.value)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            {d?.account_health && (
                                <>
                                    <SectionBar label="בריאות חשבונות" />
                                    <div className="px-4 py-3 grid grid-cols-3 gap-2 text-center">
                                        <HealthCell n={d.account_health.healthy_accounts} label="תקין" tone="text-emerald-600" />
                                        <HealthCell n={d.account_health.warning_accounts} label="בסיכון" tone="text-amber-600" />
                                        <HealthCell n={d.account_health.error_accounts} label="בעיות" tone="text-rose-600" />
                                    </div>
                                </>
                            )}
                        </aside>
                    </div>

                    <SectionBar label="קמפיינים מובילים">
                        <Link
                            to="/app/campaigns"
                            className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-900 transition-colors"
                        >
                            כל הקמפיינים
                            <ArrowUpRightIcon className="w-3 h-3 rtl:rotate-[-90deg]" />
                        </Link>
                    </SectionBar>
                    {dash.isPending ? (
                        <div className="divide-y divide-slate-200/60">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="h-11 px-5 flex items-center gap-3">
                                    <div className="size-1.5 rounded-full bg-slate-200" />
                                    <div className="h-3 w-40 bg-slate-100 rounded animate-pulse" />
                                    <div className="ms-auto h-3 w-24 bg-slate-100 rounded animate-pulse" />
                                </div>
                            ))}
                        </div>
                    ) : (d?.top_campaigns?.length ?? 0) === 0 ? (
                        <EmptyBlock title="אין עדיין שליחות של קמפיינים" body="ברגע שקמפיין יתחיל לשלוח, הביצועים הטובים ביותר יוצגו כאן." />
                    ) : (
                        <div className="divide-y divide-slate-200/60">
                            {d!.top_campaigns.map((c) => {
                                const dot =
                                    c.status === "active" ? "bg-emerald-500" : c.status === "paused" ? "bg-amber-500" : "bg-slate-300";
                                return (
                                    <Link
                                        key={c.campaign_id}
                                        to={`/app/campaigns/${c.campaign_id}`}
                                        className="group h-11 px-5 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                                    >
                                        <span className={`size-1.5 rounded-full shrink-0 ${dot}`} />
                                        <span className="text-[12.5px] font-medium text-slate-900 truncate max-w-[40%]">{c.name}</span>
                                        <span className="ms-auto flex items-center gap-2 md:gap-4 font-mono text-[11px] text-slate-500 tabular-nums shrink-0">
                                            <span title="הודעות שנשלחו">{num(c.emails_sent)} נשלחו</span>
                                            <span title="שיעור פתיחה" className="hidden md:inline text-emerald-600">{pct(c.open_rate)} פתיחה</span>
                                            <span title="שיעור מענה" className="text-amber-600">{pct(c.reply_rate)} מענה</span>
                                        </span>
                                    </Link>
                                );
                            })}
                        </div>
                    )}

                    <SectionBar label="פעילות אחרונה" />
                    <PageBody>
                        {dash.isPending ? (
                            <div className="divide-y divide-slate-200/60">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="h-10 px-5 flex items-center gap-3">
                                        <div className="size-4 rounded-full bg-slate-100" />
                                        <div className="h-3 w-64 bg-slate-100 rounded animate-pulse" />
                                    </div>
                                ))}
                            </div>
                        ) : (d?.recent_activity?.length ?? 0) === 0 ? (
                            <EmptyBlock title="אין פעילות עדיין" body="פתיחות, לחיצות, תשובות והחזרות יזרמו לכאן בזמן שהקמפיינים שלך שולחים." />
                        ) : (
                            <div className="divide-y divide-slate-200/60">
                                {d!.recent_activity.map((a, i) => (
                                    <ActivityRow key={i} a={a} />
                                ))}
                            </div>
                        )}
                    </PageBody>
                </>
            )}
        </Page>
    );
}

function HealthCell({ n, label, tone }: { n: number; label: string; tone: string }) {
    return (
        <div>
            <div className={`font-mono text-[18px] tabular-nums leading-none ${tone}`}>{n}</div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-slate-400 mt-1">{label}</div>
        </div>
    );
}

const ACTIVITY_TONE: Record<string, { tone: string; verb: string }> = {
    sent: { tone: "text-slate-500", verb: "נשלח אל" },
    opened: { tone: "text-emerald-600", verb: "נפתח על ידי" },
    clicked: { tone: "text-violet-600", verb: "נלחץ על ידי" },
    replied: { tone: "text-amber-600", verb: "תשובה מאת" },
    bounced: { tone: "text-rose-600", verb: "הוחזר (Bounced)" },
};

function ActivityRow({ a }: { a: { type: string; campaign_name: string; contact_email: string; timestamp: string } }) {
    const meta = ACTIVITY_TONE[a.type] ?? { tone: "text-slate-500", verb: a.type };
    return (
        <div className="h-10 px-5 flex items-center gap-3">
            <ActivityIcon className={`w-3.5 h-3.5 shrink-0 ${meta.tone}`} />
            <span className="text-[12.5px] text-slate-900 truncate">
                <span className={meta.tone}>{meta.verb}</span> {a.contact_email}
            </span>
            <span className="text-[11.5px] text-slate-400 truncate hidden md:inline">{a.campaign_name}</span>
            <span className="ms-auto font-mono text-[10.5px] text-slate-400 tabular-nums shrink-0">
                <span className="md:hidden">
                    {new Date(a.timestamp).toLocaleString("he-IL", { month: "short", day: "numeric" })}
                </span>
                <span className="hidden md:inline">
                    {new Date(a.timestamp).toLocaleString("he-IL", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
            </span>
        </div>
    );
}

function RangeTabs({ value, onChange }: { value: Range; onChange: (v: Range) => void }) {
    const opts: Range[] = ["7d", "30d", "90d"];
    return (
        <div className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 p-0.5">
            {opts.map((o) => (
                <button
                    key={o}
                    onClick={() => onChange(o)}
                    className={`h-7 px-2.5 rounded text-[12px] font-medium transition-colors ${
                        value === o ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                    }`}
                >
                    {RANGE_LABEL[o]}
                </button>
            ))}
        </div>
    );
}

function ErrorState({ onRetry, isRefetching }: { onRetry: () => void; isRefetching: boolean }) {
    return (
        <div className="px-5 py-12 text-center">
            <div className="mx-auto mb-3 size-8 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertTriangleIcon className="w-4 h-4" />
            </div>
            <p className="text-[12.5px] text-slate-900 font-medium">לא ניתן לטעון נתוני אנליטיקה</p>
            <p className="text-[11.5px] text-slate-500 mt-1 max-w-[44ch] mx-auto leading-relaxed">
                הבקשה נכשלה. ייתכן שהשרת אינו זמין או שהחזיר שגיאה.
            </p>
            <button
                type="button"
                onClick={onRetry}
                disabled={isRefetching}
                className="mt-4 h-7 px-2.5 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
            >
                {isRefetching ? <Loader2Icon className="w-3 h-3 animate-spin" /> : <RefreshCcwIcon className="w-3 h-3" />}
                נסה שוב
            </button>
        </div>
    );
}
