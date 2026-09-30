// Starts an inbox placement test: one mailbox sends a campaign step or custom
// copy to a panel of seed inboxes, one copy at a time, and the detail page
// shows where each landed.
//
// Fully unlocked and free in this Hebrew RTL edition.

import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
    Loader2Icon,
    MailCheckIcon,
    MailIcon,
    PlayIcon,
    XIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { Label, SearchInput } from "@/components/ui/field";
import {
    PopoverMenu,
    PopoverMenuContent,
    PopoverMenuItem,
    PopoverMenuLabel,
    PopoverMenuSeparator,
    PopoverMenuTrigger,
    SelectButton,
} from "@/components/ui/popover-menu";
import { useConfirm } from "@/hooks/context/confirm";
import useCampaign from "@/lib/api/hooks/app/campaigns/useCampaign";
import useCampaignSenders from "@/lib/api/hooks/app/campaigns/useCampaignSenders";
import { useCreatePlacementTest, usePlacementOverview, usePlacementSeeds } from "@/lib/api/hooks/app/placement/usePlacement";
import {
    type CreatePlacementTestRequest,
    type PlacementPace,
    type PlacementPanel,
    type PlacementTracking,
} from "@/lib/api/models/app/placement/Placement";
import type { AppError } from "@/lib/api/client/normalizeError";
import { cn } from "@/lib/utils";
import {
    CopySourceFields,
    FamilyChips,
    InlineError,
    PaceChoice,
    PanelChoice,
    TrackingChoice,
} from "./PlacementFormParts";
import {
    copyBody,
    copyIssue,
    newIdempotencyKey,
    useCampaignEmailSteps,
    QUICK_SPACING_SECONDS,
    type CopyDraft,
    type CopySource as Source,
} from "./placementCopy";
import SeedChooser from "./SeedChooser";
import { placementErrorMessage, seedBlocker, type PlacementErrorField } from "./placementTests";

interface Draft extends CopyDraft {
    senderId: string;
    tracking: PlacementTracking;
    panel: PlacementPanel;
    // Own seed inboxes to send to; empty means the usual pick.
    seedIds: string[];
    // Provider families on a shared panel; empty means every provider.
    families: string[];
    pace: PlacementPace;
}

export interface NewPlacementTestPrefill {
    campaignId?: string;
    stepId?: string;
}

function emptyDraft(prefill?: NewPlacementTestPrefill): Draft {
    const fromStep = !!prefill?.campaignId;
    return {
        senderId: "",
        source: fromStep ? "step" : "custom",
        campaignId: prefill?.campaignId ?? "",
        stepId: prefill?.stepId ?? "",
        subject: "",
        bodyHtml: "",
        bodyPlain: "",
        bodyCode: false,
        contact: null,
        tracking: fromStep ? "campaign" : "off",
        panel: "instance",
        seedIds: [],
        families: [],
        pace: "spaced",
    };
}

// What the user typed or picked, for the discard prompt.
function draftKey(d: Draft): string {
    return JSON.stringify([
        d.source,
        d.campaignId,
        d.stepId,
        d.subject,
        d.bodyHtml,
        d.contact?.id ?? "",
        d.tracking,
        d.seedIds,
        d.families,
        d.pace,
    ]);
}

export default function NewPlacementTestDialog({
    open,
    onClose,
    prefill,
}: {
    open: boolean;
    onClose: () => void;
    prefill?: NewPlacementTestPrefill;
}) {
    if (typeof document === "undefined") return null;
    return createPortal(
        <AnimatePresence>{open && <DialogBody key="placement-dialog" onClose={onClose} prefill={prefill} />}</AnimatePresence>,
        document.body,
    );
}

function DialogBody({ onClose, prefill }: { onClose: () => void; prefill?: NewPlacementTestPrefill }) {
    const navigate = useNavigate();
    const confirm = useConfirm();
    const overview = usePlacementOverview();
    const seeds = usePlacementSeeds();
    const create = useCreatePlacementTest();

    const [draft, setDraft] = React.useState<Draft>(() => emptyDraft(prefill));
    const initialKey = React.useRef(draftKey(emptyDraft(prefill)));
    const [error, setError] = React.useState<{ field: PlacementErrorField; message: string } | null>(null);
    const [nudged, setNudged] = React.useState(false);

    const idemKey = React.useRef(newIdempotencyKey());
    const patch = (p: Partial<Draft>) => {
        idemKey.current = newIdempotencyKey();
        setError(null);
        setDraft((d) => ({ ...d, ...p }));
    };

    const campaign = useCampaign(draft.source === "step" ? draft.campaignId : "");
    const campaignSenders = useCampaignSenders(draft.campaignId, draft.source === "step" && !!draft.campaignId);
    const steps = useCampaignEmailSteps(draft.campaignId, draft.source === "step");
    const emailSteps = steps.emailSteps;

    // Senders: connected mailboxes that are not seeds, the campaign's own first.
    const inCampaign = React.useMemo(
        () => new Set((campaignSenders.data ?? []).filter((s) => s.enabled).map((s) => s.email_account_id)),
        [campaignSenders.data],
    );
    const senders = React.useMemo(() => {
        const list = (seeds.data ?? []).filter((m) => m.status === "active" && !m.seed);
        return [...list].sort((a, b) => Number(inCampaign.has(b.email_account_id)) - Number(inCampaign.has(a.email_account_id)));
    }, [seeds.data, inCampaign]);
    const sender = senders.find((s) => s.email_account_id === draft.senderId) ?? null;

    // Default the sender to the campaign's first usable mailbox, else the first.
    React.useEffect(() => {
        if (sender || senders.length === 0) return;
        const pick = senders.find((s) => inCampaign.has(s.email_account_id)) ?? senders[0];
        setDraft((d) => ({ ...d, senderId: pick.email_account_id }));
    }, [sender, senders, inCampaign]);

    // Default the step to the campaign's first email step.
    React.useEffect(() => {
        if (draft.source !== "step" || !draft.campaignId || emailSteps.length === 0) return;
        if (emailSteps.some((s) => s.id === draft.stepId)) return;
        setDraft((d) => ({ ...d, stepId: emailSteps[0].id }));
    }, [draft.source, draft.campaignId, draft.stepId, emailSteps]);

    // Default the panel to the first one that can run a test.
    const panels = React.useMemo(() => overview.data?.panels ?? [], [overview.data]);
    const panel = panels.find((p) => p.panel === draft.panel);
    React.useEffect(() => {
        if (panels.length === 0 || panel?.available) return;
        const first = panels.find((p) => p.available);
        if (first) setDraft((d) => ({ ...d, panel: first.panel }));
    }, [panels, panel?.available]);

    const textOnly = draft.source === "step" && !!campaign.data?.text_only;
    React.useEffect(() => {
        if (textOnly && (draft.tracking === "on" || draft.tracking === "compare")) {
            setDraft((d) => ({ ...d, tracking: "campaign" }));
        }
    }, [textOnly, draft.tracking]);

    const compare = draft.tracking === "compare";
    const seedsPerTest = overview.data?.seeds_per_test ?? 0;
    const ownSeeds = React.useMemo(() => (seeds.data ?? []).filter((m) => m.seed), [seeds.data]);
    const chosenSeeds =
        draft.panel === "workspace"
            ? ownSeeds.filter((m) => draft.seedIds.includes(m.email_account_id) && !seedBlocker(m, sender?.email))
            : [];
    const panelFamilies = React.useMemo(() => panel?.families ?? [], [panel]);
    const chosenFamilies =
        draft.panel === "workspace" ? [] : draft.families.filter((f) => panelFamilies.some((p) => p.family === f));
    const familySeeds = chosenFamilies.length
        ? panelFamilies.filter((p) => chosenFamilies.includes(p.family)).reduce((n, p) => n + p.seeds, 0)
        : (panel?.seeds ?? 0);

    const perTest = !panel ? 0 : chosenSeeds.length > 0 ? chosenSeeds.length : Math.min(familySeeds, seedsPerTest || familySeeds);
    const copies = perTest * (compare ? 2 : 1);
    const baseSpacing = overview.data?.spacing_seconds ?? 60;
    const spacing = draft.pace === "quick" ? Math.min(baseSpacing, QUICK_SPACING_SECONDS) : baseSpacing;
    const sendSeconds = copies * spacing;
    const sendTime = sendSeconds < 90 ? "פחות מ-2 דקות" : `כ-${Math.round(sendSeconds / 60)} דקות`;

    // Unmetered and free in this self-hosted edition
    const usage = overview.data?.usage;

    const issue: string | null = !sender
        ? senders.length === 0 && !seeds.isLoading
            ? "חבר תיבת דואר תחילה. תיבות בדיקה (Seeds) אינן יכולות לשלוח בדיקה."
            : "בחר תיבת דואר שממנה תתבצע השליחה."
        : copyIssue(draft, steps) ??
          (!panel || !panel.available
              ? "בחר פאנל שיכול להריץ בדיקה."
              : panel.seeds === 0
                ? panel.panel === "workspace"
                    ? "אין לך עדיין תיבות בדיקה. סמן תיבות בלשונית תיבות בדיקה."
                    : "בפאנל זה אין עדיין תיבות בדיקה."
                : draft.panel === "workspace" && draft.seedIds.length > 0 && chosenSeeds.length === 0
                  ? "אף אחת מתיבות הבדיקה שנבחרו אינה מחוברת. בחר תיבות אחרות או נקה את הבחירה."
                  : chosenFamilies.length > 0 && familySeeds === 0
                    ? "בפאנל זה אין תיבות בדיקה בספקים שנבחרו."
                    : null);

    const dirty = draftKey(draft) !== initialKey.current;
    const pending = create.isPending;

    const requestClose = React.useCallback(() => {
        if (pending) return;
        if (dirty) {
            confirm.show("לבטל את יצירת בדיקת המיקום?", async () => onClose());
            return;
        }
        onClose();
    }, [pending, dirty, confirm, onClose]);

    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            if (document.querySelector("[data-floating], [role='alertdialog']")) return;
            e.preventDefault();
            requestClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [requestClose]);

    async function submit() {
        if (pending) return;
        if (issue) {
            setNudged(true);
            return;
        }
        const body: CreatePlacementTestRequest = {
            sender_account_id: draft.senderId,
            tracking: draft.tracking,
            panel: draft.panel,
            ...copyBody(draft),
            ...(chosenSeeds.length > 0 ? { seed_ids: chosenSeeds.map((m) => m.email_account_id) } : {}),
            ...(chosenFamilies.length > 0 ? { families: chosenFamilies } : {}),
            ...(draft.pace !== "spaced" ? { pace: draft.pace } : {}),
        };

        try {
            const tests = await create.mutateAsync({ body, idempotencyKey: idemKey.current });
            toast.success(tests.length > 1 ? "ההשוואה הופעלה בהצלחה." : "בדיקת המיקום הופעלה בהצלחה.");
            onClose();
            if (tests[0]) navigate(`/app/placement/${tests[0].id}`);
        } catch (err) {
            setError(
                placementErrorMessage(err as AppError, {
                    resetsOn: overview.data?.usage?.period_end,
                    panel: draft.panel,
                    chosen: chosenSeeds.length > 0,
                }),
            );
        }
    }

    const fieldError = (f: PlacementErrorField) =>
        error?.field === f ? <InlineError message={error.message} /> : null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onMouseDown={requestClose}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/30 backdrop-blur-[2px] px-4"
        >
            <motion.div
                role="dialog"
                aria-modal="true"
                aria-label="בדיקת מיקום חדשה"
                initial={{ y: 8, opacity: 0, scale: 0.985 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 8, opacity: 0, scale: 0.985 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full max-w-[680px] rounded-lg bg-white border border-slate-200 shadow-[0_24px_48px_-12px_rgba(15,23,42,0.18),0_8px_16px_-8px_rgba(15,23,42,0.1)] overflow-hidden flex flex-col max-h-[88dvh] text-start"
            >
                <div className="h-12 px-4 border-b border-slate-200 flex items-center gap-2.5 shrink-0">
                    <div className="size-5 rounded bg-slate-100 text-slate-600 flex items-center justify-center">
                        <MailCheckIcon className="w-3 h-3" />
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">חדש</span>
                    <div className="h-4 w-px bg-slate-200" />
                    <span className="text-[12.5px] text-slate-900 font-medium">בדיקת מיקום</span>
                    <button
                        type="button"
                        onClick={requestClose}
                        aria-label="סגור"
                        className="ms-auto size-7 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center justify-center transition-colors"
                    >
                        <XIcon className="w-3.5 h-3.5" />
                    </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-6">
                    {/* Sender */}
                    <section>
                        <Label>שלח מתיבת דואר</Label>
                        <SenderPicker
                            senders={senders}
                            inCampaign={inCampaign}
                            value={draft.senderId}
                            loading={seeds.isLoading}
                            onChange={(id) => patch({ senderId: id })}
                        />
                        <p className="mt-1.5 text-[11px] text-slate-400 leading-relaxed text-start">
                            רק תיבות דואר מחוברות יכולות לשלוח. תיבות בדיקה (Seeds) מדולגות.
                        </p>
                        {fieldError("sender")}
                    </section>

                    {/* What to test */}
                    <CopySourceFields
                        value={draft}
                        patch={patch}
                        onSource={(v) =>
                            patch({
                                source: v,
                                tracking: v === "step" ? "campaign" : draft.tracking === "campaign" ? "off" : draft.tracking,
                            })
                        }
                        campaignName={campaign.data?.name}
                        steps={steps}
                        error={fieldError("source")}
                    />

                    {/* Tracking */}
                    <TrackingChoice
                        value={draft.tracking}
                        onChange={(v) => patch({ tracking: v })}
                        source={draft.source}
                        textOnly={textOnly}
                        error={fieldError("tracking")}
                    />

                    {/* Pace */}
                    <PaceChoice value={draft.pace} onChange={(v) => patch({ pace: v })} />

                    {/* Panel */}
                    <section>
                        <span className="block mb-2 text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">פאנל תיבות בדיקה</span>
                        <PanelChoice
                            panels={panels}
                            loading={overview.isLoading}
                            value={draft.panel}
                            onChange={(p) => patch({ panel: p })}
                            usage={usage}
                        />
                        {draft.panel !== "workspace" && panel?.available && panelFamilies.length > 1 && (
                            <FamilyChips
                                families={panelFamilies}
                                value={chosenFamilies}
                                onChange={(families) => patch({ families })}
                            />
                        )}
                        {draft.panel === "workspace" && panel?.available && ownSeeds.length > 0 && (
                            <SeedChooser
                                seeds={ownSeeds}
                                senderEmail={sender?.email}
                                perTest={seedsPerTest}
                                value={draft.seedIds}
                                onChange={(seedIds) => patch({ seedIds })}
                            />
                        )}
                        {fieldError("panel")}
                    </section>

                    {/* Workload / Details */}
                    {sender && panel?.available && copies > 0 && (
                        <div className="rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-[11.5px] leading-relaxed text-slate-600 text-start">
                            שולח עד <b className="font-medium text-slate-900">{copies}</b> עותקים מ-{" "}
                            <b dir="ltr" className="font-medium text-slate-900">{sender.email}</b>, אחד לכל ~{spacing} שניות, הנספרים במכסת השליחה היומית של התיבה. זמן השליחה הכולל {sendTime}. עותק שלא זוהה בתוך שעתיים נחשב כאילו לא הגיע. תיבות בדיקה באותו דומיין של השולח מדולגות אוטומטית.
                        </div>
                    )}
                </div>

                <div className="shrink-0 border-t border-slate-200 px-4 py-3 flex items-center gap-2">
                    <div className="min-w-0 flex-1 text-start">
                        {error?.field === "general" ? (
                            <InlineError message={error.message} compact />
                        ) : nudged && issue ? (
                            <InlineError message={issue} compact />
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={requestClose}
                        disabled={pending}
                        className="h-7 px-3 text-[12px] font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-md transition-colors disabled:opacity-60"
                    >
                        ביטול
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={pending}
                        title={issue ?? undefined}
                        className={cn(
                            "h-7 px-3 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-60",
                            issue && "opacity-60",
                        )}
                    >
                        {pending ? <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> : <PlayIcon className="w-3.5 h-3.5" />}
                        {compare ? "התחל השוואה" : "התחל בדיקה"}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

function SenderPicker({
    senders,
    inCampaign,
    value,
    loading,
    onChange,
}: {
    senders: { email_account_id: string; email: string; label: string }[];
    inCampaign: Set<string>;
    value: string;
    loading: boolean;
    onChange: (id: string) => void;
}) {
    const [open, setOpen] = React.useState(false);
    const [q, setQ] = React.useState("");
    const current = senders.find((s) => s.email_account_id === value);
    const needle = q.trim().toLowerCase();
    const shown = needle ? senders.filter((s) => s.email.toLowerCase().includes(needle)) : senders;
    const campaignRows = shown.filter((s) => inCampaign.has(s.email_account_id));
    const otherRows = shown.filter((s) => !inCampaign.has(s.email_account_id));

    const row = (s: (typeof senders)[number]) => (
        <PopoverMenuItem key={s.email_account_id} selected={s.email_account_id === value} onSelect={() => onChange(s.email_account_id)}>
            <span dir="ltr" className="text-slate-800 text-start">{s.email}</span>
            {s.label && <span className="ms-1.5 text-[11px] text-slate-400">{s.label}</span>}
        </PopoverMenuItem>
    );

    return (
        <PopoverMenu open={open} onOpenChange={setOpen}>
            <PopoverMenuTrigger asChild>
                <SelectButton
                    icon={<MailIcon className="w-3.5 h-3.5" />}
                    label={current ? current.email : loading ? "טוען תיבות דואר…" : "בחר תיבת דואר"}
                    className="w-full [&>span:nth-child(2)]:max-w-none [&>span:nth-child(2)]:flex-1 [&>span:nth-child(2)]:text-start"
                />
            </PopoverMenuTrigger>
            <PopoverMenuContent minWidth={300} matchTriggerWidth className="p-1 max-h-80 text-start">
                <div className="p-1.5">
                    <SearchInput value={q} onChange={setQ} placeholder="חיפוש תיבות דואר…" autoFocus />
                </div>
                {shown.length === 0 ? (
                    <div className="px-3 py-2 text-[11.5px] text-slate-400">
                        {senders.length === 0 ? "אין תיבת דואר מחוברת שיכולה לשלוח בדיקה." : "לא נמצאו תיבות דואר תואמות."}
                    </div>
                ) : (
                    <>
                        {campaignRows.length > 0 && (
                            <>
                                <PopoverMenuLabel>בקמפיין זה</PopoverMenuLabel>
                                {campaignRows.map(row)}
                                {otherRows.length > 0 && <PopoverMenuSeparator />}
                            </>
                        )}
                        {otherRows.length > 0 && (
                            <>
                                {campaignRows.length > 0 && <PopoverMenuLabel>תיבות דואר אחרות</PopoverMenuLabel>}
                                {otherRows.map(row)}
                            </>
                        )}
                    </>
                )}
            </PopoverMenuContent>
        </PopoverMenu>
    );
}
