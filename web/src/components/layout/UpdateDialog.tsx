// The instance update dialog, for platform admins on a self-hosted install.
//
// Four panes with directional slides, like the campaign wizard: overview
// (what runs, what is newest), confirm (what the update does), progress (the
// updater's steps and log, then the backend restart), and the result. The pill
// in the header keeps following the job when the dialog is closed, and a
// reload picks the job back up from the backend.

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    AlertTriangleIcon,
    ArrowRightIcon,
    ArrowUpCircleIcon,
    CheckIcon,
    ChevronDownIcon,
    ChevronLeftIcon,
    DatabaseIcon,
    ExternalLinkIcon,
    GitBranchIcon,
    HammerIcon,
    Loader2Icon,
    RefreshCwIcon,
    RotateCwIcon,
    SendIcon,
    ServerIcon,
    ShieldCheckIcon,
    XIcon,
} from "lucide-react";
import { applyInstanceUpdate, checkInstanceUpdate } from "@/lib/api/client/admin/updates";
import {
    INSTANCE_UPDATE_KEY,
    INSTANCE_UPDATE_LOG_KEY,
    isUpdateRunning,
    runningLabel,
    useInstanceUpdate,
    useInstanceUpdateLog,
} from "@/lib/api/hooks/auth/useInstanceUpdate";
import type InstanceUpdate from "@/lib/api/models/auth/InstanceUpdate";
import type { UpdateJob } from "@/lib/api/models/auth/InstanceUpdate";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import { markUpdateStarted, readUpdateStarted, clearUpdateStarted } from "@/lib/updateSession";
import { cn } from "@/lib/utils";

const DOCS_UPDATES = "https://docs.warmbly.com/development/updates/";

interface Props {
    open: boolean;
    onClose: () => void;
}

type Pane = "overview" | "confirm" | "progress" | "done" | "failed";

interface StepDef {
    id: string;
    label: string;
    hint: string;
    icon: React.ComponentType<{ className?: string }>;
}

const COMPOSE_STEPS: StepDef[] = [
    { id: "fetch", label: "Fetch", hint: "Reading the remote repository", icon: GitBranchIcon },
    { id: "checkout", label: "Pull", hint: "Moving the checkout to the new version", icon: ArrowUpCircleIcon },
    { id: "build", label: "Build", hint: "Rebuilding every image, usually the longest step", icon: HammerIcon },
    { id: "restart", label: "Restart", hint: "Recreating the services that changed", icon: RotateCwIcon },
    { id: "prune", label: "Clean up", hint: "Removing images nothing uses any more", icon: DatabaseIcon },
    { id: "wait", label: "Reconnect", hint: "Waiting for the backend to answer again", icon: ServerIcon },
];

const COMPOSE_STEPS_HE: StepDef[] = [
    { id: "fetch", label: "בדיקת גרסה", hint: "קריאת נתוני המאגר המרוחק", icon: GitBranchIcon },
    { id: "checkout", label: "משיכת קוד", hint: "מעבר לגרסה החדשה", icon: ArrowUpCircleIcon },
    { id: "build", label: "בנייה מחדש", hint: "בנייה מחדש של הקונטיינרים (השלב הארוך ביותר)", icon: HammerIcon },
    { id: "restart", label: "הפעלה מחדש", hint: "יצירה מחדש של השירותים שהשתנו", icon: RotateCwIcon },
    { id: "prune", label: "ניקוי", hint: "הסרת תמונות ישנות שאינן בשימוש", icon: DatabaseIcon },
    { id: "wait", label: "חיבור מחדש", hint: "המתנה לתגובת שרת ה-API", icon: ServerIcon },
];

const COMMAND_STEPS: StepDef[] = [
    { id: "fetch", label: "Fetch", hint: "Reading the remote repository", icon: GitBranchIcon },
    { id: "checkout", label: "Pull", hint: "Moving the checkout to the new version", icon: ArrowUpCircleIcon },
    { id: "command", label: "Build and restart", hint: "Running the upgrade script", icon: HammerIcon },
    { id: "wait", label: "Reconnect", hint: "Waiting for the backend to answer again", icon: ServerIcon },
];

const COMMAND_STEPS_HE: StepDef[] = [
    { id: "fetch", label: "בדיקת גרסה", hint: "קריאת נתוני המאגר המרוחק", icon: GitBranchIcon },
    { id: "checkout", label: "משיכת קוד", hint: "מעבר לגרסה החדשה", icon: ArrowUpCircleIcon },
    { id: "command", label: "בנייה והפעלה", hint: "הרצת סקריפט השדרוג", icon: HammerIcon },
    { id: "wait", label: "חיבור מחדש", hint: "המתנה לתגובת שרת ה-API", icon: ServerIcon },
];

export default function UpdateDialog({ open, onClose }: Props) {
    const { i18n } = useTranslation();
    const isHe = i18n.language === "he";

    const qc = useQueryClient();
    const stateQ = useInstanceUpdate(open);
    const logQ = useInstanceUpdateLog(open);
    const state: InstanceUpdate | undefined = logQ.data ?? stateQ.data;
    const started = readUpdateStarted();

    const [pane, setPane] = React.useState<Pane>("overview");
    const [direction, setDirection] = React.useState<1 | -1>(1);
    const goTo = React.useCallback(
        (next: Pane) => {
            const order: Pane[] = ["overview", "confirm", "progress", "done", "failed"];
            setDirection(order.indexOf(next) >= order.indexOf(pane) ? 1 : -1);
            setPane(next);
        },
        [pane],
    );

    const running = isUpdateRunning(state);
    const backendDown = !!started && (logQ.isError || stateQ.isError);
    const lastJob = state?.updater.last_job;
    const finished = !!started && !running && !backendDown && lastJob && lastJob.status !== "running";

    React.useEffect(() => {
        if (!open) return;
        if (running || backendDown) {
            if (pane !== "progress") goTo("progress");
        } else if (finished) {
            const next: Pane = lastJob?.status === "succeeded" ? "done" : "failed";
            if (pane !== next) goTo(next);
        }
    }, [open, running, backendDown, finished, lastJob?.status, pane, goTo]);

    React.useEffect(() => {
        if (!open) setPane("overview");
    }, [open]);

    React.useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            if (document.querySelector("[data-floating], [role='alertdialog']")) return;
            e.preventDefault();
            onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    const check = useMutation({
        mutationFn: checkInstanceUpdate,
        onSuccess: (data) => {
            qc.setQueryData(INSTANCE_UPDATE_KEY, data);
            qc.setQueryData(INSTANCE_UPDATE_LOG_KEY, data);
            toast.success(
                data.update_available
                    ? (isHe ? "גרסה חדשה יותר זמינה לעדכון" : "A newer version is available")
                    : (isHe ? "המערכת מעודכנת לגרסה האחרונה" : "This instance is up to date"),
            );
        },
        onError: (err: unknown) => toast.error(buildError(err as AppError)),
    });

    const apply = useMutation({
        mutationFn: () => applyInstanceUpdate("latest"),
        onSuccess: (job: UpdateJob) => {
            markUpdateStarted(state?.running.version ?? "", state?.running.commit ?? job.from_commit);
            goTo("progress");
            void qc.invalidateQueries({ queryKey: INSTANCE_UPDATE_KEY });
            void qc.invalidateQueries({ queryKey: INSTANCE_UPDATE_LOG_KEY });
        },
        onError: (err: unknown) => toast.error(buildError(err as AppError)),
    });

    const job = state?.updater.job ?? state?.updater.last_job;
    const steps = state?.updater.mode === "command"
        ? (isHe ? COMMAND_STEPS_HE : COMMAND_STEPS)
        : (isHe ? COMPOSE_STEPS_HE : COMPOSE_STEPS);

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    key="overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onMouseDown={onClose}
                    className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/30 backdrop-blur-[2px] px-4"
                >
                    <motion.div
                        key="card"
                        role="dialog"
                        aria-modal="true"
                        aria-label={isHe ? "עדכון Warmbly" : "Update Warmbly"}
                        initial={{ y: 8, opacity: 0, scale: 0.985 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: 8, opacity: 0, scale: 0.985 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="w-full max-w-[560px] rounded-lg bg-white border border-slate-200 shadow-[0_24px_48px_-12px_rgba(15,23,42,0.18),0_8px_16px_-8px_rgba(15,23,42,0.1)] overflow-hidden flex flex-col max-h-[88dvh]"
                    >
                        <Header state={state} pane={pane} onClose={onClose} isHe={isHe} />

                        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                            <AnimatePresence mode="wait" initial={false} custom={direction}>
                                <motion.div
                                    key={pane}
                                    custom={direction}
                                    variants={paneVariants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                                    className="px-5 py-5"
                                >
                                    {pane === "overview" && (
                                        <OverviewPane state={state} loading={stateQ.isLoading && !state} isHe={isHe} />
                                    )}
                                    {pane === "confirm" && <ConfirmPane state={state} isHe={isHe} />}
                                    {pane === "progress" && (
                                        <ProgressPane
                                            steps={steps}
                                            job={job}
                                            backendDown={backendDown}
                                            isHe={isHe}
                                        />
                                    )}
                                    {pane === "done" && (
                                        <DonePane
                                            state={state}
                                            job={job}
                                            onAcknowledge={() => clearUpdateStarted()}
                                            isHe={isHe}
                                        />
                                    )}
                                    {pane === "failed" && <FailedPane job={job} isHe={isHe} />}
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        <Footer
                            pane={pane}
                            state={state}
                            checking={check.isPending}
                            applying={apply.isPending}
                            onCheck={() => check.mutate()}
                            onContinue={() => goTo("confirm")}
                            onBack={() => goTo("overview")}
                            onApply={() => apply.mutate()}
                            onRetry={() => {
                                clearUpdateStarted();
                                goTo("confirm");
                            }}
                            onClose={onClose}
                            isHe={isHe}
                        />
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

const paneVariants = {
    enter: (dir: 1 | -1) => ({ x: dir * 28, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: 1 | -1) => ({ x: dir * -28, opacity: 0 }),
};

// header

function Header({
    state,
    pane,
    onClose,
    isHe,
}: {
    state?: InstanceUpdate;
    pane: Pane;
    onClose: () => void;
    isHe?: boolean;
}) {
    const latest = state?.latest?.tag;
    const subtitle = isHe
        ? pane === "progress"
            ? "עדכון המערכת מתבצע כעת"
            : pane === "done"
              ? "העדכון הושלם בהצלחה"
              : pane === "failed"
                ? "העדכון נכשל"
                : state
                  ? `גרסה רצה ${runningLabel(state)}${latest ? ` · עדכנית ביותר ${latest}` : ""}`
                  : "בודק גרסה רצה…"
        : pane === "progress"
            ? "Updating this instance"
            : pane === "done"
              ? "Update finished"
              : pane === "failed"
                ? "Update failed"
                : state
                  ? `Running ${runningLabel(state)}${latest ? ` · latest ${latest}` : ""}`
                  : "Reading the running version";

    return (
        <div className="flex items-center gap-3 px-5 h-14 border-b border-slate-200 shrink-0">
            <span className="size-8 rounded-md bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
                <ArrowUpCircleIcon className="w-4 h-4" />
            </span>
            <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold text-slate-900 leading-tight">
                    {isHe ? "עדכון Warmbly" : "Update Warmbly"}
                </div>
                <div className="text-[12px] text-slate-500 truncate">{subtitle}</div>
            </div>
            <button
                type="button"
                onClick={onClose}
                aria-label={isHe ? "סגירה" : "Close"}
                className="size-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
                <XIcon className="w-4 h-4" />
            </button>
        </div>
    );
}

// panes

function OverviewPane({
    state,
    loading,
    isHe,
}: {
    state?: InstanceUpdate;
    loading: boolean;
    isHe?: boolean;
}) {
    if (loading || !state) {
        return (
            <div className="space-y-3">
                <div className="h-20 rounded-md bg-slate-100 animate-pulse" />
                <div className="h-4 w-2/3 rounded bg-slate-100 animate-pulse" />
                <div className="h-4 w-1/2 rounded bg-slate-100 animate-pulse" />
            </div>
        );
    }
    const { latest, updater } = state;
    const checkout = updater.checkout;
    const available = state.update_available;

    return (
        <div className="space-y-4">
            <div
                className={cn(
                    "rounded-md border p-4 flex items-center gap-4",
                    available ? "border-amber-200 bg-amber-50/60" : "border-emerald-200 bg-emerald-50/50",
                )}
            >
                <VersionBox label={isHe ? "גרסה נוכחית" : "Running"} value={runningLabel(state)} muted={available} />
                <ArrowRightIcon className={cn("w-4 h-4 shrink-0 rtl:rotate-180", available ? "text-amber-500" : "text-emerald-500")} />
                <VersionBox
                    label={isHe ? (available ? "גרסה זמינה" : "העדכנית ביותר") : (available ? "Available" : "Latest")}
                    value={latest?.tag ?? (checkout && !checkout.detached ? `${checkout.branch} head` : (isHe ? "לא ידוע" : "unknown"))}
                    accent={available}
                />
                <div className="ms-auto text-end">
                    <span
                        className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em]",
                            available
                                ? "border-amber-300 bg-white text-amber-700"
                                : "border-emerald-300 bg-white text-emerald-700",
                        )}
                    >
                        {available ? (
                            <>
                                <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                                {isHe ? "עדכון זמין" : "Update"}
                            </>
                        ) : (
                            <>
                                <CheckIcon className="w-3 h-3" />
                                {isHe ? "מעודכן" : "Current"}
                            </>
                        )}
                    </span>
                </div>
            </div>

            <dl className="text-[12.5px] divide-y divide-slate-100 border-y border-slate-100">
                <Row label={isHe ? "גרסת שחרור" : "Release"}>
                    {latest ? (
                        <span className="inline-flex flex-wrap items-center gap-2">
                            <span className="font-medium text-slate-900">{latest.name || latest.tag}</span>
                            {latest.published_at && (
                                <span className="text-slate-500">
                                    {isHe ? `פורסם ${relative(latest.published_at, isHe)}` : `published ${relative(latest.published_at)}`}
                                </span>
                            )}
                            {latest.html_url && (
                                <a
                                    href={latest.html_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-sky-700 hover:underline"
                                >
                                    {isHe ? "הערות שחרור" : "Release notes"}
                                    <ExternalLinkIcon className="w-3 h-3" />
                                </a>
                            )}
                        </span>
                    ) : state.check_error ? (
                        <span className="text-amber-700">
                            {isHe ? `לא ניתן לקרוא שחרורים: ${state.check_error}` : `Could not read releases: ${state.check_error}`}
                        </span>
                    ) : (
                        <span className="text-slate-500">
                            {state.enabled
                                ? (isHe ? `לא נמצאו שחרורים עבור ${state.repo}` : `No release found for ${state.repo}`)
                                : (isHe ? "בדיקת שחרורים כבויה" : "Release check is off")}
                        </span>
                    )}
                </Row>
                {checkout && (
                    <Row label={isHe ? "ענף מקור" : "Checkout"}>
                        <span className="inline-flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 font-mono text-[11.5px] text-slate-700" dir="ltr">
                                <GitBranchIcon className="w-3 h-3 text-slate-400" />
                                {checkout.detached ? (isHe ? "נעוץ" : "pinned") : checkout.branch}@{checkout.commit.slice(0, 7)}
                            </span>
                            {!checkout.detached && (
                                <span className="text-slate-500">
                                    {checkout.behind > 0
                                        ? (isHe
                                            ? `${checkout.behind} קומיטים מאחור`
                                            : `${checkout.behind} commit${checkout.behind === 1 ? "" : "s"} behind`)
                                        : (isHe ? "תואם למקור" : "matches the remote")}
                                </span>
                            )}
                            {checkout.dirty && (
                                <span className="text-amber-700">
                                    {isHe ? "קיימים שינויים מקומיים" : "local changes present"}
                                </span>
                            )}
                        </span>
                    </Row>
                )}
                <Row label={isHe ? "מנגנון עדכון" : "Updater"}>
                    {updater.status === "ok" && (
                        <span className="inline-flex items-center gap-1.5 text-slate-700">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            {isHe ? "מוכן לפעולה" : "ready"}
                            <span className="text-slate-400">({updater.mode})</span>
                        </span>
                    )}
                    {updater.status === "off" && (
                        <span className="text-slate-500">{isHe ? "לא מוגדר" : "not configured"}</span>
                    )}
                    {updater.status === "unreachable" && (
                        <span className="inline-flex items-center gap-1.5 text-amber-700">
                            <span className="size-1.5 rounded-full bg-amber-500" />
                            {isHe ? "לא זמין" : "unreachable"}
                        </span>
                    )}
                </Row>
                <Row label={isHe ? "נבדק לאחרונה" : "Checked"}>
                    <span className="text-slate-500">
                        {state.checked_at
                            ? (isHe
                                ? `${relative(state.checked_at, isHe)}, כל ${state.interval}`
                                : `${relative(state.checked_at)}, every ${state.interval}`)
                            : (isHe ? "טרם נבדק" : "not yet")}
                    </span>
                </Row>
            </dl>

            {updater.status !== "ok" && (
                <Notice tone={updater.status === "unreachable" ? "warning" : "info"}>
                    <div className="font-medium text-slate-900">
                        {updater.status === "unreachable"
                            ? (isHe ? "מנגנון העדכון אינו מגיב" : "The updater is not answering")
                            : (isHe ? "עדכונים מופעלים ישירות מהטרמינל" : "Updates run from a shell here")}
                    </div>
                    <div className="mt-0.5">
                        {updater.status === "unreachable"
                            ? updater.error
                            : (isHe
                                ? "לא הוגדר שירות מעדכן אוטומטי בסביבה זו, ניתן לבצע עדכון בפונדקאי (Host):"
                                : "No updater is configured on this instance, so apply updates on the host:")}
                    </div>
                    <code className="mt-1.5 block rounded bg-white/80 border border-slate-200 px-2 py-1 font-mono text-[11.5px] text-slate-800" dir="ltr">
                        git pull && make up
                    </code>
                    <a
                        href={DOCS_UPDATES}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1 text-sky-700 hover:underline"
                    >
                        {isHe ? "כיצד להגדיר מעדכן אוטומטי" : "How to enable the updater"}
                        <ExternalLinkIcon className="w-3 h-3" />
                    </a>
                </Notice>
            )}
            {checkout?.dirty && updater.status === "ok" && (
                <Notice tone="warning">
                    {isHe
                        ? "במאגר ישנם שינויים מקומיים שלא נשמרו. המעדכן דורש ביצוע commit או stash לפני עדכון."
                        : "The checkout has local modifications. The updater refuses to move it until they are committed or stashed."}
                </Notice>
            )}
        </div>
    );
}

function ConfirmPane({ state, isHe }: { state?: InstanceUpdate; isHe?: boolean }) {
    const target = state?.latest?.tag;
    const items = isHe
        ? [
            {
                icon: GitBranchIcon,
                title: target ? `משיכת ${target} ממאגר הקוד` : "משיכת העדכונים האחרונים ממאגר הקוד",
                text: "הקוד מתעדכן קדימה; שום דבר שנשמר במאגר לא יידרס.",
            },
            {
                icon: HammerIcon,
                title: "בנייה מחדש והפעלה של כל שירות",
                text: "תהליך זה נמשך מספר דקות. מסד הנתונים, Redis ו-NATS נשארים פעילים ברקע; רק מה שהשתנה מוקם מחדש.",
            },
            {
                icon: SendIcon,
                title: "השליחה והסנכרון יושהו ויתחדשו עצמאית",
                text: "שום דבר בתהליך אינו אובד: הקמפיינים ותהליך החימום ימשיכו מהמסד מיד עם שובם של ה-workers לפעילות.",
            },
            {
                icon: DatabaseIcon,
                title: "מיגרציות מוחלות עם חזרת שרת ה-API",
                text: "המיגרציות רצות קדימה ובטוחות לחלוטין לכל הנתונים הקיימים.",
            },
            {
                icon: ShieldCheckIcon,
                title: "ההתחברות שלך נשמרת",
                text: "כרטיסייה זו תתחבר מחדש ותתרענן אוטומטית ברגע שהגרסה החדשה תענה.",
            },
        ]
        : [
            {
                icon: GitBranchIcon,
                title: target ? `Pull ${target} from the repository` : "Pull the latest changes from the repository",
                text: "The checkout moves forward; nothing is overwritten that was committed.",
            },
            {
                icon: HammerIcon,
                title: "Rebuild and restart every service",
                text: "Takes a few minutes. Postgres, Redis and NATS stay up; only what changed is recreated.",
            },
            {
                icon: SendIcon,
                title: "Sending and syncing pause, then resume",
                text: "Nothing in flight is lost: campaigns and warmup pick up from the database when the workers are back.",
            },
            {
                icon: DatabaseIcon,
                title: "Migrations apply when the backend comes back",
                text: "They are forward-only and safe with data in place. A backup before an update is still the one you are glad to have.",
            },
            {
                icon: ShieldCheckIcon,
                title: "You stay signed in",
                text: "This tab reconnects on its own and reloads once the new version answers.",
            },
        ];

    return (
        <div className="space-y-4">
            <div className="text-[13px] text-slate-700">
                {isHe ? "להלן הפעולות שיתבצעו בהמשך:" : "Here is what happens when you continue."}
            </div>
            <ul className="space-y-2.5">
                {items.map((it, i) => (
                    <motion.li
                        key={it.title}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.04 * i, duration: 0.2 }}
                        className="flex items-start gap-3"
                    >
                        <span className="mt-0.5 size-7 rounded-md bg-slate-50 border border-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                            <it.icon className="w-3.5 h-3.5" />
                        </span>
                        <div className="min-w-0">
                            <div className="text-[12.5px] font-medium text-slate-900">{it.title}</div>
                            <div className="text-[12px] text-slate-500 leading-relaxed">{it.text}</div>
                        </div>
                    </motion.li>
                ))}
            </ul>
        </div>
    );
}

function ProgressPane({
    steps,
    job,
    backendDown,
    isHe,
}: {
    steps: StepDef[];
    job?: UpdateJob;
    backendDown: boolean;
    isHe?: boolean;
}) {
    const current = backendDown ? "wait" : (job?.step ?? "starting");
    const idx = Math.max(0, steps.findIndex((s) => s.id === current));
    const percent = backendDown
        ? Math.round(((steps.length - 0.5) / steps.length) * 100)
        : Math.round(((idx + 0.5) / steps.length) * 100);
    const [showLog, setShowLog] = React.useState(false);
    const lines = job?.log ?? [];

    return (
        <div className="space-y-4">
            <div>
                <div className="flex items-center justify-between text-[12px] mb-1.5">
                    <span className="font-medium text-slate-900 inline-flex items-center gap-2">
                        <Loader2Icon className="w-3.5 h-3.5 animate-spin text-sky-600" />
                        {backendDown
                            ? (isHe ? "מתחבר מחדש לשרת ה-API" : "Reconnecting to the backend")
                            : (steps[idx]?.label ?? (isHe ? "מתחיל…" : "Starting"))}
                    </span>
                    <span className="text-slate-500 tabular-nums">{percent}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <motion.div
                        className="h-full rounded-full bg-sky-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${percent}%` }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    />
                </div>
                <div className="mt-1.5 text-[12px] text-slate-500">
                    {backendDown
                        ? (isHe
                            ? "השירותים מופעלים כעת מחדש. תהליך זה אורך כדקה; ניתן להשאיר את הלשונית פתוחה או לחזור בהמשך."
                            : "The services are restarting. This can take a minute; keep the tab open or come back later, the result is kept.")
                        : (isHe
                            ? "ניתן לסגור חלון זה ולהמשיך לעבוד. חיווי העדכון בראש המסך ימשיך להציג את ההתקדמות."
                            : "You can close this and keep working. The pill in the header follows the update.")}
                </div>
            </div>

            <ol className="space-y-1">
                {steps.map((s, i) => {
                    const done = i < idx || (backendDown && s.id !== "wait");
                    const active = i === idx && !done;
                    return (
                        <li
                            key={s.id}
                            className={cn(
                                "flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors",
                                active && "bg-sky-50/70",
                            )}
                        >
                            <span
                                className={cn(
                                    "size-6 rounded-full flex items-center justify-center shrink-0 border transition-colors",
                                    done && "bg-emerald-500 border-emerald-500 text-white",
                                    active && "bg-white border-sky-400 text-sky-600",
                                    !done && !active && "bg-white border-slate-200 text-slate-300",
                                )}
                            >
                                <AnimatePresence mode="wait" initial={false}>
                                    {done ? (
                                        <motion.span
                                            key="done"
                                            initial={{ scale: 0.4, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            exit={{ scale: 0.4, opacity: 0 }}
                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        >
                                            <CheckIcon className="w-3.5 h-3.5" />
                                        </motion.span>
                                    ) : active ? (
                                        <motion.span key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                            <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
                                        </motion.span>
                                    ) : (
                                        <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                            <s.icon className="w-3 h-3" />
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </span>
                            <div className="min-w-0 flex-1">
                                <div
                                    className={cn(
                                        "text-[12.5px] leading-tight",
                                        done ? "text-slate-500" : active ? "text-slate-900 font-medium" : "text-slate-400",
                                    )}
                                >
                                    {s.label}
                                </div>
                                {active && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        className="text-[11.5px] text-slate-500"
                                    >
                                        {backendDown && s.id === "wait"
                                            ? (isHe ? "ממתין לתגובת שרת ה-API החדש" : "Waiting for the new backend to answer")
                                            : s.hint}
                                    </motion.div>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ol>

            <LogToggle open={showLog} onToggle={() => setShowLog((v) => !v)} count={lines.length} isHe={isHe} />
            {showLog && <LogPanel lines={lines} isHe={isHe} />}
        </div>
    );
}

function DonePane({
    state,
    job,
    onAcknowledge,
    isHe,
}: {
    state?: InstanceUpdate;
    job?: UpdateJob;
    onAcknowledge: () => void;
    isHe?: boolean;
}) {
    const [seconds, setSeconds] = React.useState(10);
    React.useEffect(() => {
        const id = setInterval(() => {
            setSeconds((s) => {
                if (s <= 1) {
                    clearInterval(id);
                    onAcknowledge();
                    window.location.reload();
                    return 0;
                }
                return s - 1;
            });
        }, 1000);
        return () => clearInterval(id);
    }, [onAcknowledge]);

    const [showLog, setShowLog] = React.useState(false);
    return (
        <div className="space-y-4">
            <div className="flex flex-col items-center text-center py-2">
                <motion.span
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 380, damping: 22 }}
                    className="size-14 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center"
                >
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
                        <CheckIcon className="w-7 h-7" strokeWidth={2.5} />
                    </motion.span>
                </motion.span>
                <div className="mt-3 text-[15px] font-semibold text-slate-900">
                    {isHe
                        ? `עודכן בהצלחה ל-${state ? runningLabel(state) : "גרסה החדשה"}`
                        : `Updated to ${state ? runningLabel(state) : "the new version"}`}
                </div>
                <div className="mt-1 text-[12.5px] text-slate-500 max-w-[36ch]">
                    {isHe
                        ? `כל השירותים חזרו לפעילות תקינה. הדף יטען מחדש בעוד ${seconds} שניות לקבלת ממשק הניהול המעודכן.`
                        : `Every service is back and sending has resumed. Reloading in ${seconds}s to pick up the new dashboard.`}
                </div>
                {job?.from_commit && job?.to_commit && (
                    <div className="mt-2 font-mono text-[11px] text-slate-400" dir="ltr">
                        {job.from_commit.slice(0, 7)} <span className="text-slate-300">→</span> {job.to_commit.slice(0, 7)}
                    </div>
                )}
            </div>
            <LogToggle open={showLog} onToggle={() => setShowLog((v) => !v)} count={job?.log?.length ?? 0} isHe={isHe} />
            {showLog && <LogPanel lines={job?.log ?? []} isHe={isHe} />}
        </div>
    );
}

function FailedPane({ job, isHe }: { job?: UpdateJob; isHe?: boolean }) {
    return (
        <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50/60 p-3">
                <motion.span
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 380, damping: 22 }}
                    className="size-8 rounded-full bg-white border border-red-200 text-red-600 flex items-center justify-center shrink-0"
                >
                    <XIcon className="w-4 h-4" />
                </motion.span>
                <div className="min-w-0 text-[12.5px] leading-relaxed text-red-900">
                    <div className="font-semibold">{isHe ? "העדכון לא הושלם" : "The update did not finish"}</div>
                    <div className="mt-0.5">{job?.error ?? (isHe ? "עיין ביומן הריצה להלן." : "See the log below.")}</div>
                    <div className="mt-1 text-red-800/80">
                        {job?.step && job.step !== "restart" && job.step !== "wait"
                            ? (isHe
                                ? "התהליך נעצר לפני הפעלה מחדש של שירותים כלשהם, ולכן הגרסה הקודמת עדיין פעילה."
                                : "It stopped before anything restarted, so the previous version is still running.")
                            : (isHe
                                ? "בדוק את סטטוס השירותים בפונדקאי לפני ניסיון חוזר."
                                : "Check the services on the host before trying again.")}
                    </div>
                </div>
            </div>
            <LogPanel lines={job?.log ?? []} isHe={isHe} />
        </div>
    );
}

// footer

function Footer({
    pane,
    state,
    checking,
    applying,
    onCheck,
    onContinue,
    onBack,
    onApply,
    onRetry,
    onClose,
    isHe,
}: {
    pane: Pane;
    state?: InstanceUpdate;
    checking: boolean;
    applying: boolean;
    onCheck: () => void;
    onContinue: () => void;
    onBack: () => void;
    onApply: () => void;
    onRetry: () => void;
    onClose: () => void;
    isHe?: boolean;
}) {
    const canApply = !!state && state.updater.status === "ok" && state.update_available && !state.updater.checkout?.dirty;
    return (
        <div className="flex items-center gap-2 px-5 h-14 border-t border-slate-200 bg-slate-50/60 shrink-0">
            <a
                href={DOCS_UPDATES}
                target="_blank"
                rel="noreferrer"
                className="text-[12px] text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
            >
                {isHe ? "איך עובדים עדכונים" : "How updates work"}
                <ExternalLinkIcon className="w-3 h-3" />
            </a>
            <div className="flex-1" />
            {pane === "overview" && (
                <>
                    <GhostButton onClick={onCheck} disabled={checking}>
                        <RefreshCwIcon className={cn("w-3.5 h-3.5", checking && "animate-spin")} />
                        {checking ? (isHe ? "בודק…" : "Checking") : (isHe ? "בדוק כעת" : "Check now")}
                    </GhostButton>
                    {canApply ? (
                        <PrimaryButton onClick={onContinue}>
                            {isHe ? "עדכן והפעל מחדש" : "Update and restart"}
                            <ArrowRightIcon className="w-3.5 h-3.5 rtl:rotate-180" />
                        </PrimaryButton>
                    ) : (
                        <PrimaryButton onClick={onClose}>{isHe ? "סיום" : "Done"}</PrimaryButton>
                    )}
                </>
            )}
            {pane === "confirm" && (
                <>
                    <GhostButton onClick={onBack} disabled={applying}>
                        <ChevronLeftIcon className="w-3.5 h-3.5 rtl:rotate-180" />
                        {isHe ? "חזרה" : "Back"}
                    </GhostButton>
                    <PrimaryButton onClick={onApply} disabled={applying} tone="amber">
                        {applying ? <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> : <RotateCwIcon className="w-3.5 h-3.5" />}
                        {applying ? (isHe ? "מתחיל…" : "Starting") : (isHe ? "עדכן כעת" : "Update now")}
                    </PrimaryButton>
                </>
            )}
            {pane === "progress" && (
                <GhostButton onClick={onClose}>
                    {isHe ? "המשך ריצה ברקע" : "Keep running in the background"}
                </GhostButton>
            )}
            {pane === "done" && (
                <>
                    <GhostButton onClick={onClose}>{isHe ? "מאוחר יותר" : "Later"}</GhostButton>
                    <PrimaryButton onClick={() => window.location.reload()}>{isHe ? "טען מחדש כעת" : "Reload now"}</PrimaryButton>
                </>
            )}
            {pane === "failed" && (
                <>
                    <GhostButton onClick={onClose}>{isHe ? "סגירה" : "Close"}</GhostButton>
                    <PrimaryButton onClick={onRetry}>
                        <RotateCwIcon className="w-3.5 h-3.5" />
                        {isHe ? "נסה שוב" : "Try again"}
                    </PrimaryButton>
                </>
            )}
        </div>
    );
}

// bits

function VersionBox({ label, value, accent, muted }: { label: string; value: string; accent?: boolean; muted?: boolean }) {
    return (
        <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
            <div
                className={cn(
                    "text-[15px] font-semibold tracking-tight truncate",
                    accent ? "text-amber-800" : muted ? "text-slate-500" : "text-slate-900",
                )}
            >
                {value}
            </div>
        </div>
    );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-2">
            <dt className="text-slate-500">{label}</dt>
            <dd className="min-w-0 text-slate-800">{children}</dd>
        </div>
    );
}

function Notice({ tone, children }: { tone: "info" | "warning"; children: React.ReactNode }) {
    return (
        <div
            className={cn(
                "flex items-start gap-3 rounded-md border p-3 text-[12.5px] leading-relaxed",
                tone === "warning" ? "border-amber-200 bg-amber-50/60 text-amber-900" : "border-sky-200 bg-sky-50/60 text-sky-900",
            )}
        >
            <AlertTriangleIcon className="mt-0.5 w-4 h-4 shrink-0" />
            <div className="min-w-0 flex-1">{children}</div>
        </div>
    );
}

function LogToggle({
    open,
    onToggle,
    count,
    isHe,
}: {
    open: boolean;
    onToggle: () => void;
    count: number;
    isHe?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className="w-full flex items-center justify-between text-[12px] text-slate-500 hover:text-slate-800 py-1"
        >
            <span className="inline-flex items-center gap-1 font-medium">
                <ChevronDownIcon className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
                {isHe ? "יומן עדכון" : "Updater log"}
                <span className="text-slate-400 font-normal">({count} {isHe ? "שורות" : "lines"})</span>
            </span>
            <span className="text-[11px] text-slate-400">{open ? (isHe ? "הסתר" : "Hide") : (isHe ? "הצג" : "Show")}</span>
        </button>
    );
}

function LogPanel({ lines, isHe }: { lines: string[]; isHe?: boolean }) {
    const ref = React.useRef<HTMLPreElement>(null);
    React.useEffect(() => {
        const el = ref.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [lines.length]);
    return (
        <pre
            ref={ref}
            dir="ltr"
            className="max-h-56 overflow-auto rounded-md border border-slate-200 bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-200"
        >
            {lines.length > 0 ? lines.join("\n") : (isHe ? "ממתין לפלט…" : "Waiting for output")}
        </pre>
    );
}

function GhostButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12.5px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
            {children}
        </button>
    );
}

function PrimaryButton({
    children,
    onClick,
    disabled,
    tone = "dark",
}: {
    children: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    tone?: "dark" | "amber";
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md text-[12.5px] font-medium text-white transition-colors disabled:opacity-60 disabled:pointer-events-none",
                tone === "amber" ? "bg-amber-600 hover:bg-amber-700" : "bg-slate-900 hover:bg-slate-800",
            )}
        >
            {children}
        </button>
    );
}

function relative(at: Date | string, isHe = false): string {
    const diff = Date.now() - new Date(at).getTime();
    const min = Math.round(diff / 60_000);
    if (min < 1) return isHe ? "ממש עכשיו" : "just now";
    if (min < 60) return isHe ? `לפני ${min} דק׳` : `${min} min ago`;
    const h = Math.round(min / 60);
    if (h < 24) return isHe ? `לפני ${h} ${h === 1 ? "שעה" : "שעות"}` : `${h} hour${h === 1 ? "" : "s"} ago`;
    const d = Math.round(h / 24);
    if (d < 30) return isHe ? `לפני ${d} ${d === 1 ? "יום" : "ימים"}` : `${d} day${d === 1 ? "" : "s"} ago`;
    return new Date(at).toLocaleDateString(isHe ? "he-IL" : undefined);
}
