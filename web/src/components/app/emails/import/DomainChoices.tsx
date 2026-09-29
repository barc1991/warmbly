// Domain choices an import applies as each mailbox connects: a tracking host on
// the domain (link.<domain> unless one already works) and a redirect of its root
// to the company website. One base value covers every domain; the dropdown under
// it changes any domain on its own.
import React from "react";
import { SparklesIcon } from "lucide-react";
import { TextInput } from "@/components/ui/field";
import { CheckSquare } from "@/components/ui/check-square";
import { Chip, SuggestionChip } from "@/components/app/emails/domains/parts";
import { PerDomainList, type PerDomainRow } from "@/components/app/emails/domains/PerDomainList";
import { commonWebsite, redirectTargetProblem, trackingHostProblem } from "@/components/app/emails/domains/rules";
import { useSendingDomains } from "@/lib/api/hooks/app/emails/useSendingDomains";
import { vendorLabel } from "@/lib/api/models/app/emails/MailboxSources";
import { plural } from "./importFields";
import { SectionLabel } from "./parts";
import {
    DEFAULT_TRACKING_LABEL,
    effectivePick,
    labelProblem,
    needsRecord,
    offersChoices,
    vendorCoverage,
    vendorForwards,
    vendorWritesCname,
    type DomainInfo,
    type DomainPicks,
} from "./domainChoiceRules";

function CheckRow({
    checked,
    onToggle,
    label,
    children,
}: {
    checked: boolean;
    onToggle: () => void;
    label: string;
    children?: React.ReactNode;
}) {
    return (
        <div className="flex items-center gap-2 min-w-0 min-h-7">
            <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={onToggle}
                className="inline-flex items-center gap-2 shrink-0 text-[11.5px] text-slate-700 hover:text-slate-900 rounded outline-none focus-visible:ring-2 focus-visible:ring-sky-100"
            >
                <CheckSquare checked={checked} />
                {label}
            </button>
            {children}
        </div>
    );
}

/** The choice for every domain at once, with how much of it the vendor does. */
export function AllDomainsChoice({
    infos,
    picks,
    setPicks,
}: {
    infos: DomainInfo[];
    picks: DomainPicks;
    setPicks: React.Dispatch<React.SetStateAction<DomainPicks>>;
}) {
    const sending = useSendingDomains();
    const website = React.useMemo(() => commonWebsite(sending.data?.data ?? []), [sending.data]);
    const usable = infos.filter(offersChoices);
    const withTracking = usable.filter((i) => i.tracking);
    const cov = vendorCoverage(usable);
    const vendor = vendorLabel(cov.vendor);
    const track = picks.all.track ?? true;
    const label = picks.all.label ?? DEFAULT_TRACKING_LABEL;
    const redirect = picks.all.redirect ?? false;
    const url = picks.all.url ?? "";
    const lp = track ? labelProblem(label) : null;
    const urlProblem = redirect && url.trim() ? redirectTargetProblem(url, "") : null;
    const n = usable.length;
    const many = n > 1;
    const newHosts = withTracking.filter((i) => i.tracking?.status === "suggested").length;
    const example = usable[0]?.domain ?? "yourdomain.com";
    const exampleHost = many ? `${label || DEFAULT_TRACKING_LABEL}.${example}` : effectivePick(usable[0], picks).host;

    // Base values fill every domain nobody changed; a changed domain keeps its own until Reset.
    const setTrack = (on: boolean) => setPicks((p) => ({ ...p, all: { ...p.all, track: on } }));
    const setLabel = (v: string) => setPicks((p) => ({ ...p, all: { ...p.all, label: v.trim().toLowerCase() } }));
    const setRedirect = (on: boolean) =>
        setPicks((p) => ({ ...p, all: { ...p.all, redirect: on, url: on && !p.all.url ? website : p.all.url } }));
    const setUrl = (v: string) => setPicks((p) => ({ ...p, all: { ...p.all, url: v } }));

    if (n === 0) return null;
    return (
        <div className="rounded-lg border border-sky-200 bg-sky-50/40 p-3 space-y-3">
            <div className="flex items-center gap-1.5">
                <SparklesIcon className="w-3 h-3 text-sky-600" />
                <span className="text-[12px] font-medium text-slate-900">{many ? `עבור כל ${n.toLocaleString()} הדומיינים` : "מומלץ לעבירות גבוהה"}</span>
            </div>

            {withTracking.length > 0 && (
                <div className="space-y-1">
                    <CheckRow checked={track} onToggle={() => setTrack(!track)} label="דומיין מעקב משלך">
                        {track && newHosts > 0 && (
                            <span dir="ltr" className="inline-flex items-center min-w-0 rounded-md border border-slate-200 bg-white focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100">
                                <input
                                    value={label}
                                    onChange={(e) => setLabel(e.target.value)}
                                    aria-label="תת-דומיין מעקב"
                                    aria-invalid={!!lp}
                                    spellCheck={false}
                                    className="h-7 w-16 pl-2 bg-transparent text-[12px] font-mono text-slate-900 outline-none"
                                />
                                <span className="pr-2 text-[12px] font-mono text-slate-400 truncate">.{many ? "<domain>" : example}</span>
                            </span>
                        )}
                        <Chip tone="sky">מומלץ</Chip>
                    </CheckRow>
                    <p className="ps-[22px] text-[11px] text-slate-500 leading-relaxed">
                        קישורים ופיקסל הפתיחה משתמשים ב-<span dir="ltr" className="font-mono">{exampleHost}</span> במקום בשרת משותף עם שולחים אחרים, כך שכל קישור
                        בהודעה מצביע על החברה ששלחה אותה.
                        {track && newHosts > 0 && (
                            cov.cname > 0 ? (
                                <span className="text-slate-600">
                                    {" "}
                                    {vendor} מוסיף את רשומת ה-DNS עבור {cov.cname === n ? (many ? "כולם" : "הדומיין") : `${cov.cname} מתוך ${n}`}.
                                    {cov.cname < n && " השאר ימתינו בעמוד דומייני השליחה לרשומת CNAME שתוסיף."}
                                </span>
                            ) : (
                                <span className="text-slate-600">
                                    {" "}
                                    {many ? "כל דומיין דורש" : "הדומיין דורש"} רשומת CNAME שתוסיף לאחר הייבוא; הקישורים יעברו אליו ברגע שהרשומה תתעדכן.
                                </span>
                            )
                        )}
                    </p>
                    {lp && <p className="ps-[22px] text-[11px] text-rose-700">{lp}</p>}
                </div>
            )}

            <div className="space-y-1">
                <CheckRow checked={redirect} onToggle={() => setRedirect(!redirect)} label={many ? "הפניית כל דומיין ראשי אל" : "הפניית הדומיין הראשי אל"}>
                    {redirect && (
                        <TextInput
                            value={url}
                            onChange={setUrl}
                            placeholder={website || "https://yourcompany.com"}
                            invalid={!!urlProblem}
                            title={urlProblem ?? undefined}
                            className="flex-1 min-w-0 [direction:ltr] text-left"
                        />
                    )}
                </CheckRow>
                <p className="ps-[22px] text-[11px] text-slate-500 leading-relaxed">
                    מי שמקליד את {many ? "אחד הדומיינים האלו" : <span dir="ltr" className="font-mono">{example}</span>} בדפדפן מגיע לאתר שלך במקום לעמוד ריק, וכך הדומיין נראה כחלק
                    מעסק אמיתי.
                    {redirect &&
                        (cov.forward > 0 ? (
                            <span className="text-slate-600">
                                {" "}
                                {vendor} מפנה {cov.forward === n ? (many ? "את כולם" : "אותו") : `${cov.forward} מתוך ${n}`} ללא צורך בהוספת DNS.
                            </span>
                        ) : (
                            <span className="text-slate-600"> רשומות ה-DNS להוספה ימתינו בעמוד דומייני השליחה לאחר הייבוא.</span>
                        ))}
                </p>
                {urlProblem && <p className="ps-[22px] text-[11px] text-rose-700">{urlProblem}</p>}
            </div>
        </div>
    );
}

/** The shared choice with each domain's own values in a dropdown under it. */
export function DomainChoicesPanel({
    infos,
    picks,
    setPicks,
}: {
    infos: DomainInfo[];
    picks: DomainPicks;
    setPicks: React.Dispatch<React.SetStateAction<DomainPicks>>;
}) {
    const usable = infos.filter(offersChoices);
    if (usable.length === 0) return null;
    const rows: PerDomainRow[] = usable.map((info) => {
        const own = picks.each[info.domain];
        const e = effectivePick(info, picks);
        const vendor = vendorLabel(info.vendor_domain?.vendor);
        const t = info.tracking;
        const trackChip = !t ? null : !needsRecord(info, e.host) ? (
            <SuggestionChip status={t.status} />
        ) : vendorWritesCname(info.vendor_domain) ? (
            <Chip tone="sky" title={`${vendor} כותב את רשומת ה-CNAME דרך ה-API שלו במהלך הייבוא.`}>
                {vendor} מוסיף DNS
            </Chip>
        ) : (
            <Chip tone="slate" title={t.cname_target ? `הוסף רשומת CNAME עבור ${e.host} המצביעה אל ${t.cname_target} לאחר הייבוא.` : undefined}>
                דרוש DNS
            </Chip>
        );
        const redirectChip =
            info.redirect?.verified && info.redirect.target_url === e.url.trim() ? (
                <Chip tone="emerald">מאומת</Chip>
            ) : vendorForwards(info.vendor_domain) ? (
                <Chip tone="sky" title={`${vendor} מפנה את הדומיין בעצמו, כך שאין צורך להוסיף DNS.`}>
                    דרך {vendor}
                </Chip>
            ) : null;
        return {
            domain: info.domain,
            canTrack: !!t || !!info.trackingLoading,
            loading: info.trackingLoading,
            track: e.track,
            host: e.host,
            redirect: e.redirect,
            url: e.url,
            urlPlaceholder: picks.all.url ?? "",
            custom: !!own && Object.keys(own).length > 0,
            trackChip,
            redirectChip,
            hostProblem: own?.host !== undefined ? trackingHostProblem(e.host, info.domain) : null,
            urlProblem: e.redirect ? redirectTargetProblem(e.url, info.domain) : null,
        };
    });
    return (
        <div className="space-y-2">
            <AllDomainsChoice infos={infos} picks={picks} setPicks={setPicks} />
            {usable.length > 1 && (
                <PerDomainList
                    rows={rows}
                    onChange={(d, patch) => setPicks((prev) => ({ ...prev, each: { ...prev.each, [d]: { ...prev.each[d], ...patch } } }))}
                    onReset={(d) =>
                        setPicks((prev) => {
                            const each = { ...prev.each };
                            delete each[d];
                            return { ...prev, each };
                        })
                    }
                />
            )}
        </div>
    );
}

/** The picked mailboxes' domains with their choices, for the vendor and grant wizards. */
export function DomainChoicesSection({
    infos,
    picks,
    setPicks,
    capped = 0,
}: {
    infos: DomainInfo[];
    picks: DomainPicks;
    setPicks: React.Dispatch<React.SetStateAction<DomainPicks>>;
    /** Domains past the ones shown, which get no choices here. */
    capped?: number;
}) {
    if (!infos.some(offersChoices)) return null;
    return (
        <div>
            <SectionLabel className="mb-1.5">דומיינים</SectionLabel>
            <DomainChoicesPanel infos={infos} picks={picks} setPicks={setPicks} />
            {capped > 0 && (
                <p className="mt-1 text-[11px] text-slate-500">
                    {plural(capped, "דומיין נוסף אינו מופיע", "דומיינים נוספים אינם מופיעים")} ברשימה. ניתן להגדיר אותם בעמוד דומייני השליחה לאחר
                    הייבוא.
                </p>
            )}
        </div>
    );
}
