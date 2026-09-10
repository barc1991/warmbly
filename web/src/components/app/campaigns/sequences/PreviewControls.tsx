// The step preview's context controls: which contact the copy is rendered for,
// which mailbox signs it, and a "send test" action that mails the saved step
// to an address through that mailbox. Shared by the original step and its A/B
// variants so every arm previews against the same lead and sender.

import React from "react";
import { Loader2Icon, MailIcon, SendIcon, UserRoundIcon } from "lucide-react";
import toast from "react-hot-toast";
import type Contact from "@/lib/api/models/app/contacts/Contact";
import type Inbox from "@/lib/api/models/app/emails/Inbox";
import useSearchContacts from "@/lib/api/hooks/app/contacts/useSearchContacts";
import useSendTestEmail from "@/lib/api/hooks/app/campaigns/useSendTestEmail";
import useDebouncedValue from "@/hooks/useDebouncedValue";
import { useUserProfile } from "@/hooks/context/user";
import { Label, SearchInput, TextInput } from "@/components/ui/field";
import {
    PopoverMenu,
    PopoverMenuContent,
    PopoverMenuItem,
    PopoverMenuLabel,
    PopoverMenuSeparator,
    PopoverMenuTrigger,
    SelectButton,
} from "@/components/ui/popover-menu";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import { SAMPLE_CONTACT_LABEL, contactLabel } from "./previewContext";

// Picks the contact the preview renders for. Lists the campaign's own leads
// first (they are who the step goes to); typing searches every contact.
export function PreviewContactPicker({
    campaignId,
    value,
    onChange,
}: {
    campaignId: string;
    value: Contact | null;
    onChange: (c: Contact | null) => void;
}) {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const debounced = useDebouncedValue(query.trim(), 250);
    const searching = debounced.length > 0;

    const search = useSearchContacts({
        options: {
            query: debounced,
            custom_field_filters: [],
            campaign_ids: searching ? [] : [campaignId],
            sort_by: "updated_at",
            reverse: false,
        },
        limit: 8,
        enabled: open,
        keepPrevious: true,
    });
    const contacts = search.contacts ?? [];

    return (
        <PopoverMenu open={open} onOpenChange={setOpen}>
            <PopoverMenuTrigger asChild>
                <SelectButton
                    icon={<UserRoundIcon className="w-3.5 h-3.5" />}
                    label={value ? contactLabel(value) : SAMPLE_CONTACT_LABEL}
                    title="איש הקשר שעבורו מופקת התצוגה המקדימה"
                />
            </PopoverMenuTrigger>
            <PopoverMenuContent minWidth={280} className="p-1">
                <div className="p-1.5">
                    <SearchInput value={query} onChange={setQuery} placeholder="חפש אנשי קשר..." autoFocus />
                </div>
                <PopoverMenuItem
                    selected={value === null}
                    onSelect={() => onChange(null)}
                    icon={<UserRoundIcon className="w-3.5 h-3.5" />}
                >
                    {SAMPLE_CONTACT_LABEL}
                </PopoverMenuItem>
                <PopoverMenuSeparator />
                <PopoverMenuLabel>{searching ? "תוצאות חיפוש" : "לידים בקמפיין זה"}</PopoverMenuLabel>
                <div className="max-h-56 overflow-y-auto">
                    {search.isLoading && contacts.length === 0 ? (
                        <div className="px-3 py-2 text-[11.5px] text-slate-400 inline-flex items-center gap-1.5">
                            <Loader2Icon className="w-3 h-3 animate-spin" /> טוען...
                        </div>
                    ) : contacts.length === 0 ? (
                        <div className="px-3 py-2 text-[11.5px] text-slate-400">
                            {searching ? "לא נמצאו אנשי קשר מתאימים." : "אין לידים עדיין. הקלד לחיפוש בכל אנשי הקשר."}
                        </div>
                    ) : (
                        contacts.map((c) => (
                            <PopoverMenuItem key={c.id} selected={value?.id === c.id} onSelect={() => onChange(c)}>
                                <span className="text-slate-800">{contactLabel(c)}</span>
                                <span className="ms-1.5 text-[11px] text-slate-400">{c.email}</span>
                            </PopoverMenuItem>
                        ))
                    )}
                </div>
            </PopoverMenuContent>
        </PopoverMenu>
    );
}

export function PreviewMailboxPicker({
    inboxes,
    value,
    onChange,
}: {
    inboxes: Inbox[];
    value: Inbox | null;
    onChange: (i: Inbox) => void;
}) {
    return (
        <PopoverMenu>
            <PopoverMenuTrigger asChild>
                <SelectButton
                    icon={<MailIcon className="w-3.5 h-3.5" />}
                    label={value ? value.email : "אין תיבת שליחה"}
                    title="תיבת הדוא״ל שחתימתה ושמה משמשים לתצוגה המקדימה"
                />
            </PopoverMenuTrigger>
            <PopoverMenuContent minWidth={260} className="p-1">
                <PopoverMenuLabel>תיבות שליחה</PopoverMenuLabel>
                {inboxes.length === 0 ? (
                    <div className="px-3 py-2 text-[11.5px] text-slate-400">
                        הוסף תיבת דוא״ל תחת שולחים כדי להציג את החתימה שלה.
                    </div>
                ) : (
                    inboxes.map((i) => (
                        <PopoverMenuItem key={i.id} selected={value?.id === i.id} onSelect={() => onChange(i)}>
                            <span className="text-slate-800">{i.email}</span>
                            {i.name && <span className="ms-1.5 text-[11px] text-slate-400">{i.name}</span>}
                        </PopoverMenuItem>
                    ))
                )}
            </PopoverMenuContent>
        </PopoverMenu>
    );
}

// Mails the saved step to an address. Disabled with the reason shown when it
// could not succeed (no mailbox in the pool, unsaved copy).
export function SendTestButton({
    campaignId,
    stepId,
    contact,
    mailbox,
    dirty,
}: {
    campaignId: string;
    stepId: string;
    contact: Contact | null;
    mailbox: Inbox | null;
    dirty: boolean;
}) {
    const { user } = useUserProfile();
    const [open, setOpen] = React.useState(false);
    const [recipient, setRecipient] = React.useState(user.email ?? "");
    const send = useSendTestEmail(campaignId);

    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.trim());
    const blocked = !mailbox
        ? "יש להוסיף תחילה תיבת שליחה לקמפיין."
        : dirty
          ? "יש לשמור את השלב תחילה כדי שהבדיקה תכלול את הנוסח העדכני."
          : null;

    async function submit() {
        if (!mailbox || blocked || !valid) return;
        await toast.promise(
            send.mutateAsync({
                account_id: mailbox.id,
                recipient: recipient.trim(),
                step_id: stepId,
                ...(contact ? { contact_id: contact.id } : {}),
            }),
            {
                loading: "שולח הודעת בדיקה...",
                success: `בדיקה נשלחה אל ${recipient.trim()} מתוך ${mailbox.email}.`,
                error: (e: AppError) => buildError(e),
            },
        );
        setOpen(false);
    }

    return (
        <PopoverMenu open={open} onOpenChange={setOpen}>
            <PopoverMenuTrigger asChild>
                <button
                    type="button"
                    title="שלח שלב זה לעצמך כבדיקה"
                    className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white text-[12px] font-medium text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900"
                >
                    <SendIcon className="w-3.5 h-3.5" />
                    שליחת בדיקה
                </button>
            </PopoverMenuTrigger>
            <PopoverMenuContent minWidth={300} className="p-2.5">
                <Label>שלח אל</Label>
                <TextInput value={recipient} onChange={setRecipient} placeholder="you@company.com" />
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                    נוצר עבור <span className="text-slate-700">{contact ? contactLabel(contact) : SAMPLE_CONTACT_LABEL}</span>
                    {mailbox && (
                        <>
                            , נשלח מ-<span className="text-slate-700">{mailbox.email}</span>
                        </>
                    )}
                    , יחד עם קבצי הקמפיין המצורפים, חתימת התיבה והערת שוליים להסרה. פתיחות ולחיצות על הודעה זו אינן נספרות במעקב.
                </p>
                {blocked && <p className="mt-1.5 text-[11px] text-amber-600">{blocked}</p>}
                <div className="mt-2.5 flex justify-end">
                    <button
                        type="button"
                        onClick={submit}
                        disabled={!!blocked || !valid || send.isPending}
                        className="h-7 px-3 rounded-md bg-sky-600 text-[12px] font-medium text-white hover:bg-sky-700 inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                        {send.isPending ? <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> : <SendIcon className="w-3.5 h-3.5" />}
                        שלח
                    </button>
                </div>
            </PopoverMenuContent>
        </PopoverMenu>
    );
}
