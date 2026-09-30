// Starts a placement batch: the same placement test from many sending
// mailboxes, a few at a time, so the results can be read by domain and
// provider. Three steps (Senders, Email, Review); every count comes from the
// server's preview of the same request, so nothing here guesses.
//
// 100% natural Israeli Hebrew localization, unmetered & free, strict RTL.

import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
    AlertCircleIcon,
    AlertTriangleIcon,
    CheckIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    Layers3Icon,
    Loader2Icon,
    PlayIcon,
    XIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { Label, NumberInput, SearchInput } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { OptionSelect, Toggle } from "@/components/app/campaigns/preferences/components/CampaignPreferenceBoolBox";
import TagSelector from "@/components/app/popup/select/TagSelector";
import { useConfirm } from "@/hooks/context/confirm";
import useDebouncedValue from "@/hooks/useDebouncedValue";
import useCampaign from "@/lib/api/hooks/app/campaigns/useCampaign";
import {
    useCreatePlacementBatch,
    usePlacementBatchPreview,
    usePlacementOverview,
    usePlacementSeeds,
} from "@/lib/api/hooks/app/placement/usePlacement";
import {
    PANEL_LABEL,
    type PlacementBatchPreview,
    type PlacementBatchRequest,
    type PlacementPanel,
    type PlacementSample,
    type PlacementSampleMode,
    type PlacementSenderScope,
    type PlacementTracking,
    type PlacementUnavailable,
    type PlacementWorkspaceSeed,
} from "@/lib/api/models/app/placement/Placement";
import { domainOf } from "@/lib/api/models/app/emails/MailboxSources";
import type { AppError } from "@/lib/api/client/normalizeError";
import { cn } from "@/lib/utils";
import {
    CampaignPicker,
    CopySourceFields,
    FamilyChips,
    InlineError,
    PanelChoice,
    SectionLabel,
    TrackingChoice,
} from "../tests/PlacementFormParts";
import {
    copyBody,
    copyIssue,
    newIdempotencyKey,
    useCampaignEmailSteps,
    type CopyDraft,
} from "../tests/placementCopy";
import SeedChooser from "../tests/SeedChooser";
import { BATCH_RETRY_DAYS, batchErrorMessage, fmtDuration, type BatchErrorField } from "./placementBatches";

type Scope = "mailboxes" | "campaign" | "workspace";
type StepKey = "senders" | "email" | "review";

const STEPS: { key: StepKey; label: string }[] = [
    { key: "senders", label: "שולחים" },
    { key: "email", label: "אימייל" },
    { key: "review", label: "סיכום ואישור" },
];

// Rows drawn in the mailbox list at once; search narrows the rest.
const MAILBOX_ROWS_SHOWN = 300;

interface Draft extends CopyDraft {
    scope: Scope;
    senderIds: string[];
    scopeCampaignId: string;
    providers: string[];
    domains: string[];
    tagIds: string[];
    untested: boolean;
    untestedDays: number;
    includeInactive: boolean;
    sampleMode: PlacementSampleMode;
    sampleCount: number;
    samplePercent: number;
    spread: boolean;
    tracking: PlacementTracking;
    panel: PlacementPanel;
    seedIds: string[];
    families: string[];
    onUnavailable: PlacementUnavailable;
}

export interface NewPlacementBatchPrefill {
    campaignId?: string;
    scope?: Scope;
    untestedDays?: number;
    senderIds?: string[];
}

function emptyDraft(prefill?: NewPlacementBatchPrefill): Draft {
    const scope: Scope =
        prefill?.scope ?? (prefill?.senderIds?.length ? "mailboxes" : prefill?.campaignId ? "campaign" : "workspace");
    const fromStep = !!prefill?.campaignId;
    return {
        source: fromStep ? "step" : "custom",
        campaignId: prefill?.campaignId ?? "",
        stepId: "",
        subject: "",
        bodyHtml: "",
        bodyPlain: "",
        bodyCode: false,
        contact: null,
        scope,
        senderIds: prefill?.senderIds ?? [],
        scopeCampaignId: prefill?.campaignId ?? "",
        providers: [],
        domains: [],
        tagIds: [],
        untested: !!prefill?.untestedDays,
        untestedDays: prefill?.untestedDays ?? 30,
        includeInactive: false,
        sampleMode: "all",
        sampleCount: 50,
        samplePercent: 10,
        spread: true,
        tracking: fromStep ? "campaign" : "off",
        panel: "instance",
        seedIds: [],
        families: [],
        onUnavailable: "defer",
    };
}

// What the user typed or picked, for the discard prompt.
function draftKey(d: Draft): string {
    return JSON.stringify({ ...d, panel: "", stepId: "", contact: d.contact?.id ?? "" });
}

function sampleOf(d: Draft): PlacementSample {
    const stratify = d.spread ? { stratify: "provider" as const } : {};
    switch (d.sampleMode) {
        case "random":
            return { mode: "random", count: d.sampleCount, ...stratify };
        case "percent":
            return { mode: "percent", percent: d.samplePercent, ...stratify };
        case "per_domain":
        case "per_provider":
            return { mode: d.sampleMode, count: d.sampleCount };
        default:
            return { mode: "all" };
    }
}

// The sender half of a request, or null while it names nobody.
function selectionBody(d: Draft, opts: { base?: boolean } = {}): PlacementBatchRequest | null {
    if (d.scope === "mailboxes") return d.senderIds.length > 0 ? { sender_account_ids: d.senderIds, sample: { mode: "all" } } : null;
    if (d.scope === "campaign" && !d.scopeCampaignId) return null;
    const scope: PlacementSenderScope = {
        type: d.scope,
        ...(d.scope === "campaign" ? { campaign_id: d.scopeCampaignId } : {}),
        ...(!opts.base && d.providers.length > 0 ? { providers: d.providers } : {}),
        ...(d.domains.length > 0 ? { domains: d.domains } : {}),
        ...(d.tagIds.length > 0 ? { tag_ids: d.tagIds } : {}),
        ...(d.includeInactive ? { include_inactive: true } : {}),
        ...(d.untested && d.untestedDays > 0 ? { untested_days: d.untestedDays } : {}),
    };
    return { sender_scope: scope, sample: opts.base ? { mode: "all" } : sampleOf(d) };
}

// Holds a request body until it has been stable for a moment.
function useSettledBody(body: PlacementBatchRequest | null) {
    const key = body ? JSON.stringify(body) : "";
    const debounced = useDebouncedValue(key, 400);
    const settledBody = React.useMemo(() => (debounced ? (JSON.parse(debounced) as PlacementBatchRequest) : null), [debounced]);
    return { body: settledBody, settled: debounced === key };
}

function usePreview(body: PlacementBatchRequest | null) {
    const settled = useSettledBody(body);
    const q = usePlacementBatchPreview(settled.body);
    const error = q.isError ? batchErrorMessage(q.error as unknown as AppError) : null;
    const ready = !!body && settled.settled && !!q.data && !q.isPlaceholderData && !q.isError;
    return { data: ready ? q.data : undefined, stale: q.data, error, loading: !!body && !ready && !error };
}

export default function NewPlacementBatchDialog({
    open,
    onClose,
    prefill,
}: {
    open: boolean;
    onClose: () => void;
    prefill?: NewPlacementBatchPrefill;
}) {
    if (typeof document === "undefined") return null;
    return createPortal(
        <AnimatePresence>{open && <DialogBody key="placement-batch-dialog" onClose={onClose} prefill={prefill} />}</AnimatePresence>,
        document.body,
    );
}

function DialogBody({ onClose, prefill }: { onClose: () => void; prefill?: NewPlacementBatchPrefill }) {
    const navigate = useNavigate();
    const confirm = useConfirm();
    const overview = usePlacementOverview();
    const seeds = usePlacementSeeds();
    const create = useCreatePlacementBatch();

    const [step, setStep] = React.useState(0);
    const [direction, setDirection] = React.useState<1 | -1>(1);
    const [draft, setDraft] = React.useState<Draft>(() => emptyDraft(prefill));
    const initialKey = React.useRef(draftKey(emptyDraft(prefill)));
    const [error, setError] = React.useState<{ field: BatchErrorField; message: string } | null>(null);
    const [nudged, setNudged] = React.useState(false);

    const idemKey = React.useRef(newIdempotencyKey());
    const patch = (p: Partial<Draft>) => {
        idemKey.current = newIdempotencyKey();
        setError(null);
        setDraft((d) => ({ ...d, ...p }));
    };

    const campaign = useCampaign(draft.source === "step" ? draft.campaignId : "");
    const scopeCampaign = useCampaign(draft.scope === "campaign" ? draft.scopeCampaignId : "");
    const steps = useCampaignEmailSteps(draft.campaignId, draft.source === "step");

    const setScopeCampaign = (id: string) => {
        patch({
            scopeCampaignId: id,
            ...(draft.source === "step" && !draft.campaignId ? { campaignId: id, stepId: "" } : {}),
        });
    };

    React.useEffect(() => {
        if (draft.source !== "step" || !draft.campaignId || steps.emailSteps.length === 0) return;
        if (steps.emailSteps.some((s) => s.id === draft.stepId)) return;
        setDraft((d) => ({ ...d, stepId: steps.emailSteps[0].id }));
    }, [draft.source, draft.campaignId, draft.stepId, steps.emailSteps]);

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

    const mailboxes = React.useMemo(() => (seeds.data ?? []).filter((m) => !m.seed), [seeds.data]);
    const ownSeeds = React.useMemo(() => (seeds.data ?? []).filter((m) => m.seed), [seeds.data]);
    const chosenSeeds = draft.panel === "workspace" ? ownSeeds.filter((m) => draft.seedIds.includes(m.email_account_id) && m.status === "active") : [];
    const panelFamilies = React.useMemo(() => panel?.families ?? [], [panel]);
    const chosenFamilies = draft.panel === "workspace" ? [] : draft.families.filter((f) => panelFamilies.some((p) => p.family === f));
    const familySeeds = chosenFamilies.length
        ? panelFamilies.filter((p) => chosenFamilies.includes(p.family)).reduce((acc, p) => acc + p.seeds, 0)
        : (panel?.seeds ?? 0);

    const selection = selectionBody(draft);
    const senders = usePreview(selection);
    const baseSelection = draft.scope === "mailboxes" ? null : selectionBody(draft, { base: true });
    const base = usePreview(baseSelection);

    const emailIssue: string | null =
        copyIssue(draft, steps) ??
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

    const fullBody: PlacementBatchRequest | null =
        selection && !emailIssue
            ? {
                  ...selection,
                  ...copyBody(draft),
                  tracking: draft.tracking,
                  panel: draft.panel,
                  ...(chosenFamilies.length > 0 ? { families: chosenFamilies } : {}),
                  ...(chosenSeeds.length > 0 ? { seed_ids: chosenSeeds.map((m) => m.email_account_id) } : {}),
                  on_unavailable: draft.onUnavailable,
              }
            : null;
    const full = usePreview(fullBody);

    const tooLarge = (p: PlacementBatchPreview) =>
        p.selected > p.senders_max
            ? `בחירה זו כוללת ${n(p.selected)} שולחים, ואצווה יכולה להכיל עד ${n(p.senders_max)}. צמצם את המסננים או קח מדגם.`
            : null;
    const emptyIssue = (p: PlacementBatchPreview) =>
        p.selected === 0
            ? p.matched === 0
                ? "אין תיבות דואר שולחות התואמות לבחירה זו."
                : "מדגם זה אינו כולל תיבות דואר. הגדל את המספר."
            : null;

    const sendersIssue: string | null =
        draft.scope === "mailboxes" && draft.senderIds.length === 0
            ? "בחר לפחות תיבת דואר אחת."
            : draft.scope === "campaign" && !draft.scopeCampaignId
              ? "בחר קמפיין."
              : senders.error
                ? senders.error.message
                : !senders.data
                  ? "סופר תיבות דואר…"
                  : (emptyIssue(senders.data) ?? tooLarge(senders.data));

    const fp = full.data;
    // Unmetered and free: no credit blockers
    const reviewIssue: string | null = full.error
        ? full.error.message
        : !fp
          ? "מחשב נתונים…"
          : (emptyIssue(fp) ?? tooLarge(fp));

    const issueOf = React.useCallback(
        (key: StepKey) => (key === "senders" ? sendersIssue : key === "email" ? emailIssue : reviewIssue),
        [sendersIssue, emailIssue, reviewIssue],
    );
    const current = STEPS[step];
    const issue = issueOf(current.key);
    React.useEffect(() => {
        if (!issue) setNudged(false);
    }, [issue]);

    const canReach = React.useCallback(
        (target: number) => {
            for (let i = 0; i < target; i++) if (issueOf(STEPS[i].key)) return false;
            return true;
        },
        [issueOf],
    );

    const goTo = React.useCallback(
        (target: number, force = false) => {
            if (target === step) return;
            if (!force && target > step && !canReach(target)) {
                setNudged(true);
                return;
            }
            setDirection(target > step ? 1 : -1);
            setNudged(false);
            setStep(target);
        },
        [step, canReach],
    );

    const dirty = draftKey(draft) !== initialKey.current;
    const pending = create.isPending;

    const requestClose = React.useCallback(() => {
        if (pending) return;
        if (dirty) {
            confirm.show("לבטל את יצירת אצוות בדיקות המיקום?", async () => onClose());
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

    const next = () => {
        if (issue) {
            setNudged(true);
            return;
        }
        goTo(step + 1);
    };

    async function submit() {
        if (pending) return;
        if (issue || !fullBody || !fp) {
            setNudged(true);
            return;
        }
        const body: PlacementBatchRequest = { ...fullBody };
        try {
            const batch = await create.mutateAsync({ body, idempotencyKey: idemKey.current });
            toast.success("אצוות בדיקות המיקום הופעלה בהצלחה.");
            onClose();
            if (batch) navigate(`/app/placement/batches/${batch.id}`);
        } catch (err) {
            setError(
                batchErrorMessage(err as AppError, {
                    resetsOn: overview.data?.usage?.period_end,
                    panel: draft.panel,
                }),
            );
        }
    }

    const fieldError = (f: BatchErrorField) =>
        error?.field === f ? <InlineError message={error.message} /> : null;

    const lastStep = STEPS.length - 1;
    const waiting = (current.key === "senders" && senders.loading) || (current.key === "review" && full.loading);

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
                aria-label="אצוות בדיקות מיקום חדשה"
                initial={{ y: 8, opacity: 0, scale: 0.985 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 8, opacity: 0, scale: 0.985 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full max-w-[720px] rounded-lg bg-white border border-slate-200 shadow-[0_24px_48px_-12px_rgba(15,23,42,0.18),0_8px_16px_-8px_rgba(15,23,42,0.1)] overflow-hidden flex flex-col max-h-[90dvh] text-start"
            >
                <div className="h-12 px-4 border-b border-slate-200 flex items-center gap-2.5 shrink-0">
                    <div className="size-5 rounded bg-slate-100 text-slate-600 flex items-center justify-center">
                        <Layers3Icon className="w-3 h-3" />
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">חדש</span>
                    <div className="h-4 w-px bg-slate-200" />
                    <span className="text-[12.5px] text-slate-900 font-medium">אצוות בדיקות מיקום</span>
                    <button
                        type="button"
                        onClick={requestClose}
                        aria-label="סגור"
                        className="ms-auto size-7 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center justify-center transition-colors"
                    >
                        <XIcon className="w-3.5 h-3.5" />
                    </button>
                </div>

                <StepBar step={step} goTo={goTo} canReach={canReach} issueOf={issueOf} />

                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                    <AnimatePresence initial={false} custom={direction} mode="wait">
                        <motion.div
                            key={current.key}
                            custom={direction}
                            variants={paneVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                            className="px-5 py-5 space-y-6"
                        >
                            {current.key === "senders" && (
                                <SendersStep
                                    draft={draft}
                                    patch={patch}
                                    setScopeCampaign={setScopeCampaign}
                                    scopeCampaignName={scopeCampaign.data?.name}
                                    mailboxes={mailboxes}
                                    mailboxesLoading={seeds.isLoading}
                                    preview={senders}
                                    base={base.data}
                                    error={fieldError("senders")}
                                />
                            )}
                            {current.key === "email" && (
                                <>
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
                                    />
                                    <TrackingChoice
                                        value={draft.tracking}
                                        onChange={(v) => patch({ tracking: v })}
                                        source={draft.source}
                                        textOnly={textOnly}
                                        compareHint="שתי בדיקות לכל שולח, עם ובלי מעקב."
                                    />
                                    <section>
                                        <SectionLabel>פאנל תיבות בדיקה</SectionLabel>
                                        <PanelChoice
                                            panels={panels}
                                            loading={overview.isLoading}
                                            value={draft.panel}
                                            onChange={(p) => patch({ panel: p })}
                                            usage={overview.data?.usage}
                                        />
                                        {draft.panel !== "workspace" && panel?.available && panelFamilies.length > 1 && (
                                            <FamilyChips families={panelFamilies} value={chosenFamilies} onChange={(families) => patch({ families })} />
                                        )}
                                        {draft.panel === "workspace" && panel?.available && ownSeeds.length > 0 && (
                                            <>
                                                <SeedChooser
                                                    seeds={ownSeeds}
                                                    perTest={overview.data?.seeds_per_test ?? 0}
                                                    value={draft.seedIds}
                                                    onChange={(seedIds) => patch({ seedIds })}
                                                />
                                                <p className="mt-1.5 text-[11px] text-slate-400 leading-relaxed text-start">
                                                    תיבת בדיקה באותו דומיין של השולח מדולגת אוטומטית עבור אותו שולח.
                                                </p>
                                            </>
                                        )}
                                        {fieldError("email")}
                                    </section>
                                </>
                            )}
                            {current.key === "review" && (
                                <ReviewStep
                                    draft={draft}
                                    patch={patch}
                                    preview={fp ?? full.stale}
                                    loading={full.loading}
                                    spacingSeconds={overview.data?.spacing_seconds ?? 60}
                                    scopeLine={scopeLine(draft, scopeCampaign.data?.name)}
                                    copyLine={
                                        draft.source === "step"
                                            ? `${campaign.data?.name ?? "קמפיין"}, ${stepName(steps.emailSteps, draft.stepId)}`
                                            : draft.subject.trim()
                                    }
                                    goTo={(k) => goTo(STEPS.findIndex((s) => s.key === k))}
                                    error={fieldError("review")}
                                />
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                <div className="px-3 min-h-12 py-1.5 sm:py-0 sm:h-12 border-t border-slate-200 flex items-center gap-1.5 shrink-0 bg-slate-50/30">
                    {step > 0 ? (
                        <button
                            type="button"
                            onClick={() => goTo(step - 1)}
                            disabled={pending}
                            className="h-7 px-2.5 rounded-md text-[12px] text-slate-700 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                        >
                            <ChevronRightIcon className="w-3 h-3 rtl:rotate-180" />
                            הקודם
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={requestClose}
                            className="h-7 px-2.5 rounded-md text-[12px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                        >
                            ביטול
                        </button>
                    )}

                    <div className="ms-auto flex items-center gap-2 min-w-0">
                        {error?.field === "general" ? (
                            <span className="min-w-0 text-start">
                                <InlineError message={error.message} compact />
                            </span>
                        ) : (
                            issue && (
                                <span
                                    role="status"
                                    className={cn(
                                        "text-[11.5px] inline-flex items-center gap-1 min-w-0 text-start",
                                        nudged && !waiting ? "text-amber-700" : "text-slate-400",
                                    )}
                                >
                                    {waiting ? <Loader2Icon className="w-3 h-3 shrink-0 animate-spin" /> : <AlertCircleIcon className="w-3 h-3 shrink-0" />}
                                    <span className="truncate" title={issue}>
                                        {issue}
                                    </span>
                                </span>
                            )
                        )}
                        {step < lastStep ? (
                            <button
                                type="button"
                                onClick={next}
                                aria-disabled={!!issue}
                                className={cn(
                                    "h-7 px-3 rounded-md text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors shrink-0",
                                    issue ? "bg-slate-200 text-slate-500 cursor-default" : "bg-sky-600 hover:bg-sky-700 text-white",
                                )}
                            >
                                המשך
                                <ChevronLeftIcon className="w-3 h-3 rtl:rotate-180" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={submit}
                                disabled={pending}
                                aria-disabled={!!issue}
                                className={cn(
                                    "h-7 px-3 rounded-md text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors shrink-0",
                                    issue ? "bg-slate-200 text-slate-500 cursor-default" : "bg-sky-600 hover:bg-sky-700 text-white",
                                )}
                            >
                                {pending ? <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> : <PlayIcon className="w-3.5 h-3.5" />}
                                הפעל אצווה
                            </button>
                        )}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}

const paneVariants = {
    enter: (dir: 1 | -1) => ({ x: dir * -28, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: 1 | -1) => ({ x: dir * 28, opacity: 0 }),
};

function stepName(steps: { id: string; name?: string; subject?: string }[], id: string): string {
    const i = steps.findIndex((s) => s.id === id);
    if (i < 0) return "שלב";
    return steps[i].name || `שלב ${i + 1}`;
}

function scopeLine(d: Draft, campaignName?: string): string {
    const parts: string[] = [];
    if (d.scope === "mailboxes") return `${n(d.senderIds.length)} תיבות דואר שנבחרו`;
    parts.push(d.scope === "campaign" ? `שולחי הקמפיין ${campaignName ?? ""}` : "כל תיבות הדואר השולחות");
    if (d.providers.length > 0) parts.push(`${n(d.providers.length)} ספקים`);
    if (d.domains.length > 0) parts.push(d.domains.length === 1 ? d.domains[0] : `${n(d.domains.length)} דומיינים`);
    if (d.tagIds.length > 0) parts.push(`${n(d.tagIds.length)} תגיות`);
    if (d.untested && d.untestedDays > 0) parts.push(`לא נבדקו ב-${d.untestedDays} ימים`);
    if (d.sampleMode !== "all") {
        switch (d.sampleMode) {
            case "random":
                parts.push(`מדגם של ${n(d.sampleCount)}`);
                break;
            case "percent":
                parts.push(`מדגם של ${d.samplePercent}%`);
                break;
            case "per_domain":
                parts.push(`${n(d.sampleCount)} לכל דומיין`);
                break;
            case "per_provider":
                parts.push(`${n(d.sampleCount)} לכל ספק`);
                break;
        }
    }
    return parts.join(" · ");
}

function StepBar({
    step,
    goTo,
    canReach,
    issueOf,
}: {
    step: number;
    goTo: (step: number) => void;
    canReach: (step: number) => boolean;
    issueOf: (k: StepKey) => string | null;
}) {
    return (
        <div className="px-4 sm:px-5 h-11 border-b border-slate-100 flex items-center shrink-0 bg-slate-50/40 text-start">
            {STEPS.map((s, i) => {
                const active = i === step;
                const done = i < step && !issueOf(s.key);
                const reachable = i <= step || canReach(i);
                return (
                    <React.Fragment key={s.key}>
                        <button
                            type="button"
                            onClick={() => goTo(i)}
                            aria-current={active ? "step" : undefined}
                            className={cn(
                                "inline-flex items-center gap-2 h-7 ps-1 pe-2 rounded-md shrink-0 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sky-100",
                                reachable && !active ? "hover:bg-slate-100" : "",
                                !reachable ? "cursor-default" : "",
                            )}
                        >
                            <span
                                className={cn(
                                    "size-5 rounded-full inline-flex items-center justify-center text-[10.5px] font-semibold tabular-nums transition-colors",
                                    done
                                        ? "bg-sky-600 text-white"
                                        : active
                                          ? "bg-white text-sky-700 ring-1 ring-inset ring-sky-600"
                                          : "bg-white text-slate-400 ring-1 ring-inset ring-slate-200",
                                )}
                            >
                                {done ? <CheckIcon className="w-3 h-3" strokeWidth={3} /> : i + 1}
                            </span>
                            <span
                                className={cn(
                                    "text-[11.5px] font-medium whitespace-nowrap",
                                    active ? "text-slate-900" : done ? "text-slate-600" : "text-slate-400",
                                )}
                            >
                                {s.label}
                            </span>
                        </button>
                        {i < STEPS.length - 1 && (
                            <span className="relative flex-1 h-px mx-1 sm:mx-2 bg-slate-200 min-w-3 overflow-hidden">
                                <motion.span
                                    initial={false}
                                    animate={{ scaleX: i < step ? 1 : 0 }}
                                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                                    style={{ originX: 1 }}
                                    className="absolute inset-0 bg-sky-600"
                                />
                            </span>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

const SAMPLE_MODES: { value: PlacementSampleMode; label: string }[] = [
    { value: "all", label: "כל התיבות" },
    { value: "random", label: "מדגם אקראי" },
    { value: "percent", label: "אחוז מהתיבות" },
    { value: "per_domain", label: "לכל דומיין" },
    { value: "per_provider", label: "לכל ספק" },
];

function chipClass(active: boolean) {
    return cn(
        "h-6 px-2 rounded-md border text-[11px] font-medium inline-flex items-center gap-1 transition-colors",
        active ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
    );
}

function SendersStep({
    draft,
    patch,
    setScopeCampaign,
    scopeCampaignName,
    mailboxes,
    mailboxesLoading,
    preview,
    base,
    error,
}: {
    draft: Draft;
    patch: (p: Partial<Draft>) => void;
    setScopeCampaign: (id: string) => void;
    scopeCampaignName?: string;
    mailboxes: PlacementWorkspaceSeed[];
    mailboxesLoading: boolean;
    preview: ReturnType<typeof usePreview>;
    base?: PlacementBatchPreview;
    error: React.ReactNode;
}) {
    const domainSuggestions = React.useMemo(() => {
        const counts = new Map<string, number>();
        for (const m of mailboxes) {
            const d = domainOf(m.email);
            if (d) counts.set(d, (counts.get(d) ?? 0) + 1);
        }
        return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d);
    }, [mailboxes]);

    const providerChips = base?.providers ?? [];
    const p = preview.data ?? preview.stale;

    return (
        <>
            <section>
                <SectionLabel>היקף שולחים</SectionLabel>
                <OptionSelect<Scope>
                    value={draft.scope}
                    onChange={(v) => patch({ scope: v })}
                    cols={3}
                    aria-label="היקף שולחים"
                    options={[
                        { value: "mailboxes", label: "תיבות שנבחרו", hint: "בחר ידנית את תיבות הדואר שישלחו." },
                        { value: "campaign", label: "שולחי הקמפיין", hint: "כל תיבת דואר המורשית לשלוח בקמפיין." },
                        { value: "workspace", label: "כל תיבות הדואר", hint: "כל תיבות הדואר השולחות בסביבת העבודה." },
                    ]}
                />
            </section>

            {draft.scope === "mailboxes" && (
                <MailboxChooser
                    mailboxes={mailboxes}
                    loading={mailboxesLoading}
                    value={draft.senderIds}
                    onChange={(senderIds) => patch({ senderIds })}
                />
            )}

            {draft.scope === "campaign" && (
                <section className="max-w-sm text-start">
                    <Label>קמפיין</Label>
                    <CampaignPicker value={draft.scopeCampaignId} name={scopeCampaignName} onChange={setScopeCampaign} />
                </section>
            )}

            {draft.scope !== "mailboxes" && (
                <section className="space-y-3.5 text-start">
                    <SectionLabel>מסננים</SectionLabel>
                    <div className="-mt-1">
                        <span className="block mb-1.5 text-[11px] text-slate-500">ספקי תיבות דואר</span>
                        <div className="flex flex-wrap gap-1">
                            <button
                                type="button"
                                aria-pressed={draft.providers.length === 0}
                                onClick={() => patch({ providers: [] })}
                                className={chipClass(draft.providers.length === 0)}
                            >
                                הכל
                            </button>
                            {providerChips.map((pr) => {
                                const active = draft.providers.includes(pr.key);
                                return (
                                    <button
                                        key={pr.key}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() =>
                                            patch({ providers: active ? draft.providers.filter((v) => v !== pr.key) : [...draft.providers, pr.key] })
                                        }
                                        className={chipClass(active)}
                                    >
                                        {pr.label}
                                        {pr.senders != null && <span className="font-mono tabular-nums text-slate-400 ms-1">{n(pr.senders)}</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div>
                        <span className="block mb-1.5 text-[11px] text-slate-500">דומיינים שולחים</span>
                        <DomainInput value={draft.domains} onChange={(domains) => patch({ domains })} suggestions={domainSuggestions} />
                    </div>
                    <div>
                        <span className="block mb-1.5 text-[11px] text-slate-500">תיבות דואר עם אחת מהתגיות הבאות</span>
                        <TagSelector
                            selected={draft.tagIds}
                            onAdd={(id) => patch({ tagIds: [...draft.tagIds, id] })}
                            onRemove={(id) => patch({ tagIds: draft.tagIds.filter((t) => t !== id) })}
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                            <Checkbox tone="slate" checked={draft.untested} onChange={(e) => patch({ untested: e.target.checked })} />
                            <span className="text-[12px] text-slate-700">רק תיבות דואר שלא נבדקו ב-</span>
                        </label>
                        <NumberInput
                            value={draft.untestedDays}
                            min={1}
                            max={365}
                            onChange={(v) => patch({ untestedDays: v, untested: true })}
                            suffix="ימים האחרונים"
                            className="w-36"
                        />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                            <div className="text-[12px] text-slate-700">כלול תיבות דואר מנותקות</div>
                            <div className="text-[11px] text-slate-400 leading-snug">
                                הן ימתינו לחיבור מחדש בניסיונות חוזרים, או ידולגו.
                            </div>
                        </div>
                        <Toggle
                            value={draft.includeInactive}
                            onChange={(v) => patch({ includeInactive: v })}
                            ariaLabel="כלול תיבות דואר מנותקות"
                        />
                    </div>
                </section>
            )}

            {draft.scope !== "mailboxes" && (
                <section className="text-start">
                    <SectionLabel>מדגם</SectionLabel>
                    <div role="radiogroup" aria-label="מדגם" className="flex flex-wrap gap-1">
                        {SAMPLE_MODES.map((m) => (
                            <button
                                key={m.value}
                                type="button"
                                role="radio"
                                aria-checked={draft.sampleMode === m.value}
                                onClick={() => patch({ sampleMode: m.value })}
                                className={chipClass(draft.sampleMode === m.value)}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                    {draft.sampleMode !== "all" && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-3">
                            {draft.sampleMode === "percent" ? (
                                <NumberInput
                                    value={draft.samplePercent}
                                    min={1}
                                    max={100}
                                    onChange={(v) => patch({ samplePercent: v })}
                                    suffix="% מהתיבות"
                                    className="w-48"
                                />
                            ) : (
                                <NumberInput
                                    value={draft.sampleCount}
                                    min={1}
                                    max={100000}
                                    onChange={(v) => patch({ sampleCount: v })}
                                    suffix={
                                        draft.sampleMode === "per_domain"
                                            ? "לכל דומיין"
                                            : draft.sampleMode === "per_provider"
                                              ? "לכל ספק"
                                              : "תיבות דואר"
                                    }
                                    className="w-44"
                                />
                            )}
                            {(draft.sampleMode === "random" || draft.sampleMode === "percent") && (
                                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                                    <Checkbox tone="slate" checked={draft.spread} onChange={(e) => patch({ spread: e.target.checked })} />
                                    <span className="text-[12px] text-slate-700">פזר בין ספקים שונים</span>
                                </label>
                            )}
                        </div>
                    )}
                </section>
            )}

            {p && (
                <div
                    className={cn(
                        "rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2 text-[11.5px] leading-relaxed text-slate-600 transition-opacity text-start",
                        preview.loading && "opacity-60",
                    )}
                >
                    <b className="font-medium text-slate-900">{n(p.selected)}</b> תיבות דואר נבחרו מתוך{" "}
                    <b className="font-medium text-slate-900">{n(p.matched)}</b> מתאימות ב-
                    {p.domains} דומיינים שונים.
                    {p.inactive > 0 && (
                        <span className="text-amber-700"> {n(p.inactive)} מתוכן אינן מחוברות כעת.</span>
                    )}
                </div>
            )}
            {error}
        </>
    );
}

function MailboxChooser({
    mailboxes,
    loading,
    value,
    onChange,
}: {
    mailboxes: PlacementWorkspaceSeed[];
    loading: boolean;
    value: string[];
    onChange: (ids: string[]) => void;
}) {
    const [q, setQ] = React.useState("");
    const chosen = React.useMemo(() => new Set(value), [value]);
    const needle = q.trim().toLowerCase();
    const shown = React.useMemo(
        () => (needle ? mailboxes.filter((m) => m.email.toLowerCase().includes(needle) || m.label?.toLowerCase().includes(needle)) : mailboxes),
        [mailboxes, needle],
    );

    const toggle = (id: string) => onChange(chosen.has(id) ? value.filter((v) => v !== id) : [...value, id]);
    const selectAllShown = () => {
        const next = new Set(value);
        for (const m of shown.slice(0, MAILBOX_ROWS_SHOWN)) next.add(m.email_account_id);
        onChange([...next]);
    };
    const clearAll = () => onChange([]);

    return (
        <section className="rounded-md border border-slate-200 bg-white overflow-hidden text-start">
            <div className="p-2 border-b border-slate-100 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                    <SearchInput value={q} onChange={setQ} placeholder="חיפוש תיבות דואר…" />
                </div>
                <button
                    type="button"
                    onClick={selectAllShown}
                    className="shrink-0 h-7 px-2 rounded text-[11px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                    בחר הכל ({Math.min(shown.length, MAILBOX_ROWS_SHOWN)})
                </button>
                {value.length > 0 && (
                    <button
                        type="button"
                        onClick={clearAll}
                        className="shrink-0 h-7 px-2 rounded text-[11px] text-slate-500 hover:text-slate-800 transition-colors"
                    >
                        נקה
                    </button>
                )}
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                {loading ? (
                    <div className="px-3 py-3 text-[11.5px] text-slate-400 inline-flex items-center gap-1.5">
                        <Loader2Icon className="w-3 h-3 animate-spin" /> טוען תיבות דואר…
                    </div>
                ) : shown.length === 0 ? (
                    <div className="px-3 py-3 text-[11.5px] text-slate-400">
                        {mailboxes.length === 0 ? "אין תיבות דואר שיכולות לשלוח בדיקה. תיבות בדיקה מדולגות." : "לא נמצאו תיבות דואר תואמות."}
                    </div>
                ) : (
                    shown.slice(0, MAILBOX_ROWS_SHOWN).map((m) => (
                        <label key={m.email_account_id} className="h-8 px-3 flex items-center gap-2.5 cursor-pointer hover:bg-slate-50">
                            <Checkbox checked={chosen.has(m.email_account_id)} onChange={() => toggle(m.email_account_id)} />
                            <span dir="ltr" className="min-w-0 flex-1 truncate text-[12px] text-slate-800 text-start">{m.email}</span>
                            {m.status !== "active" && (
                                <span className="shrink-0 h-4 px-1.5 rounded bg-amber-50 text-amber-700 text-[10px] inline-flex items-center">
                                    לא מחובר
                                </span>
                            )}
                            <span className="shrink-0 text-[10.5px] text-slate-400 ms-1">{m.label}</span>
                        </label>
                    ))
                )}
            </div>
            {shown.length > MAILBOX_ROWS_SHOWN && (
                <p className="px-3 py-1.5 border-t border-slate-100 text-[11px] text-slate-400">
                    מציג {n(MAILBOX_ROWS_SHOWN)} מתוך {n(shown.length)}. חפש כדי לצמצם, או בחר את כל המוצגות.
                </p>
            )}
        </section>
    );
}

function DomainInput({ value, onChange, suggestions }: { value: string[]; onChange: (v: string[]) => void; suggestions: string[] }) {
    const [text, setText] = React.useState("");
    const add = (raw: string) => {
        const d = raw.trim().toLowerCase().replace(/^@/, "");
        if (d && !value.includes(d)) onChange([...value, d]);
        setText("");
    };
    const needle = text.trim().toLowerCase();
    const matches = needle ? suggestions.filter((s) => s.includes(needle) && !value.includes(s)).slice(0, 6) : [];
    return (
        <div>
            <div className="min-h-7 rounded-md border border-slate-200 bg-white px-1.5 py-1 flex flex-wrap items-center gap-1 focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100 transition-colors">
                {value.map((d) => (
                    <span key={d} className="inline-flex items-center gap-1 h-5 ps-1.5 pe-1 rounded bg-slate-100 text-[11px] text-slate-700">
                        {d}
                        <button
                            type="button"
                            onClick={() => onChange(value.filter((v) => v !== d))}
                            aria-label={`הסר ${d}`}
                            className="opacity-60 hover:opacity-100"
                        >
                            <XIcon className="w-2.5 h-2.5" />
                        </button>
                    </span>
                ))}
                <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "," || e.key === " " || e.key === "Tab") {
                            if (!text.trim()) return;
                            e.preventDefault();
                            add(text);
                        } else if (e.key === "Backspace" && !text && value.length > 0) {
                            onChange(value.slice(0, -1));
                        }
                    }}
                    onBlur={() => text.trim() && add(text)}
                    placeholder={value.length === 0 ? "כל הדומיינים. הקלד כדי לסנן, למשל acme.com" : ""}
                    className="flex-1 min-w-[140px] h-5 bg-transparent outline-none text-[16px] md:text-[12px] text-slate-900 placeholder:text-slate-400 text-start"
                />
            </div>
            {matches.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                    {matches.map((s) => (
                        <button
                            key={s}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => add(s)}
                            className="h-5 px-1.5 rounded border border-dashed border-slate-300 text-[10.5px] text-slate-600 hover:border-slate-400 hover:text-slate-800"
                        >
                            {s}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function ReviewStep({
    draft,
    patch,
    preview: p,
    loading,
    spacingSeconds,
    scopeLine: senders,
    copyLine,
    goTo,
    error,
}: {
    draft: Draft;
    patch: (p: Partial<Draft>) => void;
    preview?: PlacementBatchPreview;
    loading: boolean;
    spacingSeconds: number;
    scopeLine: string;
    copyLine: string;
    goTo: (k: StepKey) => void;
    error: React.ReactNode;
}) {
    const summary: { label: string; value: string; step: StepKey }[] = [
        { label: "שולחים", value: senders, step: "senders" },
        { label: "אימייל", value: copyLine || "(ללא נושא)", step: "email" },
        {
            label: "פאנל",
            value: `${PANEL_LABEL[draft.panel]}${draft.tracking === "compare" ? ", עם וללא מעקב" : draft.tracking === "on" ? ", עם מעקב" : draft.tracking === "off" ? ", ללא מעקב" : ""}`,
            step: "email",
        },
    ];

    return (
        <>
            <dl className="rounded-md border border-slate-200 divide-y divide-slate-100 text-start">
                {summary.map((row) => (
                    <div key={row.label} className="px-3 py-2 flex items-center gap-3">
                        <dt className="w-16 shrink-0 text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">{row.label}</dt>
                        <dd className="min-w-0 flex-1 truncate text-[12px] text-slate-800" title={row.value}>
                            {row.value}
                        </dd>
                        <button
                            type="button"
                            onClick={() => goTo(row.step)}
                            className="shrink-0 h-6 px-1.5 rounded text-[11px] text-sky-700 hover:bg-sky-50 transition-colors"
                        >
                            שנה
                        </button>
                    </div>
                ))}
            </dl>

            {!p ? (
                <div className="h-24 rounded-md bg-slate-50 animate-pulse" />
            ) : (
                <div className={cn("space-y-3 transition-opacity text-start", loading && "opacity-60")}>
                    <Workload preview={p} spacingSeconds={spacingSeconds} />
                    {p.inactive > 0 && (
                        <p className="flex items-start gap-1.5 text-[11.5px] leading-snug text-amber-700 text-start">
                            <AlertTriangleIcon className="w-3.5 h-3.5 shrink-0 mt-px" />
                            <span>
                                {n(p.inactive)} תיבות דואר שנבחרו אינן מחוברות כעת.{" "}
                                {draft.onUnavailable === "defer"
                                    ? `הן ייבדקו שוב כשיתחברו מחדש, עד ${BATCH_RETRY_DAYS} ימים.`
                                    : "הן ידולגו."}
                            </span>
                        </p>
                    )}
                </div>
            )}
            {error}

            <section className="text-start">
                <SectionLabel>כששולח אינו יכול לשלוח</SectionLabel>
                <OptionSelect<PlacementUnavailable>
                    value={draft.onUnavailable}
                    onChange={(v) => patch({ onUnavailable: v })}
                    aria-label="כששולח אינו יכול לשלוח"
                    options={[
                        {
                            value: "defer",
                            label: "נסה שוב עד שכל שולח ייבדק",
                            hint: `תיבת דואר שהגיעה למכסה היומית, עסוקה או מנותקת תיבדק שוב מאוחר יותר, עד ${BATCH_RETRY_DAYS} ימים.`,
                        },
                        {
                            value: "skip",
                            label: "דלג על שולחים שאינם יכולים לשלוח מיד",
                            hint: "האצווה תסתיים מהר יותר. תיבות שידולגו יופיעו עם סיבת הדילוג.",
                        },
                    ]}
                />
            </section>
        </>
    );
}

function Workload({ preview: p, spacingSeconds }: { preview: PlacementBatchPreview; spacingSeconds: number }) {
    const perSender = p.seeds_per_test * p.variants * spacingSeconds;
    const atOnce = Math.max(1, Math.min(p.concurrency || 1, p.selected));
    const total = Math.ceil(p.selected / atOnce) * perSender;
    return (
        <div className="rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-[11.5px] leading-relaxed text-slate-600 space-y-1 text-start">
            <p>
                <b className="font-medium text-slate-900">{n(p.selected)} תיבות דואר</b>
                {p.variants > 1 ? ", שתי בדיקות כל אחת (עם וללא מעקב)" : ""}, {n(p.seeds_per_test)} תיבות בדיקה לבדיקה: עד{" "}
                <b className="font-medium text-slate-900">{n(p.max_sends)} עותקים</b>
                {p.variants > 1 ? ` ב-${n(p.tests)} בדיקות` : ""}.
            </p>
            <p>
                {p.selected <= atOnce
                    ? `כולן שולחות במקביל, כל אחת במרווח של כ-${spacingSeconds} שניות למשך ${fmtDuration(perSender)}.`
                    : `כ-${n(atOnce)} שולחות בו-זמנית, כל אחת במרווח של כ-${spacingSeconds} שניות למשך ${fmtDuration(perSender)}, כך שזמן השליחה הכולל אורך ${fmtDuration(total)} או יותר.`}{" "}
                כל עותק נספר במכסת השליחה היומית של התיבה, ותיבה שנותרה לה מכסה נמוכה יותר תשלח פחות. עותק שלא זוהה בתוך שעתיים נחשב כאילו לא הגיע.
            </p>
            <p className="text-emerald-700 font-medium">ללא הגבלה / אינו נספר כנגד המכסה החודשית.</p>
        </div>
    );
}

function n(num: number | undefined): string {
    return (num ?? 0).toLocaleString("he-IL");
}
