// A mailbox's warmup deliverability: where its warmup mail landed, day by day
// and per recipient provider, and the trailing inbox rate behind the list's
// percentage. Live: WARMUP_PLACEMENT events refresh the query.
import { useMemo, useState, type ReactNode } from "react";
import { InboxIcon } from "lucide-react";
import { DitherRing } from "@/components/ui/dither";
import { Loading } from "@/components/loader";
import useWarmupPlacement from "@/lib/api/hooks/app/analytics/useWarmupPlacement";
import type { WarmupHealthInfo } from "@/lib/api/models/app/analytics/AccountStatus";
import type { PlacementGroup } from "@/lib/api/models/app/analytics/WarmupPlacement";
import { cn } from "@/lib/utils";
import {
    BAND,
    GROUP_LABEL,
    GROUP_ORDER,
    RANGES,
    bandForRate,
    fmtNum,
    fmtPct,
    rateSentence,
    totals,
    utcWindow,
    viewDays,
    type GroupFilter,
    type RangeKey,
} from "./placement";
import { BandChip, GroupFilterChips, LandedLegend, PlacementColumns, ProviderBreakdown, RangeTabs, RateTrend } from "./PlacementCharts";

const POOL_STATE_LABEL: Record<string, string> = {
    watch: "מצב במאגר: במעקב",
    throttled: "מצב במאגר: מואט",
    quarantined: "מצב במאגר: בהסגר",
    blocked: "מצב במאגר: חסום",
};

export default function MailboxPlacementTab({ mailboxId, poolHealth }: { mailboxId: string; poolHealth?: WarmupHealthInfo }) {
    const [range, setRange] = useState<RangeKey>("30d");
    const [group, setGroup] = useState<GroupFilter>("all");
    const days = RANGES.find((r) => r.key === range)?.days ?? 30;
    const { from, to } = useMemo(() => utcWindow(days), [days]);
    const q = useWarmupPlacement(mailboxId, from, to);
    const report = q.data;

    const groups = useMemo<PlacementGroup[]>(
        () => GROUP_ORDER.filter((g) => report?.providers.some((p) => p.group === g && p.delivered > 0)),
        [report],
    );
    const activeGroup: GroupFilter = group !== "all" && !groups.includes(group) ? "all" : group;
    const view = useMemo(
        () => (report ? viewDays(report.daily, activeGroup, report.rate.min_sample, report.rate.window_days) : []),
        [report, activeGroup],
    );
    const t = useMemo(() => totals(view), [view]);

    if (q.isPending) {
        return (
            <div className="py-20 flex items-center justify-center">
                <Loading className="w-5 h-5 text-sky-500" />
            </div>
        );
    }
    if (q.isError || !report) {
        return (
            <div className="px-5 py-16 text-center">
                <p className="text-[12.5px] text-slate-700 font-medium">לא ניתן לטעון את נתוני המיקום</p>
                <button
                    type="button"
                    onClick={() => q.refetch()}
                    className="mt-3 h-7 px-3 rounded-md border border-slate-200 hover:border-slate-300 text-[12px] text-slate-700"
                >
                    נסה שוב
                </button>
            </div>
        );
    }

    const rate = report.rate;
    const style = BAND[rate.band];
    const everDelivered = report.summary.delivered > 0 || rate.delivered > 0;
    const filtered = activeGroup !== "all";

    return (
        <div className="divide-y divide-slate-200/60">
            {/* Headline: the trailing rate the list shows, and what it is made of. */}
            <div className="px-5 py-4 flex items-center gap-4">
                <DitherRing frac={rate.inbox_rate != null ? rate.inbox_rate / 100 : 0} size={84} thickness={7} tone={style.tone}>
                    <div className="text-center leading-none">
                        <div className={cn("text-[19px] font-light tabular-nums", rate.inbox_rate != null ? "text-slate-900" : "text-slate-300")}>
                            {rate.inbox_rate != null ? `${Math.floor(rate.inbox_rate)}%` : "—"}
                        </div>
                        <div className="mt-1 text-[8.5px] uppercase tracking-[0.14em] text-slate-400">דואר נכנס</div>
                    </div>
                </DitherRing>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <BandChip band={rate.band} />
                        {poolHealth && POOL_STATE_LABEL[poolHealth.state] && (
                            <span className="inline-flex items-center rounded px-1.5 h-5 text-[10px] font-medium border bg-orange-50 text-orange-700 border-orange-200" title={poolHealth.reason}>
                                {POOL_STATE_LABEL[poolHealth.state]}
                            </span>
                        )}
                    </div>
                    <p className="mt-2 text-[12.5px] text-slate-700 leading-snug">{rateSentence(rate)}</p>
                    {rate.inbox_rate == null && rate.delivered > 0 && (
                        <div className="mt-2 h-1 w-full max-w-[220px] rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full bg-slate-400 transition-all" style={{ width: `${Math.min(100, (rate.delivered / rate.min_sample) * 100)}%` }} />
                        </div>
                    )}
                    {rate.inbox_rate != null && (
                        <p className="mt-1 text-[11px] text-slate-400 font-mono tabular-nums">
                            {fmtNum(rate.spam)} בספאם · {fmtNum(rate.tabs)} בלשוניות אחרות · 90%+ נחשב תקין
                        </p>
                    )}
                </div>
            </div>

            {!everDelivered ? (
                <div className="px-5 py-14 text-center">
                    <InboxIcon className="w-5 h-5 text-slate-300 mx-auto mb-2" />
                    <p className="text-[12.5px] text-slate-700 font-medium">אין מסירות חימום בחלון זמן זה</p>
                    <p className="text-[11.5px] text-slate-400 mt-1 max-w-[40ch] mx-auto leading-relaxed">
                        כל מייל חימום שתיבה זו שולחת נבדק בתיבת הדואר של השותף. ברגע שהם יתחילו להגיע תוכל לראות
                        אם כל אחד הגיע לתיבת הדואר הנכנס, ללשונית אחרת או לספאם, ובאיזה ספק.
                    </p>
                    <div className="mt-4 flex justify-center">
                        <RangeTabs value={range} onChange={setRange} />
                    </div>
                </div>
            ) : (
                <>
                    {/* Controls */}
                    <div className="px-5 py-2.5 flex items-center gap-2">
                        <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">היסטוריה</span>
                        <GroupFilterChips value={activeGroup} onChange={setGroup} groups={groups} className="ms-auto" />
                        <RangeTabs value={range} onChange={setRange} className="shrink-0" />
                    </div>

                    {/* Window counts, narrowed by the provider filter */}
                    <div className="grid grid-cols-3 divide-x rtl:divide-x-reverse divide-y divide-slate-200/60 [&>*:nth-child(-n+3)]:border-t-0">
                        <Cell label="נמסרו" value={fmtNum(t.delivered)} sub={filtered ? `אצל ${GROUP_LABEL[activeGroup]}` : `מתוך ${fmtNum(t.sent)} שנשלחו`} />
                        <Cell label="שיעור דואר נכנס" value={fmtPct(t.inboxRate)} sub={`${fmtNum(t.inbox)} בתיבה הראשית`} tone={BAND[bandForRate(t.inboxRate)].text} />
                        <Cell label="ספאם" value={fmtNum(t.spam)} sub={t.spamRate != null ? `${fmtPct(t.spamRate)} מהנמסרים` : "לא נמסרו"} tone={t.spam > 0 ? "text-rose-600" : undefined} />
                        <Cell label="לשוניות אחרות" value={fmtNum(t.tabs)} sub="קידומי מכירות, עדכונים…" />
                        <Cell label="חולצו מספאם" value={fmtNum(t.rescued)} sub={t.spam > 0 ? `חילוץ נשלח, מתוך ${fmtNum(t.spam)} בספאם` : "אין מה לחלץ"} />
                        <Cell
                            label="לא אומתו"
                            value={filtered ? "—" : fmtNum(t.unconfirmed)}
                            sub={filtered ? "לא מפוצל לפי ספק" : "נשלחו לפני 24+ שעות, לא זוהו"}
                        />
                    </div>

                    <div className="px-5 py-4">
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <Eyebrow>היכן נחת בכל יום</Eyebrow>
                            <LandedLegend />
                        </div>
                        <PlacementColumns days={view} height={120} />
                    </div>

                    <div className="px-5 py-4">
                        <div className="mb-3">
                            <Eyebrow>שיעור דואר נכנס לאורך זמן</Eyebrow>
                        </div>
                        <RateTrend days={view} windowDays={rate.window_days} height={110} />
                    </div>

                    <div>
                        <div className="px-5 pt-4 pb-2">
                            <Eyebrow>לפי ספק נמען</Eyebrow>
                        </div>
                        <ProviderBreakdown providers={report.providers} />
                    </div>
                </>
            )}

            <div className="px-5 py-4">
                <Eyebrow>איך זה נמדד</Eyebrow>
                <ul className="mt-2 space-y-1.5 text-[11.5px] text-slate-500 leading-relaxed">
                    <li>כל מייל חימום מאותר בתיבת הדואר של השותף ומתועד היכן הגיע: תיבת הדואר הנכנס, לשונית קטגוריה ב-Gmail או ספאם. דבר אינו משוער.</li>
                    <li>שיעור הדואר הנכנס מחשיב לשוניות קטגוריה כדואר נכנס, לאורך {rate.window_days} הימים האחרונים, ומופיע לאחר {rate.min_sample} מסירות. מתחת ל-90% כדאי לעקוב; מתחת ל-80% משמעו שהתיבה דורשת תשומת לב.</li>
                    <li>חולצו מספאם סופר הודעות שנחתו בספאם ותיבת השותף הונחתה להעבירן חזרה לדואר הנכנס, שזהו האות שממנו ספקי הדואר לומדים; ההעברה מתבקשת אך אינה מאומתת בחזרה. דואר שלא אומת לא נראה בתיבת השותף יממה לאחר שליחתו.</li>
                    <li>הימים מחושבים לפי UTC. נתונים אלו מכסים דואר חימום בלבד, ולא שליחות קמפיינים.</li>
                </ul>
            </div>
        </div>
    );
}

function Eyebrow({ children }: { children: ReactNode }) {
    return <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">{children}</span>;
}

function Cell({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
    return (
        <div className="px-4 py-3.5 min-w-0">
            <Eyebrow>{label}</Eyebrow>
            <div className={cn("mt-1 text-[22px] font-light leading-none tabular-nums", tone ?? "text-slate-900")}>{value}</div>
            {sub && <div className="mt-1.5 text-[10.5px] text-slate-400 font-mono truncate" title={sub}>{sub}</div>}
        </div>
    );
}
