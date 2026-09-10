// Mailbox detail — a themed right slide-over with five tabs:
//   Overview   read-only at-a-glance: health, today's usage, warmup status, identity
//   Analytics  warmup volume series + summary metrics
//   Warmup     editable warmup ramp config + live status
//   Sending    human sending behaviour: working days, hours, lunch, volume, spacing
//   Settings   profile, signature, tags, sending caps, tracking domain
// Edits across Warmup + Settings share one form; a sticky save bar commits
// them via PATCH /emails/:id. Sending owns its own save (PUT
// /emails/:id/behavior) because the profile is a separate resource with its own
// validation. Read data: /analytics/accounts/:id and /analytics/warmup?email_id=.

import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import AdvisorStrip from "@/components/app/advisor/AdvisorStrip";
import {
    XIcon,
    GaugeIcon,
    BarChart3Icon,
    FlameIcon,
    Settings2Icon,
    ClockFadingIcon,
    CheckCircle2Icon,
    AlertTriangleIcon,
    AlertCircleIcon,
    ClockIcon,
    CalendarIcon,
    ReplyIcon,
    SendIcon,
    CopyIcon,
    CheckIcon,
    PlayIcon,
    PauseIcon,
    ShieldCheckIcon,
    ShieldAlertIcon,
    BanIcon,
    HourglassIcon,
    XCircleIcon,
    RefreshCwIcon,
    type LucideIcon,
} from "lucide-react";
import toast from "react-hot-toast";

import type Inbox from "@/lib/api/models/app/emails/Inbox";
import type AccountStatusModel from "@/lib/api/models/app/analytics/AccountStatus";
import type { AccountError } from "@/lib/api/models/app/analytics/AccountStatus";
import useAccountStatus from "@/lib/api/hooks/app/analytics/useAccountStatus";
import useWarmupAnalytics from "@/lib/api/hooks/app/analytics/useWarmupAnalytics";
import useUpdateEmail from "@/lib/api/hooks/app/emails/useUpdateEmail";
import useWarmupLifecycle from "@/lib/api/hooks/app/emails/useWarmupLifecycle";
import useSendHold from "@/lib/api/hooks/app/emails/useSendHold";
import useWarmupBanStatus from "@/lib/api/hooks/app/emails/useWarmupBanStatus";
import useAppealWarmupBan from "@/lib/api/hooks/app/emails/useAppealWarmupBan";
import useAuthCheck from "@/lib/api/hooks/app/emails/useAuthCheck";
import useRefreshAuthCheck from "@/lib/api/hooks/app/emails/useRefreshAuthCheck";
import useUpdateEmailTrackingDomain from "@/lib/api/hooks/app/emails/useUpdateEmailTrackingDomain";
import useEmailTrackingDomain from "@/lib/api/hooks/app/emails/useEmailTrackingDomain";
import useVerifyEmailTrackingDomain from "@/lib/api/hooks/app/emails/useVerifyEmailTrackingDomain";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import { useQueryClient } from "@tanstack/react-query";
import reauthEmailOAuth from "@/lib/api/client/app/emails/reauthEmailOAuth";
import onboardOAuthFinish from "@/lib/api/client/app/emails/onboardOAuthFinish";
import { openEmailOAuthPopup } from "@/lib/emails/emailOAuthPopup";
import UpdateCredentialsDialog from "./UpdateCredentialsDialog";
import EmailEditor from "../EmailEditor";
import SendingBehaviorTab from "./SendingBehaviorTab";
import SyncStatusCard from "./SyncStatusCard";
import CloudWarmupCard from "./CloudWarmupCard";
import useCloudPool from "@/hooks/useCloudPool";
import { Toggle } from "@/components/app/campaigns/preferences/components/CampaignPreferenceBoolBox";
import useSendingBehavior from "@/lib/api/hooks/app/emails/useSendingBehavior";
import useSendingPlan from "@/lib/api/hooks/app/emails/useSendingPlan";
import { minutesToClock, secondsToLabel } from "@/lib/api/models/app/emails/SendingBehavior";
import TagSelector from "../popup/select/TagSelector";
import TimeSelect from "@/components/ui/TimeSelect";
import { DitherBarChart } from "@/components/ui/dither";
import WeekdayBitmask from "../campaigns/schedule/WeekdayBitmask";
import { Loading } from "@/components/loader";
import { NumberInput, TextInput } from "@/components/ui/field";
import { useConfirm } from "@/hooks/context/confirm";
import { usePresenceResource } from "@/hooks/PresenceProvider";
import ResourceViewers from "@/components/app/presence/ResourceViewers";
import { cn } from "@/lib/utils";

/* ── small themed primitives ─────────────────────── */

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
    <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">{children}</div>
);

// Warmup volume dropping, or a ramp that stops climbing, reads as a bug when
// nothing says why. The two states end at different times, so they are worded
// separately.
function RampHoldNotice({ hold }: { hold: import("@/lib/api/models/app/analytics/AccountStatus").WarmupRampHold }) {
    const hours = Math.max(0, Math.round((new Date(hold.resumes_at).getTime() - Date.now()) / 3_600_000));
    const resumesIn = hours > 0 ? ` למשך כ-${hours} ${hours === 1 ? "שעה" : "שעות"}` : "";
    return (
        <div className="px-5 py-4">
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 flex items-start gap-2">
                <AlertTriangleIcon className="w-3.5 h-3.5 mt-px shrink-0 text-amber-600" />
                <div className="min-w-0">
                    <p className="text-[12.5px] font-medium text-amber-900">
                        {hold.volume_cut ? "נפח החימום הוגבל" : "העלייה בנפח החימום הושהתה"}
                    </p>
                    <p className="text-[11.5px] text-amber-800/90 leading-relaxed mt-0.5">
                        {hold.volume_cut ? (
                            <>
                                {hold.placements === 1 ? "אימייל חימום אחד" : `${hold.placements} אימיילי חימום`} הגיעו לספאם ב-48 השעות האחרונות{hold.sends > 0 ? ` מתוך ${hold.sends} שנשלחו` : ""}. יעד היום הופחת ברבע והתוספת היומית מושהית{resumesIn}.
                            </>
                        ) : (
                            <>
                                הנפח חזר למצב תקין, אך התוספת היומית נשארת מושהית{resumesIn} בעקבות הגעה אחרונה לספאם.
                            </>
                        )}{" "}
                        העלייה תתחדש אוטומטית אם לא יהיו הגעות נוספות לספאם.
                    </p>
                </div>
            </div>
        </div>
    );
}

// A mailbox that has quietly stopped receiving campaign sends looks broken.
function LifecycleNotice({
    mailboxId,
    state,
    hasHealthSignal,
}: {
    mailboxId: string;
    state: import("@/lib/api/models/app/analytics/AccountStatus").SendLifecycleState;
    hasHealthSignal: boolean;
}) {
    const hold = useSendHold(mailboxId);
    const reserve = state.state === "reserve";
    const copy = reserve
        ? "תיבת דואר זו מושהית מקמפיינים. החימום ממשיך לפעול. כבה את ההשהיה למטה כדי להחזירה לסבב השליחה."
        : hasHealthSignal
            ? "תיבת דואר זו במנוחה: קמפיינים אינם שולחים ממנה בזמן שבריאות החימום שלה מתאוששת. היא תחזור לפעילות בעצמה ברגע שהבריאות תתאושש ותישאר יציבה במשך 3 ימים."
            : "תיבת דואר זו במנוחה, אך אינה משויכת למאגר חימום ולכן אין מדד בריאות להתאושש לפיו. היא תחזור לפעילות לאחר שלושה ימי מנוחה, או כעת אם תחזיר אותה.";
    const resume = () =>
        hold.mutate(false, {
            onSuccess: (data) =>
                toast.success(
                    data.state === "resting"
                        ? "עדיין במנוחה: בריאות החימום מוגבלת או גרוע מכך, לכן היא תישאר בחוץ עד שתתאושש"
                        : "תיבת הדואר חזרה לסבב הקמפיינים",
                ),
            onError: (e) => toast.error(buildError(e as unknown as AppError)),
        });
    return (
        <div className="px-5 py-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 flex items-start gap-2">
                <PauseIcon className="w-3.5 h-3.5 mt-px shrink-0 text-slate-500" />
                <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium text-slate-900">
                        אינה שולחת קמפיינים ({reserve ? "מושהית" : state.state})
                    </p>
                    <p className="text-[11.5px] text-slate-600 leading-relaxed mt-0.5">
                        {copy}
                        {!reserve && state.reason ? ` ${state.reason}.` : ""}
                    </p>
                    {!reserve && (
                        <button
                            type="button"
                            onClick={resume}
                            disabled={hold.isPending}
                            className="mt-2 h-7 px-2.5 inline-flex items-center rounded-md border border-slate-200 bg-white text-[12px] font-medium text-slate-700 hover:border-sky-400 hover:text-sky-700 disabled:opacity-50 transition-colors"
                        >
                            {hold.isPending ? "מחזיר…" : "החזר לקמפיינים"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// The owner's switch for the reserve lifecycle state.
function SendHoldControl({ mailboxId, state }: { mailboxId: string; state?: import("@/lib/api/models/app/analytics/AccountStatus").SendLifecycleState }) {
    const hold = useSendHold(mailboxId);
    const held = state?.state === "reserve";
    const toggle = (v: boolean) =>
        hold.mutate(v, {
            onSuccess: (data) =>
                toast.success(
                    v
                        ? "תיבת הדואר הושהתה מקמפיינים"
                        : data.state === "resting"
                            ? "ההשהיה שוחררה. תיבת הדואר תנוח עד שבריאות החימום שלה תתאושש"
                            : "תיבת הדואר חזרה לסבב הקמפיינים",
                ),
            onError: (e) => toast.error(buildError(e as unknown as AppError)),
        });
    return (
        <div className="px-5 py-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
                <div className="text-[12.5px] font-medium text-slate-900">השהה מקמפיינים</div>
                <div className="text-[11px] text-slate-400">
                    מונע מתיבת דואר זו לשלוח קמפיינים עד שתכבה את ההשהיה. החימום אינו מושפע, ו-Warmbly לעולם אינו משחרר השהיה בעצמו.
                </div>
            </div>
            <div className="shrink-0">
                <Toggle value={held} onChange={toggle} disabled={hold.isPending} />
            </div>
        </div>
    );
}

// A cold cap below the configured one reads as a bug unless it says why.
function ColdRampNotice({ ramp }: { ramp: import("@/lib/api/models/app/analytics/AccountStatus").ColdRampInfo }) {
    return (
        <div className="px-5 py-4">
            <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2.5 flex items-start gap-2">
                <GaugeIcon className="w-3.5 h-3.5 mt-px shrink-0 text-sky-600" />
                <div className="min-w-0">
                    <p className="text-[12.5px] font-medium text-sky-900">
                        עלייה הדרגתית בשליחה קרה: {ramp.ceiling} מתוך {ramp.mailbox_cap} ליום
                    </p>
                    <p className="text-[11.5px] text-sky-800/90 leading-relaxed mt-0.5">
                        {ramp.held ? (
                            <>
                                העלייה מושהית בעקבות הגעה אחרונה לספאם. היא תתחדש אוטומטית, ולאחר מכן תוסיף 5 ביום עד שתגיע ל-{ramp.mailbox_cap}.
                            </>
                        ) : (
                            <>
                                מעבר ישיר מחימום למכסה קרה מלאה מהווה קפיצת נפח שספקי הדואר מענישים עליה, לכן מתווספים 5 ביום במקום זאת. בקצב זה היא תגיע ל-{ramp.mailbox_cap} בתוך כ-{ramp.days_to_full_cap} {ramp.days_to_full_cap === 1 ? "יום" : "ימים"}.
                            </>
                        )}
                    </p>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: string; accent?: boolean }) {
    return (
        <div className="px-4 py-3.5">
            <Eyebrow>{label}</Eyebrow>
            <div className={cn("mt-1 text-[24px] font-light leading-none tabular-nums", accent ? "text-sky-600" : "text-slate-900")}>{value}</div>
            {sub && <div className="mt-1.5 text-[10.5px] text-slate-400 font-mono truncate">{sub}</div>}
        </div>
    );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-3 px-5 h-10 border-b border-slate-200/60 text-[12.5px]">
            <span className="text-slate-500">{label}</span>
            <span className="text-slate-900 truncate text-left rtl:text-right">{children}</span>
        </div>
    );
}

function FieldShell({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-[12px] font-medium text-slate-700 mb-1">{label}</label>
            {children}
            {hint && <p className="text-[10.5px] text-slate-400 mt-1 leading-relaxed">{hint}</p>}
        </div>
    );
}

function NumField({ value, onChange, suffix, max }: { value: number; onChange: (v: number) => void; suffix?: string; max?: number }) {
    // Themed number field with our own steppers, no native spinner.
    return (
        <NumberInput
            value={value}
            onChange={onChange}
            suffix={suffix}
            min={0}
            max={max}
            align="right"
            className="w-full h-9"
        />
    );
}

function formatGap(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 60) return `${seconds ?? 0} שנ'`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s === 0 ? `${m} דק'` : `${m} דק' ${s} שנ'`;
}

function statusTone(status: string) {
    const s = status?.toLowerCase();
    if (s === "active" || s === "healthy") return "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (s === "warming" || s === "warning") return "bg-amber-50 text-amber-700 border-amber-100";
    if (s === "revoked" || s === "error" || s === "inactive") return "bg-rose-50 text-rose-700 border-rose-100";
    return "bg-slate-100 text-slate-600 border-slate-200";
}

/* ── tabs ─────────────────────── */

const TABS: { key: string; label: string; icon: LucideIcon }[] = [
    { key: "overview", label: "סקירה כללית", icon: GaugeIcon },
    { key: "analytics", label: "אנליטיקה", icon: BarChart3Icon },
    { key: "warmup", label: "חימום", icon: FlameIcon },
    { key: "sending", label: "שליחה", icon: ClockFadingIcon },
    { key: "settings", label: "הגדרות", icon: Settings2Icon },
];

/* ═══════════════════════════════════════════
   Drawer shell
   ═══════════════════════════════════════════ */

export default function InboxDetails({
    emails,
    view,
    setView,
    initialTab = "overview",
    canWarmup = true,
}: {
    emails: Inbox[] | null;
    view: string;
    setView: React.Dispatch<React.SetStateAction<string>>;
    initialTab?: string;
    canWarmup?: boolean;
}) {
    const mailbox = emails?.find((e) => e.id === view) ?? null;
    const close = () => setView("");

    return (
        <AnimatePresence>
            {view && mailbox && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="fixed inset-0 z-40 bg-slate-900/40"
                        onClick={close}
                    />
                    <motion.aside
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 32, stiffness: 320 }}
                        className="fixed right-0 top-0 z-50 h-full w-full sm:w-[600px] bg-white border-l border-slate-200 shadow-[0_0_60px_-12px_rgba(15,23,42,0.3)] flex flex-col"
                    >
                        <Detail key={mailbox.id} mailbox={mailbox} onClose={close} initialTab={initialTab} canWarmup={canWarmup} />
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    );
}

/* ── editable fields tracked for the save bar ─────────────────────── */
const EDITABLE: (keyof Inbox)[] = [
    "name", "signature_html", "signature_plain", "signature_sync", "signature_code",
    "tags", "campaign_limit", "min_wait_time", "reply_to", "save_to_sent",
    "warmup_base", "warmup_max", "warmup_increase", "warmup_reply_rate",
    "warmup_tag", "warmup_start_time", "warmup_end_time", "warmup_days",
];

function Detail({ mailbox, onClose, initialTab = "overview", canWarmup = true }: { mailbox: Inbox; onClose: () => void; initialTab?: string; canWarmup?: boolean }) {
    const { i18n } = useTranslation();
    const isHe = i18n.language === "he";
    const [tab, setTab] = useState(initialTab);
    const [form, setForm] = useState<Inbox>(mailbox);
    const update = (patch: Partial<Inbox>) => setForm((f) => ({ ...f, ...patch }));

    usePresenceResource(mailbox.id ? `mailbox:${mailbox.id}` : null, "editing");

    const status = useAccountStatus(mailbox.id);
    const { from, to } = useMemo(() => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 29);
        const fmt = (d: Date) => d.toISOString().slice(0, 10);
        return { from: fmt(start), to: fmt(end) };
    }, []);
    const warmup = useWarmupAnalytics(mailbox.id, from, to);
    const mutation = useUpdateEmail(mailbox.id);

    const dirty = useMemo(
        () => EDITABLE.some((k) => JSON.stringify(form[k]) !== JSON.stringify(mailbox[k])),
        [form, mailbox],
    );

    const save = async () => {
        const patch: Partial<Inbox> = {};
        for (const k of EDITABLE) {
            if (JSON.stringify(form[k]) !== JSON.stringify(mailbox[k])) {
                (patch as Record<string, unknown>)[k] = form[k];
            }
        }
        try {
            await mutation.mutateAsync(patch);
            toast.success("תיבת הדואר עודכנה");
        } catch (e) {
            toast.error(buildError(e as AppError));
        }
    };

    const initials = mailbox.email.slice(0, 2).toUpperCase();

    return (
        <>
            {/* Header */}
            <div className="shrink-0 px-5 h-14 flex items-center gap-3 border-b border-slate-200">
                <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center text-[11px] font-semibold shrink-0">
                    {initials}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-slate-900 truncate">{mailbox.email}</div>
                    <div className="text-[10.5px] text-slate-400 capitalize">{mailbox.provider?.replace("_", "/")}</div>
                </div>
                <span className={cn("h-5 px-2 rounded-full border text-[10px] font-semibold uppercase tracking-wide inline-flex items-center shrink-0", statusTone(mailbox.status))}>
                    {isHe
                        ? mailbox.status === "active"
                            ? "פעיל"
                            : mailbox.status === "inactive"
                              ? "לא פעיל"
                              : mailbox.status === "paused"
                                ? "מושהה"
                                : mailbox.status === "error"
                                  ? "שגיאה"
                                  : mailbox.status
                        : mailbox.status}
                </span>
                <ResourceViewers resource={mailbox.id ? `mailbox:${mailbox.id}` : null} className="shrink-0" />
                <button onClick={onClose} aria-label="סגור" className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0">
                    <XIcon className="w-4 h-4" />
                </button>
            </div>

            {/* Tabs */}
            <div className="shrink-0 px-3 flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
                {TABS.map((t) => {
                    const active = tab === t.key;
                    return (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={cn(
                                "relative h-10 px-2.5 inline-flex shrink-0 items-center gap-1.5 text-[12.5px] transition-colors",
                                active ? "text-slate-900 font-medium" : "text-slate-500 hover:text-slate-800",
                            )}
                        >
                            <t.icon className="w-3.5 h-3.5" />
                            {t.label}
                            {active && (
                                <motion.span
                                    layoutId="inbox-tab-underline"
                                    className="absolute left-1.5 right-1.5 -bottom-px h-0.5 rounded-full bg-sky-600"
                                    transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
                                />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                {tab === "overview" && <OverviewTab status={status.data} loading={status.isPending} mailbox={mailbox} />}
                {tab === "analytics" && <AnalyticsTab warmup={warmup.data} loading={warmup.isPending} />}
                {tab === "warmup" && <WarmupTab form={form} update={update} status={status.data} mailbox={mailbox} canWarmup={canWarmup} />}
                {tab === "sending" && <SendingBehaviorTab mailboxId={mailbox.id} />}
                {tab === "settings" && <SettingsTab form={form} update={update} mailbox={mailbox} />}
            </div>

            {/* Save bar — only when something changed */}
            <AnimatePresence>
                {dirty && (
                    <motion.div
                        initial={{ y: 60 }}
                        animate={{ y: 0 }}
                        exit={{ y: 60 }}
                        transition={{ duration: 0.2 }}
                        className="shrink-0 h-14 px-5 flex items-center gap-2 border-t border-slate-200 bg-slate-50/60"
                    >
                        <span className="text-[11.5px] text-slate-500">שינויים שלא נשמרו</span>
                        <div className="ms-auto flex items-center gap-2">
                            <button onClick={() => setForm(mailbox)} className="h-8 px-3 rounded-md border border-slate-200 hover:border-slate-300 text-[12px] text-slate-700 hover:text-slate-900 transition-colors">
                                בטל
                            </button>
                            <button onClick={save} disabled={mutation.isPending} className="h-8 px-3.5 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-60">
                                {mutation.isPending && <Loading className="!w-3.5 h-3.5 text-white" />}
                                שמור שינויים
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

/* ── Overview ─────────────────────── */

// Credential-class error codes a reconnect fixes (mirror of the backend's
// errx.CredentialMailErrorCodes). Any of these gets the reconnect button.
const CREDENTIAL_ERROR_CODES = new Set([
    "GOOGLE_AUTHENTICATION_FAILED",
    "AUTHENTICATION_FAILED",
    "AUTHORIZATION_FAILED",
    "INVALID_CREDENTIALS",
]);

// The missing re-verify button of issue #274. OAuth mailboxes re-run the
// provider consent in a popup; SMTP/IMAP mailboxes get a replacement-
// credentials dialog. Either way the backend renews the stored credential,
// clears the error, and reactivates the mailbox.
function ReconnectAction({ mailbox }: { mailbox: Inbox }) {
    const qc = useQueryClient();
    const [busy, setBusy] = useState(false);
    const [credsOpen, setCredsOpen] = useState(false);
    const oauth = mailbox.provider === "gmail" || mailbox.provider === "outlook";
    const providerLabel = mailbox.provider === "gmail" ? "Google" : "Microsoft";

    const reauth = async () => {
        if (busy) return;
        setBusy(true);
        try {
            const { url, state } = await reauthEmailOAuth(mailbox.id);
            const { code } = await openEmailOAuthPopup(url, state);
            await onboardOAuthFinish(code, state);
            toast.success("תיבת הדואר אושרה מחדש וחזרה לפעילות.");
            qc.invalidateQueries({ queryKey: ["emails", "list"] });
            qc.invalidateQueries({ queryKey: ["analytics", "accounts"] });
        } catch (e) {
            toast.error(e instanceof Error ? e.message : buildError(e as AppError));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="mt-2">
            {oauth ? (
                <button
                    type="button"
                    onClick={() => void reauth()}
                    disabled={busy}
                    className="h-7 px-2.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                >
                    {busy ? <Loading className="!w-3 h-3 text-white" /> : <ShieldCheckIcon className="w-3 h-3" />}
                    {busy ? "ממתין לאישור…" : `אשר מחדש עם ${providerLabel}`}
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => setCredsOpen(true)}
                    className="h-7 px-2.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors"
                >
                    <ShieldCheckIcon className="w-3 h-3" />
                    עדכן פרטי גישה
                </button>
            )}
            <UpdateCredentialsDialog
                mailboxId={mailbox.id}
                mailboxEmail={mailbox.email}
                open={credsOpen}
                onClose={() => setCredsOpen(false)}
            />
        </div>
    );
}

function OverviewTab({ status, loading, mailbox }: { status?: import("@/lib/api/models/app/analytics/AccountStatus").default; loading: boolean; mailbox: Inbox }) {
    const health = status?.health;
    const usage = status?.daily_usage;
    const ws = status?.warmup_status;

    // When a sending-behaviour profile is on, TODAY'S rolled plan is the real
    // ceiling and spacing — not the mailbox's fixed cap and gap. Showing the
    // fixed numbers here would contradict what the mailbox actually does.
    const behavior = useSendingBehavior(mailbox.id);
    const personaOn = behavior.data?.enabled === true;
    const plan = useSendingPlan(mailbox.id, personaOn);
    const today = personaOn ? plan.data : undefined;

    const healthTone =
        health?.status === "healthy" ? { bar: "bg-emerald-500", text: "text-emerald-600", icon: CheckCircle2Icon }
            : health?.status === "warning" ? { bar: "bg-amber-500", text: "text-amber-600", icon: AlertTriangleIcon }
                : { bar: "bg-rose-500", text: "text-rose-600", icon: AlertCircleIcon };
    const HealthIcon = healthTone.icon;

    // One reconnect button per drawer, on the first credential-class error;
    // every such error is fixed by the same reconnect.
    const firstCredentialErrorId = status?.errors?.find((e) => CREDENTIAL_ERROR_CODES.has(e.error_code))?.id;

    const synced = mailbox.last_synced_at ? new Date(mailbox.last_synced_at) : null;

    return (
        <div className="divide-y divide-slate-200/60">
            {/* Whatever the Advisor has on this mailbox, above the numbers that
                produced it. This is where a row flag and a deep link both land. */}
            <AdvisorStrip
                entityType="email_account"
                entityId={mailbox.id}
                title=""
                limit={4}
                compact
                className="px-5 py-4"
            />

            {/* Health */}
            <div className="px-5 py-4">
                <div className="flex items-center justify-between">
                    <Eyebrow>בריאות התיבה</Eyebrow>
                    {health && (
                        <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium capitalize", healthTone.text)}>
                            <HealthIcon className="w-3.5 h-3.5" /> {health.status === "healthy" ? "תקין" : health.status === "warning" ? "אזהרה" : "דורש טיפול"}
                        </span>
                    )}
                </div>
                <div className="mt-2 flex items-end gap-2">
                    <span className="text-[30px] font-light leading-none text-slate-900 tabular-nums">{loading ? "—" : (health?.score ?? "—")}</span>
                    <span className="text-[12px] text-slate-400 mb-1">/ 100</span>
                </div>
                <div className="mt-2.5 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", healthTone.bar)} style={{ width: `${health?.score ?? 0}%` }} />
                </div>
                {health?.issues && health.issues.length > 0 && (
                    <ul className="mt-3 space-y-1">
                        {health.issues.map((i, k) => (
                            <li key={k} className="text-[11.5px] text-slate-500 flex items-start gap-1.5">
                                <span className="text-amber-500 mt-0.5">•</span> {i}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Sync: import progress and fair-use status */}
            <SyncStatusCard mailboxId={mailbox.id} />

            {/* Key stats */}
            <div className="grid grid-cols-2 divide-x divide-y divide-slate-200/60">
                <StatCard
                    label="נשלחו היום"
                    value={usage ? usage.campaign_sent : "—"}
                    sub={
                        today
                            ? today.is_working_day
                                ? `מתוך ${today.daily_limit} שנקבעו להיום`
                                : "לא יום שליחה"
                            : usage
                                ? `מתוך מכסה של ${usage.campaign_limit}/יום`
                                : undefined
                    }
                />
                <StatCard label="חימום היום" value={ws ? ws.current_volume : (usage?.warmup_sent ?? "—")} sub={ws ? `יעד: ${ws.target_volume}` : undefined} accent />
                <StatCard label="אחוז מענה" value={ws ? `${ws.reply_rate}%` : "—"} sub="תשובות חימום" />
                <StatCard label="ימי חימום" value={ws ? ws.days_active : "—"} sub={ws ? `מקס' ${ws.max_volume}/יום` : undefined} />
            </div>

            {ws?.ramp_hold && <RampHoldNotice hold={ws.ramp_hold} />}
            {status?.send_lifecycle && <LifecycleNotice mailboxId={mailbox.id} state={status.send_lifecycle} hasHealthSignal={!!status.warmup_health} />}
            {status?.cold_ramp && <ColdRampNotice ramp={status.cold_ramp} />}
            {status && <SendHoldControl mailboxId={mailbox.id} state={status.send_lifecycle} />}

            {/* Errors */}
            {status?.errors && status.errors.length > 0 && (
                <div className="px-5 py-4">
                    <Eyebrow>דורש טיפול</Eyebrow>
                    <div className="mt-2 space-y-2">
                        {status.errors.map((e: AccountError) => (
                            <div key={e.id} className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2">
                                <div className="text-[12px] font-medium text-rose-800">{e.title}</div>
                                <div className="text-[11px] text-rose-700/90 mt-0.5 leading-relaxed">{e.message}</div>
                                {e.action_required && <div className="text-[11px] text-rose-900 mt-1 font-medium">{e.action_required}</div>}
                                {e.id === firstCredentialErrorId && <ReconnectAction mailbox={mailbox} />}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Identity */}
            <div>
                <Row label="ספק"><span className="capitalize">{mailbox.provider?.replace("_", "/")}</span></Row>
                <Row label="דומיין מעקב">{mailbox.tracking_domain || <span className="text-slate-400">לא הוגדר</span>}</Row>
                <Row label="מכסה יומית">
                    {today?.is_working_day
                        ? `${today.daily_limit} / יום היום (טווח ${behavior.data?.daily_limit_min}-${behavior.data?.daily_limit_max})`
                        : `${mailbox.campaign_limit} / יום`}
                </Row>
                <Row label="מרווח מינימלי">
                    {today
                        ? `${secondsToLabel(today.gap_min_seconds)}-${secondsToLabel(today.gap_max_seconds)}`
                        : formatGap(mailbox.min_wait_time)}
                </Row>
                {today?.is_working_day && (
                    <Row label="יום עבודה">
                        {minutesToClock(today.work_start_minute)}-{minutesToClock(today.work_end_minute)}
                        {today.lunch_start_minute !== null && today.lunch_end_minute !== null && (
                            <span className="text-slate-400">
                                {" "}(הפסקת צהריים {minutesToClock(today.lunch_start_minute)}-{minutesToClock(today.lunch_end_minute)})
                            </span>
                        )}
                    </Row>
                )}
                <Row label="סנכרון אחרון">
                    <span className="inline-flex items-center gap-1.5 text-slate-600">
                        <ClockIcon className="w-3.5 h-3.5 text-slate-400" />
                        {synced ? synced.toLocaleString("he-IL") : "אף פעם"}
                    </span>
                </Row>
                <Row label="חובר בתאריך">
                    <span className="inline-flex items-center gap-1.5 text-slate-600">
                        <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(mailbox.created_at).toLocaleDateString("he-IL")}
                    </span>
                </Row>
            </div>
        </div>
    );
}

/* ── Analytics ─────────────────────── */

function AnalyticsTab({ warmup, loading }: { warmup?: import("@/lib/api/models/app/analytics/WarmupAnalytics").default; loading: boolean }) {
    // Tap affordance for touch devices, where the native title tooltip never fires.
    const [selectedDay, setSelectedDay] = useState<string | null>(null);
    if (loading) {
        return <div className="py-20 flex items-center justify-center"><Loading className="w-5 h-5 text-sky-500" /></div>;
    }
    if (!warmup || warmup.daily_stats.length === 0) {
        return (
            <div className="px-5 py-16 text-center">
                <BarChart3Icon className="w-5 h-5 text-slate-300 mx-auto mb-2" />
                <p className="text-[12.5px] text-slate-700 font-medium">אין עדיין פעילות חימום</p>
                <p className="text-[11.5px] text-slate-400 mt-1 max-w-[34ch] mx-auto leading-relaxed">ברגע שתיבת דואר זו תתחיל בחימום, נפח השליחה היומי והתשובות יוצגו כאן בגרף.</p>
            </div>
        );
    }
    const s = warmup.summary;
    const chartData = warmup.daily_stats.map((d) => ({
        key: d.date,
        value: d.emails_sent,
        hint: `${d.date}: ${d.emails_sent} נשלחו / יעד ${d.target_volume} · ${d.emails_replied} תשובות`,
    }));
    const targets = warmup.daily_stats.map((d) => d.target_volume);
    const selectedIndex = selectedDay ? warmup.daily_stats.findIndex((d) => d.date === selectedDay) : -1;

    return (
        <div className="divide-y divide-slate-200/60">
            <div className="grid grid-cols-2 divide-x divide-y divide-slate-200/60">
                <StatCard label="סה״כ נשלחו" value={s.total_sent} sub={`ממוצע של ${s.average_daily.toFixed(1)}/יום`} />
                <StatCard label="תשובות" value={s.total_replied} sub={`שיעור מענה של ${s.reply_rate.toFixed(1)}%`} accent />
                <StatCard label="התקדמות ליעד" value={`${Math.round(s.target_progress)}%`} sub="בדרך לנפח המקסימלי" />
                <StatCard label="ימים פעילים" value={s.days_active} sub={`${warmup.date_range.from} → ${warmup.date_range.to}`} />
            </div>

            <div className="px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                    <Eyebrow>נפח שליחה יומי</Eyebrow>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-sky-500" /> נשלחו</span>
                        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-slate-200" /> יעד</span>
                    </div>
                </div>
                <DitherBarChart
                    data={chartData}
                    ghost={targets}
                    height={112}
                    selected={selectedIndex >= 0 ? selectedIndex : null}
                    onSelect={(i) =>
                        setSelectedDay((cur) => {
                            const date = warmup.daily_stats[i]?.date ?? null;
                            return cur === date ? null : date;
                        })
                    }
                />
                {selectedDay && (() => {
                    const d = warmup.daily_stats.find((s) => s.date === selectedDay);
                    if (!d) return null;
                    return (
                        <p className="mt-2 text-[11px] text-slate-500 font-mono tabular-nums">
                            {d.date}: {d.emails_sent} נשלחו / יעד {d.target_volume} · {d.emails_replied} תשובות
                        </p>
                    );
                })()}
            </div>
        </div>
    );
}

/* ── Warmup (editable) ─────────────────────── */

const WEEKDAYS = ["שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת", "ראשון"];

const warmupStateTone: Record<string, { text: string; bar: string; label: string }> = {
    healthy: { text: "text-emerald-600", bar: "bg-emerald-500", label: "תקין" },
    watch: { text: "text-amber-600", bar: "bg-amber-500", label: "במעקב" },
    throttled: { text: "text-amber-700", bar: "bg-amber-500", label: "מוגבל" },
    quarantined: { text: "text-rose-600", bar: "bg-rose-500", label: "בהסגר" },
    blocked: { text: "text-rose-700", bar: "bg-rose-600", label: "חסום" },
};

/* ── Warmup ban banner + appeal form ─────────────────────── */

// Shown at the top of the Warmup tab when a mailbox has been blocked from the
// warmup pool (e.g. for deleting or spam-marking warmup mail). Explains why,
// lets the owner submit an appeal, and flips to "under review" once one is
// pending. Renders nothing while loading or when the mailbox isn't blocked.
function WarmupBanBanner({ emailId }: { emailId: string }) {
    const ban = useWarmupBanStatus(emailId);
    const appeal = useAppealWarmupBan(emailId);
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState("");

    const data = ban.data;
    if (!data || !data.blocked) return null;

    const submit = async () => {
        const trimmed = reason.trim();
        if (!trimmed) {
            toast.error("נא לתאר מדוע יש להחזיר תיבת דואר זו לפעילות.");
            return;
        }
        try {
            await appeal.mutateAsync(trimmed);
            toast.success("הערעור הוגש — הצוות שלנו יבדוק אותו.");
            setOpen(false);
            setReason("");
        } catch (e) {
            toast.error(buildError(e as unknown as AppError));
        }
    };

    return (
        <div className="px-5 py-4">
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3.5">
                <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                        <BanIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-[12.5px] font-semibold text-rose-900">חסום מחימום</span>
                            <span className="h-5 px-2 rounded-full border border-rose-200 bg-white/60 text-rose-700 text-[10px] font-semibold uppercase tracking-wide inline-flex items-center capitalize">
                                {data.health_state}
                            </span>
                        </div>
                        <p className="mt-1 text-[11.5px] text-rose-800/90 leading-relaxed">
                            {data.reason || "תיבת דואר זו הוסרה ממאגר החימום כדי להגן על מוניטין השולחים המשותף."}
                        </p>
                        {(data.blocked_at || data.blocked_until) && (
                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] text-rose-700/80">
                                {data.blocked_at && (
                                    <span className="inline-flex items-center gap-1">
                                        <ClockIcon className="w-3 h-3" /> נחסם ב-{new Date(data.blocked_at).toLocaleDateString("he-IL")}
                                    </span>
                                )}
                                {data.blocked_until && (
                                    <span className="inline-flex items-center gap-1">
                                        <CalendarIcon className="w-3 h-3" /> עד {new Date(data.blocked_until).toLocaleDateString("he-IL")}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Appeal affordance */}
                        {data.pending_appeal ? (
                            <div className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11.5px] font-medium text-amber-800">
                                <HourglassIcon className="w-3.5 h-3.5" /> ערעור הוגש — בבדיקה
                            </div>
                        ) : data.can_appeal ? (
                            open ? (
                                <div className="mt-3 space-y-2">
                                    <label className="block text-[10px] uppercase tracking-[0.14em] text-rose-700/80 font-medium">
                                        סיבת הערעור
                                    </label>
                                    <textarea
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        rows={3}
                                        autoFocus
                                        placeholder="פרט מה השתנה או מדוע חסימה זו היא טעות…"
                                        className="w-full px-2.5 py-2 rounded-md border border-rose-200 bg-white text-[12px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 resize-none transition-colors"
                                    />
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={submit}
                                            disabled={appeal.isPending || !reason.trim()}
                                            className="h-8 px-3.5 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                                        >
                                            {appeal.isPending && <Loading className="!w-3.5 h-3.5 text-white" />}
                                            הגש ערעור
                                        </button>
                                        <button
                                            onClick={() => { setOpen(false); setReason(""); }}
                                            disabled={appeal.isPending}
                                            className="h-8 px-3 rounded-md border border-rose-200 hover:border-rose-300 text-[12px] text-rose-700 hover:text-rose-900 transition-colors disabled:opacity-60"
                                        >
                                            בטל
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setOpen(true)}
                                    className="mt-3 h-8 px-3 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors"
                                >
                                    <ShieldAlertIcon className="w-3.5 h-3.5" /> ערער על חסימה זו
                                </button>
                            )
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── Domain authentication (SPF / DKIM / DMARC live check) ─────────────────────── */

// One row per auth record. Green check when present/aligned, red cross when
// missing. Optional detail (selectors, the SPF record, the DMARC policy) is
// shown muted underneath.
function AuthRecordRow({ label, ok, detail }: { label: string; ok: boolean; detail?: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-3 py-2 border-b border-slate-200/60 last:border-b-0">
            <div className="min-w-0">
                <div className="text-[12.5px] font-medium text-slate-900">{label}</div>
                {detail && <div className="mt-0.5 text-[10.5px] text-slate-500 font-mono break-all leading-relaxed">{detail}</div>}
            </div>
            <span className={cn("inline-flex items-center gap-1 shrink-0 text-[11px] font-medium", ok ? "text-emerald-600" : "text-rose-600")}>
                {ok ? <CheckCircle2Icon className="w-3.5 h-3.5" /> : <XCircleIcon className="w-3.5 h-3.5" />}
                {ok ? "נמצא" : "חסר"}
            </span>
        </div>
    );
}

// The banner above the records, shown only when the stored state is "failing".
// The gate is invisible otherwise, and an owner whose campaigns have stopped
// needs to be told that here rather than inferring it from a paused campaign.
function AuthGateNotice({ mailbox }: { mailbox: Inbox }) {
    if (mailbox.auth_state !== "failing") return null;

    const since = mailbox.auth_failing_since ? new Date(mailbox.auth_failing_since) : null;
    return (
        <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2.5 flex gap-2.5">
            <ShieldAlertIcon className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="min-w-0 text-[11.5px] text-rose-900/90 leading-relaxed">
                <span className="font-medium">דומיין זה נכשל באימות.</span>{" "}
                שליחה קרה וחימום מתיבת דואר זו מושהים כל עוד הבעיה נמשכת
                {since ? `, נכשל מאז ${since.toLocaleDateString("he-IL")}` : ""}. הוסף את רשומות ה-DNS החסרות אצל רשם הדומיינים שלך, ולאחר מכן בדוק שוב למטה כדי לאשר מיידית.
            </div>
        </div>
    );
}

function AuthCheckPanel({ mailbox }: { mailbox: Inbox }) {
    const emailId = mailbox.id;
    const [open, setOpen] = useState(false);
    const check = useAuthCheck(emailId, open);
    // Re-checking RECORDS the verdict, which is what lifts the send gate, so
    // the button is a write and not a query refetch.
    const refresh = useRefreshAuthCheck(emailId);
    const data = refresh.data ?? check.data;
    const busy = check.isFetching || refresh.isPending;

    return (
        <div className="px-5 py-4">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <Eyebrow>אימות דומיין</Eyebrow>
                    <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">בדיקה חיה של SPF, DKIM ו-DMARC בדומיין השליחה.</p>
                </div>
                <button
                    onClick={() => {
                        setOpen(true);
                        if (open) {
                            refresh.mutate(undefined, {
                                onError: (e) => toast.error(buildError(e as unknown as AppError)),
                            });
                        }
                    }}
                    disabled={busy}
                    className="h-8 px-3 rounded-md border border-slate-200 hover:border-slate-300 text-[12px] font-medium text-slate-700 hover:text-slate-900 inline-flex items-center gap-1.5 transition-colors disabled:opacity-60 shrink-0"
                >
                    {busy ? <Loading className="!w-3.5 h-3.5" /> : <RefreshCwIcon className="w-3.5 h-3.5" />}
                    {open ? "בדוק שוב" : "בדוק"}
                </button>
            </div>

            <AuthGateNotice mailbox={mailbox} />

            {open && (
                <div className="mt-3">
                    {check.isError ? (
                        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2.5 text-[11.5px] text-rose-700 leading-relaxed">
                            {buildError(check.error as unknown as AppError)}
                        </div>
                    ) : check.isFetching && !data ? (
                        <div className="rounded-md border border-slate-200 bg-slate-50/70 px-3 py-3 flex items-center gap-2 text-[12px] text-slate-500">
                            <Loading className="!w-3.5 h-3.5" /> מאתר רשומות DNS…
                        </div>
                    ) : data ? (
                        <div className="rounded-md border border-slate-200 bg-white">
                            <div className={cn("flex items-start gap-2 px-3 py-2.5 border-b border-slate-200/60", data.all_aligned ? "text-emerald-700" : "text-amber-700")}>
                                {data.all_aligned ? <ShieldCheckIcon className="w-4 h-4 shrink-0 mt-0.5" /> : <ShieldAlertIcon className="w-4 h-4 shrink-0 mt-0.5" />}
                                <div className="min-w-0">
                                    <div className="text-[12px] font-medium">{data.all_aligned ? "האימות תקין ומסונכרן" : "האימות דורש תשומת לב"}</div>
                                    {data.summary && <div className="mt-0.5 text-[11px] text-slate-500 leading-relaxed">{data.summary}</div>}
                                </div>
                            </div>
                            <div className="px-3">
                                <AuthRecordRow label="SPF" ok={data.spf_found} detail={data.spf_record} />
                                <AuthRecordRow
                                    label="DKIM"
                                    ok={data.dkim_found}
                                    detail={data.dkim_selectors && data.dkim_selectors.length > 0 ? `סלקטורים: ${data.dkim_selectors.join(", ")}` : undefined}
                                />
                                <AuthRecordRow
                                    label="DMARC"
                                    ok={data.dmarc_found}
                                    detail={
                                        data.dmarc_found && data.dmarc_policy
                                            ? data.dmarc_inherited
                                                ? `מדיניות: ${data.dmarc_policy} (מורש מ-${data.dmarc_domain})`
                                                : `מדיניות: ${data.dmarc_policy}`
                                            : undefined
                                    }
                                />
                            </div>
                            <div className="px-3 py-2 text-[10.5px] text-slate-400 font-mono truncate border-t border-slate-200/60">{data.domain}</div>
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
}

function WarmupTab({ form, update, status, mailbox, canWarmup = true }: { form: Inbox; update: (p: Partial<Inbox>) => void; status?: AccountStatusModel; mailbox: Inbox; canWarmup?: boolean }) {
    const ws = status?.warmup_status;
    const wh = status?.warmup_health;
    const inCampaign = status?.in_campaign;

    // Warmup on/off is a lifecycle action (immediate), not a saved form field —
    // read live state off the mailbox prop, which the lifecycle mutation patches
    // back into cache on success.
    const life = useWarmupLifecycle(mailbox.id);
    const confirm = useConfirm();
    const off = !mailbox.warmup;
    const paused = !!mailbox.warmup && !!mailbox.warmup_paused_at;
    const active = !!mailbox.warmup && !mailbox.warmup_paused_at;
    // When Warmbly Cloud warms this mailbox the local controls step aside.
    const pool = useCloudPool();
    const inCloud = pool.connected && pool.isEnrolled(mailbox.id);

    const run = (action: "start" | "pause" | "resume" | "stop") => {
        const verb = action === "start" ? "הופעל" : action === "pause" ? "הושהה" : action === "resume" ? "חודש" : "הופסק";
        life.mutate(action, {
            onSuccess: () => toast.success(`חימום ${verb}`),
            onError: (e) => toast.error(buildError(e as unknown as AppError)),
        });
    };

    const stopReset = () => {
        confirm.show(
            "להפסיק את החימום ולאפס את התקדמות ההדרגתיות? הפעלה מחדש תחל מנפח הבסיס. השתמש ב'השהה' כדי לשמור על ההתקדמות.",
            async () => {
                try {
                    await life.mutateAsync("stop");
                    toast.success("החימום הופסק");
                } catch (e) {
                    toast.error(buildError(e as unknown as AppError));
                }
            },
        );
    };

    const baseOverMax = form.warmup_base > form.warmup_max;

    return (
        <div className="divide-y divide-slate-200/60">
            {/* Ban banner + appeal — only when the mailbox is blocked from the pool */}
            <WarmupBanBanner emailId={mailbox.id} />

            <CloudWarmupCard mailboxId={mailbox.id} email={mailbox.email} provider={mailbox.provider} />

            {/* Lifecycle control */}
            {!inCloud && (
            <div className="px-5 py-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", active ? "bg-orange-50 text-orange-600" : paused ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-400")}>
                        <FlameIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-[12.5px] font-medium text-slate-900">{active ? "חימום פעיל" : paused ? "מושהה" : "חימום כבוי"}</div>
                        <div className="text-[11px] text-slate-400 truncate">{active ? "בניית מוניטין שולח" : paused ? "התקדמות ההדרגתיות נשמרת — ניתן לחדש בכל עת" : "לא בונה מוניטין"}</div>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {(off || paused) && canWarmup && (
                        <button
                            onClick={() => run(off ? "start" : "resume")}
                            disabled={life.isPending}
                            className="h-8 px-3 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                        >
                            {life.isPending ? <Loading className="!w-3.5 h-3.5 text-white" /> : <PlayIcon className="w-3.5 h-3.5" />}
                            {off ? "הפעל" : "המשך"}
                        </button>
                    )}
                    {active && (
                        <>
                            <button
                                onClick={() => run("pause")}
                                disabled={life.isPending}
                                className="h-8 px-3 rounded-md border border-slate-200 hover:border-slate-300 text-[12px] font-medium text-slate-700 hover:text-slate-900 inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                            >
                                {life.isPending ? <Loading className="!w-3.5 h-3.5" /> : <PauseIcon className="w-3.5 h-3.5" />}
                                השהה
                            </button>
                            <button
                                onClick={stopReset}
                                disabled={life.isPending}
                                title="הפסק חימום ואפס התקדמות"
                                className="h-8 px-3 rounded-md border border-slate-200 hover:border-rose-200 text-[12px] font-medium text-slate-600 hover:text-rose-600 inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                            >
                                הפסק
                            </button>
                        </>
                    )}
                    {paused && (
                        <button
                            onClick={stopReset}
                            disabled={life.isPending}
                            title="הפסק חימום ואפס התקדמות"
                            className="h-8 px-3 rounded-md border border-slate-200 hover:border-rose-200 text-[12px] font-medium text-slate-600 hover:text-rose-600 inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                        >
                            הפסק
                        </button>
                    )}
                </div>
            </div>
            )}

            {/* Upsell when warmup isn't available on the plan */}
            {!inCloud && off && !canWarmup && (
                <div className="px-5 py-4">
                    <div className="rounded-md border border-sky-100 bg-sky-50/70 px-3 py-2.5 text-[11.5px] text-sky-900/90 leading-relaxed">
                        חימום דואר זמין במסלולים בתשלום. שדרג כדי לבנות ולהגן על מוניטין השולח באופן אוטומטי.
                    </div>
                </div>
            )}

            {/* Live volume */}
            {ws && active && (
                <div className="px-5 py-4">
                    <Eyebrow>היום</Eyebrow>
                    <div className="mt-2 flex items-center gap-2 text-[12.5px] text-slate-700">
                        <span>שולח <b className="text-slate-900 tabular-nums">{ws.current_volume}</b> מתוך <b className="text-slate-900 tabular-nums">{ws.target_volume}</b> · יום {ws.days_active}</span>
                    </div>
                    <div className="mt-2.5 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-orange-400 transition-all" style={{ width: `${Math.min(100, (ws.current_volume / Math.max(1, ws.target_volume)) * 100)}%` }} />
                    </div>
                </div>
            )}

            {/* Warmup reputation (pool health) */}
            {wh && (
                <div className="px-5 py-4">
                    <div className="flex items-center justify-between">
                        <Eyebrow>מוניטין חימום</Eyebrow>
                        <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium", warmupStateTone[wh.state]?.text ?? "text-slate-500")}>
                            <ShieldCheckIcon className="w-3.5 h-3.5" /> {warmupStateTone[wh.state]?.label ?? wh.state}
                        </span>
                    </div>
                    {wh.reason && <p className="mt-1.5 text-[11.5px] text-slate-500 leading-relaxed">{wh.reason}</p>}
                    {wh.blocked_until && (
                        <p className="mt-1 text-[11px] text-rose-600">מושהה מהמאגר עד {new Date(wh.blocked_until).toLocaleDateString("he-IL")}.</p>
                    )}
                </div>
            )}

            {/* Domain authentication (live SPF/DKIM/DMARC check) */}
            <AuthCheckPanel mailbox={mailbox} />

            {/* In-campaign health-check explainer */}
            {inCampaign && (
                <div className="px-5 py-4">
                    <div className="rounded-md border border-sky-100 bg-sky-50/70 px-3 py-2.5 flex gap-2.5">
                        <ShieldCheckIcon className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                        <p className="text-[11.5px] text-sky-900/90 leading-relaxed">
                            תיבת דואר זו פעילה בקמפיין. Warmbly שומר על נפח נמוך של
                            {" "}<b>חימום לבדיקת בריאות (~5/יום)</b> זורם{active ? "" : " גם כאשר החימום כבוי"} כדי שנוכל
                            לעקוב באופן רציף אחר עבירות ההודעות בזמן שליחת תפוצה קרה.
                        </p>
                    </div>
                </div>
            )}

            {/* Ramp configuration */}
            <div className="px-5 py-5 space-y-5">
                <Eyebrow>הגדרות הדרגתיות (Ramp)</Eyebrow>
                <FieldShell label="נפח התחלתי" hint="מספר אימיילים ביום בתחילת החימום.">
                    <NumField value={form.warmup_base} onChange={(v) => update({ warmup_base: v })} suffix="אימיילים / יום" />
                </FieldShell>
                <FieldShell label="עלייה יומית" hint="כמה אימיילים נוספים לשלוח בכל יום עם התחזקות המוניטין.">
                    <NumField value={form.warmup_increase} onChange={(v) => update({ warmup_increase: v })} suffix="+ / יום" />
                </FieldShell>
                <FieldShell label="נפח מקסימלי" hint="תקרת היעד של העלייה ההדרגתית. מומלץ לשמור על ערך שמרני לתיבות חדשות (≈40/יום).">
                    <NumField value={form.warmup_max} onChange={(v) => update({ warmup_max: v })} suffix="אימיילים / יום" />
                </FieldShell>
                {baseOverMax && (
                    <p className="text-[11px] text-rose-600 -mt-3">הנפח ההתחלתי אינו יכול לעלות על הנפח המקסימלי.</p>
                )}
                <FieldShell label="שיעור מענה" hint="אחוז ממיילי החימום שמקבלים תשובה, כדי לדמות שיחה אמיתית.">
                    <NumField value={form.warmup_reply_rate} onChange={(v) => update({ warmup_reply_rate: v })} suffix="%" />
                </FieldShell>
                <FieldShell label="פלח תוכן" hint="מייעד תוכן חימום ספציפי לתחום (למשל saas, agency). השאר ריק עבור תוכן כללי.">
                    <TextInput
                        value={form.warmup_tag ?? ""}
                        placeholder="לדוגמה: saas, agency"
                        onChange={(v) => update({ warmup_tag: v.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                        className="w-full h-9"
                    />
                </FieldShell>
            </div>

            {/* Schedule */}
            <div className="px-5 py-5 space-y-5">
                <Eyebrow>חלון שליחה</Eyebrow>
                <div className="grid grid-cols-2 gap-3">
                    <FieldShell label="שעת התחלה">
                        <TimeSelect value={form.warmup_start_time || "08:00"} onChange={(v) => update({ warmup_start_time: v })} />
                    </FieldShell>
                    <FieldShell label="שעת סיום">
                        <TimeSelect value={form.warmup_end_time || "20:00"} onChange={(v) => update({ warmup_end_time: v })} />
                    </FieldShell>
                </div>
                <FieldShell label="ימי שליחה" hint="ימים בהם נשלחים מיילי חימום. השאר הכל ריק לשליחה בכל יום.">
                    <div className="mt-1">
                        <WeekdayBitmask
                            weekdays={WEEKDAYS}
                            value={form.warmup_days ?? 0}
                            setValue={(v) => update({ warmup_days: v })}
                        />
                    </div>
                </FieldShell>
            </div>
        </div>
    );
}

/* ── Tracking domain (own save + DNS verify flow) ─────────────────────── */

// normalizeTrackingDomain mirrors the backend: accept whatever is pasted (a
// full URL, a trailing dot, stray case) and keep the bare host. Without this a
// pasted link saved as-is and then sat at "Pending DNS" forever, which is what
// made this look broken rather than wrong.
function normalizeTrackingDomain(raw: string): string {
    let v = raw.trim();
    const scheme = v.indexOf("://");
    if (scheme >= 0) v = v.slice(scheme + 3);
    const at = v.lastIndexOf("@");
    if (at >= 0) v = v.slice(at + 1);
    const cut = v.search(/[/?#]/);
    if (cut >= 0) v = v.slice(0, cut);
    return v.trim().toLowerCase().replace(/\.+$/, "");
}

// A hostname with at least one dot and an alphabetic TLD, matching
// validate.TrackingHostname on the backend so the error arrives before the
// round trip instead of after it.
function trackingDomainProblem(host: string): string | null {
    if (!host) return null;
    if (host.length > 253) return "הדומיין ארוך מדי.";
    if (/[^a-z0-9.-]/.test(host)) return "השתמש בשם מארח פשוט, לדוגמה track.yourdomain.com.";
    if (!host.includes(".")) return "השתמש בתת-דומיין של דומיין בבעלותך, לדוגמה track.yourdomain.com.";
    if (host.split(".").some((l) => !l || l.startsWith("-") || l.endsWith("-"))) {
        return "השתמש בשם מארח פשוט, לדוגמה track.yourdomain.com.";
    }
    if (!/^[a-z]{2,}$/.test(host.split(".").pop() ?? "")) return "הדומיין חייב להסתיים בסיומת תקינה, לדוגמה .com.";
    return null;
}

function TrackingDomainCard({ mailbox }: { mailbox: Inbox }) {
    const { i18n } = useTranslation();
    const isHe = i18n.language === "he";
    const [domain, setDomain] = useState(mailbox.tracking_domain ?? "");
    const [copied, setCopied] = useState(false);
    const status = useEmailTrackingDomain(mailbox.id);
    const mutation = useUpdateEmailTrackingDomain(mailbox.id);
    const verify = useVerifyEmailTrackingDomain(mailbox.id);

    const saved = (status.data?.tracking_domain ?? mailbox.tracking_domain ?? "").trim();
    const verified = status.data?.tracking_domain_verified ?? mailbox.tracking_domain_verified;
    const normalized = normalizeTrackingDomain(domain);
    const dirty = normalized !== saved;
    const problem = trackingDomainProblem(normalized);
    // The target is this install's own tracking host, so a self-hosted
    // deployment shows its own value instead of the cloud one.
    const target = status.data?.cname_target ?? "";
    const busy = mutation.isPending || verify.isPending;
    // Show the diagnostic while something is wrong, not once it is fixed.
    const rawMessage = !verified && status.data?.message && !dirty ? status.data.message : "";
    const message = isHe && rawMessage.includes("No custom tracking domain is set")
        ? "לא הוגדר דומיין מעקב מותאם אישית, לכן פתיחות ולחיצות עוברות דרך שרת המעקב המשותף וקישור ההסרה נשאר על כתובת ה-API של ההתקנה."
        : rawMessage;

    const copyTarget = async () => {
        if (!target) return;
        try {
            await navigator.clipboard.writeText(target);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            // clipboard may be unavailable (insecure context); ignore
        }
    };

    const save = async () => {
        if (problem) return;
        try {
            const res = await mutation.mutateAsync(normalized);
            setDomain(res.tracking_domain);
            if (!normalized) {
                toast.success("דומיין המעקב הוסר");
            } else if (res.tracking_domain_verified) {
                toast.success(res.tracking_host_unresolvable ? "נשמר, אך שרת המעקב אינו מגיב" : "דומיין המעקב אומת");
            } else {
                toast(res.message || "נשמר. ה-DNS טרם התעדכן, בדוק שוב בעוד מספר דקות.", { icon: "⏳" });
            }
        } catch (e) {
            toast.error(buildError(e as AppError));
        }
    };

    const recheck = async () => {
        try {
            const res = await verify.mutateAsync();
            if (res.tracking_domain_verified) {
                toast.success(res.tracking_host_unresolvable ? "הרשומה שלך נכונה, אך שרת המעקב אינו מגיב" : "דומיין המעקב אומת");
            } else {
                toast(res.message || "עדיין ממתין לעדכון DNS.", { icon: "⏳" });
            }
        } catch (e) {
            toast.error(buildError(e as AppError));
        }
    };

    const clear = async () => {
        setDomain("");
        try {
            await mutation.mutateAsync("");
            toast.success("דומיין המעקב הוסר");
        } catch (e) {
            toast.error(buildError(e as AppError));
        }
    };

    return (
        <div className="px-5 py-5 space-y-3">
            <div className="flex items-center justify-between">
                <Eyebrow>דומיין מעקב</Eyebrow>
                {saved ? (
                    verified ? (
                        <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full border border-emerald-100 bg-emerald-50 text-emerald-700 text-[10px] font-semibold uppercase tracking-wide">
                            <CheckCircle2Icon className="w-3 h-3" /> מאומת
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full border border-amber-100 bg-amber-50 text-amber-700 text-[10px] font-semibold uppercase tracking-wide">
                            <ClockIcon className="w-3 h-3" /> ממתין ל-DNS
                        </span>
                    )
                ) : (
                    <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full border border-slate-200 bg-slate-100 text-slate-500 text-[10px] font-semibold uppercase tracking-wide">
                        לא הוגדר
                    </span>
                )}
            </div>

            <FieldShell label="דומיין מעקב מותאם אישית" hint="עקוב אחר פתיחות ולחיצות דרך תת-דומיין משלך במקום השרת המשותף, והצג גם את קישור ההסרה שם. משפר את עבירות ההודעות.">
                <TextInput value={domain} placeholder="track.yourdomain.com" onChange={setDomain} className="w-full h-9" />
            </FieldShell>

            {problem && (
                <div className="flex items-start gap-1.5 text-[11.5px] text-rose-600">
                    <AlertCircleIcon className="w-3.5 h-3.5 shrink-0 mt-px" />
                    <span>{problem}</span>
                </div>
            )}

            {/* Nothing to point at: the install itself has no tracking host. */}
            {!problem && normalized && status.data && !target && (
                <div className="flex items-start gap-1.5 text-[11.5px] text-amber-700">
                    <AlertTriangleIcon className="w-3.5 h-3.5 shrink-0 mt-px" />
                    <span>התקנה זו של Warmbly אינה כוללת שרת מעקב מוגדר, ולכן לא ניתן לאמת דומיין מותאם עדיין. פנה למנהל המערכת להגדרת TRACKING_DOMAIN.</span>
                </div>
            )}

            {!problem && normalized && target && (
                <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                    <div className="text-[11px] text-slate-500 leading-relaxed">
                        הוסף רשומת CNAME זו אצל ספק ה-DNS שלך, ולאחר מכן שמור לאימות:
                    </div>
                    <div className="grid grid-cols-[56px_1fr] gap-x-3 gap-y-1.5 text-[11.5px] items-center">
                        <span className="text-slate-400">סוג</span>
                        <span className="font-mono text-slate-700">CNAME</span>
                        <span className="text-slate-400">שם</span>
                        <span className="font-mono text-slate-700 truncate">{normalized}</span>
                        <span className="text-slate-400">ערך</span>
                        <span className="font-mono text-slate-700 inline-flex items-center gap-1.5 min-w-0">
                            <span className="truncate">{target}</span>
                            <button
                                type="button"
                                onClick={copyTarget}
                                className="shrink-0 text-slate-400 hover:text-slate-700 transition-colors"
                                aria-label="העתק יעד CNAME"
                            >
                                {copied ? <CheckIcon className="w-3 h-3 text-emerald-600" /> : <CopyIcon className="w-3 h-3" />}
                            </button>
                        </span>
                    </div>
                </div>
            )}

            {/* Why it is not verified, in the customer's own terms. */}
            {message && (
                <div className="flex items-start gap-1.5 text-[11.5px] text-slate-500 leading-relaxed">
                    <AlertCircleIcon className="w-3.5 h-3.5 shrink-0 mt-px text-amber-500" />
                    <span>
                        {message}
                        {status.data?.observed && status.data.status === "wrong_target" && (
                            <> נמצא <span className="font-mono text-slate-600">{status.data.observed}</span>.</>
                        )}
                    </span>
                </div>
            )}

            {/* Verified but dead: the customer's record is right and ours is not. */}
            {verified && status.data?.tracking_host_unresolvable && (
                <div className="flex items-start gap-1.5 text-[11.5px] text-amber-700 leading-relaxed">
                    <AlertTriangleIcon className="w-3.5 h-3.5 shrink-0 mt-px" />
                    <span>{status.data.message}</span>
                </div>
            )}

            {/* One primary action, whichever one applies: save what was typed,
                re-resolve what is already saved, or nothing left to do. */}
            <div className="flex items-center gap-2">
                {dirty || !saved ? (
                    <button
                        onClick={save}
                        disabled={busy || !!problem || (!dirty && !saved)}
                        className="h-8 px-3.5 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                    >
                        {mutation.isPending && <Loading className="!w-3.5 h-3.5 text-white" />}
                        שמור ואמת
                    </button>
                ) : verified ? (
                    <button
                        disabled
                        className="h-8 px-3.5 rounded-md bg-sky-600 text-white text-[12px] font-medium inline-flex items-center gap-1.5 disabled:opacity-60"
                    >
                        <CheckCircle2Icon className="w-3.5 h-3.5" /> מאומת
                    </button>
                ) : (
                    <button
                        onClick={recheck}
                        disabled={busy}
                        className="h-8 px-3.5 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                    >
                        {verify.isPending ? <Loading className="!w-3.5 h-3.5 text-white" /> : <RefreshCwIcon className="w-3.5 h-3.5" />}
                        בדוק שוב
                    </button>
                )}
                {saved && !dirty && (
                    <button
                        onClick={clear}
                        disabled={busy}
                        className="h-8 px-3 rounded-md border border-slate-200 hover:border-slate-300 text-[12px] text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-60"
                    >
                        נקה
                    </button>
                )}
            </div>
        </div>
    );
}

/* ── Settings (editable) ─────────────────────── */

function SettingsTab({ form, update, mailbox }: { form: Inbox; update: (p: Partial<Inbox>) => void; mailbox: Inbox }) {
    return (
        <div className="divide-y divide-slate-200/60">
            <div className="px-5 py-5 space-y-4">
                <Eyebrow>פרופיל שולח</Eyebrow>
                <FieldShell label="שם תצוגה">
                    <TextInput value={form.name ?? ""} placeholder="שם פרטי ומשפחה" onChange={(v) => update({ name: v })} className="w-full h-9" />
                </FieldShell>
                <FieldShell
                    label="כתובת למענה (Reply-to)"
                    hint={`לאן מגיעות התשובות. השאר ריק כדי להשתמש ב-${mailbox.email}.`}
                >
                    <div className="flex items-center gap-1.5">
                        <TextInput
                            value={form.reply_to ?? ""}
                            placeholder={mailbox.email}
                            onChange={(v) => update({ reply_to: v })}
                            className="w-full h-9"
                        />
                        {form.reply_to !== mailbox.email && (
                            <button
                                type="button"
                                onClick={() => update({ reply_to: mailbox.email })}
                                className="h-9 px-2.5 rounded-md border border-slate-200 hover:border-slate-300 text-[12px] text-slate-700 hover:text-slate-900 transition-colors shrink-0"
                            >
                                השתמש בכתובת התיבה
                            </button>
                        )}
                    </div>
                </FieldShell>
            </div>

            {mailbox.provider === "smtp_imap" && (
                <div className="px-5 py-5 space-y-3">
                    <Eyebrow>תיקיית דואר יוצא</Eyebrow>
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="text-[12.5px] font-medium text-slate-900">
                                שמור עותק של דואר שנשלח
                            </div>
                            <div className="text-[11px] text-slate-400">
                                שומר כל הודעה ש-Warmbly שולח לתוך תיקיית הפריטים שנשלחו של תיבת דואר זו. כבה אפשרות זו אם הספק שלך כבר שומר עותק, אחרת תראה כל הודעה פעמיים.
                            </div>
                        </div>
                        <Toggle
                            value={form.save_to_sent ?? true}
                            onChange={(v) => update({ save_to_sent: v })}
                        />
                    </div>
                </div>
            )}

            <div className="px-5 py-5 space-y-2">
                <Eyebrow>חתימה</Eyebrow>
                <div className="overflow-x-auto">
                    <EmailEditor
                        id="inbox-signature"
                        htmlText={form.signature_html}
                        setHtmlText={(v) => update({ signature_html: v })}
                        plainText={form.signature_plain}
                        setPlainText={(v) => update({ signature_plain: v })}
                        sync={form.signature_sync}
                        setSync={(v) => update({ signature_sync: v })}
                        code={form.signature_code}
                        setCode={(v) => update({ signature_code: v })}
                    />
                </div>
            </div>

            <div className="px-5 py-5 space-y-2">
                <Eyebrow>תגיות</Eyebrow>
                <TagSelector
                    selected={form.tags}
                    onAdd={(v) => update({ tags: [...form.tags, v] })}
                    onRemove={(v) => update({ tags: form.tags.filter((t) => t !== v) })}
                />
            </div>

            <div className="px-5 py-5 space-y-5">
                <Eyebrow>מגבלות שליחה</Eyebrow>
                <FieldShell label="מכסת קמפיין יומית" hint="מקסימום אימיילים לקמפיין קר ביום, עד 5,000. ברירת מחדל 50; הגדל רק עם מוניטין מוכח.">
                    <NumField value={form.campaign_limit} onChange={(v) => update({ campaign_limit: v })} suffix="אימיילים / יום" max={5000} />
                    {form.campaign_limit > 100 && (
                        <p className="text-[11px] text-amber-600 mt-1 leading-relaxed">
                            הרבה מעבר לטווח הבטוח של 30–50 ביום עבור פניות קרות. מכסות כה גבוהות דורשות תיבת דואר ותיקה ומחוממת היטב וספק שמאפשר נפח כזה (Google Workspace מוגבל ל-2,000 ביום). פגיעה בעבירות מתבטאת בהגעה לספאם ולא בהודעות שגיאה.
                        </p>
                    )}
                </FieldShell>
                <FieldShell
                    label="מרווח מינימלי"
                    hint={`ההשהיה הקצרה ביותר בין שתי שליחות מתיבה זו — כרגע ${formatGap(form.min_wait_time)}. מוחלף כאשר הגדרות התנהגות שליחה פעילות, הקובעות השהיה ייחודית לכל שליחה.`}
                >
                    <NumField value={form.min_wait_time} onChange={(v) => update({ min_wait_time: v })} suffix="שניות" max={86400} />
                </FieldShell>
            </div>

            <TrackingDomainCard mailbox={mailbox} />

            <div className="flex flex-wrap items-center gap-1.5 px-5 py-3 text-[11px] text-slate-400">
                <SendIcon className="w-3 h-3" /> השינויים יחולו על שליחות חדשות. <ReplyIcon className="w-3 h-3 ms-1 me-1" /> החתימה חלה גם על תשובות.
            </div>
        </div>
    );
}
