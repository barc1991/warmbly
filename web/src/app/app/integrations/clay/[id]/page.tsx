// Clay page: the URL a Clay table posts rows to, what those rows become, and
// which Warmbly events are sent back to a Clay table.

"use client";

import React from "react";
import { Link, useBlocker, useParams } from "react-router-dom";
import {
    AlertTriangleIcon,
    ArrowLeftIcon,
    CheckIcon,
    CopyIcon,
    ExternalLinkIcon,
    Loader2Icon,
    RefreshCwIcon,
    SendIcon,
} from "lucide-react";
import toast from "react-hot-toast/headless";
import { useTranslation } from "react-i18next";

import { Checkbox } from "@/components/ui/checkbox";
import { FieldError, Label, TextInput } from "@/components/ui/field";
import ResourceViewers from "@/components/app/presence/ResourceViewers";
import CampaignPicker from "@/components/app/campaigns/CampaignPicker";
import { Segmented, Toggle } from "@/components/app/campaigns/preferences/components/CampaignPreferenceBoolBox";
import CategoryPicker from "@/components/app/contacts/CategoryPicker";
import { SegmentMultiPicker } from "@/components/app/segments/SegmentPickers";
import { useConfirm } from "@/hooks/context/confirm";
import { usePresenceResource } from "@/hooks/PresenceProvider";
import useCampaigns from "@/lib/api/hooks/app/campaigns/useCampaigns";
import { useRotateInboundUrl, useTestConnection } from "@/lib/api/hooks/app/integrations/useConnectionWebhookTools";
import { useClaySettings, useUpdateClaySettings } from "@/lib/api/hooks/app/integrations/useClay";
import type { ClayInboundDefaults, ClaySettings } from "@/lib/api/models/app/integrations/Clay";
import { API_URL } from "@/lib/information";
import { takeInboundUrl } from "@/lib/integrations/freshInboundUrl";
import { cn } from "@/lib/utils";

import ProviderGlyph from "../../_components/ProviderGlyph";
import StatusPill, { HealthDot } from "../../_components/StatusPill";
import { CardRow, SettingsCard, ToggleRow, primaryBtn, secondaryBtn } from "../../salesforce/_components/shared";
import { absolute, ago, errMsg } from "../../salesforce/_components/util";

const CLAY_EVENT_LABELS: Record<string, string> = {
    "campaign.reply_received": "Prospect replies",
    "campaign.email_sent": "Email sent",
    "campaign.email_opened": "Email opened",
    "campaign.email_clicked": "Link clicked",
    "campaign.email_bounced": "Email bounces",
    "campaign.unsubscribed": "Contact unsubscribes",
    "meeting.booked": "Meeting booked",
    "meeting.canceled": "Meeting canceled",
};

const CLAY_EVENT_LABELS_HE: Record<string, string> = {
    "campaign.reply_received": "תשובה התקבלה מאיש קשר",
    "campaign.email_sent": "אימייל נשלח",
    "campaign.email_opened": "אימייל נפתח",
    "campaign.email_clicked": "קישור נלחץ",
    "campaign.email_bounced": "אימייל נדחה (Bounce)",
    "campaign.unsubscribed": "איש קשר ביטל הרשמה",
    "meeting.booked": "פגישה נקבעה",
    "meeting.canceled": "פגישה בוטלה",
};

// The inbound route is served by the API, which is often not the dashboard's host.
const absoluteUrl = (url: string) =>
    url.startsWith("http") ? url : `${(API_URL || window.location.origin).replace(/\/+$/, "")}${url}`;

const BODY_EXAMPLE = `{
  "email": "/Work Email",
  "first_name": "/First Name",
  "last_name": "/Last Name",
  "company": "/Company Name",
  "title": "/Job Title",
  "linkedin_url": "/LinkedIn Profile",
  "tags": "clay, q4-list"
}`;

export default function ClayPage() {
    const { i18n } = useTranslation();
    const isHe = i18n.language === "he";

    const { id = "" } = useParams();
    const settings = useClaySettings(id);
    usePresenceResource(id ? `integration_connection:${id}` : null, "editing");

    const s = settings.data;

    if (settings.isError && !s) {
        return (
            <div className="flex flex-col min-h-full bg-white text-start rtl:text-right ltr:text-left">
                <div className="px-3 sm:px-5 pt-3 sm:pt-4 pb-3">
                    <BackLink isHe={isHe} />
                    <div className="mt-6 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 max-w-xl">
                        <p className="text-[12.5px] font-medium text-rose-800">
                            {isHe ? "לא ניתן לטעון חיבור Clay זה" : "This Clay connection could not be loaded"}
                        </p>
                        <p className="text-[11.5px] text-rose-700 mt-0.5">
                            {errMsg(settings.error, isHe ? "יתכן שהוא נותק." : "It may have been disconnected.")}
                        </p>
                        <button type="button" onClick={() => void settings.refetch()} className={cn(secondaryBtn, "mt-2.5")}>
                            <RefreshCwIcon className="w-3 h-3" />
                            {isHe ? "נסה שוב" : "Try again"}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-full bg-white text-start rtl:text-right ltr:text-left">
            <div className="px-3 sm:px-5 pt-3 sm:pt-4 pb-3 flex flex-wrap items-start gap-3 border-b border-slate-200">
                <div className="min-w-0 flex-1">
                    <BackLink isHe={isHe} />
                    <div className="flex items-center gap-2.5 min-w-0">
                        <ProviderGlyph provider="clay" name="Clay" />
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <h1 className="min-w-0 max-w-full text-[18px] font-semibold text-slate-900 truncate">
                                    {s?.label || "Clay"}
                                </h1>
                                {s && <StatusPill status={s.status} />}
                                <ResourceViewers resource={id ? `integration_connection:${id}` : null} className="shrink-0" />
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-slate-500 mt-0.5">
                                {s && (
                                    <span className="inline-flex items-center gap-1">
                                        <HealthDot health={s.health} />
                                        {s.health}
                                    </span>
                                )}
                                {s && (
                                    <span title={absolute(s.stats.last_received_at)}>
                                        {isHe
                                            ? `שורה אחרונה ${ago(s.stats.last_received_at)}`
                                            : `Last row ${ago(s.stats.last_received_at)}`}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <a href="https://app.clay.com/" target="_blank" rel="noopener noreferrer" className={secondaryBtn}>
                    <ExternalLinkIcon className="w-3 h-3" />
                    {isHe ? "פתח את Clay" : "Open Clay"}
                </a>
            </div>

            <div className="flex-1 px-3 sm:px-5 py-5 pb-24 space-y-8 max-w-4xl">
                {!s ? (
                    <div className="space-y-3">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="h-28 rounded-md bg-slate-100 animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <>
                        <InboundCard connectionId={id} minted={s.inbound_url_minted} isHe={isHe} />
                        <StatsCard settings={s} isHe={isHe} />
                        <DefaultsCard connectionId={id} saved={s.defaults} isHe={isHe} />
                        <OutboundCard connectionId={id} settings={s} isHe={isHe} />
                    </>
                )}
            </div>
        </div>
    );
}

// The URL is the credential and is shown only right after it is minted.
function InboundCard({ connectionId, minted, isHe }: { connectionId: string; minted: boolean; isHe?: boolean }) {
    const confirm = useConfirm();
    const rotate = useRotateInboundUrl();
    const [url, setUrl] = React.useState<string | null>(() => {
        const fresh = takeInboundUrl(connectionId);
        return fresh ? absoluteUrl(fresh) : null;
    });
    const [copied, setCopied] = React.useState<string | null>(null);

    function copy(text: string, what: string) {
        void navigator.clipboard.writeText(text).then(
            () => {
                setCopied(what);
                window.setTimeout(() => setCopied((c) => (c === what ? null : c)), 1500);
            },
            () => toast.error(isHe ? "לא ניתן להעתיק" : "Could not copy"),
        );
    }

    function regenerate() {
        const run = async () => {
            try {
                const res = await rotate.mutateAsync(connectionId);
                setUrl(absoluteUrl(res.inbound_webhook_url));
                toast.success(isHe ? "כתובת חדשה הופקה. העתק אותה כעת; היא מוצגת פעם אחת בלבד." : "New URL ready. Copy it now; it is shown once.");
            } catch (err) {
                toast.error(errMsg(err, isHe ? "לא ניתן להפיק כתובת חדשה" : "Could not make a new URL"));
                throw err;
            }
        };
        if (minted) {
            confirm.show(
                isHe
                    ? "ליצור כתובת חדשה? הכתובת הנוכחית תפסיק לפעול באופן מיידי, לכן יש לעדכן כל עמודת Clay שמשתמשת בה."
                    : "Make a new URL? The current one stops working at once, so update every Clay column that uses it.",
                run,
            );
        } else {
            void run().catch(() => undefined);
        }
    }

    return (
        <SettingsCard
            title={isHe ? "שליחת שורות מ-Clay" : "Send rows from Clay"}
            description={
                isHe
                    ? "הוסף עמודת HTTP API בטבלת Clay והפנה אותה לכתובת זו. כל שורה שמעובדת הופכת לאיש קשר ב-Warmbly, שנוצר או מתעדכן לפי כתובת הדוא\"ל."
                    : "Add an HTTP API column to a Clay table and point it at this URL. Each row it runs becomes a Warmbly contact, created or updated by email address."
            }
        >
            <CardRow className="space-y-2">
                <Label>{isHe ? "כתובת ה-Clay שלך" : "Your Clay URL"}</Label>
                {url ? (
                    <>
                        <div className="flex items-center gap-1.5">
                            <code
                                dir="ltr"
                                className="flex-1 min-w-0 h-7 px-2 rounded-md border border-slate-200 bg-slate-50 text-[11.5px] font-mono text-slate-800 inline-flex items-center overflow-x-auto whitespace-nowrap"
                            >
                                {url}
                            </code>
                            <button type="button" onClick={() => copy(url, "url")} className={secondaryBtn}>
                                {copied === "url" ? <CheckIcon className="w-3 h-3 text-emerald-600" /> : <CopyIcon className="w-3 h-3" />}
                                {isHe ? "העתק" : "Copy"}
                            </button>
                        </div>
                        <p className="text-[11px] text-amber-700 flex items-center gap-1">
                            <AlertTriangleIcon className="w-3 h-3 shrink-0" />
                            {isHe ? "העתק אותה כעת. היא משמשת כסיסמה ולא תוצג שוב לעולם." : "Copy it now. It works like a password and is not shown again."}
                        </p>
                    </>
                ) : (
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[12px] text-slate-600 flex-1 min-w-[220px]">
                            {minted
                                ? (isHe ? "הכתובת מוסתרת מכיוון שהיא משמשת כסיסמה. צור כתובת חדשה אם איבדת אותה." : "The URL is hidden because it works like a password. Make a new one if you lost it.")
                                : (isHe ? "אין כתובת עדיין. צור כתובת כדי להתחיל לשלוח שורות." : "No URL yet. Make one to start sending rows.")}
                        </span>
                        <button type="button" onClick={regenerate} disabled={rotate.isPending} className={minted ? secondaryBtn : primaryBtn}>
                            {rotate.isPending ? <Loader2Icon className="w-3 h-3 animate-spin" /> : <RefreshCwIcon className="w-3 h-3" />}
                            {minted ? (isHe ? "צור כתובת חדשה" : "Make a new URL") : (isHe ? "צור כתובת" : "Make a URL")}
                        </button>
                    </div>
                )}
                {url && (
                    <button type="button" onClick={regenerate} disabled={rotate.isPending} className="text-[11px] text-slate-500 hover:text-slate-800 underline-offset-2 hover:underline">
                        {isHe ? "צור כתובת חדשה במקום זאת" : "Make a new URL instead"}
                    </button>
                )}
            </CardRow>
            <CardRow className="space-y-3">
                <ol className="space-y-1.5 text-[12px] text-slate-700 list-decimal ps-4 marker:text-slate-400">
                    {isHe ? (
                        <>
                            <li>בטבלת ה-Clay שלך, הוסף עמודה ובחר ב-<span className="font-medium">HTTP API</span>.</li>
                            <li>
                                הגדר את המתודה ל-<span className="font-mono text-[11.5px]">POST</span> והדבק את הכתובת שלמעלה כיעד הבקשה.
                            </li>
                            <li>
                                כתוב גוף JSON. הקלד <span className="font-mono text-[11.5px]">/</span> כדי להוסיף שדה מהטבלה. רק שדה{" "}
                                <span className="font-mono text-[11.5px]">email</span> הינו חובה.
                            </li>
                            <li>הפעל את העמודה על מספר שורות לבדיקה, ולאחר מכן הפעל הרצה אוטומטית.</li>
                        </>
                    ) : (
                        <>
                            <li>In your Clay table, add a column and pick <span className="font-medium">HTTP API</span>.</li>
                            <li>
                                Set the method to <span className="font-mono text-[11.5px]">POST</span> and paste the URL above as the endpoint.
                            </li>
                            <li>
                                Write a JSON body. Type <span className="font-mono text-[11.5px]">/</span> to insert a column. Only{" "}
                                <span className="font-mono text-[11.5px]">email</span> is required.
                            </li>
                            <li>Run the column on a few rows, check the result, then turn on auto-run.</li>
                        </>
                    )}
                </ol>
                <div className="relative">
                    <pre dir="ltr" className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11.5px] font-mono text-slate-800 overflow-x-auto text-left">
                        {BODY_EXAMPLE}
                    </pre>
                    <button
                        type="button"
                        onClick={() => copy(BODY_EXAMPLE, "body")}
                        aria-label={isHe ? "העתק דוגמת JSON" : "Copy the example body"}
                        className="absolute top-1.5 end-1.5 size-7 rounded-md text-slate-400 hover:text-slate-900 hover:bg-white inline-flex items-center justify-center"
                    >
                        {copied === "body" ? <CheckIcon className="w-3 h-3 text-emerald-600" /> : <CopyIcon className="w-3 h-3" />}
                    </button>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                    {isHe
                        ? "מפתחות נתמכים: email, first_name, last_name, name, company, phone, tags, subscribed ו-campaign_id. כל מפתח אחר נשמר כשדה מותאם אישית. התגובה מחזירה status ו-contact_id, שניתן למפות בחזרה לעמודות Clay. עד 100 שורות לבקשה."
                        : "Recognised keys: email, first_name, last_name, name, company, phone, tags, subscribed and campaign_id. Any other key is saved as a custom field. The response carries status and contact_id, which you can map back into Clay columns. Up to 100 rows per request."}
                </p>
            </CardRow>
        </SettingsCard>
    );
}

function StatsCard({ settings: s, isHe }: { settings: ClaySettings; isHe?: boolean }) {
    const st = s.stats;
    const cells: { label: string; value: number; tone?: string }[] = [
        { label: isHe ? "שורות שהתקבלו" : "Rows received", value: st.received },
        { label: isHe ? "אנשי קשר שנוצרו" : "Contacts created", value: st.created, tone: "text-emerald-700" },
        { label: isHe ? "אנשי קשר שעודכנו" : "Contacts updated", value: st.updated },
        { label: isHe ? "דולגו" : "Skipped", value: st.skipped },
        { label: isHe ? "נכשלו" : "Failed", value: st.failed, tone: st.failed > 0 ? "text-rose-700" : undefined },
    ];
    return (
        <SettingsCard title={isHe ? "פעילות" : "Activity"}>
            <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-slate-100">
                {cells.map((c) => (
                    <div key={c.label} className="px-4 py-3">
                        <div className={cn("text-[18px] font-semibold tabular-nums text-slate-900", c.tone)}>{c.value.toLocaleString()}</div>
                        <div className="text-[11px] text-slate-500">{c.label}</div>
                    </div>
                ))}
            </div>
            {st.last_error && (
                <CardRow className="border-t border-slate-100">
                    <p className="text-[11.5px] text-rose-700 flex items-start gap-1.5 break-words">
                        <AlertTriangleIcon className="w-3 h-3 mt-0.5 shrink-0" />
                        {isHe ? `תקלה אחרונה: ${st.last_error}` : `Last problem: ${st.last_error}`}
                    </p>
                </CardRow>
            )}
        </SettingsCard>
    );
}

const sameDefaults = (a: ClayInboundDefaults, b: ClayInboundDefaults) =>
    (a.campaign_id ?? null) === (b.campaign_id ?? null) &&
    a.dedup === b.dedup &&
    a.subscribed === b.subscribed &&
    [...a.category_ids].sort().join() === [...b.category_ids].sort().join() &&
    [...a.segment_ids].sort().join() === [...b.segment_ids].sort().join();

function normalize(d: ClayInboundDefaults): ClayInboundDefaults {
    return { ...d, campaign_id: d.campaign_id ?? null, category_ids: d.category_ids ?? [], segment_ids: d.segment_ids ?? [] };
}

function DefaultsCard({ connectionId, saved, isHe }: { connectionId: string; saved: ClayInboundDefaults; isHe?: boolean }) {
    const confirm = useConfirm();
    const update = useUpdateClaySettings(connectionId);
    const campaigns = useCampaigns({ query: "", folder: "" });
    const [base, setBase] = React.useState(() => normalize(saved));
    const [draft, setDraft] = React.useState(() => normalize(saved));
    const dirty = !sameDefaults(draft, base);

    // A teammate's save is adopted while nobody is editing here.
    const dirtyRef = React.useRef(dirty);
    dirtyRef.current = dirty;
    React.useEffect(() => {
        if (dirtyRef.current) return;
        setBase(normalize(saved));
        setDraft(normalize(saved));
    }, [saved]);

    const blocker = useBlocker(React.useCallback(() => dirtyRef.current, []));
    React.useEffect(() => {
        if (blocker.state !== "blocked") return;
        confirm.show(
            isHe
                ? "יש לך שינויים שלא נשמרו בברירות המחדל של Clay. לעזוב ולבטל אותם?"
                : "You have unsaved Clay defaults. Leave and discard them?",
            async () => blocker.proceed?.(),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [blocker.state, isHe]);

    const campaignName = campaigns.campaigns.find((c) => c.id === draft.campaign_id)?.name ?? "";

    async function save() {
        try {
            const res = await update.mutateAsync({ connectionId, body: { defaults: draft } });
            setBase(normalize(res.defaults));
            setDraft(normalize(res.defaults));
            toast.success(isHe ? "ברירות המחדל של Clay נשמרו" : "Clay defaults saved");
        } catch (err) {
            toast.error(errMsg(err, isHe ? "לא ניתן לשמור את ברירות המחדל" : "Could not save the defaults"));
        }
    }

    return (
        <SettingsCard
            title={isHe ? "מה השורות הופכות להיות" : "What rows become"}
            description={
                isHe
                    ? "מוחל על כל שורה ש-Clay שולח. תגיות מהשורה עצמה מתווספות לאלו, ושורה עם campaign_id משויכת לקמפיין זה במקום."
                    : "Applied to every row Clay sends. A row's own tags are added to these, and a row with campaign_id goes to that campaign instead."
            }
            action={
                dirty ? (
                    <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => setDraft(base)} disabled={update.isPending} className={secondaryBtn}>
                            {isHe ? "בטל שינויים" : "Discard"}
                        </button>
                        <button type="button" onClick={() => void save()} disabled={update.isPending} className={primaryBtn}>
                            {update.isPending && <Loader2Icon className="w-3.5 h-3.5 animate-spin" />}
                            {isHe ? "שמור" : "Save"}
                        </button>
                    </div>
                ) : undefined
            }
        >
            <CardRow className="grid gap-4 sm:grid-cols-2">
                <div>
                    <Label>{isHe ? "הוספה לקמפיין" : "Add to a campaign"}</Label>
                    <CampaignPicker
                        campaignId={draft.campaign_id ?? null}
                        campaignName={campaignName}
                        onChange={(cid) => setDraft((d) => ({ ...d, campaign_id: cid }))}
                        noneLabel={isHe ? "הוסף לאנשי קשר בלבד" : "Only add to contacts"}
                    />
                </div>
                <div>
                    <Label>{isHe ? "תוויות" : "Labels"}</Label>
                    <CategoryPicker value={draft.category_ids} onChange={(ids) => setDraft((d) => ({ ...d, category_ids: ids }))} />
                </div>
                <div>
                    <Label>{isHe ? "נעיצה במקטעים" : "Pin into segments"}</Label>
                    <SegmentMultiPicker value={draft.segment_ids} onChange={(ids) => setDraft((d) => ({ ...d, segment_ids: ids }))} />
                </div>
                <div>
                    <Label>{isHe ? "כאשר איש הקשר כבר קיים" : "When the contact already exists"}</Label>
                    <Segmented
                        value={draft.dedup}
                        onChange={(v) => setDraft((d) => ({ ...d, dedup: v }))}
                        options={[
                            { value: "update", label: isHe ? "עדכן אותו" : "Update it" },
                            { value: "skip", label: isHe ? "השאר ללא שינוי" : "Leave it alone" },
                        ]}
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                        {isHe
                            ? "עדכון ממלא את מה ש-Clay שולח ואינו מוחק שדות קיימים."
                            : "Updating fills in what Clay sends and never blanks a field."}
                    </p>
                </div>
            </CardRow>
            <CardRow className="border-t border-slate-100">
                <ToggleRow
                    title={isHe ? "רשום לקמפיינים" : "Subscribed to campaigns"}
                    description={
                        isHe
                            ? "אנשי קשר חדשים נוצרים כרשומים. שורה עדיין יכולה לשלוח subscribed: false."
                            : "New contacts start subscribed. A row can still send subscribed: false."
                    }
                    control={
                        <Toggle
                            value={draft.subscribed}
                            onChange={(v) => setDraft((d) => ({ ...d, subscribed: v }))}
                            ariaLabel={isHe ? "רשום לקמפיינים" : "Subscribed to campaigns"}
                        />
                    }
                />
            </CardRow>
        </SettingsCard>
    );
}

function OutboundCard({ connectionId, settings: s, isHe }: { connectionId: string; settings: ClaySettings; isHe?: boolean }) {
    const confirm = useConfirm();
    const update = useUpdateClaySettings(connectionId);
    const test = useTestConnection();
    const [webhookUrl, setWebhookUrl] = React.useState("");
    const [token, setToken] = React.useState("");
    const [events, setEvents] = React.useState<string[]>(s.outbound.events ?? []);
    const [error, setError] = React.useState<string | null>(null);

    const savedEvents = s.outbound.events ?? [];
    const eventsDirty = [...events].sort().join() !== [...savedEvents].sort().join();
    const dirty = !!webhookUrl.trim() || !!token.trim() || eventsDirty;

    // A teammate's save is adopted while nothing here is edited.
    const savedKey = savedEvents.join();
    const eventsDirtyRef = React.useRef(eventsDirty);
    eventsDirtyRef.current = eventsDirty;
    React.useEffect(() => {
        if (!eventsDirtyRef.current) setEvents(s.outbound.events ?? []);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [savedKey]);

    function toggle(ev: string) {
        setEvents((cur) => (cur.includes(ev) ? cur.filter((e) => e !== ev) : [...cur, ev]));
        setError(null);
    }

    async function save() {
        setError(null);
        try {
            await update.mutateAsync({
                connectionId,
                body: {
                    ...(webhookUrl.trim() ? { webhook_url: webhookUrl.trim() } : {}),
                    ...(token.trim() ? { auth_token: token.trim() } : {}),
                    events,
                },
            });
            setWebhookUrl("");
            setToken("");
            toast.success(isHe ? "הגדרות שליחה ל-Clay נשמרו" : "Clay sending saved");
        } catch (err) {
            setError(errMsg(err, isHe ? "לא ניתן לשמור" : "Could not save"));
        }
    }

    function disconnectTable() {
        confirm.show(
            isHe
                ? "להפסיק לשלוח ל-Clay? פעולה זו תסיר את ה-Webhook של הטבלה, את הטוקן ואת כל האירועים שנבחרו."
                : "Stop sending to Clay? This removes the table webhook, its token and every chosen event.",
            async () => {
                try {
                    await update.mutateAsync({ connectionId, body: { webhook_url: "", auth_token: "", events: [] } });
                    setEvents([]);
                    toast.success(isHe ? "השליחה ל-Clay הופסקה" : "Stopped sending to Clay");
                } catch (err) {
                    toast.error(errMsg(err, isHe ? "לא ניתן לעדכן" : "Could not update"));
                    throw err;
                }
            },
        );
    }

    function sendTest() {
        test.mutate(connectionId, {
            onSuccess: (r) =>
                toast.success(
                    isHe
                        ? (r.sent === 1 ? "שורת בדיקה נשלחה בהצלחה ל-Clay" : `${r.sent} שורות בדיקה נשלחו בהצלחה ל-Clay`)
                        : (r.sent === 1 ? "Sent a test row to Clay" : `Sent ${r.sent} test rows to Clay`),
                ),
            onError: (err) => toast.error(errMsg(err, isHe ? "שורת הבדיקה לא הגיעה ל-Clay" : "The test row did not reach Clay")),
        });
    }

    const canTest = s.outbound.webhook_url_set && savedEvents.length > 0 && !dirty;

    return (
        <SettingsCard
            title={isHe ? "שליחת אירועים ל-Clay" : "Send events to Clay"}
            description={
                isHe
                    ? "כל אירוע שנבחר מוסיף שורה לטבלת Clay: פרטי איש הקשר, מה קרה והקמפיין. תהליכי עבודה ב-Clay יכולים להסתעף לפי מענה, קפיצות דוא\"ל ופגישות."
                    : "Each chosen event adds a row to a Clay table: who it was, what happened, and the campaign. Clay workflows can branch on replies, bounces and meetings."
            }
            action={
                s.outbound.webhook_url_set ? (
                    <button
                        type="button"
                        onClick={sendTest}
                        disabled={!canTest || test.isPending}
                        title={!canTest ? (dirty ? (isHe ? "שמור תחילה" : "Save first") : (isHe ? "בחר אירוע אחד לפחות" : "Choose at least one event")) : undefined}
                        className={secondaryBtn}
                    >
                        {test.isPending ? <Loader2Icon className="w-3 h-3 animate-spin" /> : <SendIcon className="w-3 h-3" />}
                        {isHe ? "שלח שורת בדיקה" : "Send a test row"}
                    </button>
                ) : undefined
            }
        >
            <CardRow className="grid gap-4 sm:grid-cols-2">
                <div>
                    <Label>{isHe ? "כתובת Webhook של הטבלה" : "Table webhook URL"}</Label>
                    <TextInput
                        value={webhookUrl}
                        onChange={(v) => {
                            setWebhookUrl(v);
                            setError(null);
                        }}
                        placeholder={
                            s.outbound.webhook_url_set
                                ? (isHe ? `שמור (${s.outbound.webhook_host ?? "Clay"}). הדבק להחלפה` : `Saved (${s.outbound.webhook_host ?? "Clay"}). Paste to replace`)
                                : "https://api.clay.com/v3/sources/webhook/…"
                        }
                        autoComplete="off"
                        className="w-full font-mono text-start rtl:text-left ltr:text-left"
                        dir="ltr"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                        {isHe ? "ב-Clay, הוסף מקור (source) לטבלה ובחר ב-Webhook." : "In Clay, add a source to the table and choose Webhook."}
                    </p>
                </div>
                <div>
                    <Label>{isHe ? "טוקן אימות (אופציונלי)" : "Auth token (optional)"}</Label>
                    <TextInput
                        value={token}
                        onChange={(v) => {
                            setToken(v);
                            setError(null);
                        }}
                        type="password"
                        placeholder={
                            s.outbound.auth_token_set
                                ? (isHe ? "שמור. הדבק להחלפה" : "Saved. Paste to replace")
                                : (isHe ? "מהגדרות מקור ה-Webhook" : "From the webhook source settings")
                        }
                        autoComplete="off"
                        className="w-full font-mono text-start rtl:text-left ltr:text-left"
                        dir="ltr"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                        {isHe ? "נשלח ככותרת x-clay-webhook-auth כאשר המקור דורש זאת." : "Sent as the x-clay-webhook-auth header when the source asks for one."}
                    </p>
                </div>
            </CardRow>
            <CardRow className="border-t border-slate-100">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium mb-2">
                    {isHe ? "אירועים" : "Events"}
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                    {s.available_events.map((ev) => (
                        <label key={ev} className="flex items-center gap-2 text-[12.5px] text-slate-700 cursor-pointer">
                            <Checkbox tone="slate" checked={events.includes(ev)} onChange={() => toggle(ev)} />
                            {isHe ? (CLAY_EVENT_LABELS_HE[ev] ?? ev) : (CLAY_EVENT_LABELS[ev] ?? ev)}
                        </label>
                    ))}
                </div>
            </CardRow>
            <CardRow className="border-t border-slate-100 flex flex-wrap items-center gap-2">
                <FieldError message={error} className="flex-1 min-w-[200px]" />
                <div className="ms-auto flex items-center gap-1.5">
                    {s.outbound.webhook_url_set && (
                        <button type="button" onClick={disconnectTable} disabled={update.isPending} className={secondaryBtn}>
                            {isHe ? "הפסק שליחה" : "Stop sending"}
                        </button>
                    )}
                    <button type="button" onClick={() => void save()} disabled={!dirty || update.isPending} className={primaryBtn}>
                        {update.isPending && <Loader2Icon className="w-3.5 h-3.5 animate-spin" />}
                        {isHe ? "שמור" : "Save"}
                    </button>
                </div>
            </CardRow>
        </SettingsCard>
    );
}

function BackLink({ isHe }: { isHe?: boolean }) {
    return (
        <Link
            to="/app/integrations"
            className="inline-flex items-center gap-1 h-6 -ms-1.5 px-1.5 mb-1 rounded-md text-[11.5px] text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
            <ArrowLeftIcon className="w-3 h-3 rtl:rotate-180" />
            {isHe ? "אינטגרציות" : "Integrations"}
        </Link>
    );
}
