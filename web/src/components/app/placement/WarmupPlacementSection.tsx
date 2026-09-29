// Workspace warmup placement on the deliverability page: inbox vs spam over
// time, per recipient provider, and every mailbox ranked worst first.
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRightIcon } from "lucide-react";
import { EmptyBlock, SectionBar, Stat, StatStrip } from "@/components/layout/Page";
import useWarmupPlacement from "@/lib/api/hooks/app/analytics/useWarmupPlacement";
import type { PlacementGroup, PlacementMailbox } from "@/lib/api/models/app/analytics/WarmupPlacement";
import { cn } from "@/lib/utils";
import { BAND, GROUP_LABEL, GROUP_ORDER, bandForRate, fmtNum, fmtPct, rateSentence, totals, utcWindow, viewDays, type GroupFilter } from "./placement";
import {
    BandChip,
    GroupFilterChips,
    LandedLegend,
    PlacementColumns,
    PlacementRateBadge,
    ProviderBreakdown,
    RateSpark,
    RateTrend,
} from "./PlacementCharts";

const PAGE = 25;

export default function WarmupPlacementSection({ days }: { days: number }) {
    const { from, to } = useMemo(() => utcWindow(days), [days]);
    const q = useWarmupPlacement(undefined, from, to);
    const report = q.data;
    const [group, setGroup] = useState<GroupFilter>("all");
    const [attentionOnly, setAttentionOnly] = useState(false);
    const [showAll, setShowAll] = useState(false);
    const navigate = useNavigate();

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

    const mailboxes = report?.mailboxes ?? [];
    const attention = mailboxes.filter((m) => m.rate.band === "poor" || m.rate.band === "fair");
    const listed = attentionOnly ? attention : mailboxes;
    const shown = showAll ? listed : listed.slice(0, PAGE);

    if (q.isPending) {
        return (
            <>
                <SectionBar label="מיקום חימום בתיבת הדואר" />
                <div className="px-5 py-4">
                    <div className="h-[180px] rounded-md bg-slate-50 animate-pulse" />
                </div>
            </>
        );
    }
    if (!report || report.summary.delivered === 0) {
        return (
            <>
                <SectionBar label="מיקום חימום בתיבת הדואר" />
                <EmptyBlock
                    title={q.isError ? "לא ניתן לטעון את מיקום החימום" : "אין מסירות חימום בחלון זמן זה"}
                    body="כל מייל חימום נבדק בתיבת הדואר של השותף ומתועד כדואר נכנס, לשונית אחרת ב-Gmail או ספאם, לפי ספק ולפי תיבת דואר."
                />
            </>
        );
    }

    const rate = report.rate;
    const filtered = activeGroup !== "all";

    return (
        <>
            <SectionBar label="מיקום חימום בתיבת הדואר">
                <GroupFilterChips value={activeGroup} onChange={setGroup} groups={groups} className="max-w-full" />
            </SectionBar>

            <StatStrip cols={5}>
                <Stat
                    label="שיעור דואר נכנס · 7 ימים"
                    value={<span className={BAND[rate.band].text}>{rate.inbox_rate != null ? fmtPct(rate.inbox_rate) : "—"}</span>}
                    sub={rate.inbox_rate != null ? BAND[rate.band].label : rateSentence(rate)}
                />
                <Stat
                    label="שיעור דואר נכנס · חלון זמן"
                    value={<span className={BAND[bandForRate(t.inboxRate)].text}>{fmtPct(t.inboxRate)}</span>}
                    sub={filtered ? `אצל ${GROUP_LABEL[activeGroup]}` : `${fmtNum(t.inbox)} ראשית · ${fmtNum(t.tabs)} לשוניות`}
                />
                <Stat label="נמסרו" value={t.delivered} sub={filtered ? "שליחות אינן מפוצלות לפי ספק" : `מתוך ${fmtNum(t.sent)} שנשלחו`} />
                <Stat
                    label="ספאם"
                    value={<span className={t.spam > 0 ? "text-rose-600" : undefined}>{fmtNum(t.spam)}</span>}
                    sub={`${fmtPct(t.spamRate)} · ${fmtNum(t.rescued)} חולצו`}
                />
                <Stat label="לא אומתו" value={filtered ? "—" : t.unconfirmed} sub="נשלחו לפני 24+ שעות, טרם זוהו" last />
            </StatStrip>

            <div className="grid lg:grid-cols-2 border-b border-slate-200/60">
                <div className="px-5 py-4 lg:border-e lg:border-slate-200/60">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <Eyebrow>היכן נחת דואר החימום</Eyebrow>
                        <LandedLegend />
                    </div>
                    <PlacementColumns days={view} height={140} />
                </div>
                <div className="px-5 py-4">
                    <div className="mb-3">
                        <Eyebrow>שיעור דואר נכנס לאורך זמן</Eyebrow>
                    </div>
                    <RateTrend days={view} windowDays={rate.window_days} height={130} />
                </div>
            </div>

            <SectionBar label="מיקום חימום לפי ספק" count={report.providers.length || undefined} />
            <ProviderBreakdown providers={report.providers} />
            <p className="px-5 py-3 text-[11.5px] text-slate-500 leading-relaxed border-t border-slate-200/60">
                בחירת שותפי החימום קוראת את הנתונים האלו לפי שרת דואר: תיבה שנוחתת בספאם אצל ספק מסוים נשלחת לפחות
                שותפים שם כל עוד שיעור הספאם גבוה, וליותר שותפים ברגע שהיא מתאוששת. היא לעולם אינה מנותקת לחלוטין, משום
                ששולח שמפסיק לשלוח לספק לעולם לא יוכל לגלות שהמוניטין שלו התאושש.
            </p>

            <SectionBar label="תיבות דואר לפי שיעור דואר נכנס" count={listed.length || undefined}>
                <button
                    type="button"
                    onClick={() => setAttentionOnly((v) => !v)}
                    className={cn(
                        "h-6 px-2 rounded text-[11px] font-medium transition-colors border",
                        attentionOnly ? "bg-amber-50 text-amber-700 border-amber-200" : "text-slate-500 border-slate-200 hover:text-slate-900",
                    )}
                >
                    מתחת ל-90% בלבד{attention.length > 0 ? ` · ${attention.length}` : ""}
                </button>
            </SectionBar>
            {listed.length === 0 ? (
                <EmptyBlock
                    title={attentionOnly ? "כל תיבת דואר עומדת על 90% ומעלה" : "לאף תיבת דואר לא היו מסירות חימום בחלון זמן זה"}
                    body="תיבות הדואר מדורגות לפי שיעור הדואר הנכנס שלהן ב-7 הימים האחרונים, מהנמוך לגבוה."
                />
            ) : (
                <div className="divide-y divide-slate-200/60">
                    {shown.map((m) => (
                        <MailboxRow key={m.email_account_id} m={m} onOpen={() => navigate(`/app/emails?mailbox=${m.email_account_id}&tab=deliverability`)} />
                    ))}
                    {listed.length > PAGE && (
                        <button
                            type="button"
                            onClick={() => setShowAll((v) => !v)}
                            className="w-full h-9 text-[11.5px] text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                        >
                            {showAll ? "הצג פחות" : `הצג את כל ${listed.length}`}
                        </button>
                    )}
                </div>
            )}
        </>
    );
}

function MailboxRow({ m, onOpen }: { m: PlacementMailbox; onOpen: () => void }) {
    return (
        <button type="button" onClick={onOpen} className="group w-full h-11 px-5 flex items-center gap-3 text-start hover:bg-slate-50/80 transition-colors">
            <span className={cn("size-1.5 rounded-full shrink-0", BAND[m.rate.band].dot)} />
            <span dir="ltr" className="text-[12.5px] font-medium text-slate-900 truncate min-w-0 flex-1 text-start">{m.email}</span>
            <span className="hidden md:block" title="שיעור דואר נכנס יומי בחלון זמן זה">
                <RateSpark values={m.daily_inbox_rate} />
            </span>
            <span className="hidden sm:flex items-center gap-3 font-mono text-[11px] tabular-nums text-slate-500 shrink-0">
                <span title="נמסרו בחלון זמן זה" className="w-16 text-end">{fmtNum(m.delivered)} נמסרו</span>
                <span title="ספאם בחלון זמן זה" className={cn("w-14 text-end", m.spam > 0 ? "text-rose-600" : "text-slate-400")}>{fmtNum(m.spam)} ספאם</span>
            </span>
            <span className="w-12 text-end shrink-0">
                <PlacementRateBadge rate={m.rate} />
            </span>
            <BandChip band={m.rate.band} className="hidden lg:inline-flex w-[118px] justify-center" />
            <ChevronRightIcon className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 shrink-0 rtl:rotate-180" />
        </button>
    );
}

function Eyebrow({ children }: { children: ReactNode }) {
    return <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">{children}</span>;
}
