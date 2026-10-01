// Where a root redirect is served from, whether visitors get it, and how to fix it (or hand it to Warmbly Cloud) when they do not.
import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangleIcon, CheckCircle2Icon, CloudIcon, ExternalLinkIcon, Loader2Icon, ServerIcon, ZapIcon } from "lucide-react";
import type { DomainRedirect, RedirectServer } from "@/lib/api/models/app/emails/SendingDomain";
import timeAgo from "@/lib/helper/timeAgo";
import { cn } from "@/lib/utils";
import { CopyButton } from "./parts";
import { PROXY_NAMES, redirectBlocked } from "./rules";
import type { CloudServing } from "./cloudServing";

/* ── Served from ─────────────────────── */

export function ServedByPicker({
    value,
    current,
    onChange,
    onConnect,
    cloud,
}: {
    value: RedirectServer;
    /** Where it is served today, so an existing Cloud redirect stays selectable at the limit. */
    current?: RedirectServer;
    onChange: (v: RedirectServer) => void;
    /** Opens the link to Warmbly Cloud in place. */
    onConnect: () => void;
    cloud: CloudServing;
}) {
    // A redirect already on Cloud stays selectable at the limit, never once the link or the offer is gone.
    const cloudOpen = cloud.canServe || (current === "cloud" && cloud.connected && !!cloud.offer?.available);
    let cloudBody: React.ReactNode;
    if (!cloud.connected) {
        cloudBody = (
            <>
                חבר מופע זה לסביבת עבודה חינמית ב-Warmbly Cloud והוא יגיש את ההפניה ללא צורך בהגדרות נוספות כאן.
                <span className="block mt-1.5">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onConnect();
                        }}
                        className="h-6 px-2 rounded-md border border-sky-200 bg-white text-[11.5px] font-medium text-sky-700 hover:bg-sky-50 inline-flex items-center gap-1 transition-colors"
                    >
                        <CloudIcon className="w-3 h-3" />
                        התחבר ל-Warmbly Cloud
                    </button>
                </span>
            </>
        );
    } else if (!cloud.offer?.available) {
        cloudBody = "Warmbly Cloud אינו מגיש הפניות עבור מופע זה כעת.";
    } else if (!cloudOpen) {
        cloudBody = `Warmbly Cloud מגיש עד ${cloud.offer.limit} הפניות למופע אחד, ומכסה זו נוצלה במלואה.`;
    } else {
        cloudBody = "כוון את הדומיין ל-Warmbly Cloud. הוא יגיש את ההפניה ותעודת ה-SSL ללא צורך בהגדרות בשרת שלך.";
    }
    return (
        <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium text-start">מוגש באמצעות</div>
            <div role="radiogroup" aria-label="מהיכן מוגשת ההפניה" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <ServerOption
                    active={value === "instance"}
                    onSelect={() => onChange("instance")}
                    icon={<ServerIcon className="w-3.5 h-3.5" />}
                    title="שרת זה"
                    body="כוון את הדומיין למופע זה. אם שרת פרוקסי פועל לפני Warmbly, עליו להעביר את הדומיין הלאה."
                />
                <ServerOption
                    active={value === "cloud"}
                    disabled={!cloudOpen}
                    onSelect={() => onChange("cloud")}
                    icon={<CloudIcon className="w-3.5 h-3.5" />}
                    title="Warmbly Cloud"
                    badge="ללא הגדרות שרת"
                    body={cloudBody}
                />
            </div>
        </div>
    );
}

function ServerOption({
    active,
    disabled,
    onSelect,
    icon,
    title,
    badge,
    body,
}: {
    active: boolean;
    disabled?: boolean;
    onSelect: () => void;
    icon: React.ReactNode;
    title: string;
    badge?: string;
    body: React.ReactNode;
}) {
    return (
        <div
            role="radio"
            aria-checked={active}
            aria-disabled={disabled || undefined}
            tabIndex={disabled ? -1 : 0}
            onClick={() => !disabled && onSelect()}
            onKeyDown={(e) => {
                if (!disabled && (e.key === " " || e.key === "Enter")) {
                    e.preventDefault();
                    onSelect();
                }
            }}
            className={cn(
                "rounded-md border px-3 py-2.5 text-start transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sky-100",
                active ? "border-sky-400 bg-sky-50/60 ring-1 ring-sky-100" : "border-slate-200",
                disabled ? "bg-slate-50/60 cursor-default" : "cursor-pointer hover:border-slate-300",
                active && "hover:border-sky-400",
            )}
        >
            <div className="flex items-center gap-1.5">
                <span className={cn("shrink-0", active ? "text-sky-700" : disabled ? "text-slate-400" : "text-slate-500")}>{icon}</span>
                <span className={cn("text-[12.5px] font-medium", disabled && !active ? "text-slate-500" : "text-slate-900")}>{title}</span>
                {badge && !disabled && (
                    <span className="ms-auto h-4 px-1.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-medium inline-flex items-center whitespace-nowrap">
                        {badge}
                    </span>
                )}
            </div>
            <p className="mt-1 text-[11.5px] text-slate-500 leading-relaxed">{body}</p>
        </div>
    );
}

/* ── Status ─────────────────────── */

/** The redirect's state as a visitor would meet it: waiting for DNS, live, or in place but not reaching them. */
export function RedirectStatusBanner({ domain, redirect }: { domain: string; redirect: DomainRedirect }) {
    const reach = redirect.reach ?? null;
    const blocked = redirectBlocked(redirect);
    const live = redirect.verified && !blocked;
    const cloud = redirect.served_by === "cloud";
    const tone = live ? "emerald" : "amber";
    const checkedAt = redirect.last_checked_at ?? reach?.checked_at;

    let title: string;
    let body: React.ReactNode;
    if (!redirect.verified) {
        title = "ממתין ל-DNS";
        body = redirect.last_error || (cloud ? "הוסף את הרשומות שלהלן כדי להפנות את הדומיין ל-Warmbly Cloud." : "הוסף את הרשומות שלהלן אצל ספק ה-DNS שלך.");
    } else if (blocked) {
        title = "רשומות ה-DNS הוגדרו, אך מבקרים אינם מגיעים להפניה";
        body = reach?.detail || `פתיחת ${domain} אינה מגיעה להפניה כעת.`;
    } else {
        title = "פעיל";
        body = (
            <>
                <span dir="ltr">{domain}</span>
                {redirect.include_www ? <span dir="ltr"> וכן www.{domain}</span> : ""} מפנים אל{" "}
                <a
                    href={redirect.target_url}
                    target="_blank"
                    rel="noreferrer"
                    dir="ltr"
                    className="inline-flex items-center gap-0.5 underline decoration-emerald-300 hover:decoration-emerald-600 break-all"
                >
                    {redirect.target_url}
                    <ExternalLinkIcon className="w-2.5 h-2.5 shrink-0" />
                </a>
                .
            </>
        );
    }

    return (
        <div
            className={cn(
                "rounded-md border px-3 py-2.5 flex items-start gap-2 text-start",
                tone === "emerald" ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/60",
            )}
        >
            {live ? (
                <CheckCircle2Icon className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
            ) : blocked ? (
                <AlertTriangleIcon className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
            ) : (
                <Loader2Icon className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0 animate-spin" />
            )}
            <div className="min-w-0 flex-1 text-[11.5px] leading-relaxed">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <p className={cn("text-[12.5px] font-medium", tone === "emerald" ? "text-emerald-900" : "text-amber-900")}>{title}</p>
                    {cloud && (
                        <span className="h-4 px-1.5 rounded bg-white/70 ring-1 ring-inset ring-slate-200 text-slate-600 text-[10px] font-medium inline-flex items-center gap-1">
                            <CloudIcon className="w-2.5 h-2.5" />
                            Warmbly Cloud
                        </span>
                    )}
                </div>
                <p className={cn("break-words", tone === "emerald" ? "text-emerald-800/90" : "text-amber-800/90")}>{body}</p>
                {live && reach?.status === "unreachable" && reach.hint !== "no_listener" && reach.detail && (
                    <p className="text-[11px] text-slate-500 mt-1">{reach.detail}</p>
                )}
                {live && reach?.status === "unreachable" && reach.hint === "no_listener" && (
                    <p className="text-[11px] text-slate-500 mt-1">
                        שרת זה לא הצליח לפתוח את <span dir="ltr">{domain}</span> לבדיקה חוזרת.{" "}
                        <a
                            href={`http://${domain}`}
                            target="_blank"
                            rel="noreferrer"
                            dir="ltr"
                            className="text-sky-700 hover:text-sky-800 underline decoration-sky-300 hover:decoration-sky-600"
                        >
                            פתח אותו
                        </a>{" "}
                        לאימות.
                    </p>
                )}
                {checkedAt && <p className="text-[11px] text-slate-500 mt-0.5">נבדק לאחרונה לפני {timeAgo(checkedAt)}</p>}
            </div>
        </div>
    );
}

/* ── Fix ─────────────────────── */

type ProxyKey = "traefik" | "coolify" | "dokploy" | "nginx" | "caddy";

const PROXIES: { key: ProxyKey; label: string }[] = [
    { key: "traefik", label: "Traefik" },
    { key: "coolify", label: "Coolify" },
    { key: "dokploy", label: "Dokploy" },
    { key: "nginx", label: "nginx" },
    { key: "caddy", label: "Caddy" },
];

interface Step {
    text: React.ReactNode;
    code?: string;
}

function proxySteps(key: ProxyKey, domain: string, host: string, www: boolean): Step[] {
    const names = [domain, ...(www ? [`www.${domain}`] : [])];
    const H = (h: string) => <span dir="ltr" className="font-mono text-[11px] text-slate-800">{h}</span>;
    switch (key) {
        case "traefik":
            return [
                { text: <>מצא את כלל הניתוב שמכיל את {H(host)}, לרוב תווית בקונטיינר ה-tracking, והוסף אליו את הדומיין:</>, code: [host, ...names].map((n) => `Host(\`${n}\`)`).join(" || ") },
                { text: <>החל את השינוי באמצעות <span dir="ltr" className="font-mono text-[11px]">docker compose up -d</span>. מפענח התעודות של הראוטר ינפיק את התעודות באופן אוטומטי.</> },
            ];
        case "coolify":
            return [
                { text: <>פתח את משאב ה-Warmbly שלך ואת השירות ששדה ה-Domains שלו מכיל את {H(host)}. הוסף את הדומיין לשדה זה:</>, code: [host, ...names].map((n) => `https://${n}`).join(",") },
                { text: "שמור ופרוס מחדש. Coolify ינפיק את התעודות." },
            ];
        case "dokploy":
            return [
                { text: "פתח את פרויקט ה-compose של Warmbly ועבור אל Domains." },
                ...names.map((n) => ({ text: <>הוסף דומיין: host {H(n)}, שירות tracking, פורט 3000, HTTPS מופעל עם Let&apos;s Encrypt.</> })),
                { text: "בצע פריסה (Deploy)." },
            ];
        case "nginx":
            return [
                { text: <>בבלוק ה-server שמפנה ל-{H(host)}, הוסף את הדומיין לשמותיו:</>, code: `server_name ${[host, ...names].join(" ")};` },
                { text: "שמור על שם המארח המקורי בדרך ל-Warmbly, הנפק תעודה וטען מחדש את nginx:", code: `proxy_set_header Host $host;\ncertbot --nginx ${names.map((n) => `-d ${n}`).join(" ")}` },
            ];
        case "caddy":
            return [
                { text: <>הוסף את הדומיין לבלוק ה-site של {H(host)}:</>, code: `${[host, ...names].join(", ")} {` },
                { text: "טען מחדש את Caddy. הוא ינפיק את התעודות בעצמו." },
            ];
    }
}

function initialProxy(proxy?: string): ProxyKey {
    return proxy === "nginx" || proxy === "caddy" ? proxy : "traefik";
}

function CodeLine({ code }: { code: string }) {
    return (
        <div dir="ltr" className="mt-1 rounded-md bg-slate-900 text-slate-100 flex items-start gap-2 ps-2.5 pe-1 py-1.5">
            <pre className="min-w-0 flex-1 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all text-left">{code}</pre>
            <span className="[&_button]:text-slate-400 [&_button:hover]:text-white [&_button:hover]:bg-white/10">
                <CopyButton value={code} label="הקטע" />
            </span>
        </div>
    );
}

/** What to change when DNS is right but visitors do not get the redirect, with Cloud as the way around it. */
export function ReachFix({
    domain,
    redirect,
    cloud,
    onServeFromCloud,
    onConnect,
    switching,
}: {
    domain: string;
    redirect: DomainRedirect;
    cloud: CloudServing;
    onServeFromCloud: () => void;
    /** Opens the link to Warmbly Cloud in place; serving from it follows. */
    onConnect: () => void;
    switching: boolean;
}) {
    const reach = redirect.reach;
    const [proxy, setProxy] = React.useState<ProxyKey>(() => initialProxy(reach?.proxy));
    if (!reach || !redirectBlocked(redirect)) return null;

    const host = redirect.serve_host || "מארח המעקב שלך";
    const www = redirect.include_www;
    const named = reach.proxy ? PROXY_NAMES[reach.proxy] : "";
    let intro: React.ReactNode;
    let showProxies = true;
    if (redirect.served_by === "cloud") {
        intro = `Warmbly Cloud מגיש את ${domain}, אך הבדיקה לא הגיעה אליו. ודא שרשומות ה-root מצביעות אך ורק על הכתובות שלהלן, והסר כל רשומת A או AAAA אחרת עבור ${domain}.`;
        showProxies = false;
    } else {
        switch (reach.hint) {
            case "host_header":
                intro = "הפרוקסי שלך מעביר את הביקור ל-Warmbly אך מחליף את שם המארח, ולכן Warmbly אינו יכול לדעת איזה דומיין התבקש. העבר את כותרת ה-Host המקורית. ב-nginx זה נראה כך:";
                showProxies = false;
                break;
            case "wrong_target":
                intro = `גורם כלשהו לפני Warmbly כבר מפנה את ${domain} למקום אחר: כלל פרוקסי, או הפניה בספק הדומיין או ה-DNS שלך. הסר הפניה זו כדי שהביקור יגיע ל-Warmbly.`;
                showProxies = false;
                break;
            case "certificate":
                intro = `ההפניה פועלת ב-http, אך ל-https://${domain} אין תעודת SSL תקינה, ולכן הדפדפנים מציגים אזהרה. ${named ? `${named} מקבל` : "שרת הפרוקסי שלך יקבל"} תעודה ברגע שהדומיין יתווסף להגדרותיו:`;
                break;
            case "no_listener":
                intro =
                    reach.status === "https_error"
                        ? `אין מענה בפורט 443 עבור ${domain}. פתח את פורט 443 בחומת האש וודא שהפרוקסי מגיש את הדומיין:`
                        : `אין מענה בפורט 80 עבור ${domain}. פתח את פורט 80 בחומת האש שלך; מבקרים שמקלידים את הדומיין ללא https והנפקת תעודות זקוקים שניהם לפורט זה.`;
                showProxies = reach.status === "https_error";
                break;
            default:
                intro = named
                    ? `${named} בשרת שלך ענה במקום Warmbly. הוא מגיש רק את שמות המארחים שהוגדרו בו, לכן הוסף את ${domain} לצד ${host}, שכבר מגיע ל-Warmbly בהצלחה.`
                    : `גורם כלשהו לפני Warmbly ענה במקום, בדרך כלל פרוקסי כגון Traefik, nginx או Caddy, או לוח בקרה של אחסון. הוסף את ${domain} בכל מקום שבו ${host} מוגדר.`;
        }
    }
    const steps = proxySteps(proxy, domain, host, www);

    return (
        <div className="rounded-md border border-slate-200 bg-white text-start">
            <div className="px-3 py-2.5 space-y-2 text-[11.5px] text-slate-600 leading-relaxed">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">כיצד לתקן</div>
                <p>{intro}</p>
                {reach.hint === "host_header" && redirect.served_by !== "cloud" && <CodeLine code="proxy_set_header Host $host;" />}
                {showProxies && (
                    <>
                        <div role="tablist" aria-label="שרת הפרוקסי שלך" className="flex flex-wrap gap-1">
                            {PROXIES.map((p) => (
                                <button
                                    key={p.key}
                                    type="button"
                                    role="tab"
                                    aria-selected={proxy === p.key}
                                    onClick={() => setProxy(p.key)}
                                    className={cn(
                                        "h-6 px-2 rounded-md text-[11.5px] transition-colors",
                                        proxy === p.key ? "bg-sky-50 text-sky-700 font-medium ring-1 ring-inset ring-sky-200" : "text-slate-600 hover:bg-slate-100",
                                    )}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                        {reach.proxy === "traefik" && (proxy === "traefik" || proxy === "coolify" || proxy === "dokploy") && (
                            <p className="text-[11px] text-slate-500">Coolify ו-Dokploy מריצים את Traefik מתחת למכסה המנוע, בחר את שלך אם אתה משתמש בהם.</p>
                        )}
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.ol
                                key={proxy}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.14 }}
                                className="space-y-2 list-decimal ps-5 marker:text-slate-400"
                            >
                                {steps.map((s, i) => (
                                    <li key={i}>
                                        {s.text}
                                        {s.code && <CodeLine code={s.code} />}
                                    </li>
                                ))}
                            </motion.ol>
                        </AnimatePresence>
                    </>
                )}
                <p className="text-[11px] text-slate-500">לאחר השינוי, לחץ על 'בדוק כעת'. Warmbly גם בודק שוב כל 10 דקות.</p>
            </div>
            {redirect.served_by !== "cloud" && cloud.choosable && (cloud.canServe || !cloud.connected) && (
                <div className="border-t border-slate-100 px-3 py-2.5 flex items-start gap-2.5 bg-slate-50/60 rounded-b-md">
                    <CloudIcon className="w-3.5 h-3.5 text-sky-600 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1 text-[11.5px] text-slate-600 leading-relaxed">
                        <p className="text-[12px] font-medium text-slate-900">או דלג על הגדרות הפרוקסי</p>
                        <p>
                            {cloud.canServe
                                ? "Warmbly Cloud יכול להגיש הפניה זו ותעודת ה-SSL שלה. אתה מחליף את רשומות ה-root בלבד; דבר לא משתנה בשרת שלך."
                                : "חבר מופע זה לסביבת עבודה חינמית ב-Warmbly Cloud והוא יוכל להגיש הפניה זו ואת התעודה שלה, ללא כל שינוי בשרת. התהליך לוקח כדקה."}
                        </p>
                        <div className="mt-2">
                            {cloud.canServe ? (
                                <button
                                    type="button"
                                    onClick={onServeFromCloud}
                                    disabled={switching}
                                    className="h-7 px-2.5 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                                >
                                    {switching ? <Loader2Icon className="w-3 h-3 animate-spin" /> : <ZapIcon className="w-3 h-3" />}
                                    הגש מ-Warmbly Cloud
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={onConnect}
                                    className="h-7 px-2.5 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors"
                                >
                                    <CloudIcon className="w-3 h-3" />
                                    התחבר ל-Warmbly Cloud
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
