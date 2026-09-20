import { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDownIcon, ClockIcon, UsersIcon } from "lucide-react";
import useCampaignSendPlan from "@/lib/api/hooks/app/campaigns/useCampaignSendPlan";
import type SendPlan from "@/lib/api/models/app/campaigns/SendPlan";
import type { MailboxPlan, SendBottleneck, SendLimitKind } from "@/lib/api/models/app/campaigns/SendPlan";
import { DitherMeter } from "@/components/ui/dither";
import AnimatedNumber from "@/components/ui/AnimatedNumber";

interface LimitMeta {
    label: string;
    hint: string;
    to?: string;
}

const LIMIT_META: Record<SendLimitKind, LimitMeta> = {
    campaign_daily_limit: {
        label: "מגבלה יומית לקמפיין",
        hint: "קמפיין זה מגביל כל תיבה מתחת למגבלה היומית שלה.",
        to: "preferences#senders",
    },
    campaign_ramp: {
        label: "חימום הדרגתי של הקמפיין (Ramp-up)",
        hint: "העלייה היומית ההדרגתית עדיין מטפסת לעבר התקרה.",
        to: "preferences#rotation",
    },
    warmup_graduation: {
        label: "מעבר מחימום לשליחה קרה",
        hint: "תיבה שחוממה מתחילה שליחה קרה ב-5 עד 20 ביום ומוסיפה 5 בכל יום תקין עד הגעה למגבלה שלה.",
        to: "/app/emails",
    },
    workspace_risk: {
        label: "מצב שליחה של סביבת העבודה",
        hint: "סביבת העבודה מוגבלת, ולכן כל תיבה שולחת חלק מהמגבלה שלה.",
        to: "/app/deliverability",
    },
    domain_auth: {
        label: "אימות דומיין נכשל",
        hint: "דומיין שליחה נכשל ב-SPF או DMARC מעבר לתקופת החסד; לא נשלח ממנו דבר.",
        to: "/app/emails",
    },
    resting: {
        label: "במנוחה או ברזרבה",
        hint: "התיבה הוצאה מסבב השליחה הקרה; היא ממשיכה בחימום ולא שולחת הודעות קרות.",
        to: "/app/emails",
    },
    warmup_health_hold: {
        label: "מושהה עקב בריאות חימום",
        hint: "התיבה בהסגר או חסומה עקב בריאות החימום שלה ולא תשלח קר עד שזה יוסר.",
        to: "/app/emails",
    },
    other_campaigns: {
        label: "בשימוש על ידי קמפיינים אחרים",
        hint: "המגבלה היומית של התיבה משותפת לכל הקמפיינים; השליחות הללו הוקצו לקמפיין אחר היום.",
        to: "/app/campaigns",
    },
    warmup_health_pace: {
        label: "האטה עקב בריאות חימום",
        hint: "תיבה במעקב או מואטת מקבלת מרווחים רחבים יותר בין שליחות היום.",
        to: "/app/emails",
    },
    mailbox_hours: {
        label: "מחוץ לשעות הפעילות של התיבה",
        hint: "התיבה באזור זמן אחר או עם ימי עבודה מוגדרים סגורה להיום.",
        to: "/app/emails",
    },
    sending_behavior: {
        label: "תוכנית התנהגות שליחה",
        hint: "יום העבודה המוגדר לתיבה מקצה לה פחות שליחות היום מהתקרה שלה.",
        to: "/app/emails",
    },
    spacing: {
        label: "מרווח מינימלי בין שליחות",
        hint: "עם זמן השליחה שנותר היום, המרווח בין שתי שליחות מתיבה אחת אינו מאפשר שליחות נוספות.",
        to: "/app/emails",
    },
    sending_window: {
        label: "מחוץ לחלון השליחה",
        hint: "לפי לוח הזמנים של הקמפיין לא נותר זמן שליחה היום.",
        to: "schedule",
    },
    not_running: {
        label: "הקמפיין אינו פעיל",
        hint: "הקמפיין מושהה או כבוי, שום דבר לא יישלח עד להפעלתו.",
    },
    org_daily_limit: {
        label: "מכסה יומית של החשבון",
        hint: "מכסה יומית מוגדרת בכל הקמפיינים.",
        to: "/app/campaigns",
    },
    new_lead_cap: {
        label: "מכסת לידים חדשים ליום",
        hint: "רק כמות זו של אנשי קשר יקבלו אימייל ראשון היום; המשכי מעקב ממשיכים כרגיל.",
        to: "preferences#leadflow",
    },
    leads: {
        label: "אין מספיק לידים מוכנים",
        hint: "התיבות יכולות לשלוח יותר, אך אין שלבים נוספים להיום.",
        to: "leads",
    },
};

const STATE_META: Record<MailboxPlan["state"], { label: string; tone: string }> = {
    sending: { label: "שולח", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
    budget_spent: { label: "נוצל התקציב", tone: "bg-slate-100 text-slate-600 ring-slate-200" },
    hours_closed: { label: "סגור", tone: "bg-amber-50 text-amber-700 ring-amber-200" },
    no_working_day: { label: "יום חופש", tone: "bg-slate-100 text-slate-600 ring-slate-200" },
    domain_auth: { label: "אימות נכשל", tone: "bg-rose-50 text-rose-700 ring-rose-200" },
    resting: { label: "במנוחה", tone: "bg-slate-100 text-slate-600 ring-slate-200" },
    health_hold: { label: "השהיית בריאות", tone: "bg-rose-50 text-rose-700 ring-rose-200" },
    window_closed: { label: "חלון סגור", tone: "bg-amber-50 text-amber-700 ring-amber-200" },
};

const LIMITED_BY: Record<MailboxPlan["limited_by"], string> = {
    mailbox_daily_cap: "מגבלת תיבה",
    campaign_daily_limit: "מגבלת קמפיין",
    campaign_ramp: "עלייה הדרגתית",
    warmup_graduation: "יציאה מחימום",
    workspace_risk: "מצב סביבת עבודה",
};

function fmtTime(iso: string | undefined, tz: string): string {
    if (!iso) return "";
    try {
        return new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz });
    } catch {
        return new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
    }
}

function fmtDay(iso: string | undefined, tz: string): string {
    if (!iso) return "";
    const d = new Date(iso);
    const today = new Date();
    const opts: Intl.DateTimeFormatOptions = { timeZone: tz };
    const sameDay = d.toLocaleDateString("he-IL", opts) === today.toLocaleDateString("he-IL", opts);
    if (sameDay) return fmtTime(iso, tz);
    return `${d.toLocaleDateString("he-IL", { weekday: "short", timeZone: tz })} ${fmtTime(iso, tz)}`;
}

function shortTz(tz: string): string {
    const city = tz.split("/").pop() ?? tz;
    return city.replace(/_/g, " ");
}

// The one sentence under the number: what decided it.
function headline(plan: SendPlan): string {
    const b: SendBottleneck = plan.bottleneck;
    const n = plan.projected_today;
    if (plan.mailboxes.length === 0) return "אף תיבת דואר אינה משויכת לקמפיין זה, ולכן לא ניתן לשלוח הודעות.";
    if (plan.status !== "active") {
        const held = plan.limits.find((l) => l.kind === "not_running")?.emails ?? 0;
        return `לאחר הפעלה, קמפיין זה צפוי לשלוח כ-${(plan.expected_remaining + held).toLocaleString("he-IL")} הודעות היום.`;
    }
    switch (b) {
        case "":
            return n === plan.configured_ceiling
                ? "שום דבר אינו מגביל את השליחה מתחת להגדרות שלך."
                : "כל תיבת דואר שולחת לפי המגבלה המקסימלית שלה.";
        case "budget_spent":
            return "כל התיבות מיצו את תקציב השליחה שלהן להיום; השליחה תתחדש מחר.";
        case "leads":
            return `רק ${(plan.leads.due_now + plan.leads.due_later_today).toLocaleString("he-IL")} שלבים ממתינים להיום; התיבות מסוגלות לשלוח יותר.`;
        case "sending_window":
            return plan.window.opens_at
                ? `מחוץ לחלון השליחה; החלון ייפתח ב-${fmtDay(plan.window.opens_at, plan.timezone)}.`
                : "מחוץ לחלון השליחה.";
        case "new_lead_cap":
            return `מגבלת הלידים החדשים ליום (${plan.leads.max_new_leads_per_day}) היא שמעכבת; המשכי מעקב ממשיכים כרגיל.`;
        case "org_daily_limit":
            return `החשבון מאפשר עד ${plan.organization?.daily_limit.toLocaleString("he-IL") ?? ""} אימיילים ביום בכל הקמפיינים.`;
        default: {
            const meta = LIMIT_META[b];
            return meta ? `${meta.label} מגבילה את השליחה מתחת ל-${plan.configured_ceiling.toLocaleString("he-IL")} שהוגדרו.` : "";
        }
    }
}

function WindowLine({ plan }: { plan: SendPlan }) {
    const w = plan.window;
    const tz = shortTz(plan.timezone);
    let text: string;
    if (w.starts_at && new Date(w.starts_at).getTime() > Date.now()) {
        text = `מתחיל ב-${fmtDay(w.starts_at, plan.timezone)}`;
    } else if (!w.sending_day) {
        text = w.opens_at ? `אינו יום שליחה. ייפתח ב-${fmtDay(w.opens_at, plan.timezone)}` : "אינו יום שליחה";
    } else if (w.open_now) {
        text = w.closes_at ? `חלון פתוח עד ${fmtTime(w.closes_at, plan.timezone)}` : "חלון שליחה פתוח";
    } else if (w.opens_at) {
        text = `חלון ייפתח ב-${fmtDay(w.opens_at, plan.timezone)}`;
    } else {
        text = "חלון השליחה סגור להיום";
    }
    return (
        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
            <ClockIcon className="size-3 text-slate-400" />
            {text}
            <span className="text-slate-400">· {tz}</span>
        </span>
    );
}

function LeadsLine({ plan }: { plan: SendPlan }) {
    const l = plan.leads;
    const parts: string[] = [];
    parts.push(`${l.due_now.toLocaleString("he-IL")} ממתינים כעת`);
    if (l.due_later_today) parts.push(`${l.due_later_today.toLocaleString("he-IL")} בהמשך היום`);
    if (l.waiting_on_step) parts.push(`${l.waiting_on_step.toLocaleString("he-IL")} ממתינים לשלב הבא`);
    if (l.waiting_on_condition) parts.push(`${l.waiting_on_condition.toLocaleString("he-IL")} בחלון תנאי/הסתעפות`);
    if (l.waiting_on_sender) parts.push(`${l.waiting_on_sender.toLocaleString("he-IL")} ממתינים לתיבה המקורית`);
    if (l.held) parts.push(`${l.held.toLocaleString("he-IL")} מושהים`);
    if (l.max_new_leads_per_day > 0) parts.push(`${l.new_leads_started_today}/${l.max_new_leads_per_day} לידים חדשים היום`);
    return (
        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 min-w-0">
            <UsersIcon className="size-3 text-slate-400 shrink-0" />
            <span className="truncate">לידים: {parts.join(" · ")}</span>
        </span>
    );
}

function withDefaults(plan: SendPlan): SendPlan {
    return {
        ...plan,
        limits: plan.limits ?? [],
        mailboxes: plan.mailboxes ?? [],
        window: plan.window ?? { sending_day: false, open_now: false, minutes_left: 0 },
        leads: plan.leads ?? {
            due_now: 0, due_later_today: 0, new_leads_due_today: 0, waiting_on_step: 0,
            waiting_on_condition: 0, held: 0, waiting_on_sender: 0, new_leads_started_today: 0, max_new_leads_per_day: 0,
        },
        configured_ceiling: plan.configured_ceiling ?? 0,
        projected_today: plan.projected_today ?? 0,
        sent_today: plan.sent_today ?? 0,
        expected_remaining: plan.expected_remaining ?? 0,
        bottleneck: plan.bottleneck ?? "",
        timezone: plan.timezone || "Asia/Jerusalem",
        status: plan.status ?? "",
    };
}

export default function SendPlanCard({ campaignId }: { campaignId: string }) {
    const q = useCampaignSendPlan(campaignId);
    const [open, setOpen] = useState(false);
    const plan = q.data && typeof q.data === "object" && "campaign_id" in q.data ? withDefaults(q.data) : undefined;

    if (q.isPending) {
        return (
            <div dir="rtl" className="rounded-md border border-slate-200 bg-white h-12 px-4 flex items-center gap-3">
                <div className="h-5 w-16 bg-slate-100 rounded animate-pulse" />
                <div className="h-3 w-64 bg-slate-100 rounded animate-pulse" />
            </div>
        );
    }
    if (q.isError || !plan) {
        return (
            <div dir="rtl" className="rounded-md border border-slate-200 bg-white h-12 px-4 flex items-center gap-2 text-[11.5px] text-slate-500">
                <span className="text-slate-700 font-medium">תוכנית השליחה להיום</span>
                <span>לא ניתנה לחישוב כרגע. המערכת מנסה שוב באופן אוטומטי.</span>
            </div>
        );
    }

    const frac = plan.projected_today > 0 ? plan.sent_today / plan.projected_today : 0;
    const campaignBase = `/app/campaigns/${campaignId}`;
    const linkFor = (to?: string) => (!to ? undefined : to.startsWith("/") ? to : `${campaignBase}/${to}`);
    const showWaterfall = plan.limits.length > 0 || plan.sent_today > 0;

    return (
        <div dir="rtl" className="rounded-md border border-slate-200 overflow-hidden bg-white text-right">
            {/* The strip */}
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="w-full min-h-12 px-4 py-2 flex items-center gap-3 text-right hover:bg-slate-50/60 transition-colors"
            >
                <span className="flex items-baseline gap-1.5 shrink-0">
                    <AnimatedNumber
                        value={plan.projected_today}
                        className="text-[20px] font-semibold text-slate-900 leading-none tabular-nums"
                    />
                    <span className="text-[11.5px] text-slate-600">{plan.status === "active" ? "היום" : "ליום"}</span>
                </span>
                <span className="hidden sm:block w-20 shrink-0">
                    <DitherMeter frac={frac} tone="sky" height={4} />
                </span>
                <span className="text-[11px] text-slate-400 font-mono tabular-nums shrink-0 hidden md:inline">
                    {plan.sent_today.toLocaleString("he-IL")} נשלחו · {plan.expected_remaining.toLocaleString("he-IL")} נותרו
                </span>
                <span className="text-[11.5px] text-slate-500 truncate min-w-0 flex-1">{headline(plan)}</span>
                <span className="hidden lg:inline-flex shrink-0">
                    <WindowLine plan={plan} />
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
                    פירוט
                    <ChevronDownIcon className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />
                </span>
            </button>

            <AnimatePresence initial={false}>
                {open ? (
                    <motion.div
                        key="why"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-slate-200/60">
                            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-slate-200/60">
                                {/* Right column: From settings to today (Waterfall) */}
                                <div className="px-4 py-3">
                                    <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium mb-1.5">
                                        מההגדרות שלך ועד להיום
                                    </div>
                                    {showWaterfall ? (
                                        <div className="divide-y divide-slate-100">
                                            <div className="h-7 flex items-center gap-3 text-[12px]">
                                                <span className="text-slate-700">סך מגבלות התיבות שהוגדרו</span>
                                                <span className="mr-auto font-mono text-[11.5px] text-slate-700 tabular-nums">
                                                    {plan.configured_ceiling.toLocaleString("he-IL")}
                                                </span>
                                            </div>
                                            {plan.limits.map((l) => {
                                                const meta = LIMIT_META[l.kind];
                                                const to = linkFor(meta?.to);
                                                const body = (
                                                    <>
                                                        <span className="text-slate-700 truncate">{meta?.label ?? l.kind}</span>
                                                        {l.mailboxes ? (
                                                            <span className="text-[10.5px] text-slate-400 shrink-0">
                                                                ({l.mailboxes} {l.mailboxes === 1 ? "תיבה" : "תיבות"})
                                                            </span>
                                                        ) : null}
                                                        <span className="mr-auto font-mono text-[11.5px] text-rose-600 tabular-nums shrink-0">
                                                            −{l.emails.toLocaleString("he-IL")}
                                                        </span>
                                                    </>
                                                );
                                                return to ? (
                                                    <Link
                                                        key={l.kind}
                                                        to={to}
                                                        title={meta?.hint}
                                                        className="h-7 flex items-center gap-2 text-[12px] hover:bg-slate-50 -mx-2 px-2 rounded transition-colors"
                                                    >
                                                        {body}
                                                    </Link>
                                                ) : (
                                                    <div key={l.kind} title={meta?.hint} className="h-7 flex items-center gap-2 text-[12px]">
                                                        {body}
                                                    </div>
                                                );
                                            })}
                                            {plan.sent_today > 0 && (
                                                <div className="h-7 flex items-center gap-3 text-[12px]">
                                                    <span className="text-slate-700">נשלחו היום</span>
                                                    <span className="mr-auto font-mono text-[11.5px] text-slate-500 tabular-nums">
                                                        −{plan.sent_today.toLocaleString("he-IL")}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="h-7 flex items-center gap-3 text-[12px]">
                                                <span className="text-slate-900 font-medium">נותרו לשליחה היום</span>
                                                <span className="mr-auto font-mono text-[11.5px] text-slate-900 font-medium tabular-nums">
                                                    {plan.expected_remaining.toLocaleString("he-IL")}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-[11.5px] text-slate-400 py-1">שום מגבלה אינה מורידה את כמות השליחה היום.</p>
                                    )}
                                    <div className="mt-2 flex flex-col gap-1">
                                        <LeadsLine plan={plan} />
                                        <span className="lg:hidden">
                                            <WindowLine plan={plan} />
                                        </span>
                                        {plan.organization && (
                                            <span className="text-[11px] text-slate-500">
                                                מכסה יומית: {plan.organization.sent_today.toLocaleString("he-IL")}/{plan.organization.daily_limit.toLocaleString("he-IL")} היום
                                            </span>
                                        )}
                                        {plan.next_wake_at && (
                                            <span className="text-[11px] text-slate-400">בדיקה הבאה: {fmtDay(plan.next_wake_at, plan.timezone)}</span>
                                        )}
                                    </div>
                                </div>

                                {/* Left column: Mailbox details */}
                                <div className="px-4 py-3 min-w-0">
                                    <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium mb-1.5">
                                        {plan.mailboxes.length} {plan.mailboxes.length === 1 ? "תיבת דואר" : "תיבות דואר"}
                                    </div>
                                    {plan.mailboxes.length === 0 ? (
                                        <p className="text-[11.5px] text-slate-400 py-1">אף תיבת דואר אינה משויכת לקמפיין זה.</p>
                                    ) : (
                                        <div className="divide-y divide-slate-100">
                                            {plan.mailboxes.map((m) => {
                                                const st = STATE_META[m.state] ?? STATE_META.sending;
                                                const sentTitle = m.sent_by_other_campaigns
                                                    ? `${m.sent_today} מקמפיין זה, ${m.sent_by_other_campaigns} מקמפיינים אחרים`
                                                    : `${m.sent_today} מקמפיין זה`;
                                                return (
                                                    <div key={m.id} className="py-1.5 flex items-center gap-2 min-w-0">
                                                        <span className="flex-1 min-w-0">
                                                            <span className="block text-[12px] text-slate-900 truncate" dir="ltr">{m.email}</span>
                                                            <span className="block text-[10.5px] text-slate-400 truncate">
                                                                {m.limited_by !== "mailbox_daily_cap" ? `${LIMITED_BY[m.limited_by]} · ` : ""}
                                                                מרווח {Math.round(m.min_gap_seconds / 60)} דק׳
                                                                {m.graduation
                                                                    ? ` · ${m.graduation.days_to_full_cap} ${m.graduation.days_to_full_cap === 1 ? "יום תקין" : "ימים תקינים"} עד ${m.graduation.mailbox_cap}${m.graduation.held ? ", העלייה מושהית" : ""}`
                                                                    : ""}
                                                                {m.health ? ` · בריאות חימום: ${m.health}` : ""}
                                                                {m.reopens_at ? ` · ייפתח שוב ב-${fmtDay(m.reopens_at, plan.timezone)}` : ""}
                                                            </span>
                                                        </span>
                                                        <span className="font-mono text-[11px] text-slate-500 tabular-nums shrink-0" title={sentTitle} dir="ltr">
                                                            {m.sent_today}
                                                            {m.sent_by_other_campaigns ? <span className="text-slate-400">+{m.sent_by_other_campaigns}</span> : null}
                                                            <span className="text-slate-300"> / </span>
                                                            <span className="text-slate-700">{m.cap_today}</span>
                                                            {m.cap_today !== m.configured_cap && <span className="text-slate-400"> (מתוך {m.configured_cap})</span>}
                                                        </span>
                                                        <span
                                                            className={`inline-flex items-center rounded px-1.5 h-5 text-[10px] font-medium ring-1 shrink-0 ${st.tone}`}
                                                            title={m.state === "sending" ? `נותרו עוד ${m.expected_remaining}` : undefined}
                                                        >
                                                            {st.label}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </div>
    );
}
