// Automatic inbox tagging — the phase-1 review surface.
//
// The feature labels inbound mail and scores it for relevance. It takes no
// action: no snooze, no lead hold, no task, no suppression. That is the whole
// point of this phase, and this page is what makes the phase mean something: a
// person watches what it decided and how sure it was, and only then is it
// allowed to act on anything.
//
// So this page shows the confidence, not just the verdict, and shows where the
// verdict came from. A label that a mail header decided is a different kind of
// fact from one the model inferred, and reading the two as the same thing is
// how you end up trusting the wrong half.

import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckIcon, FilterIcon, InfoIcon, SparklesIcon } from "lucide-react";

import {
    EmptyBlock,
    Page,
    PageBody,
    PageTopbar,
    SectionBar,
    Stat,
    StatStrip,
} from "@/components/layout/Page";
import { NoAccess } from "@/components/layout/NoAccess";
import { TagMeaningTooltip } from "@/components/ui/tag-meaning-tooltip";
import { usePermission } from "@/hooks/usePermission";
import useInboxTagReview from "@/lib/api/hooks/app/inboxtag/useInboxTagReview";
import type { InboxTagRow } from "@/lib/api/models/app/inboxtag/InboxTagReview";
import { cn } from "@/lib/utils";

const PRIORITY_LABELS: Record<string, string> = {
    now: "עכשיו",
    today: "היום",
    whenever: "בהזדמנות",
    ignore: "התעלם",
};

const PRIORITY_TONE: Record<string, string> = {
    now: "bg-rose-50 text-rose-700",
    today: "bg-amber-50 text-amber-700",
    whenever: "bg-sky-50 text-sky-700",
    ignore: "bg-slate-100 text-slate-500",
};

function pct(v: number): string {
    return `${Math.round(v * 100)}%`;
}

// Confidence is the number this page exists to show, so it is coloured rather
// than merely printed: below the floor nothing was trusted, and that has to be
// visible at a glance across fifty rows.
function ConfidenceChip({ value, floorBreached }: { value: number; floorBreached: boolean }) {
    return (
        <span
            title={floorBreached ? "מתחת לסף הוודאות — לא בוצעה פעולה" : "וודאות המודל"}
            className={cn(
                "shrink-0 px-1.5 rounded font-mono text-[10.5px] tabular-nums",
                floorBreached ? "bg-rose-50 text-rose-700" : value >= 0.9 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600",
            )}
        >
            {pct(value)}
        </span>
    );
}

function Row({ r }: { r: InboxTagRow }) {
    return (
        <div className="px-5 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors">
            <span
                title={`רלוונטיות ${r.relevance} מתוך 100`}
                className="shrink-0 w-9 text-right font-mono text-[12.5px] tabular-nums text-slate-900"
            >
                {r.relevance}
            </span>
            <span
                className={cn(
                    "shrink-0 px-1.5 rounded text-[10px] font-semibold uppercase tracking-wide",
                    PRIORITY_TONE[r.priority] ?? PRIORITY_TONE.ignore,
                )}
            >
                {PRIORITY_LABELS[r.priority] || r.priority || "—"}
            </span>

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                    {r.labels.length === 0 ? (
                        <span className="text-[11.5px] text-slate-400">אין תוויות</span>
                    ) : (
                        r.labels.map((l) => (
                            <TagMeaningTooltip key={l} title={l}>
                                <span className="px-1.5 rounded bg-slate-100 text-slate-700 text-[11px] cursor-help">
                                    {l}
                                </span>
                            </TagMeaningTooltip>
                        ))
                    )}
                </div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
                    <span className="font-mono truncate max-w-[22ch]" title={r.thread_id}>
                        {r.thread_id || "—"}
                    </span>
                    <span>·</span>
                    <span title="מקור ההחלטה">
                        {r.kind_source === "header" ? "הוכרע מקומית" : `מודל ${r.model}`}
                    </span>
                    {r.input_tokens > 0 && (
                        <>
                            <span>·</span>
                            <span title="טוקנים של קלט; פלט אינו מחויב">{r.input_tokens} טוקנים</span>
                        </>
                    )}
                </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
                <span className="text-[11.5px] text-slate-600">{r.kind || "—"}</span>
                <ConfidenceChip value={r.kind_confidence} floorBreached={r.review_reason === "kind"} />
                {r.intent && (
                    <>
                        <span className="text-[11.5px] text-slate-600">{r.intent}</span>
                        <ConfidenceChip value={r.intent_confidence} floorBreached={r.review_reason === "intent"} />
                    </>
                )}
            </div>
        </div>
    );
}

export default function InboxTaggingPage() {
    const canView = usePermission("VIEW_ANALYTICS");
    const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
    const q = useInboxTagReview(needsReviewOnly);
    const d = q.data?.pages[0];

    if (!canView) {
        return <NoAccess feature="תיוג תיבת דואר אוטומטי" permissionLabel="צפייה באנליטיקה" />;
    }

    const rows = q.data?.pages.flatMap((page) => page.data) ?? [];

    return (
        <Page>
            <PageTopbar
                eyebrow="תיוג תיבת דואר אוטומטי"
                subtitle="החלטות המסווג ורמת הוודאות. שלב 1 מפיק תוויות בלבד ללא פעולות אוטומטיות."
            />

            {!d?.enabled && !q.isPending && !q.isError && (
                <div className="mx-5 mt-4 px-3 py-2.5 rounded-md border border-amber-200 bg-amber-50 flex items-start gap-2">
                    <InfoIcon className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[11.5px] text-amber-800 leading-relaxed">
                        סיווג אוטומטי כבוי בסביבה זו. נדרש מפתח <code className="font-mono">TYPESAFE_API_KEY</code> והגדרה{" "}
                        <code className="font-mono">INBOX_TAGGING_ENABLED=true</code>. תוכן ההודעות נשלח למסווג שהוגדר, ולכן הוא נשאר כבוי עד להפעלתו במכוון. תגיות מעקב מבוססות חותמת זמן ממשיכות לפעול מקומית.
                    </p>
                </div>
            )}

            <StatStrip cols={4}>
                <Stat label="סווגו" value={q.isPending ? "—" : (d?.summary.total ?? 0).toLocaleString()} sub="הודעות" accent={(d?.summary.total ?? 0) > 0} />
                <Stat label="דורש בדיקה" value={q.isPending ? "—" : (d?.summary.needs_review ?? 0).toLocaleString()} sub="מתחת לרף הוודאות" />
                <Stat label="הוכרע מקומית" value={q.isPending ? "—" : (d?.summary.from_offline ?? 0).toLocaleString()} sub="ללא קריאה למודל" />
                <Stat label="פעולות שבוצעו" value="0" sub="שלב 1 מוסיף תוויות בלבד" last />
            </StatStrip>

            <SectionBar label="החלטות אחרונות" count={rows.length}>
                <button
                    type="button"
                    onClick={() => setNeedsReviewOnly((v) => !v)}
                    className={cn(
                        "h-6 px-2 rounded-md inline-flex items-center gap-1.5 text-[11px] transition-colors",
                        needsReviewOnly
                            ? "bg-sky-50 text-sky-700"
                            : "text-slate-500 hover:text-slate-900 hover:bg-slate-100",
                    )}
                >
                    {needsReviewOnly ? <CheckIcon className="w-3 h-3" /> : <FilterIcon className="w-3 h-3" />}
                    דורש בדיקה בלבד
                </button>
            </SectionBar>

            <PageBody>
                {q.isPending ? (
                    <div className="divide-y divide-slate-200/60">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="h-14 px-5 flex items-center gap-3">
                                <div className="h-3 w-8 bg-slate-100 rounded animate-pulse" />
                                <div className="h-3 w-64 bg-slate-100 rounded animate-pulse" />
                            </div>
                        ))}
                    </div>
                ) : q.isError ? (
                    <EmptyBlock title="לא ניתן לטעון תיוג אוטומטי" body="נסה שוב בעוד מספר רגעים." />
                ) : rows.length === 0 ? (
                    <EmptyBlock
                        title={needsReviewOnly ? "אין פריטים הדורשים בדיקה" : "טרם סווגו הודעות"}
                        body={
                            d?.enabled
                                ? "דואר נכנס מתויג בעת הגעתו. הודעות יוצאות שלנו אינן מסווגות, ומענים אוטומטיים נפוצים מוכרעים מקומית ללא קריאה למודל."
                                : "הפעל את התכונה כדי שדואר נכנס יתויג אוטומטית עם הגעתו."
                        }
                    />
                ) : (
                    <>
                        <div className="divide-y divide-slate-200/60">
                            {rows.map((r) => (
                                <Row key={r.id} r={r} />
                            ))}
                        </div>
                        {q.hasNextPage && (
                            <div className="px-5 py-3 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => q.fetchNextPage()}
                                    disabled={q.isFetchingNextPage}
                                    className="h-7 px-3 rounded-md border border-slate-200 text-[11.5px] text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                >
                                    {q.isFetchingNextPage ? "טוען…" : "טען עוד"}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </PageBody>

            <div className="px-5 py-3 flex items-center gap-1.5 text-[11px] text-slate-400">
                <SparklesIcon className="w-3 h-3" />
                כל תווית היא תווית ארגונית, כך שניתן לסנן לפיה בתוך{" "}
                <Link to="/app/unibox/all" className="underline underline-offset-2 hover:text-slate-700">
                    תיבת הדואר
                </Link>{" "}
                כמו כל תווית רגילה.
            </div>
        </Page>
    );
}
