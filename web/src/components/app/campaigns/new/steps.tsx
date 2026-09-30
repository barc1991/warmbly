// The four steps of the new-campaign flow and the launch-plan rail beside them.

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    AlertCircleIcon,
    CalendarClockIcon,
    CheckIcon,
    ChevronDownIcon,
    Loader2Icon,
    MailIcon,
    PlusIcon,
    SendIcon,
    Trash2Icon,
    UploadIcon,
    UsersIcon,
    ZapIcon,
} from "lucide-react";
import type { CampaignEstimateResult } from "@/lib/api/client/app/campaigns/estimateCampaign";
import type Sequence from "@/lib/api/models/app/campaigns/sequences/Sequence";
import type { DraftMeta } from "./serverDraft";
import EmailContentEditor from "@/components/app/campaigns/sequences/EmailContentEditor";
import { useSegments } from "@/lib/api/hooks/app/segments";
import { Checkbox } from "@/components/ui/checkbox";
import TagSelector from "@/components/app/popup/select/TagSelector";
import ScrollStrip from "@/components/ui/scroll-strip";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { Label, NumberInput, SearchInput } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import {
    NAME_MAX,
    WAIT_MAX,
    daysLabel,
    emailIssue,
    fmt24,
    fmtDateTime,
    fmtDay,
    hasContent,
    newEmail,
    plural,
    scheduledDate,
    trackingSummary,
    writtenEmails,
    type Draft,
    type StepKey,
} from "./draft";
import { ChoiceCard, SectionLabel, SendingWindowFields, StepIntro, SwitchRow, TimezoneField, type Patch } from "./fields";
import EstimateTimeline from "./EstimateTimeline";
import { BottleneckNote, SenderList, WarmupNote } from "./EstimateInsights";
import { estimateHeadline } from "./estimateText";

export type EstimateState = {
    data: CampaignEstimateResult | undefined;
    loading: boolean;
    error: boolean;
};

// Leads ------------------------------------------------------------------

export function LeadsStep({
    draft,
    patch,
    placeholderName,
    estimate,
    existingLeads = 0,
    onImport,
    onEnter,
}: {
    draft: Draft;
    patch: Patch;
    placeholderName: string;
    estimate: EstimateState;
    // Leads a saved draft already has, added outside the lists.
    existingLeads?: number;
    onImport: () => void;
    onEnter: () => void;
}) {
    const segments = useSegments();
    const [query, setQuery] = React.useState("");
    const lists = segments.data ?? [];
    const q = query.trim().toLowerCase();
    const shown = q ? lists.filter((l) => l.name.toLowerCase().includes(q) || l.description.toLowerCase().includes(q)) : lists;
    const picked = new Set(draft.segmentIds);
    const toggle = (id: string) =>
        patch({ segmentIds: picked.has(id) ? draft.segmentIds.filter((x) => x !== id) : [...draft.segmentIds, id] });
    const len = draft.name.trim().length;
    const recipients = estimate.data?.recipients ?? 0;

    return (
        <div className="max-w-[680px] text-start">
            <input
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value, nameTouched: true })}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        onEnter();
                    }
                }}
                placeholder={placeholderName}
                aria-label="שם הקמפיין"
                maxLength={NAME_MAX + 10}
                className="w-full h-10 bg-transparent text-[20px] font-semibold tracking-[-0.015em] text-slate-900 placeholder:text-slate-300 caret-sky-600 outline-none border-0 p-0 text-start"
            />
            <p className={cn("text-[11px] mt-0.5", len > NAME_MAX ? "text-rose-600" : "text-slate-400")}>
                {len > NAME_MAX ? `${len}/${NAME_MAX} תווים` : len === 0 ? "ניתן לתת שם כעת או מאוחר יותר; זה השם שיוצג לקמפיין." : "ניתן לשנות את השם בכל עת."}
            </p>

            <div className="mt-7 flex items-end justify-between gap-3">
                <div>
                    <p className="text-[13.5px] text-slate-900 font-semibold">למי לשלוח?</p>
                    <p className="text-[12px] text-slate-500 mt-0.5">
                        בחר רשימות לידים. איש קשר המופיע במספר רשימות יקבל אימייל פעם אחת בלבד.
                    </p>
                </div>
                {lists.length > 6 && (
                    <SearchInput value={query} onChange={setQuery} placeholder="חיפוש ברשימות" className="w-44 shrink-0" />
                )}
            </div>

            <div className="mt-3">
                {segments.isPending ? (
                    <div className="grid sm:grid-cols-2 gap-2">
                        {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="h-[58px] rounded-md bg-slate-100 animate-pulse" />
                        ))}
                    </div>
                ) : lists.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 px-5 py-6 text-center">
                        <div className="mx-auto size-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
                            <UsersIcon className="w-4 h-4" />
                        </div>
                        <p className="mt-3 text-[13px] text-slate-900 font-medium">אין עדיין רשימות לידים</p>
                        <p className="mt-1 text-[12px] text-slate-500 max-w-[42ch] mx-auto leading-relaxed">
                            ייבא קובץ CSV ושייך אותו לרשימה, ולאחר מכן חזור לכאן. טיוטה זו ממתינה לך.
                        </p>
                        <button
                            type="button"
                            onClick={onImport}
                            className="mt-4 h-7 px-3 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors"
                        >
                            <UploadIcon className="w-3 h-3" />
                            ייבוא לידים
                        </button>
                    </div>
                ) : (
                    <div className="grid sm:grid-cols-2 gap-2">
                        {shown.map((l) => {
                            const on = picked.has(l.id);
                            return (
                                <label
                                    key={l.id}
                                    className={cn(
                                        "cursor-pointer select-none rounded-md border px-3 py-2.5 flex items-start gap-2.5 transition-colors text-start",
                                        on ? "border-sky-400 bg-sky-50/60 ring-1 ring-inset ring-sky-400" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                                    )}
                                >
                                    <Checkbox className="mt-[3px]" checked={on} onChange={() => toggle(l.id)} />
                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-center gap-1.5">
                                            <span className="size-2 rounded-full shrink-0" style={{ background: l.color || "#0284c7" }} />
                                            <span className="text-[12.5px] text-slate-900 font-medium truncate">{l.name}</span>
                                        </span>
                                        <span className="block text-[11px] text-slate-500 mt-0.5 truncate">
                                            <span className="tabular-nums">{plural(l.contact_count, "ליד", "לידים")}</span>
                                            {l.description ? ` · ${l.description}` : ""}
                                        </span>
                                    </span>
                                </label>
                            );
                        })}
                        {!q && (
                            <button
                                type="button"
                                onClick={onImport}
                                className="rounded-md border border-dashed border-slate-200 px-3 py-2.5 flex items-center gap-2.5 text-start text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                            >
                                <UploadIcon className="w-3.5 h-3.5 shrink-0" />
                                <span className="min-w-0">
                                    <span className="block text-[12.5px] font-medium">ייבוא לידים חדשים</span>
                                    <span className="block text-[11px] text-slate-400">מקובץ CSV; טיוטה זו תמתין לך</span>
                                </span>
                            </button>
                        )}
                        {q && shown.length === 0 && (
                            <p className="sm:col-span-2 py-4 text-center text-[12px] text-slate-400">לא נמצאה רשימה התואמת ל-“{query}”.</p>
                        )}
                    </div>
                )}
            </div>

            {lists.length > 0 && (
                <p className="mt-3 flex items-center gap-2 text-[12px] min-h-5">
                    {draft.segmentIds.length === 0 && existingLeads > 0 ? (
                        <span className="text-slate-500">
                            לקמפיין זה כבר יש <span className="text-slate-900 font-medium tabular-nums">{plural(existingLeads, "ליד", "לידים")}</span>.
                            רשימות שנבחרות כאן יוסיפו גם את חבריהן.
                        </span>
                    ) : draft.segmentIds.length === 0 ? (
                        <span className="text-slate-400">לא נבחרה רשימה. ניתן להוסיף לידים גם לאחר יצירת הקמפיין.</span>
                    ) : estimate.loading && !estimate.data ? (
                        <span className="text-slate-500">סופר לידים…</span>
                    ) : recipients === 0 ? (
                        <span className="text-amber-700">רשימות אלו ריקות כעת.</span>
                    ) : (
                        <span className="text-slate-500">
                            <span className="text-slate-900 font-medium tabular-nums">{plural(recipients, "ליד ייחודי", "לידים ייחודיים")}</span>
                            {" "}
                            {existingLeads > 0 ? "כולל הלידים שכבר קיימים בו" : `מתוך ${plural(draft.segmentIds.length, "רשימה", "רשימות")}`}. נמענים שהסירו עצמם או שנמצאים ברשימת חסימה לא יישלחו.
                        </span>
                    )}
                    {estimate.loading && estimate.data && draft.segmentIds.length > 0 && (
                        <Loader2Icon className="w-3 h-3 animate-spin text-slate-300" />
                    )}
                </p>
            )}
        </div>
    );
}

// Emails -----------------------------------------------------------------

export function EmailsStep({
    draft,
    patch,
    selected,
    setSelected,
    lockedSteps,
    onOpenSteps,
}: {
    draft: Draft;
    patch: Patch;
    selected: number;
    setSelected: (i: number) => void;
    // A saved flow with branches or actions: shown, edited on the Steps tab.
    lockedSteps?: Sequence[] | null;
    onOpenSteps?: () => void;
}) {
    if (lockedSteps) return <LockedSteps steps={lockedSteps} onOpenSteps={onOpenSteps} />;
    return <EmailsEditor draft={draft} patch={patch} selected={selected} setSelected={setSelected} />;
}

function LockedSteps({ steps, onOpenSteps }: { steps: Sequence[]; onOpenSteps?: () => void }) {
    return (
        <div className="max-w-[600px] text-start">
            <StepIntro
                title="מה הם יקבלו?"
                hint="תרשים הזרימה של קמפיין זה כולל פיצולים או שלבי פעולה, ולכן עריכתו מתבצעת בעורך התרשים המלא בלשונית שלבים."
            />
            <div className="border border-slate-200 rounded-md divide-y divide-slate-100">
                {steps.map((s, i) => (
                    <div key={s.id} className="px-3 h-10 flex items-center gap-2.5 text-[12.5px]">
                        <span className="size-5 rounded-full bg-sky-600 text-white text-[10.5px] font-semibold inline-flex items-center justify-center tabular-nums shrink-0">
                            {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-slate-900">{s.subject || (i > 0 ? "תגובה באותו שרשור" : "ללא נושא")}</span>
                    </div>
                ))}
                {steps.length === 0 && <p className="px-3 py-3 text-[12px] text-slate-500">אין עדיין שלבי אימייל.</p>}
            </div>
            {onOpenSteps && (
                <button
                    type="button"
                    onClick={onOpenSteps}
                    className="mt-3 h-7 px-3 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors"
                >
                    <MailIcon className="w-3 h-3" />
                    פתיחת לשונית שלבים
                </button>
            )}
        </div>
    );
}

function EmailsEditor({
    draft,
    patch,
    selected,
    setSelected,
}: {
    draft: Draft;
    patch: Patch;
    selected: number;
    setSelected: (i: number) => void;
}) {
    const index = Math.min(selected, draft.emails.length - 1);
    const email = draft.emails[index];
    const update = (i: number, p: Partial<Draft["emails"][number]>) =>
        patch({ emails: draft.emails.map((e, idx) => (idx === i ? { ...e, ...p } : e)) });
    const add = (wait: number) => {
        patch({ emails: [...draft.emails, newEmail(wait)] });
        setSelected(draft.emails.length);
    };
    const remove = (i: number) => {
        patch({ emails: draft.emails.filter((_, idx) => idx !== i) });
        setSelected(Math.max(0, i - 1));
    };
    const addUsual = () => {
        patch({ emails: [...draft.emails, newEmail(3), newEmail(4)] });
        setSelected(1);
    };
    const totalDays = draft.emails.slice(1).reduce((n, e) => n + Math.max(0, e.wait_after), 0);

    return (
        <div className="text-start">
            <StepIntro
                title="מה הם יקבלו?"
                hint="כתוב את האימייל הראשון ואת המעקבים שלו, או השאר אותם לעריכה בלשונית שלבים. פיצולים ומבחני A/B מנוהלים שם גם כן."
            />

            <div className="mb-4 -mx-1">
                <ScrollStrip activeKey={email.id} innerClassName="flex items-center gap-1 px-1 py-0.5">
                    {draft.emails.map((e, i) => {
                        const issue = emailIssue(e, i);
                        const active = i === index;
                        return (
                            <React.Fragment key={e.id}>
                                {i > 0 && (
                                    <span className="shrink-0 inline-flex items-center gap-1 text-[10.5px] text-slate-400 tabular-nums px-0.5">
                                        <span className="w-3 h-px bg-slate-200" />
                                        {e.wait_after} ימים
                                        <span className="w-3 h-px bg-slate-200" />
                                    </span>
                                )}
                                <button
                                    type="button"
                                    data-key={e.id}
                                    data-active={active || undefined}
                                    onClick={() => setSelected(i)}
                                    className={cn(
                                        "shrink-0 h-8 ps-1.5 pe-2.5 rounded-md border inline-flex items-center gap-1.5 text-[12px] transition-colors",
                                        active
                                            ? "border-sky-400 bg-sky-50/60 text-slate-900 ring-1 ring-inset ring-sky-400"
                                            : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                                    )}
                                >
                                    <span
                                        className={cn(
                                            "size-5 rounded-full inline-flex items-center justify-center text-[10.5px] font-semibold tabular-nums",
                                            issue
                                                ? "bg-amber-100 text-amber-700"
                                                : hasContent(e)
                                                  ? "bg-sky-600 text-white"
                                                  : "bg-white text-slate-400 ring-1 ring-inset ring-slate-200",
                                        )}
                                    >
                                        {hasContent(e) && !issue ? <CheckIcon className="w-3 h-3" strokeWidth={3} /> : i + 1}
                                    </span>
                                    {i === 0 ? "אימייל ראשון" : `מעקב ${i}`}
                                </button>
                            </React.Fragment>
                        );
                    })}
                    <button
                        type="button"
                        onClick={() => add(3)}
                        disabled={draft.emails.length >= 10}
                        className="shrink-0 ms-1 h-8 px-2.5 rounded-md border border-dashed border-slate-200 text-[12px] text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50 inline-flex items-center gap-1 transition-colors disabled:opacity-40"
                    >
                        <PlusIcon className="w-3 h-3" />
                        מעקב
                    </button>
                </ScrollStrip>
                {draft.emails.length === 1 && (
                    <button
                        type="button"
                        onClick={addUsual}
                        className="mt-2 ms-1 inline-flex items-center gap-1.5 text-[11.5px] text-sky-700 hover:text-sky-800"
                    >
                        <ZapIcon className="w-3 h-3" />
                        הוסף שני מעקבים מומלצים (לאחר 3 ו-7 ימים)
                    </button>
                )}
                {draft.emails.length > 1 && (
                    <p className="mt-2 ms-1 text-[11px] text-slate-400">
                        {plural(draft.emails.length, "אימייל", "אימיילים")} לאורך {plural(totalDays, "יום", "ימים")}
                        {draft.stopOnReply ? ", עם עצירה עבור כל מי שישיב." : "."}
                    </p>
                )}
            </div>

            {index > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px] text-slate-600">
                    <span>שליחה כעבור</span>
                    <NumberInput
                        value={email.wait_after}
                        min={0}
                        max={WAIT_MAX}
                        onChange={(v) => update(index, { wait_after: v })}
                        className="w-20"
                    />
                    <span>
                        {plural(email.wait_after, "יום", "ימים")} לאחר האימייל הקודם
                        {draft.stopOnReply ? ", אם הנמען טרם השיב" : ""}.
                    </span>
                    <button
                        type="button"
                        onClick={() => remove(index)}
                        className="ms-auto h-7 px-2 rounded-md text-[12px] text-slate-500 hover:text-rose-600 hover:bg-rose-50 inline-flex items-center gap-1.5 transition-colors"
                    >
                        <Trash2Icon className="w-3 h-3" />
                        הסר
                    </button>
                </div>
            )}

            <EmailContentEditor
                key={email.id}
                subject={email.subject}
                onSubjectChange={(v) => update(index, { subject: v })}
                bodyHtml={email.body_html}
                onBodyChange={(html, plain) => update(index, { body_html: html, body_plain: plain })}
                bodyCode={email.body_code}
                onBodyCodeChange={(code) => update(index, { body_code: code })}
                subjectPlaceholder={index === 0 ? undefined : "השאר ריק כדי להשיב באותו שרשור"}
                bodyPlaceholder={index === 0 ? undefined : "רק מוודא שראית את ההודעה הקודמת שלי, {{.FirstName}}."}
            />
        </div>
    );
}

// Schedule -----------------------------------------------------------------

export function ScheduleStep({
    draft,
    patch,
    estimate,
    tz,
    meta,
}: {
    draft: Draft;
    patch: Patch;
    estimate: EstimateState;
    tz?: string;
    meta?: DraftMeta;
}) {
    const [more, setMore] = React.useState(false);
    const e = estimate.data;
    return (
        <div className="max-w-[600px] text-start">
            <StepIntro title="מתי, ומאילו תיבות דואר?" />
            <div className="space-y-7">
                <div>
                    <SectionLabel>התחלה</SectionLabel>
                    <div role="radiogroup" aria-label="התחלה" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <ChoiceCard
                            selected={draft.startMode === "now"}
                            icon={SendIcon}
                            title="ברגע ההשקה"
                            description="מתחיל לפעול בחלון השליחה הקרוב."
                            onSelect={() => patch({ startMode: "now" })}
                        />
                        <ChoiceCard
                            selected={draft.startMode === "later"}
                            icon={CalendarClockIcon}
                            title="בתאריך מסוים"
                            description="השקה כעת, ושום דבר לא יישלח לפני המועד שנבחר."
                            onSelect={() => patch({ startMode: "later" })}
                        />
                    </div>
                    <AnimatePresence initial={false}>
                        {draft.startMode === "later" && (
                            <motion.div
                                key="when"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.16 }}
                                className="overflow-hidden"
                            >
                                <div className="pt-3">
                                    <Label>התחל שליחה ב-</Label>
                                    <DateTimePicker
                                        value={draft.scheduledAt}
                                        onChange={(v) => patch({ scheduledAt: v })}
                                        stepMinutes={15}
                                        datePlaceholder="בחר תאריך ושעה"
                                    />
                                    <p className="text-[11px] text-slate-400 mt-1">לפי השעון המקומי שלך.</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div>
                    <SectionLabel>חלון שליחה</SectionLabel>
                    <div className="space-y-4">
                        <TimezoneField draft={draft} patch={patch} />
                        {meta?.customWindows ? (
                            <p className="text-[12px] text-slate-500 leading-relaxed">
                                קמפיין זה כולל חלון מותאם אישית לכל יום, שהוגדר בלשונית תזמון. ההגדרות נשמרות כפי שהן.
                            </p>
                        ) : (
                            <SendingWindowFields draft={draft} patch={patch} />
                        )}
                    </div>
                </div>

                <div>
                    <SectionLabel
                        right={
                            e && e.mailboxes > 0 ? (
                                <span className="text-[11px] text-slate-500 tabular-nums">
                                    {plural(e.mailboxes, "תיבת דואר", "תיבות דואר")} · {e.steady_capacity.toLocaleString("he-IL")}/יום במהירות מלאה
                                </span>
                            ) : null
                        }
                    >
                        שולחים
                    </SectionLabel>
                    {meta?.explicitSenders ? (
                        <p className="text-[12px] text-slate-500 leading-relaxed mb-3">
                            קמפיין זה שולח מתיבות דואר שנבחרו אחת-אחת בלשונית הגדרות. הן נשמרות כפי שהן.
                        </p>
                    ) : (
                        <>
                            <TagSelector
                                selected={draft.emailTagIds}
                                onAdd={(t) => patch({ emailTagIds: [...draft.emailTagIds, t] })}
                                onRemove={(t) => patch({ emailTagIds: draft.emailTagIds.filter((id) => id !== t) })}
                            />
                            <p className="text-[11px] text-slate-400 mt-1 mb-3">
                                תגיות תיבות דואר לרוטציה. השאר ריק כדי להשתמש בכל תיבת דואר פעילה.
                            </p>
                        </>
                    )}
                    {meta?.explicitSenders ? null : e && e.mailboxes === 0 ? (
                        <p className="text-[12px] text-amber-700 flex items-center gap-1.5">
                            <AlertCircleIcon className="w-3.5 h-3.5" />
                            אף תיבת דואר פעילה אינה תואמת. בחר תגיות אחרות או חבר תיבת דואר תחילה.
                        </p>
                    ) : (
                        e && <SenderList senders={e.senders} total={e.mailboxes} tz={tz} />
                    )}
                    <div className="mt-4 flex items-start justify-between gap-5">
                        <div className="min-w-0">
                            <p className="text-[12.5px] text-slate-900 font-medium">מגבלה יומית לתיבת דואר</p>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                מומלץ להישאר בסביבות 50 עד שמוניטין התיבות יוכח. האצה מחימום ורמות בריאות עשויות להפחית זאת עוד יותר.
                            </p>
                        </div>
                        <NumberInput
                            value={draft.dailyLimit}
                            min={3}
                            max={5000}
                            onChange={(v) => patch({ dailyLimit: v })}
                            className="w-24 shrink-0"
                        />
                    </div>
                    {draft.dailyLimit > 100 && (
                        <p className="mt-1.5 text-[11px] text-amber-700">
                            מעל 100 ביום לתיבת דואר זהו נפח גבוה לאימייל קר. כדאי להגדיר זאת רק עם תיבות בעלות מוניטין מוכח.
                        </p>
                    )}
                </div>

                <div>
                    <button
                        type="button"
                        onClick={() => setMore((v) => !v)}
                        className="w-full flex items-center gap-2 text-start"
                        aria-expanded={more}
                    >
                        <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">מעקב ומענה</span>
                        <span className="text-[11px] text-slate-400 truncate">{trackingSummary(draft)}</span>
                        <ChevronDownIcon className={cn("ms-auto w-3.5 h-3.5 text-slate-400 transition-transform", more && "rotate-180")} />
                    </button>
                    <AnimatePresence initial={false}>
                        {more && (
                            <motion.div
                                key="more"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.16 }}
                                className="overflow-hidden"
                            >
                                <div className="mt-2 border border-slate-200 rounded-md divide-y divide-slate-100 overflow-hidden">
                                    <SwitchRow
                                        label="עצירה במענה"
                                        description="סיום סדרת המעקבים עבור ליד ברגע שהוא משיב."
                                        value={draft.stopOnReply}
                                        onChange={(v) => patch({ stopOnReply: v })}
                                    />
                                    <SwitchRow
                                        label="מעקב פתיחות"
                                        description="פיקסל שקוף המודד צפיות בתיבת הדואר."
                                        value={draft.openTracking}
                                        onChange={(v) => patch({ openTracking: v })}
                                    />
                                    <SwitchRow
                                        label="מעקב לחיצות"
                                        description="עטיפת קישורים כך שכל לחיצה, ואיזה קישור נלחץ, יופיעו בפיד הפעילות שלך."
                                        value={draft.linkTracking}
                                        onChange={(v) => patch({ linkTracking: v })}
                                    />
                                    <SwitchRow
                                        label="הוספת פרמטרי UTM"
                                        description="תיוג כל קישור עם utm_source, utm_medium, utm_campaign ו-utm_content לכל קישור."
                                        value={draft.utmTracking}
                                        onChange={(v) => patch({ utmTracking: v })}
                                    />
                                    <SwitchRow
                                        label="כותרת הסרה (List-Unsubscribe)"
                                        description="הוספת List-Unsubscribe, שרוב ספקי הדואר מצפים לה."
                                        value={draft.unsubHeader}
                                        onChange={(v) => patch({ unsubHeader: v })}
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

// Review -------------------------------------------------------------------

export type LaunchBlock = string | null;

export function ReviewStep({
    draft,
    estimate,
    tz,
    tzLabel,
    finalName,
    segmentNames,
    launchBlock,
    lockedSteps,
    customWindows,
    existingLeads = 0,
    goTo,
}: {
    draft: Draft;
    estimate: EstimateState;
    tz?: string;
    tzLabel: string;
    finalName: string;
    segmentNames: string[];
    launchBlock: LaunchBlock;
    lockedSteps?: Sequence[] | null;
    customWindows?: boolean;
    existingLeads?: number;
    goTo: (k: StepKey) => void;
}) {
    const e = estimate.data;
    const written = writtenEmails(draft);
    const steps = lockedSteps ? lockedSteps.length : Math.max(1, written.length);
    const hasLeads = draft.segmentIds.length > 0 || existingLeads > 0;
    const totalDays = draft.emails.slice(1).reduce((n, em) => n + Math.max(0, em.wait_after), 0);
    const at = scheduledDate(draft);
    const headline = estimateHeadline(e, { steps, hasLeads, tz });

    const rows: { key: StepKey; icon: React.ComponentType<{ className?: string }>; title: string; value: string; warn?: boolean }[] = [
        {
            key: "leads",
            icon: UsersIcon,
            title: "לידים",
            value: hasLeads
                ? draft.segmentIds.length === 0
                    ? `${e ? plural(e.recipients, "ליד", "לידים") : "…"} כבר בקמפיין`
                    : `${e ? plural(e.recipients, "ליד", "לידים") : "…"} מתוך ${segmentNames.join(", ") || plural(draft.segmentIds.length, "רשימה", "רשימות")}${existingLeads > 0 ? " והלידים שכבר קיימים בו" : ""}`
                : "אין עדיין. הוסף אותם לאחר יצירת הקמפיין.",
            warn: !hasLeads || (e ? e.recipients === 0 : false),
        },
        {
            key: "emails",
            icon: MailIcon,
            title: "אימיילים",
            value:
                written.length === 0
                    ? "טרם נכתב תוכן. כתוב כאן או בלשונית שלבים."
                    : `${plural(written.length, "אימייל", "אימיילים")}${written.length > 1 ? ` לאורך ${plural(totalDays, "יום", "ימים")}` : ""}: “${written[0].subject}”`,
            warn: written.length === 0,
        },
        {
            key: "schedule",
            icon: CalendarClockIcon,
            title: "לוח זמנים",
            value: `${at ? `מתחיל ב-${fmtDateTime(at)}` : "מתחיל ברגע ההשקה"} · ${customWindows ? "חלון מותאם אישית לכל יום" : `${daysLabel(draft.days)}, ${fmt24(draft.startTime)} עד ${fmt24(draft.endTime)}`} · ${tzLabel}`,
        },
        {
            key: "schedule",
            icon: SendIcon,
            title: "שולחים",
            value: e
                ? e.mailboxes === 0
                    ? "אין תיבת דואר פעילה"
                    : `${plural(e.mailboxes, "תיבת דואר", "תיבות דואר")}, עד ${draft.dailyLimit}/יום לכל אחת${e.held > 0 ? ` (${e.held} בהמתנה)` : ""}`
                : "…",
            warn: !!e && (e.mailboxes === 0 || e.held > 0),
        },
    ];

    return (
        <div className="max-w-[720px] text-start">
            <StepIntro title="סקירה והשקה" hint={`“${finalName}”. הכל ניתן לשינוי גם מאוחר יותר.`} />

            <div
                className={cn(
                    "rounded-lg border px-4 py-4",
                    headline?.tone === "warn" ? "border-amber-200 bg-amber-50/40" : "border-slate-200",
                )}
            >
                {!e && estimate.loading ? (
                    <div className="flex items-center gap-2 text-[12.5px] text-slate-500">
                        <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
                        מחשב את זמני השליחה מול תיבות הדואר שלך…
                    </div>
                ) : estimate.error && !e ? (
                    <p className="text-[12.5px] text-slate-500">לא ניתן לחשב את הערכת הזמנים. ניתן עדיין להשיק את הקמפיין.</p>
                ) : headline ? (
                    <>
                        <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                                <p className={cn("text-[16px] font-semibold tracking-[-0.01em]", headline.tone === "warn" ? "text-amber-900" : "text-slate-900")}>
                                    {headline.title}
                                </p>
                                <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">{headline.detail}</p>
                            </div>
                            {estimate.loading && <Loader2Icon className="w-3.5 h-3.5 animate-spin text-slate-300 shrink-0 mt-1" />}
                        </div>
                        {e && e.timeline.some((d) => d.sends > 0) && (
                            <EstimateTimeline days={e.timeline} showFollowUps={steps > 1} className="mt-4" />
                        )}
                        {e && (
                            <div className="mt-4 space-y-2">
                                <BottleneckNote e={e} tz={tz} />
                                <WarmupNote e={e} />
                            </div>
                        )}
                    </>
                ) : null}
            </div>

            <div className="mt-5 border border-slate-200 rounded-md divide-y divide-slate-100">
                {rows.map((r) => (
                    <button
                        key={r.title}
                        type="button"
                        onClick={() => goTo(r.key)}
                        className="group w-full px-3 py-2.5 flex items-center gap-3 text-start hover:bg-slate-50 transition-colors"
                    >
                        <span
                            className={cn(
                                "size-6 rounded-md inline-flex items-center justify-center shrink-0",
                                r.warn ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500",
                            )}
                        >
                            <r.icon className="w-3.5 h-3.5" />
                        </span>
                        <span className="w-20 shrink-0 text-[12px] text-slate-500">{r.title}</span>
                        <span className={cn("min-w-0 flex-1 truncate text-[12.5px]", r.warn ? "text-amber-800" : "text-slate-900")}>{r.value}</span>
                        <span className="shrink-0 text-[11.5px] text-slate-400 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            עריכה
                        </span>
                    </button>
                ))}
            </div>

            {launchBlock && (
                <p className="mt-3 text-[11.5px] text-slate-500 flex items-start gap-1.5 leading-relaxed">
                    <AlertCircleIcon className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-px" />
                    <span>{launchBlock} שמור את הקמפיין כטיוטה כעת והשק אותו מדף הקמפיין כשהוא יהיה מוכן.</span>
                </p>
            )}
        </div>
    );
}

// Launch plan rail -----------------------------------------------------------

export function LaunchPlanRail({
    draft,
    estimate,
    tz,
    existingLeads = 0,
}: {
    draft: Draft;
    estimate: EstimateState;
    tz?: string;
    existingLeads?: number;
}) {
    const e = estimate.data;
    const steps = Math.max(1, writtenEmails(draft).length);
    const headline = estimateHeadline(e, { steps, hasLeads: draft.segmentIds.length > 0 || existingLeads > 0, tz });
    return (
        <aside className="hidden lg:flex w-[300px] shrink-0 rtl:border-r ltr:border-l border-slate-200 bg-slate-50/50 flex-col min-h-0 text-start">
            <div className="px-4 pt-4 pb-3 flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">תוכנית השקה</span>
                {estimate.loading && <Loader2Icon className="w-3 h-3 animate-spin text-slate-300" />}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-4">
                {!e ? (
                    <div className="space-y-2">
                        <div className="h-4 w-3/4 rounded bg-slate-200/70 animate-pulse" />
                        <div className="h-3 w-full rounded bg-slate-200/50 animate-pulse" />
                        <div className="h-16 w-full rounded bg-slate-200/40 animate-pulse mt-3" />
                    </div>
                ) : (
                    <>
                        {headline && (
                            <div>
                                <p className={cn("text-[13.5px] font-semibold leading-snug", headline.tone === "warn" ? "text-amber-900" : "text-slate-900")}>
                                    {headline.title}
                                </p>
                                <p className="text-[11.5px] text-slate-500 mt-1 leading-relaxed">{headline.detail}</p>
                            </div>
                        )}
                        {e.timeline.some((d) => d.sends > 0) && (
                            <EstimateTimeline days={e.timeline} height={64} maxBars={28} showFollowUps={steps > 1} />
                        )}
                        <dl className="space-y-1.5 text-[12px]">
                            {(draft.segmentIds.length > 0 || existingLeads > 0) && <Fact label="לידים" value={e.recipients.toLocaleString("he-IL")} />}
                            {e.total_sends > 0 && steps > 1 && <Fact label="אימיילים בסך הכל" value={e.total_sends.toLocaleString("he-IL")} />}
                            <Fact label="תיבות דואר" value={e.mailboxes.toLocaleString("he-IL")} />
                            {e.steady_capacity > 0 && <Fact label="מהירות מלאה" value={`${e.steady_capacity.toLocaleString("he-IL")}/יום`} />}
                            {e.full_capacity_at && <Fact label="הגעה לקצב" value={fmtDay(e.full_capacity_at, tz)} />}
                        </dl>
                        <BottleneckNote e={e} tz={tz} />
                        <WarmupNote e={e} />
                    </>
                )}
            </div>
        </aside>
    );
}

function Fact({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <dt className="text-slate-500">{label}</dt>
            <dd className="text-slate-900 font-medium tabular-nums">{value}</dd>
        </div>
    );
}
