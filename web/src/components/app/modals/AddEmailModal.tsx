// Connect-mailbox modal — themed, single column, three providers.
//
// Same chrome as every other dialog in the app: 48px header band with
// eyebrow + subtitle + close, hairline rows, slate-900 primary,
// 28px buttons. Replaces the old indigo-gradient "feature billboard"
// triptych.
//
// Flow:
//   provider picker ──► gmail OAuth popup  ─┐
//                  ──► outlook OAuth popup ─┼─► /emails/onboarding/oauth/finish
//                  ──► smtp/imap form ──────────► /emails/onboarding/smtp-imap
//                  ──► CSV bulk import ─────────► /emails/onboarding/smtp-imap/bulk
//
// Every path can run into the workspace's mailbox allowance; that answer
// (code mailbox_allowance_reached) opens MailboxAllowanceDialog instead of a
// toast, and the picker shows the allowance up front so it is never a surprise.
//
// OAuth popup posts {type:"email_oauth_callback", code, state} back here
// via window.postMessage; we then call OAuth-finish with the user's bearer.
//
// Linked to Warmbly Cloud: the consent runs on the cloud's app, the popup
// returns to /cloud-oauth/done, and we redeem its session via /cloud-link/oauth/finish.

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    AlertCircleIcon,
    ArrowLeftIcon,
    CheckIcon,
    ChevronRightIcon,
    CloudIcon,
    FileSpreadsheetIcon,
    InboxIcon,
    KeyRoundIcon,
    LayersIcon,
    Loader2Icon,
    MailIcon,
    ExternalLinkIcon,
    PlusIcon,
    SendIcon,
    SettingsIcon,
    ShieldCheckIcon,
    XIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useOAuthSlots } from "@/lib/api/hooks/app/oauth-slots/useOAuthSlots";
import type { OAuthSlot } from "@/lib/api/models/app/oauth-slots/OAuthSlot";

import { Logo } from "@/components/svg";
import { TextInput } from "@/components/ui/field";
import { useUserProfile } from "@/hooks/context/user";
import { API_URL, APP_URL } from "@/lib/information";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import addEmail from "@/lib/api/client/app/emails/addEmail";
import {
    allowsNoEncryption,
    defaultImapSecurity,
    defaultSmtpSecurity,
    validPort,
    type MailSecurity,
} from "@/lib/api/models/app/emails/Service";
import SecuritySelect from "@/components/app/emails/SecuritySelect";
import useAuthConfig from "@/lib/api/hooks/auth/useAuthConfig";
import onboardOAuthStart from "@/lib/api/client/app/emails/onboardOAuthStart";
import onboardOAuthFinish from "@/lib/api/client/app/emails/onboardOAuthFinish";
import { capture } from "@/lib/productAnalytics";
import { finishCloudOAuth, startCloudOAuth } from "@/lib/api/client/app/cloudlink/cloudLink";
import { useAdoptCloudMailbox, useCloudWorkspaceMailboxes } from "@/lib/api/hooks/app/cloudlink/useCloudLink";
import useCloudPool from "@/hooks/useCloudPool";
import type { CloudOAuthDoneMessage } from "@/app/cloud-oauth/done/page";
import { Google, Outlook } from "@/components/svg";
import { cn } from "@/lib/utils";
import useFeatureAccess from "@/hooks/useFeatureAccess";
import useMailboxAllowance from "@/lib/api/hooks/app/emails/useMailboxAllowance";
import { allowanceFull } from "@/lib/api/models/app/emails/MailboxAllowance";
import type MailboxAllowance from "@/lib/api/models/app/emails/MailboxAllowance";
import MailboxAllowanceDialog from "@/components/app/emails/MailboxAllowanceDialog";
import BulkConnectPanel from "@/components/app/emails/BulkConnectPanel";
import { DitherMeter, type DitherTone } from "@/components/ui/dither";

type View = "pick" | "gmail" | "outlook" | "smtp_imap" | "bulk";

/** The one answer every connect path shares: open the allowance dialog. */
function isAllowanceError(e: unknown): boolean {
    return (e as AppError | undefined)?.code === "mailbox_allowance_reached";
}
type OAuthProvider = "gmail" | "outlook";

interface OAuthCallbackMessage {
    type: "email_oauth_callback";
    provider: OAuthProvider;
    code: string;
    state: string;
    error: string;
}

// originOf normalises a configured base URL to a bare origin. APP_URL and
// API_URL may carry a trailing slash or a path; event.origin never does.
function originOf(value: string | undefined): string | null {
    if (!value) return null;
    try {
        return new URL(value, window.location.href).origin;
    } catch {
        return null;
    }
}

// The origins we accept an OAuth callback message from.
//
// The bridge page is served by the API, not the dashboard, so that the
// redirect_uri registered with Google and Microsoft stays stable across
// front-end changes. On a split-domain deployment (dashboard on one host, API
// on another, which is what the self-hosting guide sets up) event.origin is
// therefore API_URL's origin and never APP_URL's. Accepting only APP_URL
// silently dropped every callback and left the modal waiting forever.
//
// This is a coarse gate: the real replay protection is the single-use state
// match below, which the message still has to satisfy.
function allowedCallbackOrigins(): string[] {
    return [originOf(APP_URL), originOf(API_URL), window.location.origin].filter(
        (o): o is string => Boolean(o),
    );
}

function openCentered(url: string, name: string): Window | null {
    const w = 520;
    const h = 640;
    const sx = window.screenLeft ?? window.screenX;
    const sy = window.screenTop ?? window.screenY;
    const sw = window.innerWidth ?? document.documentElement.clientWidth ?? screen.width;
    const sh = window.innerHeight ?? document.documentElement.clientHeight ?? screen.height;
    const left = sx + (sw - w) / 2;
    const top = sy + (sh - h) / 2;
    const popup = window.open(
        url,
        name,
        `width=${w},height=${h},left=${left},top=${top}`,
    );
    popup?.focus();
    return popup;
}

export default function AddEmailModal() {
    const user = useUserProfile();
    const qc = useQueryClient();
    const { i18n } = useTranslation();
    const isHe = i18n.language?.startsWith("he");

    const [view, setView] = React.useState<View>("pick");
    const [oauthBusy, setOauthBusy] = React.useState<OAuthProvider | null>(null);
    const [selectedSlotId, setSelectedSlotId] = React.useState<string | null>(null);
    const slotsQuery = useOAuthSlots();
    // Set when the deployment has no OAuth client for the provider the user
    // picked. Rendered inline rather than as a toast: it is a setup instruction
    // with a link, not a transient failure.
    const [notConfigured, setNotConfigured] = React.useState<OAuthProvider | null>(null);
    const pendingState = React.useRef<{ provider: OAuthProvider; state: string } | null>(null);
    // A consent running on Warmbly Cloud's app; redeemed by session, not code.
    const pendingCloud = React.useRef<{ provider: OAuthProvider; session: string } | null>(null);
    const pool = useCloudPool();
    const viaCloud = pool.connected;

    // The allowance is read while the modal is open so the picker can show it
    // and a refused connect can explain itself. Fetched from the same query
    // the mailbox list invalidates, so it is live.
    const access = useFeatureAccess();
    const allowance = useMailboxAllowance(user.addEmail);
    const [allowanceOpen, setAllowanceOpen] = React.useState(false);
    const [allowanceReached, setAllowanceReached] = React.useState(false);
    const openAllowance = React.useCallback((reached = false) => {
        setAllowanceReached(reached);
        setAllowanceOpen(true);
    }, []);
    // Route a refused connect to the dialog; everything else stays a toast.
    const onConnectError = React.useCallback(
        (e: unknown) => {
            if (isAllowanceError(e)) openAllowance(true);
        },
        [openAllowance],
    );

    // Reset when the modal closes.
    React.useEffect(() => {
        if (!user.addEmail) {
            setView("pick");
            setOauthBusy(null);
            setSelectedSlotId(null);
            setNotConfigured(null);
            setAllowanceOpen(false);
            pendingState.current = null;
            pendingCloud.current = null;
        }
    }, [user.addEmail]);

    // The cloud-brokered popup lands on our own origin (/cloud-oauth/done).
    React.useEffect(() => {
        function onMessage(event: MessageEvent) {
            if (event.origin !== window.location.origin) return;
            const data = event.data as CloudOAuthDoneMessage | undefined;
            if (!data || data.type !== "cloud_oauth_callback") return;
            const expected = pendingCloud.current;
            if (!expected || expected.session !== data.session) return;
            pendingCloud.current = null;
            if (data.status !== "ok") {
                setOauthBusy(null);
                if (data.error !== "access_denied") {
                    toast.error(
                        data.message ||
                            (data.error
                                ? isHe
                                    ? `שגיאת ספק: ${data.error}`
                                    : `Provider error: ${data.error}`
                                : isHe
                                  ? "ההתחברות בוטלה."
                                  : "Connection was cancelled."),
                    );
                }
                return;
            }
            void toast.promise(
                finishCloudOAuth(data.session).then((inbox) => {
                    qc.invalidateQueries({ queryKey: ["emails", "list"] });
                    qc.invalidateQueries({ queryKey: ["cloud-link"] });
                    capture("mailbox_connected", { provider: expected.provider, method: "cloud" });
                    user.setAddEmail(false);
                    return inbox;
                }),
                {
                    loading: isHe ? "מחבר את התיבה…" : "Adding the mailbox…",
                    success: isHe
                        ? "תיבת הדואר חוברה בהצלחה. Warmbly Cloud יחמם אותה מעכשיו."
                        : "Mailbox connected. Warmbly Cloud warms it from now on.",
                    error: (e: AppError) => buildError(e),
                },
            )
                .catch(onConnectError)
                .finally(() => setOauthBusy(null));
        }
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, [qc, user, onConnectError, isHe]);

    // Listen for the OAuth popup's postMessage. We only honour messages from an
    // origin we own and whose state matches the one we issued, which is what
    // protects against replay and stray posts.
    React.useEffect(() => {
        function onMessage(event: MessageEvent) {
            if (event.origin && !allowedCallbackOrigins().includes(event.origin)) {
                return;
            }
            const data = event.data as OAuthCallbackMessage | undefined;
            if (!data || data.type !== "email_oauth_callback") return;

            const expected = pendingState.current;
            if (!expected || expected.state !== data.state) return;
            pendingState.current = null;

            if (data.error || !data.code) {
                setOauthBusy(null);
                if (data.error !== "access_denied") {
                    toast.error(
                        data.error
                            ? isHe
                                ? `שגיאת ספק: ${data.error}`
                                : `Provider error: ${data.error}`
                            : isHe
                              ? "ההתחברות בוטלה."
                              : "Connection was cancelled.",
                    );
                }
                return;
            }

            void toast.promise(
                onboardOAuthFinish(data.code, data.state).then((inbox) => {
                    qc.invalidateQueries({ queryKey: ["emails", "list"] });
                    qc.invalidateQueries({ queryKey: ["oauth-slots"] });
                    capture("mailbox_connected", { provider: expected.provider, method: "oauth" });
                    user.setAddEmail(false);
                    return inbox;
                }),
                {
                    loading: isHe ? "מתחבר…" : "Connecting…",
                    success: isHe ? "תיבת הדואר חוברה בהצלחה" : "Mailbox connected",
                    error: (e: AppError) => buildError(e),
                },
            )
                .catch(onConnectError)
                .finally(() => setOauthBusy(null));
        }
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, [qc, user, onConnectError, isHe]);

    async function startOAuth(provider: OAuthProvider, slotId?: string) {
        if (oauthBusy) return;
        setOauthBusy(provider);
        setNotConfigured(null);
        if (viaCloud) {
            try {
                const { url, session } = await startCloudOAuth(provider);
                pendingCloud.current = { provider, session };
                const popup = openCentered(url, `connect-${provider}`);
                if (!popup) {
                    pendingCloud.current = null;
                    setOauthBusy(null);
                    toast.error(
                        isHe
                            ? "לא ניתן לפתוח את חלון האישור. נא לאפשר חלונות קופצים (Popups) ולנסות שוב."
                            : "Could not open the authorization window. Please allow popups and try again.",
                    );
                }
            } catch (err) {
                pendingCloud.current = null;
                setOauthBusy(null);
                if (isAllowanceError(err)) {
                    openAllowance(true);
                    return;
                }
                toast.error(buildError(err as AppError));
            }
            return;
        }
        try {
            const effSlotId = slotId ?? selectedSlotId ?? undefined;
            const { url, state } = await onboardOAuthStart(provider, effSlotId);
            pendingState.current = { provider, state };
            const popup = openCentered(url, `connect-${provider}`);
            if (!popup) {
                pendingState.current = null;
                setOauthBusy(null);
                toast.error(
                    isHe
                        ? "לא ניתן לפתוח את חלון האישור. נא לאפשר חלונות קופצים (Popups) ולנסות שוב."
                        : "Could not open the authorization window. Please allow popups and try again.",
                );
            }
        } catch (err) {
            pendingState.current = null;
            setOauthBusy(null);
            const e = err as AppError;
            if (e.code === "mailbox_provider_not_configured") {
                setNotConfigured(provider);
                return;
            }
            if (isAllowanceError(e)) {
                openAllowance(true);
                return;
            }
            toast.error(buildError(e));
        }
    }

    return (
        <AnimatePresence>
            {user.addEmail && (
                <motion.div
                    key="overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => user.setAddEmail(false)}
                    className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/30 backdrop-blur-[2px] px-4"
                >
                    <motion.div
                        key="card"
                        initial={{ y: 8, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 8, opacity: 0 }}
                        transition={{ duration: 0.16 }}
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                            "w-full rounded-lg bg-white border border-slate-200 shadow-[0_24px_48px_-12px_rgba(15,23,42,0.18),0_8px_16px_-8px_rgba(15,23,42,0.1)] overflow-hidden flex flex-col max-h-[88dvh] transition-[max-width] duration-200",
                            view === "bulk" ? "max-w-[760px]" : "max-w-[560px]",
                        )}
                    >
                        <Header
                            view={view}
                            onBack={() => {
                                setNotConfigured(null);
                                setView("pick");
                            }}
                            onClose={() => user.setAddEmail(false)}
                        />
                        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative">
                            <AnimatePresence mode="wait" initial={false}>
                                <motion.div
                                    key={view}
                                    initial={{ opacity: 0, x: view === "pick" ? -12 : 12 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: view === "pick" ? 12 : -12 }}
                                    transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
                                >
                                    {view === "pick" && (
                                        <>
                                            <AllowanceStrip
                                                allowance={allowance.data}
                                                onOpen={() => openAllowance(allowanceFull(allowance.data))}
                                            />
                                            <PickProvider
                                                onPick={setView}
                                                viaCloud={viaCloud}
                                                onAdopted={() => {
                                                    qc.invalidateQueries({ queryKey: ["emails", "list"] });
                                                    user.setAddEmail(false);
                                                }}
                                            />
                                        </>
                                    )}
                                    {view === "gmail" && (
                                        notConfigured === "gmail" ? (
                                            <ProviderNotConfigured provider="gmail" selfHosted={pool.selfHosted} />
                                        ) : (
                                            <OAuthPanel
                                                provider="gmail"
                                                busy={oauthBusy === "gmail"}
                                                viaCloud={viaCloud}
                                                slots={slotsQuery.data?.filter((s) => s.provider === "gmail") ?? []}
                                                selectedSlotId={selectedSlotId}
                                                onSelectSlot={setSelectedSlotId}
                                                onConnect={(slotId) => startOAuth("gmail", slotId)}
                                            />
                                        )
                                    )}
                                    {view === "outlook" && (
                                        notConfigured === "outlook" ? (
                                            <ProviderNotConfigured provider="outlook" selfHosted={pool.selfHosted} />
                                        ) : (
                                            <OAuthPanel
                                                provider="outlook"
                                                busy={oauthBusy === "outlook"}
                                                viaCloud={viaCloud}
                                                slots={slotsQuery.data?.filter((s) => s.provider === "outlook") ?? []}
                                                selectedSlotId={selectedSlotId}
                                                onSelectSlot={setSelectedSlotId}
                                                onConnect={(slotId) => startOAuth("outlook", slotId)}
                                            />
                                        )
                                    )}
                                    {view === "smtp_imap" && (
                                        <SmtpImapPanel
                                            onDone={() => {
                                                qc.invalidateQueries({ queryKey: ["emails", "list"] });
                                                user.setAddEmail(false);
                                            }}
                                            onError={onConnectError}
                                        />
                                    )}
                                    {view === "bulk" && (
                                        <BulkConnectPanel
                                            onDone={() => {
                                                qc.invalidateQueries({ queryKey: ["emails", "list"] });
                                                user.setAddEmail(false);
                                            }}
                                            onAllowance={() => openAllowance(allowanceFull(allowance.data))}
                                        />
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </motion.div>
                    <MailboxAllowanceDialog
                        open={allowanceOpen}
                        onClose={() => setAllowanceOpen(false)}
                        allowance={allowance.data}
                        reached={allowanceReached}
                        currentPlan={access.plan}
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// AllowanceStrip — the workspace's mailbox allowance at the top of the
// picker: quiet while there is plenty of room, a warning near the cap, and a
// clear "full" state that leads to the request dialog rather than letting the
// user type credentials that will be refused.
function AllowanceStrip({ allowance: a, onOpen }: { allowance: MailboxAllowance | undefined; onOpen: () => void }) {
    const { i18n } = useTranslation();
    const isHe = i18n.language?.startsWith("he");

    if (!a || a.allowance == null) return null;
    const cap = a.allowance;
    const remaining = a.remaining ?? 0;
    const pct = Math.min(100, Math.round((a.used / cap) * 100));
    const full = remaining <= 0;
    const near = !full && (pct >= 80 || remaining <= 5);
    if (!full && !near) {
        return (
            <div className="px-4 py-2 border-b border-slate-200/60 flex items-center gap-2 text-[11px] text-slate-500">
                <span className="font-mono tabular-nums text-slate-700">
                    {a.used.toLocaleString()} / {cap.toLocaleString()}
                </span>
                <span>{isHe ? "תיבות דואר במרחב עבודה זה" : "mailboxes on this workspace"}</span>
                {a.pending_request && <span className="text-amber-600">{isHe ? "· בקשת הגדלה נשלחה" : "· increase requested"}</span>}
                <button type="button" onClick={onOpen} className="ms-auto underline hover:text-slate-900 transition-colors">
                    {isHe ? "צריך עוד?" : "Need more?"}
                </button>
            </div>
        );
    }
    const tone: DitherTone = full ? "rose" : "amber";
    return (
        <div className={cn("px-4 py-2.5 border-b", full ? "bg-rose-50/60 border-rose-200/60" : "bg-amber-50/60 border-amber-200/60")}>
            <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className={cn("text-[12px] font-medium", full ? "text-rose-900" : "text-amber-900")}>
                    {full
                        ? isHe
                            ? "כל מכסת תיבות הדואר נוצלה"
                            : "Every mailbox slot is used"
                        : isHe
                          ? `נותרו ${remaining.toLocaleString()} תיבות פנויות`
                          : `${remaining.toLocaleString()} ${remaining === 1 ? "slot" : "slots"} left`}
                </span>
                <span className="text-[11px] font-mono tabular-nums text-slate-700">
                    {a.used.toLocaleString()} / {cap.toLocaleString()}
                </span>
            </div>
            <DitherMeter frac={pct / 100} tone={tone} height={4} />
            <div className="flex items-center justify-between gap-2 mt-1.5">
                <span className={cn("text-[11px]", full ? "text-rose-800/90" : "text-amber-800/90")}>
                    {a.pending_request
                        ? isHe
                          ? `נשלחה בקשה להגדלה ל-${a.pending_request.requested.toLocaleString()}, בהמתנה לאישור`
                          : `Increase to ${a.pending_request.requested.toLocaleString()} requested, pending review`
                        : full
                          ? isHe
                            ? "חיבורים חדשים יידחו עד להגדלת המכסה"
                            : "New connects are refused until the allowance is raised"
                          : isHe
                            ? "מומלץ לבקש הגדלה לפני חיבור כמות גדולה"
                            : "Ask for more before a large batch"}
                </span>
                <button
                    type="button"
                    onClick={onOpen}
                    className={cn(
                        "h-6 px-2 rounded text-[11px] font-medium transition-colors shrink-0",
                        full ? "bg-rose-600 hover:bg-rose-700 text-white" : "bg-amber-600 hover:bg-amber-700 text-white",
                    )}
                >
                    {a.pending_request ? (isHe ? "צפה בבקשה" : "View request") : full ? (isHe ? "הגדל מכסה" : "Get more mailboxes") : (isHe ? "בקש עוד" : "Request more")}
                </button>
            </div>
        </div>
    );
}

function Header({
    view,
    onBack,
    onClose,
}: {
    view: View;
    onBack: () => void;
    onClose: () => void;
}) {
    const { i18n } = useTranslation();
    const isHe = i18n.language?.startsWith("he");

    const sub: Record<View, string> = {
        pick: isHe ? "חיבור תיבת דואר לשליחה" : "Connect a sending account",
        gmail: isHe ? "Gmail או Google Workspace" : "Gmail or Google Workspace",
        outlook: isHe ? "Outlook או Microsoft 365" : "Outlook or Microsoft 365",
        smtp_imap: isHe ? "כל ספק באמצעות SMTP / IMAP" : "Any provider via SMTP / IMAP",
        bulk: isHe ? "ייבוא תיבות מרובות מקובץ CSV" : "Many mailboxes from one CSV",
    };
    return (
        <div className="h-12 px-3 border-b border-slate-200 flex items-center gap-2.5 shrink-0">
            {view !== "pick" && (
                <button
                    type="button"
                    onClick={onBack}
                    aria-label={isHe ? "חזרה" : "Back"}
                    className="size-7 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center justify-center transition-colors"
                >
                    <ArrowLeftIcon className="w-3.5 h-3.5 rtl:rotate-180" />
                </button>
            )}
            <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">
                {isHe ? "תיבת דואר" : "Mailbox"}
            </span>
            <div className="h-4 w-px bg-slate-200" />
            <span className="text-[12px] text-slate-600 truncate">{sub[view]}</span>
            <button
                type="button"
                onClick={onClose}
                aria-label={isHe ? "סגור" : "Close"}
                className="ms-auto size-7 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center justify-center transition-colors"
            >
                <XIcon className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}

// Shown when the API reports this deployment has no OAuth client for the chosen
// provider. Self-host only, and the person seeing it can usually fix it, so it
// names the exact variables and links the setup guide instead of just failing.
const PROVIDER_SETUP: Record<OAuthProvider, { label: string; vars: string[] }> = {
    gmail: {
        label: "Gmail and Google Workspace",
        vars: ["BOX_GOOGLE_CLIENT_ID", "BOX_GOOGLE_CLIENT_SECRET"],
    },
    outlook: {
        label: "Outlook and Microsoft 365",
        vars: ["BOX_OUTLOOK_CLIENT_ID", "BOX_OUTLOOK_CLIENT_SECRET"],
    },
};

function ProviderNotConfigured({ provider, selfHosted }: { provider: OAuthProvider; selfHosted: boolean }) {
    const { i18n } = useTranslation();
    const isHe = i18n.language?.startsWith("he");
    const { label, vars } = PROVIDER_SETUP[provider];
    return (
        <div className="p-4 space-y-3">
            <div className="rounded-md border border-sky-200 bg-sky-50 p-3.5">
                <div className="flex items-start gap-2.5">
                    <LayersIcon className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-medium text-sky-900">
                            {isHe ? "חיבור מהיר: הגדר סלוט חיבור ישירות בממשק (מומלץ)" : "Quick setup: configure a connection slot in settings (Recommended)"}
                        </p>
                        <p className="text-[12px] text-sky-800 mt-1">
                            {isHe
                                ? "ניתן להגדיר פרויקט Google Cloud ישירות מתוך הממשק, ללא עריכת קבצי שרת (.env) וללא צורך בהפעלה מחדש. תוכל להוסיף סלוטים מרובים ולחבר מאות תיבות ללא הגבלת 100 משתמשים."
                                : "You can configure an OAuth project directly in the dashboard without editing server files or restarting. Add multiple slots to connect hundreds of mailboxes."}
                        </p>
                        <a
                            href="/app/settings/oauth-slots"
                            className="mt-2.5 inline-flex h-7 px-2.5 items-center gap-1.5 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-[12px] font-medium transition-colors shadow-sm"
                        >
                            <SettingsIcon className="w-3.5 h-3.5" />
                            {isHe ? "ניהול והוספת סלוטים של OAuth" : "Manage OAuth Slots"}
                        </a>
                    </div>
                </div>
            </div>

            {selfHosted && (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 flex items-start gap-2.5">
                    <CloudIcon className="w-4 h-4 text-slate-600 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                        <p className="text-[12.5px] font-medium text-slate-900">
                            {isHe ? "אפשרות חלופית: התחבר ל-Warmbly Cloud" : "Alternative: connect Warmbly Cloud"}
                        </p>
                        <p className="text-[12px] text-slate-600 mt-1">
                            {isHe
                                ? "מופעים מקושרים מתחברים לתיבות דרך האפליקציות של Google ו-Microsoft של Warmbly, והענן מחמם אותן. חינם עבור 10 תיבות."
                                : "Linked instances sign mailboxes in through Warmbly's own Google and Microsoft apps, and the cloud warms them. Free for 10 mailboxes."}
                        </p>
                        <a
                            href="/app/settings/warmbly-cloud"
                            className="mt-2 inline-flex h-6 px-2.5 items-center gap-1.5 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-[11.5px] font-medium transition-colors"
                        >
                            {isHe ? "התחבר ל-Warmbly Cloud" : "Connect Warmbly Cloud"}
                        </a>
                    </div>
                </div>
            )}
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-start gap-2.5">
                    <SettingsIcon className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                        <p className="text-[12.5px] font-medium text-amber-900">
                            {isHe ? `${label} אינו מוגדר בהתקנה זו` : `${label} is not configured on this deployment`}
                        </p>
                        <p className="text-[12.5px] text-amber-800 mt-1">
                            {isHe ? (
                                <>
                                    חיבור תיבות אלו דורש לקוח OAuth. הוסף את שני הערכים לקובץ{" "}
                                    <code className="bg-white/70 px-1 rounded font-mono">.env</code> בתיקיית השורש של התקנת Warmbly, ולאחר מכן הפעל מחדש באמצעות{" "}
                                    <code className="bg-white/70 px-1 rounded font-mono">make up</code>.
                                </>
                            ) : (
                                <>
                                    Connecting these mailboxes needs an OAuth client. Add both values to
                                    the <code className="bg-white/70 px-1 rounded font-mono">.env</code> at the root of
                                    your Warmbly install, then restart with{" "}
                                    <code className="bg-white/70 px-1 rounded font-mono">make up</code>.
                                </>
                            )}
                        </p>
                        <ul className="mt-2 space-y-1">
                            {vars.map((v) => (
                                <li
                                    key={v}
                                    dir="ltr"
                                    className="text-[12px] font-mono text-amber-900 bg-white/70 rounded px-1.5 py-1 text-left"
                                >
                                    {v}=
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            <a
                href="https://docs.warmbly.com/development/deployment-guide/#connect-mailboxes"
                target="_blank"
                rel="noreferrer"
                className="mt-3 h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-slate-200 text-[12.5px] text-slate-700 hover:bg-slate-50 transition-colors"
            >
                <ExternalLinkIcon className="w-3.5 h-3.5" />
                {isHe ? "מדריך מלא להגדרת הסביבה" : "Full environment setup guide"}
            </a>

            <p className="mt-3 text-[12px] text-slate-500">
                {isHe
                    ? "אין צורך בהגדרות מיוחדות עבור ספקים אחרים: ניתן להתחבר אליהם ישירות דרך SMTP ו-IMAP."
                    : "No setup needed for any other provider: connect it over SMTP and IMAP instead."}
            </p>
        </div>
    );
}

function PickProvider({ onPick, viaCloud, onAdopted }: { onPick: (v: View) => void; viaCloud: boolean; onAdopted: () => void }) {
    const { i18n } = useTranslation();
    const isHe = i18n.language?.startsWith("he");

    const rows: Array<{
        key: View;
        icon: React.ReactNode;
        title: string;
        sub: string;
        tone: "primary" | "neutral";
    }> = [
        {
            key: "gmail",
            icon: <Google className="w-5 h-5" />,
            title: isHe ? "Gmail / Google Workspace" : "Gmail / Google Workspace",
            sub: viaCloud
                ? (isHe ? "התחברות דרך Warmbly Cloud. חימום כלול, ללא צורך באפליקציית OAuth." : "Sign in through Warmbly Cloud. Warmup included, no OAuth app needed.")
                : (isHe ? "חיבור OAuth מאובטח מול Google. עבירות מיטבית עבור Gmail." : "OAuth via Google. Best deliverability for Gmail."),
            tone: "primary",
        },
        {
            key: "outlook",
            icon: <Outlook className="w-5 h-5" />,
            title: isHe ? "Outlook / Microsoft 365" : "Outlook / Microsoft 365",
            sub: viaCloud
                ? (isHe ? "התחברות דרך Warmbly Cloud. חימום כלול, ללא צורך באפליקציית OAuth." : "Sign in through Warmbly Cloud. Warmup included, no OAuth app needed.")
                : (isHe ? "חיבור OAuth מאובטח מול Microsoft. סנכרון טבעי לחשבונות Outlook." : "OAuth via Microsoft. Native sync for Outlook accounts."),
            tone: "primary",
        },
        {
            key: "smtp_imap",
            icon: <Logo className="w-4 h-5 text-slate-700" />,
            title: isHe ? "ספק אחר (SMTP / IMAP)" : "Other (SMTP / IMAP)",
            sub: isHe ? "התחברות לכל ספק עם הגדרות שרת, פורט וסיסמת אפליקציה." : "Any provider with manual host, port, and app password.",
            tone: "neutral",
        },
        {
            key: "bulk",
            icon: <FileSpreadsheetIcon className="w-4 h-4 text-slate-700" />,
            title: isHe ? "ייבוא המוני מקובץ CSV" : "Bulk import from CSV",
            sub: isHe ? "ייבוא מאות או אלפי תיבות SMTP / IMAP בפעימה אחת, עם דוח מפורט." : "Hundreds or thousands of SMTP / IMAP mailboxes in one go, with a report of anything that failed.",
            tone: "neutral",
        },
    ];
    return (
        <div className="divide-y divide-slate-200/60">
            {rows.map((r, i) => (
                <motion.button
                    key={r.key}
                    type="button"
                    onClick={() => onPick(r.key)}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 + i * 0.04, duration: 0.18, ease: "easeOut" }}
                    className="w-full px-4 py-3.5 flex items-center gap-3 text-start rtl:text-right group hover:bg-slate-50 transition-colors"
                >
                    <div className="size-9 rounded-md border border-slate-200 bg-white flex items-center justify-center shrink-0 transition-colors group-hover:border-slate-300">
                        {r.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium text-slate-900 truncate">{r.title}</div>
                        <div className="text-[11.5px] text-slate-500 truncate">{r.sub}</div>
                    </div>
                    <ChevronRightIcon className="w-4 h-4 text-slate-300 shrink-0 group-hover:text-slate-500 rtl:rotate-180 group-hover:ltr:translate-x-0.5 group-hover:rtl:-translate-x-0.5 transition-all" />
                </motion.button>
            ))}
            {viaCloud && <WorkspaceMailboxes onAdopted={onAdopted} />}
        </div>
    );
}

// Mailboxes connected directly on the linked Warmbly Cloud workspace: one
// click brings each one here, sending with tokens the cloud brokers.
function WorkspaceMailboxes({ onAdopted }: { onAdopted: () => void }) {
    const { i18n } = useTranslation();
    const isHe = i18n.language?.startsWith("he");
    const list = useCloudWorkspaceMailboxes();
    const adopt = useAdoptCloudMailbox();
    const [busy, setBusy] = React.useState<string | null>(null);
    const items = list.data ?? [];
    if (list.isLoading || items.length === 0) return null;

    const run = async (id: string, email: string) => {
        setBusy(id);
        try {
            await adopt.mutateAsync(id);
            toast.success(isHe ? `${email} חובר בהצלחה` : `${email} connected`);
            onAdopted();
        } catch (e) {
            toast.error(buildError(e as AppError));
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="px-4 py-3 bg-sky-50/40">
            <div className="flex items-center gap-1.5 mb-2">
                <CloudIcon className="w-3.5 h-3.5 text-sky-600" />
                <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">
                    {isHe ? "במרחב העבודה שלך ב-Warmbly Cloud" : "In your Warmbly Cloud workspace"}
                </span>
            </div>
            <div className="space-y-1.5">
                {items.map((m) => (
                    <div key={m.id} className="flex items-center gap-2.5 rounded-md border border-slate-200 bg-white px-2.5 py-2">
                        <div className="size-7 rounded-md border border-slate-200 bg-white flex items-center justify-center shrink-0">
                            {m.provider === "gmail" ? <Google className="w-4 h-4" /> : <Outlook className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-[12.5px] text-slate-900 truncate">{m.email}</div>
                            <div className="text-[11px] text-slate-500 truncate">
                                {isHe ? "מחובר בענן. הוסף אותו כאן כדי לשלוח קמפיינים דרכו." : "Connected on the cloud. Add it here to send campaigns from it."}
                            </div>
                        </div>
                        <button
                            type="button"
                            disabled={busy === m.id}
                            onClick={() => void run(m.id, m.email)}
                            className="shrink-0 h-7 px-2.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                        >
                            {busy === m.id ? <Loader2Icon className="w-3 h-3 animate-spin" /> : <CheckIcon className="w-3 h-3" />}
                            {isHe ? "התחבר" : "Connect"}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

function OAuthPanel({
    provider,
    busy,
    viaCloud,
    slots = [],
    selectedSlotId,
    onSelectSlot,
    onConnect,
}: {
    provider: OAuthProvider;
    busy: boolean;
    viaCloud: boolean;
    slots?: OAuthSlot[];
    selectedSlotId: string | null;
    onSelectSlot: (id: string | null) => void;
    onConnect: (slotId?: string) => void;
}) {
    const { i18n } = useTranslation();
    const isHe = i18n.language?.startsWith("he");

    const label = provider === "gmail" ? "Google" : "Microsoft";
    const Icon = provider === "gmail" ? Google : Outlook;

    const hasSlots = slots.length > 0;
    const allSlotsFull = hasSlots && slots.every((s) => s.connected_count >= s.max_accounts);

    const activeSlot = React.useMemo(() => {
        if (!hasSlots) return null;
        if (selectedSlotId) {
            const found = slots.find((s) => s.id === selectedSlotId);
            if (found) return found;
        }
        return slots.find((s) => s.connected_count < s.max_accounts) ?? slots[0];
    }, [slots, selectedSlotId, hasSlots]);

    const isCurrentSlotFull = activeSlot ? activeSlot.connected_count >= activeSlot.max_accounts : false;

    return (
        <div className="px-5 py-6 space-y-4">
            <div className="flex items-center gap-3">
                <div className="size-11 rounded-md border border-slate-200 bg-white flex items-center justify-center shrink-0">
                    <Icon className="w-6 h-6" />
                </div>
                <div>
                    <div className="text-[13.5px] font-medium text-slate-900">
                        {isHe ? `התחברות באמצעות ${label}` : `Connect with ${label}`}
                    </div>
                    <div className="text-[11.5px] text-slate-500">
                        {viaCloud
                            ? (isHe
                                ? `Warmbly Cloud יפתח חלון של ${label} באפליקציה שלו. מאשרים ומסיימים.`
                                : `Warmbly Cloud opens the ${label} window on its own app. Approve and you're done.`)
                            : (isHe
                                ? `נפתח חלון התחברות של ${label}. יש לאשר את ההרשאות כדי לסיים.`
                                : `We'll open a ${label} window. Approve the scopes and you're done.`)}
                    </div>
                </div>
            </div>

            {hasSlots && !viaCloud && (
                <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                            <LayersIcon className="w-4 h-4 text-sky-600" />
                            <span className="text-[12px] font-medium text-slate-800">
                                {isHe ? "סלוט חיבור (Google Cloud Project)" : "Connection Slot (OAuth Project)"}
                            </span>
                        </div>
                        <a
                            href="/app/settings/oauth-slots"
                            className="text-[11px] text-sky-600 hover:text-sky-700 hover:underline font-medium flex items-center gap-1"
                        >
                            <SettingsIcon className="w-3 h-3" />
                            {isHe ? "ניהול סלוטים" : "Manage slots"}
                        </a>
                    </div>

                    {slots.length > 1 && (
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-slate-500">
                                {isHe ? "בחר לאיזה סלוט לשייך את התיבה:" : "Select which slot to connect to:"}
                            </label>
                            <select
                                value={activeSlot?.id ?? ""}
                                onChange={(e) => onSelectSlot(e.target.value)}
                                className="w-full h-8 px-2.5 rounded-md border border-slate-200 bg-white text-[12px] text-slate-800 focus:outline-none focus:border-sky-400"
                            >
                                {slots.map((s) => {
                                    const full = s.connected_count >= s.max_accounts;
                                    return (
                                        <option key={s.id} value={s.id} disabled={full}>
                                            {s.name} ({s.connected_count}/{s.max_accounts} {isHe ? "תיבות" : "mailboxes"}) {full ? (isHe ? "- מלא!" : "- Full!") : ""}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                    )}

                    {activeSlot && (
                        <div className="p-2.5 rounded-md border border-slate-200 bg-white space-y-2">
                            <div className="flex items-center justify-between text-[11.5px]">
                                <span className="font-medium text-slate-900 truncate">
                                    {activeSlot.name}
                                </span>
                                <span className={cn(
                                    "font-mono tabular-nums text-[11px] px-1.5 py-0.5 rounded",
                                    isCurrentSlotFull ? "bg-rose-50 text-rose-700 font-semibold" : "bg-slate-100 text-slate-700"
                                )}>
                                    {activeSlot.connected_count} / {activeSlot.max_accounts} {isHe ? "תיבות" : "mailboxes"}
                                </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                    className={cn(
                                        "h-full rounded-full transition-all duration-300",
                                        isCurrentSlotFull ? "bg-rose-500" : activeSlot.connected_count / activeSlot.max_accounts > 0.8 ? "bg-amber-500" : "bg-sky-500"
                                    )}
                                    style={{ width: `${Math.min(100, Math.round((activeSlot.connected_count / activeSlot.max_accounts) * 100))}%` }}
                                />
                            </div>
                            {isCurrentSlotFull && (
                                <p className="text-[11px] text-rose-600 flex items-center gap-1 font-medium">
                                    <AlertCircleIcon className="w-3.5 h-3.5 shrink-0" />
                                    {isHe
                                        ? "סלוט זה הגיע למגבלת 100 תיבות. בחר סלוט אחר או הוסף סלוט חדש בהגדרות."
                                        : "This slot has reached its 100 mailbox limit. Pick another slot or add one in settings."}
                                </p>
                            )}
                        </div>
                    )}

                    {allSlotsFull && (
                        <div className="p-2.5 rounded-md border border-rose-200 bg-rose-50 text-rose-800 text-[11.5px] space-y-1.5">
                            <div className="font-medium flex items-center gap-1.5 text-rose-900">
                                <AlertCircleIcon className="w-4 h-4 shrink-0" />
                                {isHe ? "כל הסלוטים הקיימים מלאים (100/100)" : "All connection slots are full (100/100)"}
                            </div>
                            <p>
                                {isHe
                                    ? "הגעת למגבלת התיבות בכל הפרויקטים המוגדרים. כדי לחבר תיבות נוספות, יש להוסיף סלוט חיבור חדש (פרויקט Google Cloud נוסף) בהגדרות."
                                    : "All configured projects have reached their quota. To connect more mailboxes, add a new OAuth slot in settings."}
                            </p>
                            <a
                                href="/app/settings/oauth-slots"
                                className="inline-flex h-6 px-2.5 items-center gap-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-medium transition-colors"
                            >
                                <PlusIcon className="w-3 h-3" />
                                {isHe ? "הוסף סלוט חיבור חדש" : "Add new slot"}
                            </a>
                        </div>
                    )}
                </div>
            )}

            {!hasSlots && !viaCloud && (
                <div className="px-3 py-2 rounded-md bg-slate-50 border border-slate-200/80 flex items-center justify-between text-[11.5px] text-slate-600">
                    <span>
                        {isHe ? "רוצה לחבר מאות תיבות ללא הגבלת 100 משתמשים?" : "Need hundreds of mailboxes without the 100 user limit?"}
                    </span>
                    <a
                        href="/app/settings/oauth-slots"
                        className="text-sky-600 hover:underline font-medium shrink-0 ms-2"
                    >
                        {isHe ? "הוסף סלוטים בהגדרות" : "Configure slots"}
                    </a>
                </div>
            )}

            {viaCloud ? (
                <ul className="text-[11.5px] text-slate-600 space-y-1.5 px-1">
                    <Scope>{isHe ? "שליחת קמפיינים וסנכרון תגובות משרת זה, כרגיל" : "Sends campaigns and syncs replies from this server, as usual"}</Scope>
                    <Scope>{isHe ? "Warmbly Cloud שומר על החיבור ומחמם את התיבה במאגר שלו" : "Warmbly Cloud keeps the sign-in and warms the mailbox in its pool"}</Scope>
                    <Scope>{isHe ? "התיבה תופיע גם במרחב העבודה בענן; ניתן להסירה מכל צד" : "The mailbox also appears in your cloud workspace; remove it from either side"}</Scope>
                </ul>
            ) : (
                <ul className="text-[11.5px] text-slate-600 space-y-1.5 px-1">
                    <Scope>{isHe ? "שליחה וקריאה של מיילים בשמך" : "Send and read mail on your behalf"}</Scope>
                    <Scope>{isHe ? "מעקב אחר מענים ומסירות" : "Track replies and deliveries"}</Scope>
                    <Scope>{isHe ? "אסימוני הגישה נשמרים מוצפנים; ניתן לבטל גישה בכל עת" : "Refresh tokens are stored encrypted; revoke any time"}</Scope>
                </ul>
            )}

            <motion.button
                type="button"
                onClick={() => onConnect(activeSlot?.id)}
                disabled={busy || (hasSlots && (allSlotsFull || isCurrentSlotFull))}
                whileTap={busy || (hasSlots && (allSlotsFull || isCurrentSlotFull)) ? undefined : { scale: 0.985 }}
                className="w-full h-9 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[12.5px] font-medium inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
                {busy ? (
                    <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
                ) : (
                    <ShieldCheckIcon className="w-3.5 h-3.5" />
                )}
                {busy
                    ? (isHe ? "ממתין לאישור ההרשאות…" : "Waiting for authorization…")
                    : (isHe ? `המשך עם ${label}` : `Continue with ${label}`)}
            </motion.button>
        </div>
    );
}

function Scope({ children }: { children: React.ReactNode }) {
    return (
        <li className="flex items-start gap-2 text-start rtl:text-right">
            <CheckIcon className="w-3 h-3 text-slate-400 mt-1 shrink-0" />
            <span>{children}</span>
        </li>
    );
}

function SmtpImapPanel({ onDone, onError }: { onDone: () => void; onError: (e: unknown) => void }) {
    const { i18n } = useTranslation();
    const isHe = i18n.language?.startsWith("he");

    const [name, setName] = React.useState("");
    const [email, setEmail] = React.useState("");

    const [imapHost, setImapHost] = React.useState("");
    const [imapPort, setImapPort] = React.useState("993");
    const [imapUser, setImapUser] = React.useState("");
    const [imapPass, setImapPass] = React.useState("");
    const [imapSecurity, setImapSecurity] = React.useState<MailSecurity>("tls");

    const [smtpHost, setSmtpHost] = React.useState("");
    const [smtpPort, setSmtpPort] = React.useState("587");
    const [smtpUser, setSmtpUser] = React.useState("");
    const [smtpPass, setSmtpPass] = React.useState("");
    const [smtpSecurity, setSmtpSecurity] = React.useState<MailSecurity>("starttls");

    // The port implies the security mode for every conventional setup, so
    // typing a port moves the selector with it. Once the user picks a mode by
    // hand we stop guessing: that is exactly the non-standard case they came
    // here for (a submission relay on 2525, IMAP on a custom port).
    const imapSecurityTouched = React.useRef(false);
    const smtpSecurityTouched = React.useRef(false);
    React.useEffect(() => {
        if (!imapSecurityTouched.current) {
            setImapSecurity(defaultImapSecurity(Number(imapPort)));
        }
    }, [imapPort]);
    React.useEffect(() => {
        if (!smtpSecurityTouched.current) {
            setSmtpSecurity(defaultSmtpSecurity(Number(smtpPort)));
        }
    }, [smtpPort]);

    // "No encryption" is only offered for a local relay on a self-hosted
    // instance. Editing the host away from loopback has to take the mode with
    // it, or the form keeps a value the backend will reject and the user is
    // left reading an error about a control that is no longer on screen.
    const selfHosted = useAuthConfig().data?.self_hosted === true;
    React.useEffect(() => {
        if (imapSecurity === "none" && !allowsNoEncryption(imapHost, selfHosted)) {
            setImapSecurity(defaultImapSecurity(Number(imapPort)));
        }
    }, [imapHost, imapPort, imapSecurity, selfHosted]);
    React.useEffect(() => {
        if (smtpSecurity === "none" && !allowsNoEncryption(smtpHost, selfHosted)) {
            setSmtpSecurity(defaultSmtpSecurity(Number(smtpPort)));
        }
    }, [smtpHost, smtpPort, smtpSecurity, selfHosted]);

    // Single-credentials toggle — covers the 90% case where IMAP and SMTP
    // share the same login. The user can flip it off and supply distinct
    // SMTP creds for legacy setups.
    const [sameCreds, setSameCreds] = React.useState(true);
    const [submitting, setSubmitting] = React.useState(false);

    // Auto-fill the username fields from the email address so the user
    // doesn't have to re-type it. Cleared if they touched the user field.
    const imapUserTouched = React.useRef(false);
    const smtpUserTouched = React.useRef(false);
    React.useEffect(() => {
        if (!imapUserTouched.current) setImapUser(email);
        if (!smtpUserTouched.current && !sameCreds) setSmtpUser(email);
    }, [email, sameCreds]);

    function effectiveSmtp() {
        return sameCreds
            ? { user: imapUser, pass: imapPass, host: smtpHost, port: Number(smtpPort) }
            : { user: smtpUser, pass: smtpPass, host: smtpHost, port: Number(smtpPort) };
    }

    function valid() {
        if (!name.trim() || !email.trim()) return false;
        if (!imapHost.trim() || !imapPort.trim() || !imapUser.trim() || !imapPass) return false;
        if (!smtpHost.trim() || !smtpPort.trim()) return false;
        if (!sameCreds && (!smtpUser.trim() || !smtpPass)) return false;
        // Any routable port is allowed; the security mode carries how to
        // connect, so 2525 and other non-standard ports work.
        if (!validPort(Number(smtpPort)) || !validPort(Number(imapPort))) return false;
        return true;
    }

    async function submit() {
        if (submitting || !valid()) return;
        setSubmitting(true);
        const eff = effectiveSmtp();
        try {
            await toast.promise(
                addEmail({
                    name: name.trim(),
                    email: email.trim(),
                    imap: {
                        username: imapUser.trim(),
                        password: imapPass,
                        host: imapHost.trim(),
                        port: Number(imapPort),
                        security: imapSecurity,
                    },
                    smtp: {
                        username: eff.user.trim(),
                        password: eff.pass,
                        host: eff.host.trim(),
                        port: eff.port,
                        security: smtpSecurity,
                    },
                }),
                {
                    loading: isHe ? "בודק את פרטי ההתחברות…" : "Verifying credentials…",
                    success: isHe ? "תיבת הדואר חוברה בהצלחה" : "Mailbox connected",
                    error: (e: AppError) => buildError(e),
                },
            );
            onDone();
        } catch (e) {
            // Surfaced by the toast, except a full allowance, which gets its dialog.
            onError(e);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div>
            <Section title={isHe ? "חשבון" : "Account"} sub={isHe ? "שם וכתובת האימייל שמהם תישלח ההודעה" : "Name and address you send from"} icon={<MailIcon className="w-3.5 h-3.5" />}>
                <Field label={isHe ? "שם" : "Name"}>
                    <TextInput value={name} onChange={setName} placeholder="Alex Rivera" />
                </Field>
                <Field label={isHe ? "אימייל" : "Email"}>
                    <TextInput value={email} onChange={setEmail} placeholder="alex@company.com" />
                </Field>
            </Section>

            <Section title="IMAP" sub={isHe ? "דואר נכנס, בדרך כלל 993" : "Incoming, usually 993"} icon={<InboxIcon className="w-3.5 h-3.5" />}>
                <Field label={isHe ? "שרת" : "Server"}>
                    <HostPortInput
                        host={imapHost}
                        onHost={setImapHost}
                        hostPlaceholder="imap.example.com"
                        port={imapPort}
                        onPort={setImapPort}
                        portPlaceholder="993"
                    />
                </Field>
                <Field label={isHe ? "אבטחה" : "Security"}>
                    <SecuritySelect
                        value={imapSecurity}
                        host={imapHost}
                        selfHosted={selfHosted}
                        onChange={(v) => {
                            imapSecurityTouched.current = true;
                            setImapSecurity(v);
                        }}
                    />
                </Field>
                <Field label={isHe ? "שם משתמש" : "Username"}>
                    <TextInput
                        value={imapUser}
                        onChange={(v) => {
                            imapUserTouched.current = true;
                            setImapUser(v);
                        }}
                        placeholder={email || "alex@company.com"}
                    />
                </Field>
                <Field label={isHe ? "סיסמה" : "Password"}>
                    <TextInput value={imapPass} onChange={setImapPass} placeholder={isHe ? "סיסמת אפליקציה" : "App password"} type="password" />
                </Field>
            </Section>

            <Section title="SMTP" sub={isHe ? "דואר יוצא, בדרך כלל 587 או 465" : "Outgoing, usually 587 or 465"} icon={<SendIcon className="w-3.5 h-3.5" />}>
                <Field label={isHe ? "שרת" : "Server"}>
                    <HostPortInput
                        host={smtpHost}
                        onHost={setSmtpHost}
                        hostPlaceholder="smtp.example.com"
                        port={smtpPort}
                        onPort={setSmtpPort}
                        portPlaceholder="587"
                    />
                </Field>
                <Field label={isHe ? "אבטחה" : "Security"}>
                    <SecuritySelect
                        value={smtpSecurity}
                        host={smtpHost}
                        selfHosted={selfHosted}
                        onChange={(v) => {
                            smtpSecurityTouched.current = true;
                            setSmtpSecurity(v);
                        }}
                    />
                </Field>
                <label className="flex items-center gap-2 ltr:pl-[76px] rtl:pr-[76px] pt-0.5 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={sameCreds}
                        onChange={(e) => setSameCreds(e.target.checked)}
                        className="size-3.5 rounded border-slate-300 accent-slate-900"
                    />
                    <span className="text-[11.5px] text-slate-600">
                        {isHe ? "השתמש באותם פרטי התחברות כמו ב-IMAP" : "Use the same login as IMAP"}
                    </span>
                </label>
                <AnimatePresence initial={false}>
                    {!sameCreds && (
                        <motion.div
                            key="smtp-creds"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                            className="overflow-hidden"
                        >
                            <div className="space-y-2 pt-2">
                                <Field label={isHe ? "שם משתמש" : "Username"}>
                                    <TextInput
                                        value={smtpUser}
                                        onChange={(v) => {
                                            smtpUserTouched.current = true;
                                            setSmtpUser(v);
                                        }}
                                        placeholder={email || "alex@company.com"}
                                    />
                                </Field>
                                <Field label={isHe ? "סיסמה" : "Password"}>
                                    <TextInput value={smtpPass} onChange={setSmtpPass} placeholder={isHe ? "סיסמת אפליקציה" : "App password"} type="password" />
                                </Field>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Section>

            <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50/60 flex items-center gap-2 min-w-0 sticky bottom-0">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 min-w-0 flex-1">
                    <KeyRoundIcon className="w-3 h-3 shrink-0" />
                    <span className="truncate">{isHe ? "הפרטים נבדקים מול השרת שלך לפני השמירה." : "Verified against your server before saving."}</span>
                </div>
                <motion.button
                    type="button"
                    onClick={submit}
                    disabled={!valid() || submitting}
                    whileTap={valid() && !submitting ? { scale: 0.97 } : undefined}
                    className={cn(
                        "shrink-0 h-7 px-3 rounded-md text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors",
                        "bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50 disabled:cursor-not-allowed",
                    )}
                >
                    {submitting ? <Loader2Icon className="w-3 h-3 animate-spin" /> : <CheckIcon className="w-3 h-3" />}
                    {submitting ? (isHe ? "בודק פרטים…" : "Verifying…") : (isHe ? "התחבר" : "Connect")}
                </motion.button>
            </div>
        </div>
    );
}

function Section({
    title,
    sub,
    icon,
    children,
}: {
    title: string;
    sub: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="px-4 py-3 border-b border-slate-200/60 last:border-b-0 min-w-0">
            <div className="flex items-center gap-1.5 mb-2 min-w-0">
                <span className="text-slate-500 shrink-0">{icon}</span>
                <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium shrink-0">
                    {title}
                </span>
                <div className="h-3 w-px bg-slate-200 shrink-0" />
                <span className="text-[11.5px] text-slate-500 truncate min-w-0">{sub}</span>
            </div>
            <div className="space-y-2 min-w-0">{children}</div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3 min-w-0">
            <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium w-16 shrink-0">
                {label}
            </span>
            <div className="flex-1 min-w-0">{children}</div>
        </div>
    );
}

// HostPortInput — one bordered field that holds host (flex) and port
// (fixed 56px) with a hairline divider between them. Treating it as a
// single visual input avoids the old "Port label + tiny input" pinch
// that was overflowing on narrow modal widths.
function HostPortInput({
    host,
    onHost,
    hostPlaceholder,
    port,
    onPort,
    portPlaceholder,
}: {
    host: string;
    onHost: (v: string) => void;
    hostPlaceholder: string;
    port: string;
    onPort: (v: string) => void;
    portPlaceholder: string;
}) {
    return (
        <div className="flex items-stretch h-7 rounded-md border border-slate-200 bg-white focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100 transition-colors min-w-0 overflow-hidden">
            <input
                value={host}
                onChange={(e) => onHost(e.target.value)}
                placeholder={hostPlaceholder}
                className="flex-1 min-w-0 px-2.5 bg-transparent outline-none text-[12.5px] text-slate-900 placeholder:text-slate-400"
            />
            <div className="w-px bg-slate-200 shrink-0" />
            <input
                value={port}
                onChange={(e) => onPort(e.target.value)}
                placeholder={portPlaceholder}
                inputMode="numeric"
                className="w-14 shrink-0 px-2 bg-slate-50/60 outline-none text-[12.5px] text-slate-900 placeholder:text-slate-400 tabular-nums text-center"
            />
        </div>
    );
}
