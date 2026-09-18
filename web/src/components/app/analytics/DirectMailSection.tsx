// Analytics for mail written by hand, as opposed to sent by a campaign.
//
// The page above this is entirely campaign-shaped: every number on it comes
// from campaign_contact_progress, so a workspace that mostly answers its inbox
// saw an empty dashboard and no sign that anything else had been measured.
//
// Two cards, never blended. Volume comes from the synced mailbox, so it covers
// everything the mailbox sent, including mail written elsewhere, and it covers
// history. Opens and clicks come from the send records, so they only cover mail
// sent through Warmbly by a mailbox that opted in, from the moment it opted in.
// One combined "open rate" would divide opens we can see by sends we never
// measured, so the denominator is stated on the card instead.

import { Link } from "react-router-dom";
import { EyeIcon, InboxIcon, MailIcon, ReplyIcon } from "lucide-react";

import { EmptyBlock, SectionBar, Stat, StatStrip } from "@/components/layout/Page";
import { MultiTrend, type TrendSeries } from "@/components/ui/charts";
import useDirectMail from "@/lib/api/hooks/app/analytics/useDirectMail";
import type DirectMailAnalytics from "@/lib/api/models/app/analytics/DirectMailAnalytics";

function num(v: number | undefined): string {
    return (v ?? 0).toLocaleString();
}
function pct(v: number | undefined): string {
    return v == null ? "—" : `${v.toFixed(1)}%`;
}

// Reply turnaround reads better in the largest unit that still says something:
// "2.4 h" beats "144 min", and "—" beats "0 min" when nothing has been answered.
function duration(minutes: number | undefined): string {
    if (!minutes || minutes <= 0) return "—";
    if (minutes < 90) return `${Math.round(minutes)} min`;
    const hours = minutes / 60;
    if (hours < 48) return `${hours.toFixed(1)} h`;
    return `${(hours / 24).toFixed(1)} d`;
}

function SkeletonRows({ rows = 3 }: { rows?: number }) {
    return (
        <div className="divide-y divide-slate-200/60">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="h-11 px-5 flex items-center gap-3">
                    <div className="size-1.5 rounded-full bg-slate-200" />
                    <div className="h-3 w-40 bg-slate-100 rounded animate-pulse" />
                    <div className="ms-auto h-3 w-24 bg-slate-100 rounded animate-pulse" />
                </div>
            ))}
        </div>
    );
}

export default function DirectMailSection({ period }: { period: string }) {
    const q = useDirectMail(period);
    const d: DirectMailAnalytics | undefined = q.data;
    const vol = d?.volume;
    const tr = d?.tracking;

    const series: TrendSeries[] = [
        { key: "sent", label: "נשלחו", tone: "sky", values: (d?.daily_trend ?? []).map((x) => x.sent) },
        { key: "received", label: "התקבלו", tone: "emerald", values: (d?.daily_trend ?? []).map((x) => x.received) },
    ];
    const labels = (d?.daily_trend ?? []).map((x) => x.date);

    if (q.isError) {
        return (
            <>
                <SectionBar label="דוא״ל ישיר" />
                <EmptyBlock
                    title="לא ניתן לטעון נתוני דוא״ל ישיר"
                    body="נתוני הנפח והתשובות נקלטים מתיבות הדואר המסונכרנות שלך. רענן כדי לנסות שוב."
                />
            </>
        );
    }

    return (
        <>
            <SectionBar label="דוא״ל ישיר">
                <Link
                    to="/app/unibox/sent"
                    className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-900 transition-colors"
                >
                    פתח דואר יוצא
                </Link>
            </SectionBar>

            {/* Volume: measured from the mailbox itself, so it needs no opt-in
                and covers mail composed anywhere, not just here. */}
            <StatStrip cols={4}>
                <Stat
                    label="נשלח ידנית"
                    value={q.isPending ? "—" : num(vol?.sent)}
                    sub="בכל תיבות הדואר"
                    accent={!!vol && vol.sent > 0}
                />
                <Stat
                    label="התקבל"
                    value={q.isPending ? "—" : num(vol?.received)}
                    sub={vol && vol.bounced > 0 ? `${num(vol.bounced)} מהם החזרות` : "לתיבת הדואר הנכנס"}
                />
                <Stat
                    label="שיעור מענה"
                    value={q.isPending ? "—" : pct(vol?.reply_rate)}
                    sub={vol ? `${num(vol.replied)} מתוך ${num(vol.threads_started)} שרשורים` : "שרשורים שפתחת"}
                />
                <Stat
                    label="חציון זמן מענה"
                    value={q.isPending ? "—" : duration(vol?.median_reply_minutes)}
                    sub="מהירות המענה של הנמענים"
                    last
                />
            </StatStrip>

            <div className="px-5 py-4 border-b border-slate-200">
                <MultiTrend
                    labels={labels}
                    series={series}
                    height={200}
                    emptyLabel="לא נשלח ולא התקבל דואר בטווח זמנים זה"
                />
            </div>

            {/* Opens and clicks: the opt-in half. The denominator is on the card
                because it is not the same as "sent by hand" above. */}
            <SectionBar label="פתיחות ולחיצות" count={tr ? `${tr.mailboxes_opted_in}/${tr.mailboxes_total} תיבות` : undefined} />
            {q.isPending ? (
                <SkeletonRows rows={1} />
            ) : (tr?.mailboxes_opted_in ?? 0) === 0 ? (
                <EmptyBlock
                    title="אף תיבה אינה מנטרת דואר ישיר"
                    body="פתח את הגדרות התיבה והפעל 'עקוב אחר פתיחות ולחיצות בדוא״ל ישיר' כדי למדוד פתיחות ולחיצות בהודעות הנשלחות מ-Warmbly."
                />
            ) : (tr?.tracked_sent ?? 0) === 0 ? (
                <EmptyBlock
                    title="אין נתוני מעקב בטווח זה עדיין"
                    body="המעקב פעיל, אך טרם נשלח דוא״ל ישיר בתקופה זו. המענה הבא שיישלח מכאן ייספר."
                />
            ) : (
                <StatStrip cols={4}>
                    <Stat label="שליחות מנוטרות" value={num(tr?.tracked_sent)} sub="סך הכל במעקב" accent />
                    <Stat label="נפתחו" value={pct(tr?.open_rate)} sub={`${num(tr?.opened)} על ידי אדם`} />
                    <Stat label="פתיחות אוטומטיות" value={num(tr?.machine_opened)} sub="לא נספרו לעיל" />
                    <Stat label="נלחצו" value={pct(tr?.click_rate)} sub={`${num(tr?.clicked)} הודעות`} last />
                </StatStrip>
            )}

            <SectionBar label="לפי תיבת דואר" />
            {q.isPending ? (
                <SkeletonRows />
            ) : (d?.mailboxes?.length ?? 0) === 0 ? (
                <EmptyBlock title="אין תיבות דואר מחוברות" body="חבר תיבת דואר והשליחות שלה יוצגו כאן." />
            ) : (
                <div className="divide-y divide-slate-200/60">
                    {d!.mailboxes.map((m) => (
                        <div key={m.email_account_id} className="h-11 px-5 flex items-center gap-3">
                            <MailIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="text-[12.5px] font-medium text-slate-900 truncate max-w-[40%]">{m.email}</span>
                            {m.track_direct_mail && (
                                <span
                                    title="פתיחות ולחיצות מנוטרות בדוא״ל ישיר מתיבה זו"
                                    className="shrink-0 inline-flex items-center gap-1 px-1.5 rounded bg-sky-50 text-sky-700 text-[10px] font-medium"
                                >
                                    <EyeIcon className="w-2.5 h-2.5" />
                                    מנוטר
                                </span>
                            )}
                            <span className="ms-auto flex items-center gap-2 md:gap-4 font-mono text-[11px] text-slate-500 tabular-nums shrink-0">
                                <span title="נשלח ידנית">{num(m.sent)} נשלחו</span>
                                <span title="התקבלו" className="text-emerald-600">{num(m.received)} התקבלו</span>
                            </span>
                        </div>
                    ))}
                </div>
            )}

            <SectionBar label="אנשי קשר מובילים בהתכתבות" />
            {q.isPending ? (
                <SkeletonRows />
            ) : (d?.top_contacts?.length ?? 0) === 0 ? (
                <EmptyBlock
                    title="אין שיחות בטווח זה"
                    body="אנשי הקשר שאיתם אתה מתכתב הכי הרבה יוצגו כאן, מדורגים לפי כמות ההודעות ששלחת אליהם."
                />
            ) : (
                <div className="divide-y divide-slate-200/60">
                    {d!.top_contacts.map((c) => (
                        <div key={c.email} className="h-11 px-5 flex items-center gap-3">
                            <InboxIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="text-[12.5px] text-slate-900 truncate max-w-[45%]" title={c.email}>
                                {c.email}
                            </span>
                            <span className="ms-auto flex items-center gap-2 md:gap-4 font-mono text-[11px] text-slate-500 tabular-nums shrink-0">
                                <span title="אתה שלחת">{num(c.sent)} נשלחו</span>
                                <span title="הם שלחו" className="inline-flex items-center gap-1 text-emerald-600">
                                    <ReplyIcon className="w-3 h-3 rtl:scale-x-[-1]" />
                                    {num(c.received)}
                                </span>
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}
