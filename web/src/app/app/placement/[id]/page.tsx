// One placement test: where every copy landed, by folder, provider and seed,
// the content check of the copy that was sent, and for a tracking comparison
// the two halves side by side. Live through PLACEMENT_TEST_UPDATED.

import React from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeftIcon, ArrowUpRightIcon, Loader2Icon, SquareIcon } from "lucide-react";
import toast from "react-hot-toast";
import { EmptyBlock, SectionBar } from "@/components/layout/Page";
import PermissionButton from "@/components/ui/PermissionButton";
import EmailBody from "@/components/app/unibox/EmailBody";
import { IssueRow } from "@/components/app/campaigns/ContentScore";
import { useConfirm } from "@/hooks/context/confirm";
import useCampaign from "@/lib/api/hooks/app/campaigns/useCampaign";
import { useCancelPlacementTest, usePlacementTest } from "@/lib/api/hooks/app/placement/usePlacement";
import {
    PANEL_LABEL,
    type PlacementCounts,
    type PlacementResult,
    type PlacementTest,
    type PlacementTestDetail,
} from "@/lib/api/models/app/placement/Placement";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import {
    FolderChip,
    PlacementBar,
    PlacementCaveat,
    PlacementLegend,
    StatusChip,
    TrackingBadge,
} from "@/components/app/placement/tests/PlacementParts";
import {
    FOLDER,
    ORIGIN_LABEL,
    PANEL_LABEL_HE,
    fmtDate,
    fmtRate,
    isTracked,
    rateTone,
    resolvedCount,
} from "@/components/app/placement/tests/placementTests";
import { cn } from "@/lib/utils";

export default function PlacementTestPage() {
    const { id = "" } = useParams();
    const q = usePlacementTest(id);

    return (
        <div className="flex flex-col min-h-full bg-white">
            <div className="px-3 sm:px-5 pt-3 sm:pt-4">
                <Link
                    to="/app/placement"
                    className="inline-flex items-center gap-1 h-6 -ms-1.5 px-1.5 mb-1 rounded-md text-[11.5px] text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                    <ArrowLeftIcon className="w-3 h-3 rtl:rotate-180" />
                    בדיקות מיקום
                </Link>
            </div>
            {q.isLoading ? (
                <div className="px-5 py-16 flex justify-center">
                    <Loader2Icon className="w-5 h-5 animate-spin text-slate-300" />
                </div>
            ) : q.isError || !q.data ? (
                <EmptyBlock
                    title={(q.error as unknown as AppError)?.status === 404 ? "בדיקה זו אינה קיימת" : "לא ניתן לטעון בדיקה זו"}
                    body={(q.error as unknown as AppError)?.status === 404 ? "ייתכן שהיא שייכת לסביבת עבודה אחרת." : q.error ? buildError(q.error as unknown as AppError) : undefined}
                />
            ) : (
                <Detail test={q.data} />
            )}
        </div>
    );
}

function Detail({ test }: { test: PlacementTestDetail }) {
    const confirm = useConfirm();
    const cancel = useCancelPlacementTest();
    const campaign = useCampaign(test.campaign_id ?? "");
    const running = test.status === "running";
    const s = test.summary;

    const onCancel = () =>
        confirm.show(
            "לעצור בדיקה זו? עותקים שטרם נשלחו יבוטלו. העותקים שכבר נשלחו ימשיכו להיות מסווגים.",
            async () => {
                try {
                    await cancel.mutateAsync(test.id);
                    toast.success("הבדיקה נעצרה.");
                } catch (e) {
                    const err = e as AppError;
                    toast.error(err?.code === "placement_not_running" ? "בדיקה זו כבר הסתיימה." : buildError(err));
                }
            },
        );

    return (
        <>
            {/* Header */}
            <div className="px-3 sm:px-5 pb-4 flex flex-wrap items-start gap-3 border-b border-slate-200">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h1 className="min-w-0 max-w-full text-[18px] font-semibold text-slate-900 truncate">{test.subject || "(ללא נושא)"}</h1>
                        <StatusChip status={test.status} counts={s} />
                        <TrackingBadge test={test} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-slate-500">
                        <span>
                            מאת <span dir={test.sender_email ? "ltr" : undefined} className="text-slate-800">{test.sender_email || "תיבת דואר שנמחקה"}</span>
                        </span>
                        <span>{PANEL_LABEL_HE[test.panel] ?? PANEL_LABEL[test.panel] ?? test.panel}</span>
                        <span>התחיל {fmtDate(test.created_at)}</span>
                        {test.finished_at && <span>הסתיים {fmtDate(test.finished_at)}</span>}
                        {test.origin !== "manual" && <span>{ORIGIN_LABEL[test.origin] ?? test.origin}</span>}
                        {test.campaign_id && (
                            <Link to={`/app/campaigns/${test.campaign_id}/steps`} className="inline-flex items-center gap-0.5 text-sky-700 hover:text-sky-800">
                                {campaign.data?.name ?? "קמפיין"}
                                <ArrowUpRightIcon className="w-3 h-3 rtl:-scale-x-100" />
                            </Link>
                        )}
                        {test.compare && (
                            <Link to={`/app/placement/${test.compare.id}`} className="inline-flex items-center gap-0.5 text-sky-700 hover:text-sky-800">
                                {isTracked(test.compare) ? "החצי עם מעקב" : "החצי ללא מעקב"}
                                <ArrowUpRightIcon className="w-3 h-3 rtl:-scale-x-100" />
                            </Link>
                        )}
                    </div>
                    {test.error && <p className="mt-1.5 text-[11.5px] text-rose-600">{test.error}</p>}
                </div>
                {running && (
                    <PermissionButton
                        permission="SEND_CAMPAIGNS"
                        type="button"
                        onClick={onCancel}
                        disabled={cancel.isPending}
                        className="shrink-0 h-7 px-2.5 rounded-md border border-slate-200 hover:border-slate-300 bg-white text-[12px] font-medium text-slate-700 hover:text-slate-900 inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                    >
                        {cancel.isPending ? <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> : <SquareIcon className="w-3 h-3" />}
                        עצור בדיקה
                    </PermissionButton>
                )}
            </div>

            {/* Folder breakdown */}
            <Breakdown counts={s} running={running} />

            {test.compare && <Comparison test={test} other={test.compare} />}

            {/* By provider */}
            <SectionBar label="לפי ספק" count={test.families?.length || undefined}>
                <PlacementLegend className="hidden md:flex" />
            </SectionBar>
            {(test.families ?? []).length === 0 ? (
                <p className="px-5 py-4 text-[12px] text-slate-400">אין עדיין הכרעה לאף עותק.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-start">
                        <thead>
                            <tr className="h-8 border-b border-slate-200/60 text-[10px] uppercase tracking-[0.14em] text-slate-400">
                                <th className="px-5 font-medium">ספק</th>
                                <th className="px-3 font-medium w-[30%] hidden sm:table-cell" />
                                <th className="px-3 font-medium text-end">דואר נכנס</th>
                                <th className="px-3 font-medium text-end">לשוניות</th>
                                <th className="px-3 font-medium text-end">ספאם</th>
                                <th className="px-3 font-medium text-end">חסר</th>
                                <th className="px-5 font-medium text-end hidden md:table-cell">עותקים</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/60">
                            {(test.families ?? []).map((f) => (
                                <tr key={f.family} className="h-10">
                                    <td className="px-5 text-[12.5px] font-medium text-slate-900 whitespace-nowrap">{f.label || f.family}</td>
                                    <td className="px-3 hidden sm:table-cell">
                                        <PlacementBar counts={f.counts} />
                                    </td>
                                    <td className={cn("px-3 text-end font-mono text-[11.5px] tabular-nums", rateTone(f.counts.inbox_rate))}>
                                        {fmtRate(f.counts.inbox_rate)}
                                    </td>
                                    <td className="px-3 text-end font-mono text-[11.5px] tabular-nums text-violet-600">{fmtRate(f.counts.tabs_rate)}</td>
                                    <td className="px-3 text-end font-mono text-[11.5px] tabular-nums text-rose-600">{fmtRate(f.counts.spam_rate)}</td>
                                    <td className="px-3 text-end font-mono text-[11.5px] tabular-nums text-slate-500">{fmtRate(f.counts.missing_rate)}</td>
                                    <td className="px-5 text-end font-mono text-[11px] tabular-nums text-slate-400 hidden md:table-cell">
                                        {resolvedCount(f.counts)}/{f.counts.total}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] border-t border-slate-200">
                {/* Per seed */}
                <section className="min-w-0 lg:border-e lg:border-slate-200">
                    <SectionBar label="תיבות בדיקה" count={test.results?.length || undefined} />
                    <SeedResults results={test.results ?? []} masked={test.panel !== "workspace"} />
                </section>

                {/* Content check + the copy */}
                <section className="min-w-0">
                    <SectionBar label="בדיקת תוכן" />
                    <ContentCheck test={test} />
                    <SectionBar label="הנוסח שנבדק" />
                    <div className="px-5 py-3">
                        <div className="rounded-md border border-slate-200 bg-white">
                            <div className="border-b border-slate-200/70 px-3 py-2 text-[12.5px]">
                                <span className="text-slate-400">נושא: </span>
                                <span className="text-slate-800">{test.subject || "(ללא נושא)"}</span>
                            </div>
                            <div className="min-h-[160px] px-3 py-2.5">
                                {test.body_html || test.body_plain ? (
                                    <EmailBody html={test.body_html || null} plain={test.body_plain || null} />
                                ) : (
                                    <p className="text-[12px] text-slate-400">גוף ההודעה אינו שמור עבור בדיקה זו.</p>
                                )}
                            </div>
                        </div>
                        <p className="mt-1.5 text-[11px] text-slate-400 leading-relaxed">
                            התבנית כפי שנכתבה. כל תיבת בדיקה קיבלה אותה מעובדת עבור איש הקשר שנבחר, כולל החתימה,
                            שורת ההסרה בתחתית וכותרת ההסרה שמתווספות בשליחה אמיתית.
                        </p>
                    </div>
                </section>
            </div>

            <PlacementCaveat className="mx-5 my-5" />
        </>
    );
}

// Hairlines for a 2x2 grid on phones and one row of four from md up.
const CELL_BORDER = ["border-e max-md:border-b", "md:border-e max-md:border-b", "border-e", ""];

function Breakdown({ counts, running }: { counts: PlacementCounts; running: boolean }) {
    const tabs = counts.promotions + counts.other;
    const cells: { label: string; n: number; rate: number | null; tone: string; dot: string; sub?: string }[] = [
        { label: "דואר נכנס", n: counts.inbox, rate: counts.inbox_rate, tone: FOLDER.inbox.text, dot: FOLDER.inbox.dot },
        {
            label: "לשוניות Gmail",
            n: tabs,
            rate: counts.tabs_rate,
            tone: FOLDER.promotions.text,
            dot: FOLDER.promotions.dot,
            sub: `${counts.promotions} קידומי מכירות, ${counts.other} לשוניות אחרות`,
        },
        { label: "ספאם", n: counts.spam, rate: counts.spam_rate, tone: FOLDER.spam.text, dot: FOLDER.spam.dot },
        {
            label: "מעולם לא הגיע",
            n: counts.missing,
            rate: counts.missing_rate,
            tone: FOLDER.missing.text,
            dot: FOLDER.missing.dot,
            sub: "לא זוהה תוך שעתיים",
        },
    ];
    const notSent = counts.failed + counts.cancelled;
    return (
        <section className="border-b border-slate-200">
            <div className="grid grid-cols-2 md:grid-cols-4">
                {cells.map((c, i) => (
                    <div
                        key={c.label}
                        className={cn("px-5 py-4 border-slate-200", CELL_BORDER[i])}
                    >
                        <div className="flex items-center gap-2">
                            <span className={cn("size-1.5 rounded-full", c.dot)} />
                            <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">{c.label}</span>
                        </div>
                        <div className={cn("mt-2 text-[26px] font-light leading-none tabular-nums", c.rate == null ? "text-slate-300" : c.tone)}>
                            {fmtRate(c.rate)}
                        </div>
                        <div className="mt-1.5 text-[10.5px] text-slate-400 font-mono truncate">
                            {c.n === 1 ? "עותק אחד" : `${c.n} עותקים`}
                            {c.sub ? `, ${c.sub}` : ""}
                        </div>
                    </div>
                ))}
            </div>
            <div className="px-5 pb-4 pt-1">
                <PlacementBar counts={counts} height={8} />
                <p className="mt-2 text-[11px] text-slate-500">
                    {running
                        ? `ל-${resolvedCount(counts)} מתוך ${counts.total} עותקים יש הכרעה. דף זה מתעדכן בזמן שהם מגיעים.`
                        : `${counts.delivered} מתוך ${counts.total} עותקים נשלחו וסווגו.`}
                    {notSent > 0 && ` ${notSent} לא נשלחו (${counts.failed} נכשלו, ${counts.cancelled} בוטלו).`}
                    {" "}השיעורים מחושבים מתוך העותקים שנשלחו.
                </p>
            </div>
        </section>
    );
}

// Two tests to the same seeds, one untracked and one tracked, side by side.
function Comparison({ test, other }: { test: PlacementTest; other: PlacementTest }) {
    const [without, withT] = isTracked(test) ? [other, test] : [test, other];
    const rows: { label: string; key: keyof PlacementCounts }[] = [
        { label: "דואר נכנס", key: "inbox_rate" },
        { label: "לשוניות Gmail", key: "tabs_rate" },
        { label: "ספאם", key: "spam_rate" },
        { label: "מעולם לא הגיע", key: "missing_rate" },
    ];
    const diff = (a: number | null, b: number | null) => (a == null || b == null ? null : Math.round((b - a) * 100));
    const inboxDelta = diff(without.summary.inbox_rate, withT.summary.inbox_rate);
    return (
        <section className="border-b border-slate-200">
            <SectionBar label="השוואת מעקב" />
            <div className="grid sm:grid-cols-2">
                {[
                    { title: "ללא מעקב", t: without },
                    { title: "עם מעקב", t: withT },
                ].map(({ title, t }, i) => (
                    <div key={t.id} className={cn("px-5 py-4 min-w-0", i === 0 && "sm:border-e border-slate-200 max-sm:border-b")}>
                        <div className="flex items-center gap-2">
                            <span className="text-[12.5px] font-medium text-slate-900">{title}</span>
                            <StatusChip status={t.status} counts={t.summary} />
                            {t.id !== test.id && (
                                <Link to={`/app/placement/${t.id}`} className="ms-auto text-[11px] text-sky-700 hover:text-sky-800 inline-flex items-center gap-0.5">
                                    פתח
                                    <ArrowUpRightIcon className="w-3 h-3 rtl:-scale-x-100" />
                                </Link>
                            )}
                        </div>
                        <PlacementBar counts={t.summary} className="mt-3" />
                        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                            {rows.map((r) => (
                                <div key={r.key} className="flex items-center justify-between gap-2">
                                    <dt className="text-[11.5px] text-slate-500">{r.label}</dt>
                                    <dd className="font-mono text-[12px] tabular-nums text-slate-800">{fmtRate(t.summary[r.key] as number | null)}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                ))}
            </div>
            <p className="px-5 pb-4 text-[11.5px] text-slate-500 leading-relaxed">
                {inboxDelta == null
                    ? "ההבדל יוצג ברגע שלשני החצאים יהיו הכרעות."
                    : inboxDelta === 0
                      ? "למעקב לא הייתה השפעה על שיעור ההגעה לתיבת הדואר הנכנס בבדיקה זו."
                      : inboxDelta < 0
                        ? `העותקים עם מעקב הגיעו לתיבת הדואר הנכנס ב-${Math.abs(inboxDelta)} נקודות אחוז פחות. הרץ בדיקה נוספת לפני כיבוי המעקב: בדיקה אחת היא רעש סטטיסטי.`
                        : `העותקים עם מעקב הגיעו לתיבת הדואר הנכנס ב-${inboxDelta} נקודות אחוז יותר. במספר כה קטן של תיבות בדיקה מדובר בטווח הרעש הסטטיסטי.`}
            </p>
        </section>
    );
}

function SeedResults({ results, masked }: { results: PlacementResult[]; masked: boolean }) {
    if (results.length === 0) return <p className="px-5 py-4 text-[12px] text-slate-400">לא נבחרו תיבות בדיקה עבור בדיקה זו.</p>;
    return (
        <>
            {masked && (
                <p className="px-5 pt-3 text-[11px] text-slate-400">כתובות בפאנל משותף מוסתרות חלקית.</p>
            )}
            <ul className="divide-y divide-slate-200/60">
                {results.map((r, i) => (
                    <li key={`${r.seed}-${i}`} className="px-5 py-2 flex items-center gap-3 min-h-11">
                        <div className="min-w-0 flex-1">
                            <div dir="ltr" className="text-[12.5px] text-slate-800 font-mono truncate text-start">{r.seed}</div>
                            <div className="text-[11px] text-slate-400 truncate">
                                {r.family_label || r.family}
                                {r.detected_at
                                    ? `, זוהה ${fmtDate(r.detected_at)}`
                                    : r.sent_at
                                      ? `, נשלח ${fmtDate(r.sent_at)}`
                                      : r.scheduled_at && r.folder === "pending"
                                        ? `, יישלח ${fmtDate(r.scheduled_at)}`
                                        : ""}
                            </div>
                            {r.error && <div className="text-[11px] text-amber-600 truncate" title={r.error}>{r.error}</div>}
                        </div>
                        <FolderChip folder={r.folder} />
                    </li>
                ))}
            </ul>
        </>
    );
}

function ContentCheck({ test }: { test: PlacementTestDetail }) {
    const { score } = test.content;
    const issues = test.content.issues ?? [];
    const tone = score >= 80 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-rose-600";
    const label = score >= 80 ? "נראה טוב" : score >= 50 ? "ניתן לשפר" : "דורש שיפור";
    return (
        <div className="px-5 py-3">
            <div className="flex items-baseline gap-2">
                <span className={cn("text-[22px] font-light tabular-nums", tone)}>{score}</span>
                <span className="text-[11px] text-slate-400">מתוך 100</span>
                <span className={cn("text-[11.5px] font-medium", tone)}>{label}</span>
            </div>
            {issues.length === 0 ? (
                <p className="mt-1 text-[11.5px] text-slate-500">שום דבר בנוסח אינו בולט לרעה למסנן ספאם.</p>
            ) : (
                <ul className="mt-1 divide-y divide-slate-100">
                    {issues.map((issue, i) => (
                        <IssueRow key={`${issue.code}-${i}`} issue={issue} />
                    ))}
                </ul>
            )}
            <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
                אותם כללים שעורך השלבים בודק, על הנוסח שנבדק. המיקום תלוי גם במוניטין השולח, שאף בדיקת תוכן אינה רואה.
            </p>
        </div>
    );
}
