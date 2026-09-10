// Sending settings — when campaign mail leaves, in the RECIPIENT's day rather
// than the sending mailbox's. The scheduler treats the chosen hours as a real
// constraint (it delays a send to reach them), so the summary line spells out
// what the current selection means before anyone saves it.

import React from "react";
import { ClockIcon } from "lucide-react";
import { Row, Section, SectionShell, Toggle } from "../_components/SectionShell";
import { NoAccess } from "@/components/layout/NoAccess";
import { usePermission } from "@/hooks/usePermission";
import SaveStatus from "../_components/SaveStatus";
import { SelectMenu, type SelectOption } from "@/components/ui/select-menu";
import { NumberInput } from "@/components/ui/field";
import { useAutosave } from "@/hooks/useAutosave";
import { useRegisterUnsaved } from "@/hooks/context/unsaved";
import useTimezones from "@/lib/api/hooks/app/useTimezones";
import {
    useOutreachSettings,
    useUpdateOutreachSettings,
} from "@/lib/api/hooks/app/outreach/useOutreachSettings";
import VerificationSettings from "@/components/app/contacts/VerificationSettings";
import {
    DEFAULT_PREFERRED_HOURS,
    DEFAULT_UNSUBSCRIBE,
    describeHours,
    formatHour,
    type OutreachSettings,
    type UnsubscribeMode,
    type UnsubscribeSettings,
} from "@/lib/api/models/app/outreach/OutreachSettings";
import { TextInput } from "@/components/ui/field";
import { Link } from "react-router-dom";

const UNSUB_MODES: SelectOption[] = [
    { value: "text", label: "השב כדי לבטל הצטרפות (שורת טקסט)" },
    { value: "link", label: "קישור להסרה מרשימת תפוצה" },
    { value: "off", label: "ללא שורה" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function SendingSettingsPage() {
    const canManage = usePermission("MANAGE_SETTINGS");
    if (!canManage) return <NoAccess feature="שליחה" permissionLabel="ניהול הגדרות" />;
    return <SendingSettings />;
}

function SendingSettings() {
    const { data, isLoading } = useOutreachSettings();
    const update = useUpdateOutreachSettings();
    const timezones = useTimezones();
    const [draft, setDraft] = React.useState<OutreachSettings | null>(null);

    const autosave = useAutosave({
        value: draft,
        enabled: !!draft,
        save: async (v) => {
            if (v) await update.mutateAsync(v);
        },
    });
    useRegisterUnsaved(autosave, () => setDraft(autosave.savedValue));

    // One-shot hydration: the server value seeds the draft once, then the save
    // path owns the baseline so a refetch can't stomp an in-flight edit.
    const hydrated = React.useRef(false);
    React.useEffect(() => {
        if (!data || hydrated.current) return;
        hydrated.current = true;
        setDraft(data);
        autosave.markSaved(data);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    const sto = draft?.send_time_optimization;

    const patchUnsubscribe = React.useCallback(
        (next: Partial<UnsubscribeSettings>) => {
            setDraft((prev) =>
                prev ? { ...prev, unsubscribe: { ...(prev.unsubscribe ?? DEFAULT_UNSUBSCRIBE), ...next } } : prev,
            );
        },
        [],
    );

    const patchReplyIntent = React.useCallback(
        (next: Record<string, unknown>) => {
            setDraft((prev) => (prev ? { ...prev, reply_intent: { ...prev.reply_intent, ...next } } : prev));
        },
        [],
    );

    const patchPreflight = React.useCallback(
        (next: Partial<OutreachSettings["preflight"]>) => {
            setDraft((prev) => (prev ? { ...prev, preflight: { ...prev.preflight, ...next } } : prev));
        },
        [],
    );

    const patch = React.useCallback(
        (next: Partial<NonNullable<typeof sto>>) => {
            setDraft((prev) =>
                prev
                    ? { ...prev, send_time_optimization: { ...prev.send_time_optimization, ...next } }
                    : prev,
            );
        },
        [],
    );

    const toggleHour = React.useCallback(
        (h: number) => {
            if (!sto) return;
            const set = new Set(sto.preferred_hours ?? []);
            if (set.has(h)) set.delete(h);
            else set.add(h);
            // Never persist an empty list: the backend would fall back to
            // business hours anyway, and an empty grid reads as "never send".
            const next = [...set].sort((a, b) => a - b);
            patch({ preferred_hours: next.length ? next : DEFAULT_PREFERRED_HOURS });
        },
        [sto, patch],
    );

    const tzOptions = React.useMemo<SelectOption[]>(
        () => (timezones.data ?? []).map((t) => ({ value: t.name, label: t.display_name })),
        [timezones.data],
    );

    const enabled = !!sto?.enabled;
    const hours = sto?.preferred_hours?.length ? sto.preferred_hours : DEFAULT_PREFERRED_HOURS;

    return (
        <SectionShell
            title="שליחה"
            description="מועדי יציאת הודעות הקמפיין, מחושבים לפי יומו של הנמען."
            actions={<SaveStatus status={autosave.status} onRetry={autosave.retry} />}
        >
            <VerificationSettings />
            <Section
                eyebrow="אופטימיזציית זמן שליחה"
                description="השהה כל אימייל של קמפיין עד שהוא נוחת בתוך השעות שתבחר, באזור הזמן של הנמען עצמו. זה רק מעכב שליחה ולעולם אינו מקדים אותה, ועדיין מציית ללוח הזמנים של הקמפיין ולשעות העבודה של כל תיבת דואר."
            >
                {isLoading || !sto ? (
                    <div className="h-7 w-40 rounded bg-slate-100 animate-pulse" />
                ) : (
                    <>
                        <Row
                            label="השתמש בשעות המקומיות של הנמען"
                            description={
                                enabled
                                    ? "פעיל. השליחות מכוונות לשעות שלמטה."
                                    : "כבוי. השליחות פועלות לפי לוח הזמנים של הקמפיין ושעות תיבת הדואר השולחת בלבד."
                            }
                        >
                            <Toggle on={enabled} onChange={(on) => patch({ enabled: on })} />
                        </Row>

                        {enabled && (
                            <>
                                <Row
                                    label="קרא את אזור הזמן של כל איש קשר"
                                    description="משתמש בשדה אזור הזמן של איש הקשר, ולאחר מכן במדינה שאליה מפנה דומיין האימייל שלו. ברירת המחדל היא אזור הזמן שלמטה."
                                >
                                    <Toggle
                                        on={!!sto.use_contact_timezone}
                                        onChange={(on) => patch({ use_contact_timezone: on })}
                                    />
                                </Row>

                                <Row
                                    label="אזור זמן כברירת מחדל"
                                    description="משמש כאשר לא ניתן לקבוע את אזור הזמן של איש הקשר."
                                >
                                    <SelectMenu
                                        value={sto.default_contact_timezone || "UTC"}
                                        onChange={(v) => patch({ default_contact_timezone: v })}
                                        options={tzOptions}
                                        aria-label="אזור זמן כברירת מחדל"
                                        minWidth={240}
                                        align="end"
                                    />
                                </Row>

                                <Row
                                    label="דלג על סופי שבוע"
                                    description="דחה שליחה שהייתה אמורה לנחות בשבת או ראשון ליום החול הבא."
                                >
                                    <Toggle
                                        on={(sto.weekend_weight_multiplier ?? 1) < 1}
                                        onChange={(on) => patch({ weekend_weight_multiplier: on ? 0.5 : 1 })}
                                    />
                                </Row>

                                <Row label="שעות מסירה" align="start">
                                    <div className="w-full sm:w-[320px]">
                                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1" dir="ltr">
                                            {HOURS.map((h) => {
                                                const on = hours.includes(h);
                                                return (
                                                    <button
                                                        key={h}
                                                        type="button"
                                                        onClick={() => toggleHour(h)}
                                                        aria-pressed={on}
                                                        className={`h-7 rounded-md border text-[11.5px] font-mono transition-colors ${
                                                            on
                                                                ? "bg-sky-50 text-sky-700 border-sky-200"
                                                                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                                                        }`}
                                                    >
                                                        {formatHour(h)}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <p className="mt-2 text-[11.5px] text-slate-500 leading-relaxed inline-flex items-start gap-1.5">
                                            <ClockIcon className="w-3.5 h-3.5 mt-px shrink-0 text-slate-400" />
                                            <span>
                                                האימייל יגיע בסביבות <span dir="ltr">{describeHours(hours)}</span> עבור כל נמען
                                                {sto.use_contact_timezone ? "" : ` (${sto.default_contact_timezone || "UTC"})`}.
                                            </span>
                                        </p>
                                    </div>
                                </Row>
                            </>
                        )}
                    </>
                )}
            </Section>

            <Section
                eyebrow="הסרה מרשימת תפוצה (Unsubscribe)"
                description="שורת ביטול ההצטרפות שכל אימייל של קמפיין נושא, המתווספת לאחר החתימה. מענה המבקש להפסיק, לחיצה על הקישור, או כפתור ההסרה של תוכנת הדואר עצמה – כולם מכניסים את הנמען לרשימת ההשתקה, ואף קמפיין לא ישלח אליו שוב. עבור פנייה קרה כותרת List-Unsubscribe (לכל קמפיין, מופעלת כברירת מחדל) היא זו שמספקת את חוקי השולח ההמוני, כך ששורה זו יכולה להישאר משפט פשוט. קמפיין יכול לדרוס זאת בהגדרותיו."
            >
                {isLoading || !draft ? (
                    <div className="h-7 w-40 rounded bg-slate-100 animate-pulse" />
                ) : (
                    <>
                        <UnsubscribeRows value={draft.unsubscribe ?? DEFAULT_UNSUBSCRIBE} onChange={patchUnsubscribe} />
                        <Row
                            label="כבד מענה המבקש להפסיק"
                            description="מענה המכיל 'בטל מנוי', 'הסר אותי', 'הפסק לשלוח לי' וכדומה מכניס את הנמען מיד לרשימת ההשתקה. זה מה שהופך את שורת ביטול ההצטרפות במענה למנגנון אמיתי."
                        >
                            <Toggle
                                on={draft.reply_intent?.auto_suppress_on_unsubscribe_keyword !== false}
                                onChange={(on) => patchReplyIntent({ auto_suppress_on_unsubscribe_keyword: on })}
                            />
                        </Row>
                    </>
                )}
            </Section>

            <Section
                eyebrow="בדיקות תוכן וספאם"
                description="ציון התוכן של כל שלב לפי האותות שמסנני ספאם מודדים: מילות טריגר, סימני פיסוק מרובים, ספירת קישורים ותמונות, וקבצים מצורפים. נבדק בעת ההשקה, ושוב בכל שליחה מול התוכן שהנמען מקבל בפועל לאחר פריסת משתנים ו-spintax."
            >
                {isLoading || !draft ? (
                    <div className="h-7 w-40 rounded bg-slate-100 animate-pulse" />
                ) : (
                    <>
                        <Row
                            label="סמן תוכן בסיכון"
                            description="המלצה בלבד. מתריע בדיאלוג ההשקה ובעדכוני הקמפיין, ולעולם אינו חוסם או מעכב שליחה."
                        >
                            <Toggle
                                on={!!draft.preflight?.check_content_score}
                                onChange={(on) => patchPreflight({ check_content_score: on })}
                            />
                        </Row>
                        {draft.preflight?.check_content_score && (
                            <Row
                                label="ציון מינימלי"
                                description="תוכן שמקבל ציון מתחת למספר זה מתוך 100 יסומן. ציון גבוה יותר מחמיר יותר."
                            >
                                <NumberInput
                                    min={1}
                                    max={100}
                                    value={draft.preflight?.min_content_score ?? 60}
                                    onChange={(n) =>
                                        patchPreflight({
                                            min_content_score: Number.isFinite(n) ? Math.min(100, Math.max(1, n)) : 60,
                                        })
                                    }
                                    className="w-20"
                                />
                            </Row>
                        )}
                    </>
                )}
            </Section>
        </SectionShell>
    );
}

function UnsubscribeRows({
    value,
    onChange,
}: {
    value: UnsubscribeSettings;
    onChange: (next: Partial<UnsubscribeSettings>) => void;
}) {
    const mode = (value.mode || "text") as UnsubscribeMode;
    const text = value.text || DEFAULT_UNSUBSCRIBE.text;
    const intro = value.link_intro || DEFAULT_UNSUBSCRIBE.link_intro;
    const linkText = value.link_text || DEFAULT_UNSUBSCRIBE.link_text;
    return (
        <>
            <Row
                label="שורת ביטול הצטרפות"
                description={
                    mode === "text"
                        ? "משפט פשוט המזמין מענה. נקרא כמו אימייל אישי; המענה מזוהה ומכובד אוטומטית."
                        : mode === "link"
                          ? "משפט עם קישור ממשי להסרה מרשימת התפוצה. לחיצה אחת בעמוד אישור; תוכנת הדואר עשויה להציג גם כפתור הסרה משלה. נקרא כמו דיוור המוני בניגוד למענה אישי, לכן מומלץ לרשימות המחייבות קישור."
                          : "ללא שורת ביטול הצטרפות בגוף ההודעה. יש לוודא שכותרת ה-unsubscribe פעילה בכל קמפיין."
                }
            >
                <SelectMenu
                    value={mode}
                    onChange={(v) => onChange({ mode: v as UnsubscribeMode })}
                    options={UNSUB_MODES}
                    aria-label="שורת ביטול הצטרפות"
                    minWidth={240}
                    align="end"
                />
            </Row>
            {mode === "text" && (
                <Row label="ניסוח" description="משפט אחד, מתווסף לאחר החתימה." align="start">
                    <TextInput
                        value={value.text}
                        onChange={(v) => onChange({ text: v })}
                        placeholder={DEFAULT_UNSUBSCRIBE.text}
                        className="w-full sm:w-[420px]"
                    />
                </Row>
            )}
            {mode === "link" && (
                <>
                    <Row label="ניסוח" description="המשפט שלפני הקישור." align="start">
                        <TextInput
                            value={value.link_intro}
                            onChange={(v) => onChange({ link_intro: v })}
                            placeholder={DEFAULT_UNSUBSCRIBE.link_intro}
                            className="w-full sm:w-[420px]"
                        />
                    </Row>
                    <Row label="טקסט הקישור" description="מה שהקישור עצמו מציג.">
                        <TextInput
                            value={value.link_text}
                            onChange={(v) => onChange({ link_text: v })}
                            placeholder={DEFAULT_UNSUBSCRIBE.link_text}
                            className="w-full sm:w-[240px]"
                        />
                    </Row>
                </>
            )}
            {mode !== "off" && (
                <Row label="תצוגה מקדימה" align="start">
                    <p className="w-full sm:w-[420px] rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2 text-[12px] text-slate-500">
                        {mode === "text" ? (
                            text
                        ) : (
                            <>
                                {intro} <span className="underline text-slate-600">{linkText}</span>
                            </>
                        )}
                    </p>
                </Row>
            )}
            <Row
                label="רשימת השתקה (Suppression)"
                description="כל מי שביטל הצטרפות, חזר כ-bounce או התלונן, בתוספת כתובות שנוספו ידנית. אף קמפיין לא ישלח לכתובת הנמצאת ברשימה זו."
            >
                <Link to="/app/contacts/suppressions" className="text-[12px] text-sky-700 hover:text-sky-800 font-medium">
                    פתח את הרשימה
                </Link>
            </Row>
        </>
    );
}
