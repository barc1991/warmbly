// Sending settings — when campaign mail leaves, in the RECIPIENT's day rather
// than the sending mailbox's. The scheduler treats the chosen hours as a real
// constraint (it delays a send to reach them), so the summary line spells out
// what the current selection means before anyone saves it.

import React from "react";
import { useAppStore } from "@/stores";
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
    AUTOMATED_INTENTS,
    DEFAULT_PREFERRED_HOURS,
    DEFAULT_UNSUBSCRIBE,
    REPLY_INTENT_CHOICES,
    describeHours,
    formatHour,
    taskIntents,
    type OutreachSettings,
    type ReplyIntent,
    type ReplyIntentSettings,
    type UnsubscribeMode,
    type UnsubscribeSettings,
} from "@/lib/api/models/app/outreach/OutreachSettings";
import { TextInput } from "@/components/ui/field";
import { Link } from "react-router-dom";

const UNSUB_MODES: SelectOption[] = [
    { value: "text", label: "השב כדי לבטל (שורת טקסט)" },
    { value: "link", label: "קישור להסרה מרשימת תפוצה" },
    { value: "off", label: "ללא שורת הסרה" },
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

    // These are one workspace's settings, so the draft belongs to the workspace
    // it was hydrated from. Switching workspaces re-hydrates it, and a save that
    // would land on a different workspace than the draft came from is dropped:
    // otherwise the next edit after a switch wrote the previous workspace's
    // whole settings object onto the new one.
    const orgID = useAppStore((st) => st.currentOrganization?.id);
    const hydratedFor = React.useRef<string | undefined>(undefined);

    const autosave = useAutosave({
        value: draft,
        enabled: !!draft,
        save: async (v) => {
            if (!v) return;
            if (hydratedFor.current !== useAppStore.getState().currentOrganization?.id) return;
            await update.mutateAsync(v);
        },
    });
    useRegisterUnsaved(autosave, () => setDraft(autosave.savedValue));

    // Hydration is once per workspace: the server value seeds the draft, then
    // the save path owns the baseline so a refetch can't stomp an in-flight edit.
    React.useEffect(() => {
        if (!data || hydratedFor.current === orgID) return;
        hydratedFor.current = orgID;
        setDraft(data);
        autosave.markSaved(data);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, orgID]);

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
        (next: Partial<ReplyIntentSettings>) => {
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
            description="מתי מיילים של קמפיינים יוצאים, לפי שעות היום של הנמען."
            actions={<SaveStatus status={autosave.status} onRetry={autosave.retry} />}
        >
            <VerificationSettings />
            <Section
                eyebrow="אופטימיזציית מועד שליחה"
                description="השהה כל מייל בקמפיין עד שהוא נוחת בטווח השעות שבחרת, באזור הזמן של הנמען. זה רק מעכב שליחה ולעולם לא מקדים אותה, וממשיך לציית ללוח הזמנים של הקמפיין ולשעות הפעילות של כל תיבת דואר."
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
                                    : "כבוי. השליחות פועלות רק לפי לוח הזמנים של הקמפיין ושעות התיבה השולחת."
                            }
                        >
                            <Toggle on={enabled} onChange={(on) => patch({ enabled: on })} />
                        </Row>

                        {enabled && (
                            <>
                                <Row
                                    label="זהה את אזור הזמן של כל איש קשר"
                                    description="משתמש בשדה אזור הזמן של איש הקשר, ולאחר מכן במדינה של דומיין הדוא״ל שלו. כברירת מחדל משתמש באזור הזמן שלהלן."
                                >
                                    <Toggle
                                        on={!!sto.use_contact_timezone}
                                        onChange={(on) => patch({ use_contact_timezone: on })}
                                    />
                                </Row>

                                <Row
                                    label="אזור זמן לברירת מחדל"
                                    description="בשימוש כאשר לא ניתן לקבוע את אזור הזמן של איש הקשר."
                                >
                                    <SelectMenu
                                        value={sto.default_contact_timezone || "UTC"}
                                        onChange={(v) => patch({ default_contact_timezone: v })}
                                        options={tzOptions}
                                        aria-label="אזור זמן לברירת מחדל"
                                        minWidth={240}
                                        align="end"
                                    />
                                </Row>

                                <Row
                                    label="דלג על סופי שבוע"
                                    description="דחה שליחה שהייתה אמורה לנחות ביום שבת או ראשון ליום העבודה הבא."
                                >
                                    <Toggle
                                        on={(sto.weekend_weight_multiplier ?? 1) < 1}
                                        onChange={(on) => patch({ weekend_weight_multiplier: on ? 0.5 : 1 })}
                                    />
                                </Row>

                                <Row label="שעות מסירה" align="start">
                                    <div className="w-full sm:w-[320px]">
                                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1">
                                            {HOURS.map((h) => {
                                                const on = hours.includes(h);
                                                return (
                                                    <button
                                                        key={h}
                                                        type="button"
                                                        onClick={() => toggleHour(h)}
                                                        aria-pressed={on}
                                                        className={`h-7 rounded-md border text-[11.5px] transition-colors ${
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
                                                הודעות יגיעו סביב {describeHours(hours)} לכל נמען
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
                eyebrow="הסרה מרשימת תפוצה"
                description="אפשרות ההסרה שכל מייל בקמפיין נושא, מתווספת לאחר החתימה. תגובה המבקשת להפסיק, לחיצה על הקישור או לחצן ההסרה של תוכנת הדואר עצמה מעבירים את הנמען לרשימת החסימות (הסרה), ואף קמפיין לא ישלח אליו שוב."
            >
                {isLoading || !draft ? (
                    <div className="h-7 w-40 rounded bg-slate-100 animate-pulse" />
                ) : (
                    <>
                        <UnsubscribeRows value={draft.unsubscribe ?? DEFAULT_UNSUBSCRIBE} onChange={patchUnsubscribe} />
                        <Row
                            label="כבד תגובות המבקשות להסיר"
                            description="תגובה המכילה 'הסר אותי', 'בטל הרשמה', 'תפסיקו לשלוח לי' וכדומה מעבירה את הנמען לרשימת החסימות באופן מיידי."
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
                eyebrow="מחוץ למשרד"
                description="כאשר תיבת הדואר של הנמען מגיבה בהודעת היעדרות, השהה את השלב הבא שלו עד שיחזור במקום לשלוח למשרד ריק. ההשהיה חלה על כל הקמפיינים שאיש הקשר נמצא בהם. תאריך החזרה נלקח מהתגובה האוטומטית במידה וזוהה, בתוספת יום עבודה."
            >
                {isLoading || !draft ? (
                    <div className="h-7 w-40 rounded bg-slate-100 animate-pulse" />
                ) : (
                    <>
                        <Row
                            label="השהה איש קשר שנמצא בחופשה / היעדרות"
                            description="תגובה אוטומטית לעולם אינה נחשבת לתגובה אנושית, ולכן ללא הגדרה זו המעקב הבא יישלח במועד והרצף יסתיים לפני שיחזור."
                        >
                            <Toggle
                                on={draft.reply_intent?.hold_on_out_of_office !== false}
                                onChange={(on) => patchReplyIntent({ hold_on_out_of_office: on })}
                            />
                        </Row>
                        {draft.reply_intent?.hold_on_out_of_office !== false && (
                            <Row
                                label="משך השהיה"
                                description="בשימוש כאשר הודעת ההיעדרות אינה כוללת תאריך חזרה שניתן לזהות. בין 1 ל-90 ימים."
                            >
                                <div className="flex items-center gap-1.5">
                                    <NumberInput
                                        min={1}
                                        max={90}
                                        value={draft.reply_intent?.out_of_office_hold_days ?? 7}
                                        onChange={(n) =>
                                            patchReplyIntent({
                                                out_of_office_hold_days: Number.isFinite(n)
                                                    ? Math.min(90, Math.max(1, n))
                                                    : 7,
                                            })
                                        }
                                        className="w-20"
                                    />
                                    <span className="text-[11.5px] text-slate-500">ימים</span>
                                </div>
                            </Row>
                        )}
                    </>
                )}
            </Section>

            <Section
                eyebrow="משימות מעקב לתגובות"
                description="פתח משימת CRM כאשר מתקבלת תשובה, כך שליד שעונה יופיע בדף המשימות בנוסף לתיבת הדואר. המשימה מוקצית לבעל תיבת הדואר עם מועד יעד של 24 שעות."
            >
                {isLoading || !draft ? (
                    <div className="h-7 w-40 rounded bg-slate-100 animate-pulse" />
                ) : (
                    <>
                        <Row
                            label="פתח משימה בעת קבלת תגובה"
                            description="משימה אחת לכל תגובה מסווגת, עם כותרת לפי כוונת התגובה והשולח."
                        >
                            <Toggle
                                on={draft.reply_intent?.auto_create_crm_task !== false}
                                onChange={(on) => patchReplyIntent({ auto_create_crm_task: on })}
                            />
                        </Row>
                        {draft.reply_intent?.auto_create_crm_task !== false && (
                            <Row
                                label="עבור אילו תגובות"
                                description="תגובות אוטומטיות כבויות כברירת מחדל: הודעת חופשה אינה דורשת מעקב מכירות, ושבוע שליחות מייצר רבות כאלו שעלולות לקבור תגובות אמיתיות."
                                align="start"
                            >
                                <IntentPicker
                                    value={taskIntents(draft.reply_intent)}
                                    onChange={(next) => patchReplyIntent({ crm_task_intents: next })}
                                />
                            </Row>
                        )}
                    </>
                )}
            </Section>

            <Section
                eyebrow="בדיקות תוכן"
                description="ציון תוכן כל שלב לפי אותות שמסנני ספאם בוחנים: מילים חשודות, ריבוי סימני פיסוק, כמות קישורים ותמונות וקבצים מצורפים. נבדק בעת השקת הקמפיין ופעם נוספת לפני כל שליחה בפועל."
            >
                {isLoading || !draft ? (
                    <div className="h-7 w-40 rounded bg-slate-100 animate-pulse" />
                ) : (
                    <>
                        <Row
                            label="סמן תוכן בעל סיכון"
                            description="המלצה בלבד. מציג אזהרה בחלון ההשקה ובעדכוני הקמפיין, ולעולם אינו חוסם או מעכב שליחה."
                        >
                            <Toggle
                                on={!!draft.preflight?.check_content_score}
                                onChange={(on) => patchPreflight({ check_content_score: on })}
                            />
                        </Row>
                        {draft.preflight?.check_content_score && (
                            <Row
                                label="ציון מינימלי"
                                description="טקסט המקבל ציון נמוך מזה מתוך 100 יסומן באזהרה. ציון גבוה יותר מחמיר יותר."
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

// The intents that open a follow-up task. Chips rather than checkboxes, to
// match the delivery-hours grid above; the two automated classes move together
// because they are one thing to the person reading the list.
function IntentPicker({
    value,
    onChange,
}: {
    value: ReplyIntent[];
    onChange: (next: ReplyIntent[]) => void;
}) {
    const has = (id: ReplyIntent) =>
        id === "out_of_office" ? AUTOMATED_INTENTS.some((i) => value.includes(i)) : value.includes(id);

    function toggle(id: ReplyIntent) {
        const group = id === "out_of_office" ? AUTOMATED_INTENTS : [id];
        const on = has(id);
        const next = on
            ? value.filter((v) => !group.includes(v))
            : [...value.filter((v) => !group.includes(v)), ...group];
        onChange(next);
    }

    return (
        <div className="w-full sm:w-[320px]">
            <div className="flex flex-wrap gap-1">
                {REPLY_INTENT_CHOICES.map((c) => {
                    const on = has(c.id);
                    return (
                        <button
                            key={c.id}
                            type="button"
                            onClick={() => toggle(c.id)}
                            aria-pressed={on}
                            title={c.hint}
                            className={`h-7 px-2.5 rounded-md border text-[11.5px] transition-colors ${
                                on
                                    ? "bg-sky-50 text-sky-700 border-sky-200"
                                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                            }`}
                        >
                            {c.label}
                        </button>
                    );
                })}
            </div>
            <p className="mt-2 text-[11.5px] text-slate-500 leading-relaxed">
                {value.length === 0
                    ? "Nothing opens a task. Same as turning the switch off."
                    : `A reply classified ${REPLY_INTENT_CHOICES.filter((c) => has(c.id))
                          .map((c) => c.label.toLowerCase())
                          .join(", ")} opens a task.`}
            </p>
        </div>
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
                label="Opt-out line"
                description={
                    mode === "text"
                        ? "A plain sentence inviting a reply. Reads like a personal email; the reply is detected and honoured automatically."
                        : mode === "link"
                          ? "A sentence with a real unsubscribe link. One click on a confirmation page; the mail client may also show its own Unsubscribe button. Reads as bulk mail where a reply reads as a person, so keep it for lists that need a link. On a plain-text campaign it prints the full address in the copy."
                          : "No opt-out in the body. Keep the unsubscribe header on in each campaign, or you are relying on recipients replying."
                }
            >
                <SelectMenu
                    value={mode}
                    onChange={(v) => onChange({ mode: v as UnsubscribeMode })}
                    options={UNSUB_MODES}
                    aria-label="Opt-out line"
                    minWidth={240}
                    align="end"
                />
            </Row>
            {mode === "text" && (
                <Row label="Wording" description="One sentence, appended after the signature." align="start">
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
                    <Row label="Wording" description="The sentence before the link." align="start">
                        <TextInput
                            value={value.link_intro}
                            onChange={(v) => onChange({ link_intro: v })}
                            placeholder={DEFAULT_UNSUBSCRIBE.link_intro}
                            className="w-full sm:w-[420px]"
                        />
                    </Row>
                    <Row label="Link text" description="What the link itself says.">
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
                <Row label="Preview" align="start">
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
                label="Suppression list"
                description="Everyone who opted out, bounced or complained, plus anything added by hand. No campaign emails an entry on it."
            >
                <Link to="/app/contacts/suppressions" className="text-[12px] text-sky-700 hover:text-sky-800 font-medium">
                    Open the list
                </Link>
            </Row>
        </>
    );
}
