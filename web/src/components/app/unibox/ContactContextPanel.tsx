// ContactContextPanel : the CRM rail of the unibox thread reader.
//
// Given the sender address of the open thread, it resolves the contact and
// surfaces the customer-relationship context inline: who they are, which
// campaign(s) they came from, their engagement, and their deals / tasks /
// notes with one-click add. New deals stamp the originating campaign + the
// mailbox the thread is on, so a reply turns into attributed pipeline without
// leaving the inbox.

import React from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import {
    BanIcon,
    CalendarPlusIcon,
    CheckIcon,
    ChevronDownIcon,
    CircleDollarSignIcon,
    ExternalLinkIcon,
    Loader2Icon,
    MailWarningIcon,
    MegaphoneIcon,
    PhoneIcon,
    PlusIcon,
    StickyNoteIcon,
    TagIcon,
    UserIcon,
    UserXIcon,
    CheckSquareIcon,
    XIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { TextInput } from "@/components/ui/field";
import NewMeetingDialog from "@/components/app/meetings/NewMeetingDialog";
import BookACallButton from "@/components/app/integrations/BookACallButton";
import {
    PopoverMenu,
    PopoverMenuContent,
    PopoverMenuItem,
    PopoverMenuTrigger,
} from "@/components/ui/popover-menu";
import TaskTypePicker from "@/components/app/crm/TaskTypePicker";
import DueInDays from "@/components/app/crm/DueInDays";
import { dueInDaysToISO } from "@/lib/helper/dueDate";
import useContactByEmail from "@/lib/api/hooks/app/contacts/useContactByEmail";
import useContact from "@/lib/api/hooks/app/contacts/useContact";
import useContactDeals from "@/lib/api/hooks/app/contacts/useContactDeals";
import useContactNotes from "@/lib/api/hooks/app/contacts/useContactNotes";
import useCreateContactNote from "@/lib/api/hooks/app/contacts/useCreateContactNote";
import useCRMTasks from "@/lib/api/hooks/app/crm/tasks/useCRMTasks";
import useCreateCRMTask from "@/lib/api/hooks/app/crm/tasks/useCreateCRMTask";
import useCreateDeal from "@/lib/api/hooks/app/crm/deals/useCreateDeal";
import useUpdateDeal from "@/lib/api/hooks/app/crm/deals/useUpdateDeal";
import usePipelines from "@/lib/api/hooks/app/crm/pipelines/usePipelines";
import type { Stage } from "@/lib/api/models/app/crm/Pipeline";
import type Deal from "@/lib/api/models/app/crm/Deal";
import type CRMTask from "@/lib/api/models/app/crm/CRMTask";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";

const DEAL_STATUS: Record<Deal["status"], { label: string; labelHe: string; cls: string; dot: string }> = {
    open: { label: "Open", labelHe: "פתוחה", cls: "text-slate-600", dot: "bg-slate-400" },
    won: { label: "Won", labelHe: "נסגרה בהצלחה", cls: "text-emerald-700", dot: "bg-emerald-500" },
    lost: { label: "Lost", labelHe: "הפסד", cls: "text-red-700", dot: "bg-red-500" },
};

const PRIORITY_DOT: Record<CRMTask["priority"], string> = {
    urgent: "bg-red-500",
    high: "bg-amber-500",
    medium: "bg-sky-500",
    low: "bg-slate-400",
};

const PRIORITY_OPTS: { id: CRMTask["priority"]; label: string; labelHe: string }[] = [
    { id: "low", label: "Low", labelHe: "נמוכה" },
    { id: "medium", label: "Med", labelHe: "בינונית" },
    { id: "high", label: "High", labelHe: "גבוהה" },
    { id: "urgent", label: "Urgent", labelHe: "דחופה" },
];

export default function ContactContextPanel({
    email,
    mailboxId,
    onClose,
}: {
    email?: string;
    mailboxId?: string;
    onClose?: () => void;
}) {
    const { i18n } = useTranslation();
    const isHe = i18n.language === "he";
    const lookup = useContactByEmail(email);
    const contact = lookup.data ?? null;
    const contactId = contact?.id;
    const [meetingOpen, setMeetingOpen] = React.useState(false);

    const detailQ = useContact(contactId ?? "", !!contactId);
    const detail = detailQ.data;
    const dealsQ = useContactDeals(contactId ?? "");
    const tasksQ = useCRMTasks({ contact_id: contactId, limit: 50 }, !!contactId);
    const notesQ = useContactNotes(contactId ?? "");
    const dealDefault = usePipelinesDefault();

    const campaigns = detail?.campaigns ?? contact?.campaigns ?? [];
    const categories = detail?.categories ?? contact?.categories ?? [];
    const phone = contact?.phone || (contact?.custom_fields?.phone) || (detail?.custom_fields?.phone) || "";
    const jobTitle =
        contact?.custom_fields?.job_title ||
        contact?.custom_fields?.title ||
        detail?.custom_fields?.job_title ||
        detail?.custom_fields?.title ||
        "";
    const rawStatus =
        contact?.campaign_lead?.status ||
        contact?.custom_fields?.status ||
        detail?.custom_fields?.status ||
        "";
    const statusMeta = getStatusBadge(rawStatus, isHe);
    const eng = detail?.engagement;
    const supp = detail?.suppression;

    const name =
        [contact?.first_name, contact?.last_name].filter(Boolean).join(" ").trim() ||
        contact?.email ||
        email ||
        "";

    return (
        <>
            {/* Below lg the panel renders as a right-side overlay drawer; this
                backdrop dims the thread behind it and closes on tap. */}
            <div
                className="lg:hidden fixed inset-0 z-[55] bg-slate-900/30"
                onClick={onClose}
                aria-hidden
            />
            <aside className="fixed inset-y-0 right-0 z-[60] flex w-[min(20rem,90vw)] shrink-0 flex-col border-l border-slate-200 bg-white min-h-0 shadow-xl lg:static lg:z-auto lg:w-80 lg:bg-slate-50/40 lg:shadow-none">
            <div className="h-12 px-3 border-b border-slate-200 flex items-center gap-2 shrink-0 bg-white">
                <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">
                    {isHe ? "איש קשר" : "Contact"}
                </span>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={isHe ? "הסתר חלונית איש קשר" : "Hide contact panel"}
                        className="ms-auto size-7 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center justify-center transition-colors"
                    >
                        <XIcon className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto">
                {lookup.isPending ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-[12px] text-slate-400">
                        <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
                        {isHe ? "מאתר איש קשר…" : "Resolving contact…"}
                    </div>
                ) : !contact ? (
                    <NotAContact email={email} />
                ) : (
                    <div className="divide-y divide-slate-200/70">
                        {/* Identity */}
                        <div className="px-3 py-3">
                            <div className="flex items-start gap-2.5">
                                <div className="size-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-[12px] font-semibold shrink-0">
                                    {initials(name)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-[13px] font-semibold text-slate-900 truncate">{name}</div>
                                    <div className="text-[11.5px] text-slate-500 truncate">{contact.email}</div>
                                    {(contact.company || jobTitle) && (
                                        <div className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-1">
                                            {jobTitle && <span>{jobTitle}</span>}
                                            {jobTitle && contact.company && <span>·</span>}
                                            {contact.company && <span>{contact.company}</span>}
                                        </div>
                                    )}
                                    {phone && (
                                        <div className="text-[11px] text-slate-400 font-mono truncate mt-0.5 flex items-center gap-1">
                                            <PhoneIcon className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                            <a href={`tel:${phone}`} className="hover:text-sky-600 transition-colors">{phone}</a>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                                {contact.subscribed ? (
                                    <Badge tone="emerald" icon={<CheckIcon className="w-2.5 h-2.5" />}>{isHe ? "רשום לתפוצה" : "Subscribed"}</Badge>
                                ) : (
                                    <Badge tone="slate" icon={<UserXIcon className="w-2.5 h-2.5" />}>{isHe ? "הסיר הרשמה" : "Unsubscribed"}</Badge>
                                )}
                                {statusMeta && (
                                    <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                                )}
                                {supp && (
                                    <Badge tone="red" icon={<BanIcon className="w-2.5 h-2.5" />}>
                                        {isHe ? "חסום לשליחה" : "Suppressed"}
                                    </Badge>
                                )}
                                <Link
                                    to="/app/contacts"
                                    className="ms-auto inline-flex items-center gap-1 text-[10.5px] text-slate-400 hover:text-sky-700 transition-colors"
                                >
                                    {isHe ? "אנשי קשר" : "Contacts"}
                                    <ExternalLinkIcon className="w-2.5 h-2.5" />
                                </Link>
                            </div>

                            {/* Contact categories / tags */}
                            {categories.length > 0 && (
                                <div className="mt-2.5 flex flex-wrap items-center gap-1 pt-2 border-t border-slate-100">
                                    <TagIcon className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                    {categories.map((cat) => (
                                        <ContactTagChip key={cat.id} title={cat.title} color={cat.color} />
                                    ))}
                                </div>
                            )}
                            {/* Meeting actions: schedule a call right here (native,
                                no calendar needed), plus a self-serve booking link
                                when a Calendly / Cal.com calendar is connected. */}
                            <div className="mt-2.5 flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setMeetingOpen(true)}
                                    className="h-7 px-2 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-[11.5px] font-medium inline-flex items-center gap-1.5 transition-colors"
                                >
                                    <CalendarPlusIcon className="w-3 h-3" />
                                    {isHe ? "קבע שיחה" : "Schedule call"}
                                </button>
                                <BookACallButton email={contact.email} name={name} contactId={contact.id} />
                            </div>
                            {supp && (
                                <div className="mt-2 rounded-md border border-red-200 bg-red-50/60 px-2 py-1.5 flex items-start gap-1.5">
                                    <MailWarningIcon className="w-3 h-3 text-red-600 mt-px shrink-0" />
                                    <span className="text-[10.5px] text-red-700/90 leading-snug">
                                        {supp.reason || (isHe ? "חסום לשליחה" : "Suppressed")} ({supp.source})
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Lead source : campaigns */}
                        <Section label={isHe ? "קמפיינים" : "Campaigns"} hint={campaigns.length ? undefined : (isHe ? "לא באף קמפיין" : "Not in any campaign")}>
                            {campaigns.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {campaigns.map((c) => (
                                        <Link
                                            key={c.id}
                                            to="/app/campaigns"
                                            className="inline-flex items-center gap-1 h-5 px-1.5 rounded bg-white border border-slate-200 hover:border-sky-300 text-[10.5px] text-slate-600 hover:text-sky-700 transition-colors"
                                        >
                                            <MegaphoneIcon className="w-2.5 h-2.5 text-slate-400" />
                                            <span className="truncate max-w-[140px]">{c.name}</span>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </Section>

                        {/* Engagement */}
                        {eng && (
                            <Section label={isHe ? "מעורבות" : "Engagement"}>
                                <div className="grid grid-cols-4 gap-1.5">
                                    <Metric label={isHe ? "נשלחו" : "Sent"} value={eng.total_sent} />
                                    <Metric label={isHe ? "נפתחו" : "Open"} value={eng.total_opened} />
                                    <Metric label={isHe ? "לחיצות" : "Click"} value={eng.total_clicked} />
                                    <Metric label={isHe ? "תשובות" : "Reply"} value={eng.total_replied} accent />
                                </div>
                            </Section>
                        )}

                        {/* Deals */}
                        <DealsSection
                            contactId={contact.id}
                            deals={dealsQ.data ?? []}
                            loading={dealsQ.isPending}
                            defaultName={contact.company || name}
                            campaignId={campaigns[0]?.id}
                            mailboxId={mailboxId}
                            pipelineId={dealDefault.pipelineId}
                            stages={dealDefault.stages}
                        />

                        {/* Tasks */}
                        <TasksSection
                            contactId={contact.id}
                            tasks={(tasksQ.data?.data ?? []).filter((t) => t.status !== "completed" && t.status !== "cancelled")}
                            loading={tasksQ.isPending}
                            defaultTitle={isHe ? `מעקב מול ${name}` : `Follow up with ${name}`}
                            contactName={name}
                            company={contact.company}
                            dealId={(dealsQ.data ?? []).find((d) => d.status === "open")?.id}
                        />

                        {/* Notes */}
                        <NotesSection contactId={contact.id} notes={asNoteList(notesQ.data)} loading={notesQ.isPending} />
                    </div>
                )}
            </div>
            {contact && (
                <NewMeetingDialog
                    open={meetingOpen}
                    onClose={() => setMeetingOpen(false)}
                    prefill={{
                        title: name ? (isHe ? `שיחה עם ${name}` : `Call with ${name}`) : (isHe ? "שיחה" : "Call"),
                        name,
                        email: contact.email,
                        contactId: contact.id,
                    }}
                />
            )}
            </aside>
        </>
    );
}

// Resolve the org's first pipeline + its first stage, used as the default
// target when creating a deal from the panel. Kept as a tiny hook so the deal
// section stays declarative.
function usePipelinesDefault() {
    const pipelines = usePipelines();
    const first = pipelines.data?.[0];
    const stages: Stage[] = first ? [...(first.stages ?? [])].sort((a, b) => a.position - b.position) : [];
    return { pipelineId: first?.id, stageId: stages[0]?.id, stages };
}

function DealsSection({
    contactId,
    deals,
    loading,
    defaultName,
    campaignId,
    mailboxId,
    pipelineId,
    stages,
}: {
    contactId: string;
    deals: Deal[];
    loading: boolean;
    defaultName: string;
    campaignId?: string;
    mailboxId?: string;
    pipelineId?: string;
    stages: Stage[];
}) {
    const { i18n } = useTranslation();
    const isHe = i18n.language === "he";
    const create = useCreateDeal();
    const updateDeal = useUpdateDeal();
    const [open, setOpen] = React.useState(false);
    const [name, setName] = React.useState(defaultName);
    const [value, setValue] = React.useState("");
    const [stageId, setStageId] = React.useState<string | undefined>(stages[0]?.id);

    React.useEffect(() => setName(defaultName), [defaultName]);
    React.useEffect(() => setStageId((s) => s ?? stages[0]?.id), [stages]);

    const canAdd = !!pipelineId && stages.length > 0;

    async function submit() {
        if (!name.trim()) {
            toast.error(isHe ? "נדרש שם עסקה" : "Deal name required");
            return;
        }
        const data: Partial<Deal> = {
            pipeline_id: pipelineId,
            stage_id: stageId,
            name: name.trim(),
            contact_id: contactId,
            currency: "USD",
        };
        if (value.trim()) {
            const n = Number(value);
            if (Number.isFinite(n)) data.value = n;
        }
        if (campaignId) data.campaign_id = campaignId;
        if (mailboxId) data.source_mailbox_id = mailboxId;
        try {
            await toast.promise(create.mutateAsync(data), {
                loading: isHe ? "יוצר עסקה…" : "Creating deal…",
                success: isHe ? "העסקה נוצרה" : "Deal created",
                error: (e: AppError) => buildError(e),
            });
            setOpen(false);
            setValue("");
        } catch {
            /* surfaced */
        }
    }

    async function moveDeal(dealId: string, newStageId: string) {
        try {
            await toast.promise(
                updateDeal.mutateAsync({ id: dealId, data: { stage_id: newStageId } as Partial<Deal> }),
                { loading: isHe ? "מעביר…" : "Moving…", success: isHe ? "הועבר" : "Moved", error: (e: AppError) => buildError(e) },
            );
        } catch {
            /* surfaced */
        }
    }

    return (
        <Section
            label={isHe ? "עסקאות" : "Deals"}
            action={
                canAdd ? (
                    <AddButton open={open} onClick={() => setOpen((o) => !o)} isHe={isHe} />
                ) : (
                    <Link to="/app/crm/pipelines" className="text-[10.5px] text-slate-400 hover:text-sky-700">
                        {isHe ? "הוסף צינור מכירות" : "Add a pipeline"}
                    </Link>
                )
            }
        >
            {open && canAdd && (
                <div className="mb-2 rounded-md border border-slate-200 bg-white p-2 space-y-1.5">
                    <TextInput value={name} onChange={setName} placeholder={isHe ? "שם עסקה" : "Deal name"} className="w-full" autoFocus />
                    <div className="flex items-center gap-1.5">
                        <StagePicker stages={stages} value={stageId} onChange={setStageId} className="flex-1" isHe={isHe} />
                        <TextInput value={value} onChange={setValue} placeholder={isHe ? "שווי" : "Value"} className="w-[88px]" />
                    </div>
                    {(campaignId || mailboxId) && (
                        <p className="text-[10px] text-slate-400 leading-snug">
                            {isHe
                                ? `מיוחס אל ${campaignId ? "קמפיין זה" : ""}${campaignId && mailboxId ? " + " : ""}${mailboxId ? "תיבה זו" : ""}.`
                                : `Attributed to this ${campaignId ? "campaign" : ""}${campaignId && mailboxId ? " + " : ""}${mailboxId ? "mailbox" : ""}.`}
                        </p>
                    )}
                    <button
                        type="button"
                        onClick={submit}
                        disabled={create.isPending}
                        className="w-full h-7 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[11.5px] font-medium inline-flex items-center justify-center gap-1 transition-colors disabled:opacity-60"
                    >
                        {create.isPending ? <Loader2Icon className="w-3 h-3 animate-spin" /> : <CheckIcon className="w-3 h-3" />}
                        {isHe ? "צור עסקה" : "Create deal"}
                    </button>
                </div>
            )}
            {loading ? (
                <RowSkeleton />
            ) : deals.length === 0 ? (
                <Empty icon={<CircleDollarSignIcon className="w-3.5 h-3.5" />} text={isHe ? "אין עסקאות עדיין" : "No deals yet"} />
            ) : (
                <div className="space-y-1">
                    {deals.map((d) => {
                        const st = DEAL_STATUS[d.status];
                        const canMove = d.status === "open" && stages.length > 0 && d.pipeline_id === pipelineId;
                        return (
                            <div
                                key={d.id}
                                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 flex items-center gap-2"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="text-[11.5px] font-medium text-slate-900 truncate">{d.name}</div>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className={`inline-flex items-center gap-1 text-[10px] ${st.cls}`}>
                                            <span className={`size-1.5 rounded-full ${st.dot}`} />
                                            {isHe ? st.labelHe : st.label}
                                        </span>
                                        {canMove ? (
                                            <StagePicker
                                                stages={stages}
                                                value={d.stage_id}
                                                onChange={(s) => moveDeal(d.id, s)}
                                                compact
                                                isHe={isHe}
                                            />
                                        ) : d.stage?.name ? (
                                            <span className="text-[10px] text-slate-400 truncate">· {d.stage.name}</span>
                                        ) : null}
                                    </div>
                                </div>
                                {d.value != null && (
                                    <span className="font-mono text-[10.5px] text-emerald-700 tabular-nums shrink-0">
                                        {money(d.value, d.currency)}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </Section>
    );
}

// Compact stage selector used both to place a new deal and to move an existing
// open deal through the pipeline without leaving the inbox. `compact` renders
// the inline text trigger used inside a deal row.
function StagePicker({
    stages,
    value,
    onChange,
    className,
    compact,
    isHe = false,
}: {
    stages: Stage[];
    value?: string;
    onChange: (stageId: string) => void;
    className?: string;
    compact?: boolean;
    isHe?: boolean;
}) {
    const [open, setOpen] = React.useState(false);
    const cur = stages.find((s) => s.id === value);

    return (
        <PopoverMenu open={open} onOpenChange={setOpen} align="start">
            <PopoverMenuTrigger asChild>
                <button
                    type="button"
                    className={
                        compact
                            ? "inline-flex items-center gap-1 min-w-0 max-w-[110px] text-[10px] text-slate-500 hover:text-slate-900 transition-colors"
                            : `h-7 px-2 rounded-md border border-slate-200 hover:border-slate-300 bg-white text-[12px] text-slate-700 inline-flex items-center gap-1.5 transition-colors ${className ?? ""}`
                    }
                >
                    <span
                        className="size-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: cur?.color || "#94a3b8" }}
                    />
                    <span className={compact ? "truncate" : "truncate flex-1 text-start"}>
                        {cur?.name ?? (isHe ? "שלב" : "Stage")}
                    </span>
                    <ChevronDownIcon className="w-3 h-3 text-slate-400 shrink-0" />
                </button>
            </PopoverMenuTrigger>
            <PopoverMenuContent minWidth={170} className="max-h-56 overflow-y-auto">
                {stages.map((s) => (
                    <PopoverMenuItem
                        key={s.id}
                        onSelect={() => onChange(s.id)}
                        selected={s.id === value}
                        icon={
                            <span
                                className="size-2 rounded-full block"
                                style={{ backgroundColor: s.color || "#94a3b8" }}
                            />
                        }
                    >
                        {s.name}
                    </PopoverMenuItem>
                ))}
            </PopoverMenuContent>
        </PopoverMenu>
    );
}

function TasksSection({
    contactId,
    tasks,
    loading,
    defaultTitle,
    contactName,
    company,
    dealId,
}: {
    contactId: string;
    tasks: CRMTask[];
    loading: boolean;
    defaultTitle: string;
    contactName: string;
    company?: string;
    dealId?: string;
}) {
    const { i18n } = useTranslation();
    const isHe = i18n.language === "he";
    const create = useCreateCRMTask();
    const [open, setOpen] = React.useState(false);
    const [title, setTitle] = React.useState(defaultTitle);
    const [type, setType] = React.useState("");
    const [priority, setPriority] = React.useState<CRMTask["priority"]>("medium");
    const [dueDays, setDueDays] = React.useState<number | null>(3);
    const [desc, setDesc] = React.useState("");

    React.useEffect(() => setTitle(defaultTitle), [defaultTitle]);

    async function submit() {
        if (!title.trim()) {
            toast.error(isHe ? "נדרשת כותרת משימה" : "Task title required");
            return;
        }
        const data: Partial<CRMTask> = {
            title: title.trim(),
            contact_id: contactId,
            priority,
        };
        if (type) data.type = type;
        if (dueDays !== null) data.due_date = dueInDaysToISO(dueDays);
        if (desc.trim()) data.description = desc.trim();
        if (dealId) data.deal_id = dealId;
        try {
            await toast.promise(create.mutateAsync(data), {
                loading: isHe ? "מוסיף משימה…" : "Adding task…",
                success: isHe ? "המשימה נוספה" : "Task added",
                error: (e: AppError) => buildError(e),
            });
            setOpen(false);
            setType("");
            setPriority("medium");
            setDueDays(3);
            setDesc("");
        } catch {
            /* surfaced */
        }
    }

    return (
        <Section label={isHe ? "משימות" : "Tasks"} action={<AddButton open={open} onClick={() => setOpen((o) => !o)} isHe={isHe} />}>
            {open && (
                <div className="mb-2 rounded-md border border-slate-200 bg-white p-2 space-y-1.5">
                    <TextInput
                        value={title}
                        onChange={setTitle}
                        placeholder={isHe ? `מעקב מול ${contactName}…` : `Follow up with ${contactName}…`}
                        className="w-full"
                        autoFocus
                    />
                    <TaskTypePicker value={type} onChange={setType} className="w-full" />
                    <DueInDays value={dueDays} onChange={setDueDays} />
                    <div className="flex items-center gap-0.5">
                        {PRIORITY_OPTS.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => setPriority(p.id)}
                                className={`h-6 px-2 rounded text-[10.5px] font-medium inline-flex items-center gap-1 transition-colors ${
                                    priority === p.id
                                        ? "bg-slate-100 text-slate-900 ring-1 ring-slate-300"
                                        : "text-slate-500 hover:text-slate-900"
                                }`}
                            >
                                <span className={`size-1.5 rounded-full ${PRIORITY_DOT[p.id]}`} />
                                {isHe ? p.labelHe : p.label}
                            </button>
                        ))}
                    </div>
                    <textarea
                        value={desc}
                        onChange={(e) => setDesc(e.target.value)}
                        placeholder={isHe ? "פרטים (אופציונלי)" : "Details (optional)"}
                        rows={2}
                        className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px] text-slate-700 placeholder:text-slate-400 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 resize-none"
                    />
                    <p className="text-[10px] text-slate-400 leading-snug">
                        {isHe
                            ? `מקושר אל ${contactName}${company ? ` · ${company}` : ""}${dealId ? " · עסקה פתוחה" : ""}.`
                            : `Linked to ${contactName}${company ? ` · ${company}` : ""}${dealId ? " · open deal" : ""}.`}
                    </p>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={create.isPending}
                        className="w-full h-7 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[11.5px] font-medium inline-flex items-center justify-center gap-1 transition-colors disabled:opacity-60"
                    >
                        {create.isPending ? <Loader2Icon className="w-3 h-3 animate-spin" /> : <CheckIcon className="w-3 h-3" />}
                        {isHe ? "צור משימה" : "Create task"}
                    </button>
                </div>
            )}
            {loading ? (
                <RowSkeleton />
            ) : tasks.length === 0 ? (
                <Empty icon={<CheckSquareIcon className="w-3.5 h-3.5" />} text={isHe ? "אין משימות פתוחות" : "No open tasks"} />
            ) : (
                <div className="space-y-1">
                    {tasks.map((t) => (
                        <div key={t.id} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 flex items-center gap-2">
                            <span className={`size-1.5 rounded-full shrink-0 ${PRIORITY_DOT[t.priority]}`} />
                            <span className="text-[11.5px] text-slate-800 truncate flex-1">{t.title}</span>
                            {t.due_date && (
                                <span className="font-mono text-[10px] text-slate-400 tabular-nums shrink-0">
                                    {fmtDate(t.due_date, isHe)}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </Section>
    );
}

function NotesSection({
    contactId,
    notes,
    loading,
}: {
    contactId: string;
    notes: { id: string; content: string; created_at: Date | string }[];
    loading: boolean;
}) {
    const { i18n } = useTranslation();
    const isHe = i18n.language === "he";
    const create = useCreateContactNote();
    const [draft, setDraft] = React.useState("");

    async function submit() {
        if (!draft.trim()) return;
        try {
            await create.mutateAsync({ contactId, data: { content: draft.trim() } });
            setDraft("");
        } catch (e) {
            toast.error(buildError(e as AppError));
        }
    }

    return (
        <Section label={isHe ? "הערות" : "Notes"}>
            <div className="mb-2 rounded-md border border-slate-200 bg-white p-2">
                <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={isHe ? "הוסף הערה…" : "Add a note…"}
                    rows={2}
                    className="w-full bg-transparent text-[11.5px] text-slate-900 placeholder:text-slate-400 outline-none resize-none"
                />
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={submit}
                        disabled={create.isPending || !draft.trim()}
                        className="h-6 px-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-medium inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                    >
                        {create.isPending ? <Loader2Icon className="w-2.5 h-2.5 animate-spin" /> : <PlusIcon className="w-2.5 h-2.5" />}
                        {isHe ? "הערה" : "Note"}
                    </button>
                </div>
            </div>
            {loading ? (
                <RowSkeleton />
            ) : notes.length === 0 ? (
                <Empty icon={<StickyNoteIcon className="w-3.5 h-3.5" />} text={isHe ? "אין הערות עדיין" : "No notes yet"} />
            ) : (
                <div className="space-y-1.5">
                    {notes.slice(0, 5).map((n) => (
                        <div key={n.id} className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
                            <p className="text-[11.5px] text-slate-700 leading-snug whitespace-pre-wrap break-words">{n.content}</p>
                            <p className="text-[10px] text-slate-400 mt-1 font-mono">{fmtDate(n.created_at, isHe)}</p>
                        </div>
                    ))}
                </div>
            )}
        </Section>
    );
}

// ── small presentational helpers ───────────────────────────────────

function Section({
    label,
    hint,
    action,
    children,
}: {
    label: string;
    hint?: string;
    action?: React.ReactNode;
    children?: React.ReactNode;
}) {
    return (
        <div className="px-3 py-3">
            <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">{label}</span>
                {action && <span className="ms-auto">{action}</span>}
            </div>
            {hint ? <p className="text-[11px] text-slate-400">{hint}</p> : children}
        </div>
    );
}

function AddButton({ open, onClick, isHe = false }: { open: boolean; onClick: () => void; isHe?: boolean }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="h-6 px-1.5 rounded-md border border-slate-200 hover:border-slate-300 text-[10.5px] text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 transition-colors"
        >
            {open ? <XIcon className="w-2.5 h-2.5" /> : <PlusIcon className="w-2.5 h-2.5" />}
            {open ? (isHe ? "ביטול" : "Cancel") : (isHe ? "הוספה" : "Add")}
        </button>
    );
}

function Badge({
    tone,
    icon,
    children,
}: {
    tone: "emerald" | "slate" | "red" | "sky" | "amber" | "purple";
    icon?: React.ReactNode;
    children: React.ReactNode;
}) {
    const cls = {
        emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
        slate: "bg-slate-100 text-slate-600 border-slate-200",
        red: "bg-red-50 text-red-700 border-red-100",
        sky: "bg-sky-50 text-sky-700 border-sky-100",
        amber: "bg-amber-50 text-amber-700 border-amber-100",
        purple: "bg-purple-50 text-purple-700 border-purple-100",
    }[tone];
    return (
        <span className={`inline-flex items-center gap-1 h-5 px-1.5 rounded border text-[10px] font-medium ${cls}`}>
            {icon}
            {children}
        </span>
    );
}

function ContactTagChip({ title, color }: { title: string; color: string }) {
    return (
        <span
            className="inline-flex items-center gap-1 h-4.5 px-1.5 rounded border text-[10px] font-medium max-w-[140px] overflow-hidden"
            style={{
                borderColor: color ? `${color}60` : "rgb(226 232 240)",
                backgroundColor: color ? `${color}14` : "rgb(248 250 252)",
                color: "rgb(51 65 85)",
            }}
            title={title}
        >
            <span
                aria-hidden
                className="size-1.5 rounded-full shrink-0"
                style={{ backgroundColor: color || "#94a3b8" }}
            />
            <span className="truncate">{title}</span>
        </span>
    );
}

function getStatusBadge(
    status: string,
    isHe: boolean,
): { label: string; tone: "emerald" | "slate" | "red" | "sky" | "amber" | "purple" } | null {
    if (!status) return null;
    const s = status.toLowerCase();
    switch (s) {
        case "replied":
        case "interested":
            return { label: isHe ? "נענה / מתעניין" : "Replied / Interested", tone: "emerald" };
        case "active":
            return { label: isHe ? "פעיל בקמפיין" : "Active", tone: "sky" };
        case "pending":
            return { label: isHe ? "ממתין" : "Pending", tone: "amber" };
        case "completed":
            return { label: isHe ? "הושלם" : "Completed", tone: "slate" };
        case "unsubscribed":
            return { label: isHe ? "הסיר הרשמה" : "Unsubscribed", tone: "slate" };
        case "bounced":
        case "failed":
        case "undeliverable":
            return { label: isHe ? "שגיאת מסירה" : "Delivery Issue", tone: "red" };
        default:
            return { label: status, tone: "sky" };
    }
}

function Metric({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
    return (
        <div className="rounded-md border border-slate-200 bg-white px-1.5 py-1.5 text-center">
            <div className={`text-[14px] font-light tabular-nums leading-none ${accent ? "text-sky-700" : "text-slate-900"}`}>
                {value}
            </div>
            <div className="text-[9px] uppercase tracking-[0.08em] text-slate-400 mt-1">{label}</div>
        </div>
    );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
    return (
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 py-1">
            <span className="text-slate-300">{icon}</span>
            {text}
        </div>
    );
}

function RowSkeleton() {
    return (
        <div className="space-y-1">
            {[0, 1].map((i) => (
                <div key={i} className="h-8 rounded-md bg-slate-100 animate-pulse" />
            ))}
        </div>
    );
}

function NotAContact({ email }: { email?: string }) {
    const { i18n } = useTranslation();
    const isHe = i18n.language === "he";
    return (
        <div className="px-3 py-8 text-center">
            <div className="mx-auto size-9 rounded-md bg-white border border-slate-200 flex items-center justify-center mb-2.5">
                <UserIcon className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-[12px] font-medium text-slate-700 mb-0.5">
                {isHe ? "איש קשר לא מוכר" : "Not a known contact"}
            </p>
            {email && <p className="text-[11px] text-slate-400 break-all mb-3">{email}</p>}
            <Link
                to="/app/contacts"
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-slate-200 hover:border-slate-300 text-[11.5px] text-slate-700 hover:text-slate-900 transition-colors"
            >
                <PlusIcon className="w-3 h-3" />
                {isHe ? "ניהול אנשי קשר" : "Manage contacts"}
            </Link>
        </div>
    );
}

// The notes endpoint returns either a bare array or a { data, pagination }
// envelope depending on the path; normalise to a plain list (mirrors the
// contacts NotesTab helper) so .slice/.map never blow up.
function asNoteList(raw: unknown): { id: string; content: string; created_at: Date | string }[] {
    const arr = Array.isArray(raw) ? raw : ((raw as { data?: unknown } | null | undefined)?.data ?? []);
    return Array.isArray(arr) ? (arr as { id: string; content: string; created_at: Date | string }[]) : [];
}

function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function money(n: number, currency = "USD") {
    try {
        return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD", maximumFractionDigits: 0 }).format(n);
    } catch {
        return `$${Math.round(n).toLocaleString()}`;
    }
}

function fmtDate(d: string | Date, isHe = false) {
    try {
        return new Date(d).toLocaleDateString(isHe ? "he-IL" : "en-US", { month: "short", day: "numeric" });
    } catch {
        return "";
    }
}
