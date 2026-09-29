// Review step: what the import will do before it does it. Counts, the host and
// settings detected for every domain, grouped problems with their fix, the
// first rows, and the defaults every new mailbox gets.
import React from "react";
import { ChevronLeftIcon, ChevronRightIcon, ExternalLinkIcon, InfoIcon, Loader2Icon, WandSparklesIcon } from "lucide-react";
import type {
    DomainDetection,
    ImportLeg,
    MailboxImportPreview,
    MailboxImportSettings,
    OnExisting,
} from "@/lib/api/models/app/emails/MailboxImport";
import { mailHostLabel, mailHostLogo } from "@/lib/mailHost";
import { cn } from "@/lib/utils";
import { PREVIEW_STATUS, linesText, plural } from "./importFields";
import { Banner, HostMark, Linkified, Pill, SectionLabel, StatCard } from "./parts";
import ProviderLogo from "@/components/app/emails/ProviderLogo";
import { OnExistingChoice, SettingsSection } from "./SettingsSection";
import { DomainChoicesPanel } from "./DomainChoices";
import { offersChoices, type DomainPicks } from "./domainChoiceRules";

const DETECTED_FROM: Record<DomainDetection["source"], string> = {
    known: "ספק מוכר",
    mx: "מתוך רשומות MX",
    autoconfig: "מתוך הגדרת Autoconfig של הדומיין",
    ispdb: "מתוך מסד הנתונים של ספקי המייל",
    srv: "מתוך רשומות SRV",
    file: "מתוך הקובץ",
    none: "לא זוהה",
};

const SECURITY_LABEL: Record<string, string> = { tls: "SSL/TLS", starttls: "STARTTLS", none: "ללא הצפנה" };

const ROWS_PER_PAGE = 10;

export default function ReviewStep({
    preview,
    previewing,
    autoMapped,
    onEditMapping,
    onExisting,
    setOnExisting,
    settings,
    setSettings,
    domainPicks,
    setDomainPicks,
    onAllowance,
}: {
    preview: MailboxImportPreview;
    previewing: boolean;
    autoMapped: boolean;
    onEditMapping: () => void;
    onExisting: OnExisting;
    setOnExisting: (v: OnExisting) => void;
    settings: MailboxImportSettings;
    setSettings: React.Dispatch<React.SetStateAction<MailboxImportSettings>>;
    domainPicks: DomainPicks;
    setDomainPicks: React.Dispatch<React.SetStateAction<DomainPicks>>;
    onAllowance?: () => void;
}) {
    const s = preview.summary;
    const a = preview.allowance;
    const remaining = a && a.allowance != null ? (a.remaining ?? 0) : null;
    const newCount = s.ready + s.needs_signin;
    const full = remaining !== null && remaining <= 0 && newCount > 0;
    const overBy = remaining !== null && newCount > remaining ? newCount - remaining : 0;

    return (
        <div className="p-4 space-y-4">
            {autoMapped && (
                <div className="flex items-center gap-2 text-[11.5px] text-slate-600">
                    {preview.vendor ? (
                        <ProviderLogo id={preview.vendor.id} size="sm" />
                    ) : (
                        <WandSparklesIcon className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                    )}
                    <span className="min-w-0 truncate">
                        מופה אוטומטית{preview.vendor ? ` כייצוא של ${preview.vendor.label}` : preview.saved_mapping ? " מהמיפוי השמור שלך" : ""}
                    </span>
                    <span className="text-slate-300">·</span>
                    <button type="button" onClick={onEditMapping} className="text-sky-700 hover:text-sky-900 underline decoration-sky-300 shrink-0">
                        עריכה
                    </button>
                </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 relative">
                <StatCard label="מוכנות" value={s.ready} accent="emerald" />
                <StatCard label="דורשות התחברות" value={s.needs_signin} accent={s.needs_signin > 0 ? "sky" : "slate"} />
                <StatCard label="כבר קיימות" value={s.existing} accent="slate" />
                <StatCard label="לא תקינות" value={s.invalid} accent={s.invalid > 0 ? "red" : "slate"} />
                {previewing && (
                    <div className="absolute -top-1 ltr:-right-1 rtl:-left-1 size-5 rounded-full bg-white border border-slate-200 flex items-center justify-center">
                        <Loader2Icon className="w-3 h-3 text-slate-400 animate-spin" />
                    </div>
                )}
            </div>
            {(s.duplicate > 0 || s.total > preview.max_rows) && (
                <p className="text-[11.5px] text-slate-500 -mt-2">
                    {s.duplicate > 0 && `${plural(s.duplicate, "שורה חוזרת", "שורות חוזרות")} על כתובת שכבר הופיעה ברשימה ו${s.duplicate === 1 ? "הושמטה" : "הושמטו"}. `}
                    {s.total > preview.max_rows && `ייבוא אחד מקבל עד ${preview.max_rows.toLocaleString()} שורות.`}
                </p>
            )}

            {full ? (
                <Banner tone="red" title="מכסת תיבות הדואר שלך מלאה">
                    לא ניתן לחבר תיבות דואר חדשות ברשימה זו עד להגדלת המכסה.{" "}
                    {onAllowance && (
                        <button type="button" onClick={onAllowance} className="underline font-medium">
                            בקש הגדלת מכסה
                        </button>
                    )}
                </Banner>
            ) : overBy > 0 && remaining !== null ? (
                <Banner tone="amber" title={`נותר מקום ל-${remaining.toLocaleString()} תיבות דואר נוספות, ${newCount.toLocaleString()} חדשות ברשימה זו`}>
                    {remaining.toLocaleString()} הראשונות יחוברו ו-{overBy.toLocaleString()} הנותרות ידווחו כנכשלות, כך שתוכל{" "}
                    {onAllowance ? (
                        <button type="button" onClick={onAllowance} className="underline font-medium">
                            לבקש הגדלת מכסה
                        </button>
                    ) : (
                        "לבקש הגדלת מכסה"
                    )}{" "}
                    ולנסות שוב רק אותן.
                </Banner>
            ) : null}

            {preview.domains.length > 0 && <Domains domains={preview.domains} picks={domainPicks} setPicks={setDomainPicks} />}

            {preview.issues.length > 0 && (
                <div className="space-y-1.5">
                    <SectionLabel>דורש התייחסות</SectionLabel>
                    {preview.issues.map((i) => (
                        <div key={i.cause} className="rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2">
                            <div className="flex items-baseline gap-2">
                                <span className="text-[12.5px] font-medium text-amber-900 min-w-0 flex-1">{i.title}</span>
                                <span className="text-[11px] font-mono tabular-nums text-amber-800 shrink-0">{plural(i.count, "שורה", "שורות")}</span>
                            </div>
                            <p className="text-[11.5px] text-amber-900/80 leading-relaxed mt-0.5">
                                <Linkified text={i.fix} />
                            </p>
                            {i.lines.length > 0 && (
                                <p className="text-[11px] text-amber-800/70 mt-1 font-mono">שורות {linesText(i.lines, i.count)}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <RowsPreview preview={preview} />

            <OnExistingChoice source="file" value={onExisting} onChange={setOnExisting} />

            <SettingsSection settings={settings} setSettings={setSettings} note="ערך בקובץ גובר על הגדרות אלו עבור השורה שלו." />
        </div>
    );
}

function Domains({
    domains,
    picks,
    setPicks,
}: {
    domains: DomainDetection[];
    picks: DomainPicks;
    setPicks: React.Dispatch<React.SetStateAction<DomainPicks>>;
}) {
    const [all, setAll] = React.useState(false);
    const shown = all ? domains : domains.slice(0, 6);
    return (
        <div>
            <SectionLabel className="mb-1.5">דומיינים</SectionLabel>
            {domains.some(offersChoices) && (
                <div className="mb-2">
                    <DomainChoicesPanel infos={domains} picks={picks} setPicks={setPicks} />
                </div>
            )}
            <div className="rounded-md border border-slate-200 divide-y divide-slate-100">
                {shown.map((d) => (
                    <DomainRow
                        key={d.domain}
                        d={d}
                    />
                ))}
                {domains.length > shown.length && (
                    <button
                        type="button"
                        onClick={() => setAll(true)}
                        className="w-full h-8 text-[11.5px] text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                    >
                        הצג את כל {domains.length.toLocaleString()} הדומיינים
                    </button>
                )}
            </div>
        </div>
    );
}

function legText(label: string, leg?: ImportLeg): string | null {
    if (!leg?.host) return null;
    const sec = leg.security ? ` ${SECURITY_LABEL[leg.security] ?? leg.security}` : "";
    return `${label} ${leg.host}:${leg.port}${sec}`;
}

function DomainRow({ d, choices }: { d: DomainDetection; choices?: React.ReactNode }) {
    const label = d.label || mailHostLabel(d.mail_host) || "שרת לא מוכר";
    const signIn = mailHostLogo(d.mail_host) === "google" ? "Google" : "Microsoft";
    const legs = [legText("SMTP", d.smtp), legText("IMAP", d.imap)].filter(Boolean).join(" · ");
    return (
        <div className="px-3 py-2.5 flex items-start gap-2.5">
            <HostMark host={d.mail_host} className="mt-0.5" />
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[12.5px] font-medium text-slate-900 truncate" dir="ltr">{d.domain}</span>
                    <span className="text-[11.5px] text-slate-500 truncate">{label}</span>
                    <span className="ms-auto text-[11px] font-mono tabular-nums text-slate-500 shrink-0">{plural(d.rows, "שורה", "שורות")}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 min-w-0 text-[11px] text-slate-500">
                    {legs ? <span className="font-mono truncate" dir="ltr">{legs}</span> : <span className="text-slate-400">לא זוהו שרתים</span>}
                    <span className="text-slate-300 shrink-0">·</span>
                    <span className="shrink-0">{DETECTED_FROM[d.source] ?? d.source}</span>
                </div>
                {d.auth && (
                    <div className="mt-1 flex items-center gap-2.5">
                        <AuthDot on={d.auth.spf} label="SPF" />
                        <AuthDot on={d.auth.dkim} label="DKIM" hint="מפתח DKIM יושב תחת בורר (Selector) ש-DNS לא יכול להציג כרשימה, לכן 'לא נמצא' משמעותו לא אומת ולא בהכרח חסר." />
                        <AuthDot on={d.auth.dmarc} label="DMARC" />
                    </div>
                )}
                {d.password_auth === "app_password" && (
                    <p className="mt-1.5 text-[11.5px] text-slate-600 leading-relaxed flex items-start gap-1.5">
                        <InfoIcon className="w-3 h-3 mt-0.5 text-sky-600 shrink-0" />
                        <span>
                            {label} דורש סיסמת אפליקציה, ולא את סיסמת החשבון הרגילה.
                            {d.app_password_url && (
                                <>
                                    {" "}
                                    <a
                                        href={d.app_password_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-0.5 text-sky-700 underline decoration-sky-300 hover:decoration-sky-600"
                                    >
                                        צור סיסמת אפליקציה
                                        <ExternalLinkIcon className="w-2.5 h-2.5" />
                                    </a>
                                </>
                            )}
                        </span>
                    </p>
                )}
                {d.password_auth === "oauth_only" && (
                    <p className="mt-1.5 text-[11.5px] text-slate-600 leading-relaxed flex items-start gap-1.5">
                        <InfoIcon className="w-3 h-3 mt-0.5 text-sky-600 shrink-0" />
                        <span>
                            {label} מתחבר באמצעות התחברות {signIn}: שורות אלו יקבלו כפתור התחברות לאחר הייבוא.
                        </span>
                    </p>
                )}
                {d.password_auth === "unsupported" && (
                    <p className="mt-1.5 text-[11.5px] text-amber-800 leading-relaxed flex items-start gap-1.5">
                        <InfoIcon className="w-3 h-3 mt-0.5 text-amber-600 shrink-0" />
                        <span>
                            {d.mail_host === "proton"
                                ? "Proton Mail תומך ב-IMAP ו-SMTP רק דרך Proton Mail Bridge במחשב שלך, לכן לא ניתן לחבר שורות אלו כאן."
                                : "אף שרת דואר לא השיב עבור דומיין זה, לכן לא ניתן לחבר שורות אלו עד שיוגדרו שרתים בקובץ."}
                        </span>
                    </p>
                )}
                {choices}
            </div>
        </div>
    );
}

function AuthDot({ on, label, hint }: { on: boolean; label: string; hint?: string }) {
    return (
        <span
            className="inline-flex items-center gap-1 text-[10.5px] text-slate-500"
            title={on ? `${label} נמצא` : hint ?? `${label} לא נמצא`}
        >
            <span className={cn("size-1.5 rounded-full", on ? "bg-emerald-500" : "bg-slate-300")} />
            {label}
        </span>
    );
}

function RowsPreview({ preview }: { preview: MailboxImportPreview }) {
    const [page, setPage] = React.useState(0);
    const rows = preview.rows;
    const pages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
    const at = Math.min(page, pages - 1);
    const slice = rows.slice(at * ROWS_PER_PAGE, at * ROWS_PER_PAGE + ROWS_PER_PAGE);
    if (rows.length === 0) return null;
    return (
        <div>
            <div className="flex items-center gap-2 mb-1.5">
                <SectionLabel>שורות</SectionLabel>
                {preview.summary.total > rows.length && (
                    <span className="text-[11px] text-slate-400">
                        {rows.length.toLocaleString()} הראשונות מתוך {preview.summary.total.toLocaleString()}
                    </span>
                )}
                {pages > 1 && (
                    <div className="ms-auto flex items-center gap-1">
                        <span className="text-[11px] text-slate-500 tabular-nums me-1">
                            {at + 1} / {pages}
                        </span>
                        <button
                            type="button"
                            aria-label="שורות קודמות"
                            disabled={at === 0}
                            onClick={() => setPage(at - 1)}
                            className="size-6 rounded-md border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 inline-flex items-center justify-center disabled:opacity-40 transition-colors"
                        >
                            <ChevronLeftIcon className="w-3 h-3 rtl:rotate-180" />
                        </button>
                        <button
                            type="button"
                            aria-label="שורות הבאות"
                            disabled={at >= pages - 1}
                            onClick={() => setPage(at + 1)}
                            className="size-6 rounded-md border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 inline-flex items-center justify-center disabled:opacity-40 transition-colors"
                        >
                            <ChevronRightIcon className="w-3 h-3 rtl:rotate-180" />
                        </button>
                    </div>
                )}
            </div>
            <div className="rounded-md border border-slate-200 overflow-hidden">
                <table className="w-full text-start table-fixed">
                    <thead className="bg-slate-50/60">
                        <tr className="border-b border-slate-200">
                            <th className="px-3 py-1.5 text-[10px] font-medium text-slate-400 uppercase tracking-[0.14em] w-12">שורה</th>
                            <th className="px-3 py-1.5 text-[10px] font-medium text-slate-400 uppercase tracking-[0.14em]">אימייל</th>
                            <th className="hidden md:table-cell px-3 py-1.5 text-[10px] font-medium text-slate-400 uppercase tracking-[0.14em] w-40">שרת מארח</th>
                            <th className="px-3 py-1.5 text-[10px] font-medium text-slate-400 uppercase tracking-[0.14em] w-32">סטטוס</th>
                        </tr>
                    </thead>
                    <tbody>
                        {slice.map((r) => {
                            const st = PREVIEW_STATUS[r.status] ?? PREVIEW_STATUS.invalid;
                            return (
                                <tr key={r.line} className="border-b border-slate-100 last:border-b-0 align-top">
                                    <td className="px-3 py-1.5 text-[11px] text-slate-500 font-mono">{r.line}</td>
                                    <td className="px-3 py-1.5 min-w-0">
                                        <div className="text-[11.5px] text-slate-800 truncate" dir={r.email ? "ltr" : undefined}>{r.email || <span className="text-slate-300">ללא כתובת</span>}</div>
                                        {r.problem && <div className="text-[11px] text-red-600 leading-snug mt-0.5">{r.problem}</div>}
                                    </td>
                                    <td className="hidden md:table-cell px-3 py-1.5 text-[11.5px] text-slate-600">
                                        <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full">
                                            <ProviderLogo id={r.mail_host} size="xs" framed={false} />
                                            <span className="truncate">{mailHostLabel(r.mail_host) || "לא ידוע"}</span>
                                        </span>
                                    </td>
                                    <td className="px-3 py-1.5">
                                        <Pill className={st.cls}>{st.label}</Pill>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
