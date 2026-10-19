// Enrichment: runs that fill contacts from Apollo's people database, started
// from the Contacts page selection bar.

import { Link } from "react-router-dom";
import { AlertTriangleIcon, DatabaseZapIcon, Loader2Icon, UsersIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useApolloEnrichments } from "@/lib/api/hooks/app/integrations/useApollo";
import type { ApolloEnrichmentRun } from "@/lib/api/models/app/integrations/Apollo";

import { Pill, SettingsCard, secondaryBtn } from "../../salesforce/_components/shared";
import { absolute, ago, errMsg } from "../../salesforce/_components/util";
import { Count } from "./ImportTab";

export default function EnrichTab({ connectionId }: { connectionId: string }) {
    const { i18n } = useTranslation();
    const isHe = i18n.language === "he";

    const runs = useApolloEnrichments(connectionId);
    const list = runs.data ?? [];

    return (
        <div className="space-y-6 max-w-5xl text-start rtl:text-right ltr:text-left">
            <SettingsCard
                title={isHe ? "כיצד פועלת העשרת נתונים" : "How enrichment works"}
                description={
                    isHe
                        ? "Apollo מצליב כל איש קשר לפי כתובת דוא\"ל ושם, ו-Warmbly ממלא את הפרטים שנמצאו: תפקיד, בכירות, חברה, לינקדאין, מיקום, אתר אינטרנט ותעשייה. כתובות הדוא\"ל אינן משתנות לעולם."
                        : "Apollo matches each contact by address and name, and Warmbly fills in what it finds: title, seniority, company, LinkedIn, location, website and industry. Addresses are never changed."
                }
            >
                <div className="px-4 py-3 flex flex-wrap items-center gap-3">
                    <p className="text-[12px] text-slate-600 flex-1 min-w-[240px] leading-relaxed">
                        {isHe ? (
                            <>
                                בחר אנשי קשר בעמוד אנשי הקשר ולחץ על <span className="font-medium text-slate-800">העשרה</span>.
                                נתוני הפרופיל מתעדכנים ישירות ממאגר Apollo. עד 5,000 אנשי קשר לכל ריצה.
                            </>
                        ) : (
                            <>
                                Select contacts on the Contacts page and choose <span className="font-medium text-slate-800">Enrich</span>.
                                Apollo charges one credit for each person it finds, and nothing for the ones it does not. Up to 5,000
                                contacts per run.
                            </>
                        )}
                    </p>
                    <Link to="/app/contacts" className={secondaryBtn}>
                        <UsersIcon className="w-3 h-3" />
                        {isHe ? "עבור לאנשי קשר" : "Go to Contacts"}
                    </Link>
                </div>
            </SettingsCard>

            <section className="space-y-2">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">
                    {isHe ? "ריצות אחרונות" : "Recent runs"}
                </div>
                {runs.isPending ? (
                    <div className="space-y-2">
                        {[0, 1].map((i) => (
                            <div key={i} className="h-16 rounded-md bg-slate-100 animate-pulse" />
                        ))}
                    </div>
                ) : runs.isError ? (
                    <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-700">
                        {errMsg(runs.error, isHe ? "לא ניתן לטעון ריצות העשרה" : "Could not load enrichment runs")}
                    </div>
                ) : list.length === 0 ? (
                    <div className="rounded-md border border-dashed border-slate-300 px-6 py-10 text-center">
                        <DatabaseZapIcon className="w-5 h-5 text-slate-300 mx-auto" />
                        <p className="text-[12.5px] font-medium text-slate-700 mt-2">
                            {isHe ? "אין ריצות העשרה עדיין" : "No enrichment runs yet"}
                        </p>
                        <p className="text-[11.5px] text-slate-500 mt-0.5">
                            {isHe ? "ריצות שתפעיל מעמוד אנשי הקשר יוצגו כאן יחד עם קצב ההתקדמות שלהן." : "Runs you start from the Contacts page show up here with their progress."}
                        </p>
                    </div>
                ) : (
                    <div className="rounded-md border border-slate-200 bg-white divide-y divide-slate-100">
                        {list.map((r) => (
                            <RunRow key={r.id} run={r} isHe={isHe} />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

function RunRow({ run: r, isHe }: { run: ApolloEnrichmentRun; isHe?: boolean }) {
    const active = r.status === "queued" || r.status === "running";
    const pct = r.total > 0 ? Math.round((r.processed / r.total) * 100) : 0;
    const complete = Math.max(0, r.processed - r.enriched - r.not_found - r.failed);
    return (
        <div className="px-4 py-3 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[12.5px] font-medium text-slate-900">
                    {isHe
                        ? `${r.total.toLocaleString()} ${r.total === 1 ? "איש קשר" : "אנשי קשר"}`
                        : `${r.total.toLocaleString()} contact${r.total === 1 ? "" : "s"}`}
                </span>
                <Pill>
                    {r.overwrite
                        ? (isHe ? "החלפה בנתוני Apollo" : "Replace with Apollo data")
                        : (isHe ? "מילוי שדות ריקים" : "Fill empty fields")}
                </Pill>
                <RunBadge status={r.status} isHe={isHe} />
                <span className="text-[11.5px] text-slate-500 ms-auto" title={absolute(r.created_at)}>
                    {isHe ? `התחיל ${ago(r.created_at)}` : `Started ${ago(r.created_at)}`}
                </span>
            </div>
            {active && (
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-label={`${pct}% done`}>
                    <div className="h-full bg-sky-500 transition-[width] duration-500" style={{ width: `${pct}%` }} />
                </div>
            )}
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500 tabular-nums">
                <Count label={isHe ? "עובדו" : "processed"} value={r.processed} />
                <Count label={isHe ? "הועשרו" : "enriched"} value={r.enriched} strong />
                <Count label={isHe ? "היו מלאים" : "already complete"} value={complete} />
                <Count label={isHe ? "לא נמצאו ב-Apollo" : "not found in Apollo"} value={r.not_found} />
                {r.failed > 0 && <Count label={isHe ? "נכשלו" : "failed"} value={r.failed} tone="rose" />}
                <Count label={isHe ? "קרדיטים נוצלו" : (r.credits_consumed === 1 ? "credit used" : "credits used")} value={r.credits_consumed} />
            </div>
            {r.last_error && (
                <p className="text-[11px] text-rose-700 flex items-start gap-1.5 break-words">
                    <AlertTriangleIcon className="w-3 h-3 mt-0.5 shrink-0" />
                    {r.last_error}
                </p>
            )}
        </div>
    );
}

function RunBadge({ status, isHe }: { status: ApolloEnrichmentRun["status"]; isHe?: boolean }) {
    switch (status) {
        case "queued":
            return <Pill>{isHe ? "בתור" : "Queued"}</Pill>;
        case "running":
            return (
                <Pill tone="sky">
                    <Loader2Icon className="w-2.5 h-2.5 animate-spin" />
                    {isHe ? "רץ" : "Running"}
                </Pill>
            );
        case "error":
            return <Pill tone="rose">{isHe ? "נעצר" : "Stopped"}</Pill>;
        default:
            return <Pill tone="emerald">{isHe ? "הושלם" : "Done"}</Pill>;
    }
}
