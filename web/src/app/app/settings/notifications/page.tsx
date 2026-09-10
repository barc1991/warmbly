import React from "react";
import {
    useNotificationPreferences,
    useUpdateNotificationPreferences,
} from "@/lib/api/hooks/app/notifications/useNotifications";
import {
    EMAIL_WINDOW_MAX_MINUTES,
    EMAIL_WINDOW_MIN_MINUTES,
    normalizeNotificationPreferences,
    type NotificationCategoryKey,
    type NotificationPreferences,
} from "@/lib/api/models/app/notifications/Notification";
import { Row, Section, SectionShell, Toggle } from "../_components/SectionShell";
import { OptionSelect } from "@/components/app/campaigns/preferences/components/CampaignPreferenceBoolBox";
import { NumberInput } from "@/components/ui/field";
import SaveStatus from "../_components/SaveStatus";
import { useAutosave } from "@/hooks/useAutosave";
import { useRegisterUnsaved } from "@/hooks/context/unsaved";

const INBOUND: { key: NotificationCategoryKey; label: string; hint: string }[] = [
    { key: "inbound_reply", label: "התקבלה תגובה", hint: "נמען הגיב לאימייל קר." },
    { key: "inbound_out_of_office", label: "זוהה מענה אוטומטי (מחוץ למשרד)", hint: "תשובה אוטומטית התקבלה עבור אחת השליחות שלך." },
];

const HEALTH: { key: NotificationCategoryKey; label: string; hint: string }[] = [
    { key: "health_bounce", label: "זוהתה שגיאת מסירה (Bounce)", hint: "קמפיין מתחיל להחזיר שגיאות מסירה — שולח התראה לבעל הקמפיין." },
    { key: "health_complaint", label: "תלונת ספאם", hint: "אירוע תלונה כלשהו באחד הקמפיינים שלך." },
    { key: "health_worker_downtime", label: "השבתת וורקר (Worker)", hint: "וורקר שולח מפסיק להגיב." },
    { key: "health_domain_auth", label: "כשל באימות דומיין", hint: "דומיין שולח איבד את רשומת ה-SPF או ה-DMARC שלו. שליחה קרה וחימום ייעצרו ממנו אם לא יתוקן." },
    { key: "campaign_paused", label: "קמפיין הושהה אוטומטית", hint: "מנגנון הגנה עצר קמפיין מכיוון ששיעור ה-Bounce, התלונות או התגובות חרג מהטווח המותר." },
];

const SECURITY: { key: NotificationCategoryKey; label: string; hint: string }[] = [
    { key: "security_new_signin", label: "התחברות חדשה", hint: "התבצעה גישה לחשבונך ממכשיר שלא השתמשת בו בעבר." },
];

const BILLING: { key: NotificationCategoryKey; label: string; hint: string }[] = [
    { key: "billing_alert", label: "התראות תקופת ניסיון וחיוב", hint: "תקופת הניסיון שלך עומדת לפוג או שסביבת העבודה הושהתה. נשלח לחברים המנהלים חיוב." },
];

const TEAM: { key: NotificationCategoryKey; label: string; hint: string }[] = [
    { key: "team_activity", label: "חבר צוות הצטרף לסביבת העבודה", hint: "חבר חדש קיבל הזמנה. נשלח למנהלי הצוות." },
];

// Window presets in minutes; "custom" reveals a minutes input. There is no
// per-event option on purpose — 30 minutes is the floor.
const WINDOW_PRESETS: { value: string; label: React.ReactNode; hint: string }[] = [
    { value: "30", label: "כל 30 דקות", hint: "האפשרות המהירה ביותר. מרכזת את כל מה שטרם קראת." },
    { value: "60", label: "כל שעה", hint: "לכל היותר אימייל מרוכז אחד בשעה." },
    { value: "180", label: "כל 3 שעות", hint: "מספר הודעות מרוכזות לאורך יום העבודה." },
    { value: "1440", label: "פעם ביום", hint: "סיכום יומי מרוכז של כל ההתראות שלא נקראו." },
    { value: "custom", label: "מותאם אישית", hint: "בחר חלון זמן משלך, החל מ-30 דקות ועד יממה." },
];

export default function NotificationsSettingsPage() {
    const { data, isLoading } = useNotificationPreferences();
    const update = useUpdateNotificationPreferences();
    const [draft, setDraft] = React.useState<NotificationPreferences | null>(null);

    // Auto-save: toggles persist instantly. markSaved on data load moves the
    // baseline to the server value so the initial null→data hydration (and any
    // refetch) is never mistaken for a user edit.
    const autosave = useAutosave({
        value: draft,
        enabled: !!draft,
        save: async (v) => {
            if (v) await update.mutateAsync(v);
        },
    });
    useRegisterUnsaved(autosave, () => setDraft(autosave.savedValue));

    // One-shot hydration: server data seeds the draft once (normalized, since
    // an older backend or cached response may miss newer categories the rows
    // index directly). After that the save path owns the baseline — re-adopting
    // every refetch would stomp edits made while a save was in flight.
    const hydratedRef = React.useRef(false);
    React.useEffect(() => {
        if (!data || hydratedRef.current) return;
        hydratedRef.current = true;
        const full = normalizeNotificationPreferences(data.preferences);
        setDraft(full);
        autosave.markSaved(full);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    // Window selection: preset when the minutes match one, custom otherwise.
    // customMode keeps Custom selected while its input holds a preset value.
    const [customMode, setCustomMode] = React.useState(false);
    const minutes = draft?.email_digest_minutes ?? EMAIL_WINDOW_MIN_MINUTES;
    const matchingPreset = WINDOW_PRESETS.find((p) => p.value === String(minutes) && p.value !== "custom");
    const windowSelection = customMode || !matchingPreset ? "custom" : matchingPreset.value;
    const setMinutes = (m: number) =>
        setDraft((d) => (d ? { ...d, email_digest_minutes: m } : d));
    const pickWindow = (v: string) => {
        if (v === "custom") {
            setCustomMode(true);
            return;
        }
        setCustomMode(false);
        setMinutes(Number(v));
    };

    const setEnabled = (key: NotificationCategoryKey, on: boolean) =>
        setDraft((d) => (d ? { ...d, [key]: { ...d[key], enabled: on } } : d));

    const CATEGORY_KEYS: NotificationCategoryKey[] = [
        "inbound_reply",
        "inbound_out_of_office",
        "health_bounce",
        "health_complaint",
        "health_worker_downtime",
        "health_domain_auth",
        "campaign_paused",
        "security_new_signin",
        "billing_alert",
        "team_activity",
    ];
    // Channels present globally: "on" when every category carries the channel.
    const channelOn = (ch: "email" | "slack" | "push") =>
        !!draft && CATEGORY_KEYS.every((k) => draft[k].channels[ch]);
    const setChannel = (ch: "email" | "slack" | "push", on: boolean) =>
        setDraft((d) => {
            if (!d) return d;
            const next = { ...d };
            for (const k of CATEGORY_KEYS) {
                next[k] = { ...d[k], channels: { ...d[k].channels, [ch]: on } };
            }
            return next;
        });

    const rows = (items: { key: NotificationCategoryKey; label: string; hint: string }[]) =>
        items.map((c) => (
            <Row key={c.key} label={c.label} description={c.hint}>
                <Toggle on={!!draft && draft[c.key].enabled} onChange={(v) => setEnabled(c.key, v)} />
            </Row>
        ));

    return (
        <SectionShell
            title="התראות"
            description="אילו אירועים יתריעו בפניך והיכן יימסרו. ברירות המחדל משקפות את ההמלצה."
            actions={<SaveStatus status={autosave.status} onRetry={autosave.retry} />}
        >
            {isLoading || !draft ? (
                <div className="px-5 py-10 text-[12.5px] text-slate-400">טוען…</div>
            ) : (
                <>
                    <Section
                        eyebrow="פעילות נכנסת"
                        description="קבל התראות על תגובות בקמפיין שאתה מפעיל. כבוי כברירת מחדל לשמירה על שקט בשליחות בנפח גבוה."
                    >
                        {rows(INBOUND)}
                    </Section>
                    <Section eyebrow="תקינות ומסירות" description="התראות עבירות דואר ותשתיות. מומלץ להשאיר מופעל.">
                        {rows(HEALTH)}
                    </Section>
                    <Section eyebrow="אבטחה" description="התראות גישה לחשבון.">
                        {rows(SECURITY)}
                    </Section>
                    <Section eyebrow="חיוב ומנוי" description="התראות תקופת ניסיון ותשלומים.">
                        {rows(BILLING)}
                    </Section>
                    <Section eyebrow="צוות" description="פעילות מחברי הצוות שלך.">
                        {rows(TEAM)}
                    </Section>
                    <Section eyebrow="ערוצי מסירה" description="היכן נמסרות התראות שמופעלות. חל על כל הקטגוריות שלעיל.">
                        <Row label="בתוך המערכת" description="הפעמון בסרגל העליון (נשלט לפי קטגוריה למעלה).">
                            <span className="text-[11px] font-medium text-emerald-600">מופעל</span>
                        </Row>
                        <Row
                            label="התראת Push בנייד"
                            description="התראות במכשירים המחוברים לאפליקציית Warmbly. האירוע הראשון נשלח מיידית; רצפים מגיעים כסיכום אחד במקום צפצוף לכל אירוע."
                        >
                            <Toggle on={channelOn("push")} onChange={(v) => setChannel("push", v)} />
                        </Row>
                        <Row label="אימייל" description="מסירה לכתובת האימייל של חשבונך.">
                            <Toggle on={channelOn("email")} onChange={(v) => setChannel("email", v)} />
                        </Row>
                        <Row label="Slack" description="שליחה ל-Slack המחובר, בערוץ שהוגדר בלשונית אינטגרציות. חבר תחילה את Slack והגדר ערוץ שם.">
                            <Toggle on={channelOn("slack")} onChange={(v) => setChannel("slack", v)} />
                        </Row>
                    </Section>
                    <Section eyebrow="תדירות מסירת אימייל" description="באיזו תדירות נשלחות הודעות באימייל. כל ההתראות שלא נקראו מתקבצות לאימייל אחד לחלון זמן, כך שיום עמוס מייצר אימיילים בודדים במקום אימייל לכל התראה.">
                        <OptionSelect
                            aria-label="חלון קיבוץ אימייל"
                            cols={2}
                            value={windowSelection}
                            onChange={pickWindow}
                            options={WINDOW_PRESETS}
                        />
                        {windowSelection === "custom" && (
                            <div className="flex items-center gap-2">
                                <span className="text-[12px] text-slate-500">קבץ כל</span>
                                <NumberInput
                                    value={minutes}
                                    onChange={setMinutes}
                                    min={EMAIL_WINDOW_MIN_MINUTES}
                                    max={EMAIL_WINDOW_MAX_MINUTES}
                                    step={15}
                                    suffix="דקות"
                                    className="w-36"
                                />
                            </div>
                        )}
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                            התראות שקראת במערכת לא יישלחו שוב באימייל. התראות אבטחה על התחברות תמיד נשלחות מיידית, והתראות הנוגעות למספר חברי צוות מגיעות כאימייל משותף אחד.
                        </p>
                    </Section>
                </>
            )}
        </SectionShell>
    );
}
