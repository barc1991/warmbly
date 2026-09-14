"use client";

import React from "react";
import {
    BotIcon,
    CalendarIcon,
    CheckIcon,
    InboxIcon,
    LayersIcon,
    Loader2Icon,
    MailIcon,
    MessageSquareIcon,
    SendIcon,
    ShieldAlertIcon,
    UsersIcon,
} from "lucide-react";
import toast from "react-hot-toast";

import { useUpdateConnectionConfig } from "@/lib/api/hooks/app/integrations/useFieldMappings";
import { useTestConnection } from "@/lib/api/hooks/app/integrations/useConnectionWebhookTools";
import type { IntegrationConnection } from "@/lib/api/models/app/integrations/Integration";
import { cn } from "@/lib/utils";

interface EventItem {
    id: string;
    title: string;
    desc: string;
    badge?: string;
    badgeColor?: string;
    recommended?: boolean;
}

interface EventCategory {
    id: string;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    events: EventItem[];
}

const TELEGRAM_ALERT_CATEGORIES: EventCategory[] = [
    {
        id: "ai",
        title: "בינה מלאכותית ומפתחות (AI & BDR)",
        icon: BotIcon,
        events: [
            {
                id: "ai.quota_exhausted",
                title: "חריגת מכסה ב-AI (שגיאת Rate Limit 429)",
                desc: "התראה קריטית כאשר מפתח AI חורג ממכסת השאילתות של הספק",
                badge: "קריטי",
                badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
                recommended: true,
            },
            {
                id: "ai.fallback_engaged",
                title: "מעבר אוטומטי למודל גיבוי (Fallback)",
                desc: "התראה כאשר מודל ראשי נכשל והמערכת עברה למודל החלופי",
                badge: "חשוב",
                badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
                recommended: true,
            },
            {
                id: "ai.key_error",
                title: "שגיאת מפתח AI או מפתח מושעה",
                desc: "מפתח ה-API אינו תקין, פג תוקף, מושעה או ללא הרשאות",
                badge: "קריטי",
                badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
                recommended: true,
            },
            {
                id: "ai.bdr_draft_failed",
                title: "שגיאה בניסוח אוטונומי של סוכן BDR",
                desc: "סוכן ה-AI לא הצליח לנסח טיוטת מענה אוטונומית לליד",
                badge: "סוכן AI",
                badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
                recommended: true,
            },
        ],
    },
    {
        id: "replies",
        title: "מענים ולידים נכנסים (Replies)",
        icon: MessageSquareIcon,
        events: [
            {
                id: "campaign.reply_received",
                title: "מענה חדש מהליד (כולל זיהוי סנטימנט חיובי)",
                desc: "מענה נכנס עם סיווג כוונות AI (מענה חיובי 🔥, בקשת פגישה, ועוד)",
                badge: "מומלץ מאוד",
                badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
                recommended: true,
            },
            {
                id: "form.submitted",
                title: "טופס לידים נשלח בהצלחה",
                desc: "ליד מילא ושלח טופס באתר או בדף הנחיתה",
                badge: "לידים",
                badgeColor: "bg-sky-50 text-sky-700 border-sky-200",
                recommended: true,
            },
        ],
    },
    {
        id: "meetings",
        title: "פגישות ויומן (Calendar)",
        icon: CalendarIcon,
        events: [
            {
                id: "meeting.booked",
                title: "פגישה חדשה נקבעה ביומן! 🎯",
                desc: "איש קשר תיאם שיחה דרך Calendly / Cal.com עם פרטי המועד",
                badge: "פגישה",
                badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
                recommended: true,
            },
            {
                id: "meeting.rescheduled",
                title: "מועד פגישה נדחה או עודכן",
                desc: "איש קשר שינה את מועד הפגישה המתוכננת ביומן",
                recommended: true,
            },
            {
                id: "meeting.canceled",
                title: "פגישה בוטלה ביומן",
                desc: "איש קשר או מנהל ביטל פגישה שנקבעה",
                badge: "ביטול",
                badgeColor: "bg-slate-100 text-slate-700 border-slate-200",
                recommended: true,
            },
        ],
    },
    {
        id: "crm",
        title: "עסקאות וסנכרון Frappe CRM",
        icon: LayersIcon,
        events: [
            {
                id: "frappe_crm.lead_synced",
                title: "איש קשר סונכרן והומר לליד ב-Frappe CRM",
                desc: "סנכרון אוטונומי של פרטי הליד והמענה למערכת ה-CRM",
                badge: "Frappe CRM",
                badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
                recommended: true,
            },
            {
                id: "crm.deal_created",
                title: "עסקה חדשה נפתחה ב-CRM",
                desc: "נוצרה הזדמנות מכירה חדשה המשויכת לאיש הקשר",
                recommended: true,
            },
            {
                id: "crm.deal_updated",
                title: "שלב עסקה עודכן ב-CRM",
                desc: "עסקה התקדמה שלב בפייפליין המכירות",
                recommended: false,
            },
        ],
    },
    {
        id: "deliverability",
        title: "עבירות ובריאות חימום (Deliverability)",
        icon: ShieldAlertIcon,
        events: [
            {
                id: "campaign.deliverability_warning",
                title: "אזהרת עבירות בדיוור (Deliverability Warning)",
                desc: "ירידה בשיעור המסירה או סיכון מיידי למוניטין הדומיין",
                badge: "קריטי",
                badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
                recommended: true,
            },
            {
                id: "deliverability.bounce",
                title: "מייל חזר (שגיאת מסירה / Bounce)",
                desc: "כתובת היעד אינה קיימת או ששרת הנמען דחה את המייל",
                badge: "Bounce",
                badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
                recommended: true,
            },
            {
                id: "campaign.unsubscribed",
                title: "בקשת הסרה מרשימת תפוצה (Unsubscribe)",
                desc: "נמען לחץ על קישור הסרה או ביקש להפסיק קבלת דיוור",
                recommended: true,
            },
            {
                id: "deliverability.complaint",
                title: "תלונת ספאם התקבלה מנמען",
                desc: "נמען דיווח על המייל כספאם בתיבת הדואר שלו",
                badge: "קריטי",
                badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
                recommended: true,
            },
            {
                id: "warmup.health_changed",
                title: "שינוי בציון בריאות החימום",
                desc: "שינוי ברמת המוניטין ובציון הבריאות של תיבת דואר",
                recommended: false,
            },
            {
                id: "warmup.placement_in_spam",
                title: "מייל חימום נחת בספאם",
                desc: "מערכת החימום זיהתה שמייל חימום נחת בתיקיית דואר זבל",
                badge: "ספאם",
                badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
                recommended: true,
            },
            {
                id: "warmup.quarantined",
                title: "תיבת דואר הוכנסה להסגר (Quarantine)",
                desc: "תיבה הושהתה זמנית כדי למנוע נזק נוסף למוניטין",
                badge: "הסגר",
                badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
                recommended: true,
            },
            {
                id: "warmup.blocked",
                title: "תיבת דואר נחסמה מחימום",
                desc: "ספק הדואר חסם את התיבה או שאימות הסיסמה נכשל",
                badge: "חסימה",
                badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
                recommended: true,
            },
        ],
    },
    {
        id: "mailboxes",
        title: "תשתיות ותיבות דואר",
        icon: InboxIcon,
        events: [
            {
                id: "email_account.error",
                title: "שגיאת התחברות לתיבת דואר (IMAP/SMTP)",
                desc: "שגיאת אימות, סיסמת אפליקציה שגויה או ניתוק מהשרת",
                badge: "קריטי",
                badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
                recommended: true,
            },
        ],
    },
    {
        id: "campaigns",
        title: "קמפיינים ודיוור (Campaigns)",
        icon: MailIcon,
        events: [
            {
                id: "campaign.started",
                title: "קמפיין החל לפעול",
                desc: "קמפיין דיוור חדש הופעל ומתחיל לשלוח מיילים",
                recommended: true,
            },
            {
                id: "campaign.paused",
                title: "קמפיין הושהה",
                desc: "קמפיין הושהה ידנית או אוטומטית עקב חריגה",
                recommended: true,
            },
            {
                id: "campaign.completed",
                title: "קמפיין הסתיים בהצלחה",
                desc: "כל המיילים והשלבים בקמפיין הסתיימו",
                recommended: true,
            },
            {
                id: "campaign.email_sent",
                title: "מייל קמפיין נשלח",
                desc: "התראה על כל מייל יוצא (עשוי ליצור עומס בקמפיינים גדולים)",
                recommended: false,
            },
            {
                id: "campaign.email_opened",
                title: "ליד פתח מייל קמפיין",
                desc: "התראה מיידית כשאיש קשר פותח את הודעת הדוא\"ל",
                recommended: false,
            },
            {
                id: "campaign.email_clicked",
                title: "ליד לחץ על קישור במייל",
                desc: "איש קשר לחץ על קישור מעקב בתוך המייל",
                recommended: false,
            },
        ],
    },
    {
        id: "contacts",
        title: "אנשי קשר (Contacts)",
        icon: UsersIcon,
        events: [
            {
                id: "contact.created",
                title: "איש קשר חדש נוסף למערכת",
                desc: "איש קשר חדש הועלה בקובץ CSV או נוסף ידנית",
                recommended: false,
            },
            {
                id: "contact.updated",
                title: "פרטי איש קשר עודכנו",
                desc: "עודכנו שדות, תגיות או סטטוס של איש קשר",
                recommended: false,
            },
        ],
    },
];

const ALL_EVENT_IDS = TELEGRAM_ALERT_CATEGORIES.flatMap((c) => c.events.map((e) => e.id));
const RECOMMENDED_EVENT_IDS = TELEGRAM_ALERT_CATEGORIES.flatMap((c) =>
    c.events.filter((e) => e.recommended).map((e) => e.id),
);

export default function TelegramAlertsSettings({
    connection,
    onSaved,
}: {
    connection: IntegrationConnection;
    onSaved?: () => void;
}) {
    const updateConfig = useUpdateConnectionConfig();
    const testConnection = useTestConnection();
    const [sendingTest, setSendingTest] = React.useState(false);

    // Initial selected events from config_capabilities
    const rawEvents = connection.config_capabilities?.selected_events;
    const initialSelected = React.useMemo(() => {
        if (Array.isArray(rawEvents)) {
            return rawEvents.map(String);
        }
        return RECOMMENDED_EVENT_IDS;
    }, [rawEvents]);

    const [selected, setSelected] = React.useState<string[]>(initialSelected);
    const [savedStatus, setSavedStatus] = React.useState<"saved" | "saving" | null>(null);

    // Keep in sync if connection updates externally
    React.useEffect(() => {
        if (Array.isArray(rawEvents)) {
            setSelected(rawEvents.map(String));
        }
    }, [rawEvents]);

    const displayFields = (connection.display_fields ?? {}) as Record<string, unknown>;
    const botUsername = (displayFields.bot_username as string) || (displayFields.account as string) || "";
    const chatID = (displayFields.chat_id as string) || "";
    const topicID = (displayFields.topic_id as string) || "";

    async function applyEvents(newEvents: string[]) {
        setSelected(newEvents);
        setSavedStatus("saving");
        try {
            await updateConfig.mutateAsync({
                connectionId: connection.id,
                config_capabilities: {
                    ...(connection.config_capabilities ?? {}),
                    selected_events: newEvents,
                },
            });
            setSavedStatus("saved");
            setTimeout(() => setSavedStatus(null), 2500);
            onSaved?.();
        } catch {
            setSavedStatus(null);
            toast.error("שגיאה בשמירת הגדרות ההתראות");
        }
    }

    function toggleEvent(id: string) {
        const next = selected.includes(id) ? selected.filter((e) => e !== id) : [...selected, id];
        void applyEvents(next);
    }

    function selectAll() {
        void applyEvents(ALL_EVENT_IDS);
    }

    function selectRecommended() {
        void applyEvents(RECOMMENDED_EVENT_IDS);
    }

    function clearAll() {
        void applyEvents([]);
    }

    async function handleSendTest() {
        setSendingTest(true);
        try {
            await testConnection.mutateAsync(connection.id);
            toast.success("התראת בדיקה נשלחה בהצלחה לטלגרם!");
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : "לא ניתן לשלוח התראת בדיקה";
            toast.error(errorMsg);
        } finally {
            setSendingTest(false);
        }
    }

    const activeCount = selected.length;
    const totalCount = ALL_EVENT_IDS.length;

    return (
        <div className="space-y-4" dir="rtl">
            {/* Telegram connection details bar */}
            <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#24A1DE] text-white flex items-center justify-center font-bold text-xs shrink-0">
                            TG
                        </div>
                        <div>
                            <div className="text-[12.5px] font-medium text-slate-800 flex items-center gap-1.5">
                                {botUsername ? `@${botUsername}` : "בוט טלגרם מחובר"}
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    פעיל
                                </span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                                מזהה צ'אט: {chatID || "מוגדר"} {topicID ? `• נושא: #${topicID}` : ""}
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleSendTest}
                        disabled={sendingTest}
                        className="h-7 px-2.5 rounded-md border border-slate-200 hover:border-sky-300 hover:bg-sky-50 text-[11.5px] text-slate-700 hover:text-sky-700 font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                        title="שלח התראת ניסיון מעוצבת בעברית לערוץ או לקבוצה שלך"
                    >
                        {sendingTest ? (
                            <Loader2Icon className="w-3 h-3 animate-spin text-sky-600" />
                        ) : (
                            <SendIcon className="w-3 h-3 text-sky-600" />
                        )}
                        <span>שליחת בדיקה</span>
                    </button>
                </div>
            </div>

            {/* Header & Quick Action Presets */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-[12.5px] font-semibold text-slate-900">בחירת התראות לטלגרם</h4>
                        <p className="text-[11px] text-slate-500">
                            סמן אילו התראות יישלחו ישירות לצ'אט שלך בטלגרם בזמן אמת.
                        </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                        {savedStatus === "saving" && (
                            <span className="text-[11px] text-slate-400 inline-flex items-center gap-1">
                                <Loader2Icon className="w-3 h-3 animate-spin" /> שומר…
                            </span>
                        )}
                        {savedStatus === "saved" && (
                            <span className="text-[11px] text-emerald-600 font-medium inline-flex items-center gap-1">
                                <CheckIcon className="w-3 h-3" /> נשמר
                            </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-sky-50 text-sky-700 border border-sky-200">
                            {activeCount} / {totalCount}
                        </span>
                    </div>
                </div>

                {/* Preset buttons */}
                <div className="flex items-center gap-1.5 pt-1">
                    <button
                        type="button"
                        onClick={selectAll}
                        className="h-6 px-2 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] text-slate-700 transition-colors"
                    >
                        בחר הכל
                    </button>
                    <button
                        type="button"
                        onClick={selectRecommended}
                        className="h-6 px-2 rounded border border-sky-200 bg-sky-50/60 hover:bg-sky-50 text-[11px] text-sky-700 font-medium transition-colors"
                    >
                        מומלץ בלבד (מומלץ)
                    </button>
                    <button
                        type="button"
                        onClick={clearAll}
                        className="h-6 px-2 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[11px] text-slate-500 transition-colors"
                    >
                        נקה הכל
                    </button>
                </div>
            </div>

            {/* Categories and checkboxes */}
            <div className="space-y-4 pt-1">
                {TELEGRAM_ALERT_CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const catSelectedCount = cat.events.filter((e) => selected.includes(e.id)).length;

                    return (
                        <div key={cat.id} className="rounded-md border border-slate-200 overflow-hidden bg-white">
                            {/* Category title bar */}
                            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Icon className="w-3.5 h-3.5 text-slate-600" />
                                    <span className="text-[12px] font-semibold text-slate-800">{cat.title}</span>
                                </div>
                                <span className="text-[10.5px] text-slate-500 font-mono">
                                    {catSelectedCount} / {cat.events.length}
                                </span>
                            </div>

                            {/* Event items list */}
                            <div className="divide-y divide-slate-100">
                                {cat.events.map((ev) => {
                                    const isChecked = selected.includes(ev.id);

                                    return (
                                        <label
                                            key={ev.id}
                                            className={cn(
                                                "px-3 py-2.5 flex items-start gap-2.5 cursor-pointer transition-colors select-none",
                                                isChecked ? "bg-sky-50/20 hover:bg-sky-50/40" : "hover:bg-slate-50/60",
                                            )}
                                        >
                                            <div className="pt-0.5 shrink-0">
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => toggleEvent(ev.id)}
                                                    className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                                                />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span
                                                        className={cn(
                                                            "text-[12px] font-medium leading-tight",
                                                            isChecked ? "text-slate-900" : "text-slate-600",
                                                        )}
                                                    >
                                                        {ev.title}
                                                    </span>
                                                    {ev.badge && (
                                                        <span
                                                            className={cn(
                                                                "inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-medium border leading-none",
                                                                ev.badgeColor || "bg-slate-50 text-slate-600 border-slate-200",
                                                            )}
                                                        >
                                                            {ev.badge}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                                                    {ev.desc}
                                                </p>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
