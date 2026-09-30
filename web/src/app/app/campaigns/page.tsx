import { NoAccess } from "@/components/layout/NoAccess";
import { usePermission } from "@/hooks/usePermission";
import { useUserProfile } from "@/hooks/context/user";
import useCampaigns from "@/lib/api/hooks/app/campaigns/useCampaigns";
import useStartCampaign from "@/lib/api/hooks/app/campaigns/useStartCampaign";
import useStopCampaign from "@/lib/api/hooks/app/campaigns/useStopCampaign";
import useUpdateCampaign from "@/lib/api/hooks/app/campaigns/useUpdateCampaign";
import { useConfirm } from "@/hooks/context/confirm";
import { NewCampaignDialog } from "@/components/app/campaigns/NewCampaignDialog";
import AdvisorRowFlag from "@/components/app/advisor/AdvisorRowFlag";
import AdvisorSummaryBar from "@/components/app/advisor/AdvisorSummaryBar";
import { useAdvisorEntityIndex } from "@/lib/api/hooks/app/advisor/useAdvisor";
import LaunchCampaignDialog from "@/components/app/campaigns/LaunchCampaignDialog";
import CampaignActionsMenu from "@/components/app/campaigns/CampaignActionsMenu";
import toast from "react-hot-toast";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import type Campaign from "@/lib/api/models/app/campaigns/Campaign";
import type Folder from "@/lib/api/models/app/Folder";
import { cn, hexToRgba } from "@/lib/utils";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
    AlertTriangleIcon,
    CalendarIcon,
    CheckIcon,
    CheckCircle2Icon,
    FileTextIcon,
    FilterIcon,
    FolderIcon,
    HourglassIcon,
    Loader2Icon,
    type LucideIcon,
    PauseIcon,
    PlayIcon,
    PlusIcon,
    RefreshCcwIcon,
    Settings2Icon,
} from "lucide-react";
import {
    EmptyBlock,
    Page,
    PageBody,
    PageTopbar,
    SectionBar,
    Stat,
    StatStrip,
    TopbarAction,
} from "@/components/layout/Page";
import { SearchInput } from "@/components/ui/field";
import {
    campaignDisplayLabel,
    CAMPAIGN_IDLE_TONE,
    campaignDisplayTone,
    campaignStatusBucket as statusBucket,
    campaignStatusTone as statusTone,
    isIdleCampaign,
} from "@/components/app/campaigns/status";
import {
    PopoverMenu,
    PopoverMenuContent,
    PopoverMenuItem,
    PopoverMenuLabel,
    PopoverMenuSeparator,
    PopoverMenuTrigger,
    SelectButton,
} from "@/components/ui/popover-menu";

type StatusFilter = "all" | "active" | "paused" | "draft" | "completed";
type SortMode = "newest" | "oldest" | "name";

// Per-state label + leading mark for a campaign row. "active" renders the
// animated dot-grid loader; every other state is a 14px lucide icon so the
// fixed-width leading slot keeps each row's name aligned. The label/tone maps
// live in components/app/campaigns/status so pickers share them.
function CampaignStatusMark({ status, idle }: { status: string; idle?: boolean }) {
    const tone = statusTone(status);
    if (idle) {
        return <HourglassIcon className={cn("w-3.5 h-3.5", CAMPAIGN_IDLE_TONE)} aria-label="ממתין ללידים" />;
    }
    if (status === "active") {
        return <span className={cn("campaign-grid", tone)} aria-hidden title="שולח כעת" />;
    }
    let Icon: LucideIcon = FileTextIcon;
    let title = "טיוטה - טרם החל";
    if (status === "completed") {
        Icon = CheckCircle2Icon;
        title = "הסתיים";
    } else if (status === "paused") {
        Icon = PauseIcon;
        title = "מושהה";
    } else if (status === "paused_guardrail") {
        Icon = AlertTriangleIcon;
        title = "הושהה אוטומטית - מנגנון ההגנה על עבירות הופעל";
    } else if (status === "paused_undeliverable") {
        Icon = AlertTriangleIcon;
        title = "מושהה - אימות כתובות דחה את יתרת הלידים";
    } else if (status === "paused_no_accounts" || status === "paused_trial_expired") {
        Icon = AlertTriangleIcon;
        title = status === "paused_no_accounts" ? "מושהה - אין תיבות דואר שולחות" : "מושהה - תקופת הניסיון פגה";
    }
    return <Icon className={cn("w-3.5 h-3.5", tone)} aria-label={title} />;
}

// Read-only chips showing which folders a campaign belongs to — resolves the
// campaign's folder ids against the user's folders, shows up to 2 then "+N".
// Each chip is tinted with the folder's own color for a quick visual read.
function CampaignFolderChips({ campaign, folders }: { campaign: Campaign; folders: Folder[] }) {
    const mine = (campaign.folders ?? [])
        .map((id) => folders.find((f) => f.id === id))
        .filter((f): f is Folder => !!f);
    if (mine.length === 0) return null;
    const shown = mine.slice(0, 2);
    const extra = mine.length - shown.length;
    return (
        <span className="hidden sm:flex items-center gap-1.5 shrink-0">
            {shown.map((f) => (
                <span
                    key={f.id}
                    title={f.title}
                    className="inline-flex items-center gap-1.5 h-[18px] ps-1.5 pe-2 rounded-full text-[10.5px] font-medium text-slate-700 max-w-[130px]"
                    style={{ backgroundColor: hexToRgba(f.color, 0.16) }}
                >
                    <span
                        className="inline-block size-2 rounded-full ring-1 ring-black/5 shrink-0"
                        style={{ backgroundColor: f.color }}
                    />
                    <span className="truncate">{f.title}</span>
                </span>
            ))}
            {extra > 0 && (
                <span
                    className="inline-flex items-center h-[18px] px-1.5 rounded-full text-[10.5px] font-medium text-slate-500 bg-slate-100"
                    title={mine.slice(2).map((f) => f.title).join(", ")}
                >
                    +{extra}
                </span>
            )}
        </span>
    );
}

// Per-row "move to folder" control: a folder button (revealed on hover, or
// kept visible + sky when the campaign is already filed) that opens a popover
// of the user's folders. Toggling an item PATCHes the campaign's `folders`
// array; the menu stays open so several folders can be toggled at once.
function CampaignFolderMenu({ campaign, folders }: { campaign: Campaign; folders: Folder[] }) {
    const p = useUserProfile();
    const update = useUpdateCampaign(campaign.id);
    const current = campaign.folders ?? [];
    const inCount = current.length;

    function setFolders(next: string[]) {
        update.mutate(
            { folders: next },
            { onError: (e) => toast.error(buildError(e as unknown as AppError)) },
        );
    }

    return (
        <PopoverMenu align="end">
            <PopoverMenuTrigger asChild>
                <button
                    type="button"
                    aria-label="העבר לתיקייה"
                    title={
                        inCount > 0
                            ? `ב-${inCount} תיקיות`
                            : "העבר לתיקייה"
                    }
                    className={cn(
                        "size-6 rounded flex items-center justify-center transition-opacity shrink-0",
                        inCount > 0
                            ? "text-sky-600 hover:bg-sky-50 opacity-100"
                            : "text-slate-400 hover:text-slate-900 hover:bg-slate-100 opacity-100 md:opacity-0 md:group-hover:opacity-100",
                    )}
                >
                    <FolderIcon className="w-3.5 h-3.5" />
                </button>
            </PopoverMenuTrigger>
            <PopoverMenuContent minWidth={200}>
                <PopoverMenuLabel>תיקיות</PopoverMenuLabel>
                {folders.length === 0 ? (
                    <PopoverMenuItem
                        onSelect={() => p.setFoldersEdit(true)}
                        icon={<PlusIcon className="w-3 h-3" />}
                    >
                        צור תיקייה
                    </PopoverMenuItem>
                ) : (
                    folders.map((f) => {
                        const isIn = current.includes(f.id);
                        return (
                            <PopoverMenuItem
                                key={f.id}
                                closeOnSelect={false}
                                selected={isIn}
                                onSelect={() =>
                                    setFolders(
                                        isIn
                                            ? current.filter((x) => x !== f.id)
                                            : [...current, f.id],
                                    )
                                }
                                icon={
                                    <span
                                        className="inline-block size-2.5 rounded-full ring-1 ring-black/5"
                                        style={{ backgroundColor: f.color }}
                                    />
                                }
                                trailing={
                                    isIn ? (
                                        <CheckIcon className="w-3.5 h-3.5 text-sky-600" strokeWidth={2.5} />
                                    ) : null
                                }
                            >
                                {f.title}
                            </PopoverMenuItem>
                        );
                    })
                )}
                {inCount > 0 && (
                    <>
                        <PopoverMenuSeparator />
                        <PopoverMenuItem danger onSelect={() => setFolders([])}>
                            הסר מכל התיקיות
                        </PopoverMenuItem>
                    </>
                )}
                <PopoverMenuSeparator />
                <PopoverMenuItem
                    onSelect={() => p.setFoldersEdit(true)}
                    icon={<Settings2Icon className="w-3 h-3" />}
                >
                    ניהול תיקיות
                </PopoverMenuItem>
            </PopoverMenuContent>
        </PopoverMenu>
    );
}

export default function CampaignsPage() {
    const { t } = useTranslation(["campaigns", "common"]);
    const p = useUserProfile();
    const confirm = useConfirm();
    const canView = usePermission("VIEW_CAMPAIGNS");
    const canManage = usePermission("MANAGE_CAMPAIGNS");
    const startCampaign = useStartCampaign();
    const stopCampaign = useStopCampaign();
    const [folder, setFolder] = useState<string>("");
    const [query, setQuery] = useState<string>("");
    const [status, setStatus] = useState<StatusFilter>("all");
    const [sort, setSort] = useState<SortMode>("newest");
    const [newOpen, setNewOpen] = useState<boolean>(false);
    const [draftId, setDraftId] = useState<string | null>(null);
    const [launchTarget, setLaunchTarget] = useState<Campaign | null>(null);

    async function toggleCampaign(id: string, currentStatus: string) {
        try {
            if (currentStatus === "active") {
                await toast.promise(stopCampaign.mutateAsync(id), {
                    loading: "משהה קמפיין…",
                    success: "הקמפיין הושהה",
                    error: (e: AppError) => buildError(e),
                });
            } else {
                await toast.promise(startCampaign.mutateAsync(id), {
                    loading: "מפעיל קמפיין…",
                    success: "הקמפיין הופעל",
                    error: (e: AppError) => buildError(e),
                });
            }
        } catch {
            /* toast.promise already surfaced */
        }
    }

    // Row start/pause: pause asks first, start opens the launch dialog.
    function toggleRow(c: Campaign) {
        const cstatus = c.status ?? "draft";
        if (cstatus === "active") {
            confirm?.show(`האם להשהות את ${c.name}?`, () => toggleCampaign(c.id, cstatus));
        } else {
            setLaunchTarget(c);
        }
    }

    const campaignsData = useCampaigns({ query, folder });
    // One query for the surface; a step's copy problem indexes onto its parent
    // campaign, so it flags the row even though the step has no row of its own.
    const advisor = useAdvisorEntityIndex("campaigns");
    const campaigns = campaignsData.campaigns ?? [];

    const folders = p.user.folders ?? [];
    const activeFolder = folders.find((f) => f.id === folder);

    const filtered = useMemo(() => {
        const base = campaigns.filter(
            (c) => status === "all" || statusBucket(c.status) === status,
        );
        const sorted = [...base];
        if (sort === "newest") {
            sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        } else if (sort === "oldest") {
            sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        } else {
            sorted.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
        }
        return sorted;
    }, [campaigns, status, sort]);

    const counts = useMemo(() => {
        const stats = { total: campaigns.length, active: 0, paused: 0, draft: 0, completed: 0 };
        for (const c of campaigns) {
            stats[statusBucket(c.status)]++;
        }
        return stats;
    }, [campaigns]);

    if (!canView) return <NoAccess feature="קמפיינים" permissionLabel="צפייה בקמפיינים" />;

    return (
        <Page>
            <PageTopbar
                eyebrow={t("campaigns:title", "קמפיינים")}
                subtitle={
                    campaignsData.isPending
                        ? "טוען..."
                        : campaignsData.isError
                            ? "שגיאה בטעינה"
                            : `${campaigns.length} ${campaigns.length === 1 ? "קמפיין" : "קמפיינים"}`
                }
            >
                <TopbarAction
                    variant="ghost"
                    icon={<Settings2Icon className="w-3 h-3" />}
                    onClick={() => p.setFoldersEdit(true)}
                >
                    תיקיות
                </TopbarAction>
                <TopbarAction
                    icon={<PlusIcon className="w-3 h-3" />}
                    onClick={() => setNewOpen(true)}
                >
                    קמפיין חדש
                </TopbarAction>
            </PageTopbar>

            <StatStrip cols={5}>
                <Stat
                    label="הכל"
                    value={counts.total}
                    sub="קמפיינים"
                    onClick={() => setStatus("all")}
                />
                <Stat
                    label="פעילים"
                    value={counts.active}
                    sub="שולחים כעת"
                    accent={counts.active > 0}
                    onClick={() => setStatus("active")}
                />
                <Stat
                    label="מושהים"
                    value={counts.paused}
                    sub="ניתנים לחידוש"
                    onClick={() => setStatus("paused")}
                />
                <Stat
                    label="טיוטות"
                    value={counts.draft}
                    sub="טרם הופעלו"
                    onClick={() => setStatus("draft")}
                />
                <Stat
                    label="הושלמו"
                    value={counts.completed}
                    sub="הסתיימו"
                    last
                    onClick={() => setStatus("completed")}
                />
            </StatStrip>

            <SectionBar
                label={
                    status === "all"
                        ? "כל הקמפיינים"
                        : status === "active"
                        ? "קמפיינים פעילים"
                        : status === "paused"
                        ? "קמפיינים מושהים"
                        : status === "draft"
                        ? "טיוטות"
                        : "קמפיינים שהסתיימו"
                }
                count={filtered.length}
            >
                <SearchInput
                    value={query}
                    onChange={setQuery}
                    placeholder="חיפוש קמפיינים…"
                    className="w-full sm:w-56"
                />

                <PopoverMenu align="end">
                    <PopoverMenuTrigger asChild>
                        <SelectButton
                            icon={<FolderIcon className="w-3.5 h-3.5" />}
                            label={activeFolder?.title ?? "כל התיקיות"}
                        />
                    </PopoverMenuTrigger>
                    <PopoverMenuContent minWidth={200}>
                        <PopoverMenuLabel>תיקיות</PopoverMenuLabel>
                        <PopoverMenuItem
                            onSelect={() => setFolder("")}
                            selected={!folder}
                        >
                            כל התיקיות
                        </PopoverMenuItem>
                        {folders.map((f) => (
                            <PopoverMenuItem
                                key={f.id}
                                onSelect={() => setFolder(folder === f.id ? "" : f.id)}
                                icon={<span className="inline-block size-2 rounded-full" style={{ backgroundColor: f.color }} />}
                                selected={folder === f.id}
                            >
                                {f.title}
                            </PopoverMenuItem>
                        ))}
                        <PopoverMenuSeparator />
                        <PopoverMenuItem
                            onSelect={() => p.setFoldersEdit(true)}
                            icon={<Settings2Icon className="w-3 h-3" />}
                        >
                            ניהול תיקיות
                        </PopoverMenuItem>
                    </PopoverMenuContent>
                </PopoverMenu>

                <PopoverMenu align="end">
                    <PopoverMenuTrigger asChild>
                        <SelectButton
                            icon={<FilterIcon className="w-3.5 h-3.5" />}
                            label={sort === "newest" ? "הכי חדש" : sort === "oldest" ? "הכי ישן" : "לפי שם"}
                        />
                    </PopoverMenuTrigger>
                    <PopoverMenuContent>
                        <PopoverMenuLabel>מיון</PopoverMenuLabel>
                        <PopoverMenuItem
                            selected={sort === "newest"}
                            onSelect={() => setSort("newest")}
                        >
                            הכי חדש תחילה
                        </PopoverMenuItem>
                        <PopoverMenuItem
                            selected={sort === "oldest"}
                            onSelect={() => setSort("oldest")}
                        >
                            הכי ישן תחילה
                        </PopoverMenuItem>
                        <PopoverMenuItem
                            selected={sort === "name"}
                            onSelect={() => setSort("name")}
                        >
                            לפי שם (א–ת)
                        </PopoverMenuItem>
                    </PopoverMenuContent>
                </PopoverMenu>
            </SectionBar>

            <PageBody>
                <AdvisorSummaryBar
                    surface="campaigns"
                    noun="campaign"
                    nounPlural="campaigns"
                    className="mx-5 mt-3"
                />
                {campaignsData.isPending ? (
                    <SkeletonRows />
                ) : campaignsData.isError ? (
                    <ErrorState
                        message={
                            campaignsData.error?.message ||
                            "הבקשה נכשלה. ייתכן שהשרת אינו זמין או שהחזיר שגיאה."
                        }
                        onRetry={() => campaignsData.refetch()}
                        isRefetching={campaignsData.isFetching}
                    />
                ) : filtered.length === 0 ? (
                    campaigns.length === 0 ? (
                        <EmptyBlock
                            title="אין קמפיינים עדיין"
                            body="צור את הקמפיין הראשון שלך כדי להתחיל להגיע לנמענים."
                            cta={
                                <TopbarAction
                                    icon={<PlusIcon className="w-3 h-3" />}
                                    onClick={() => setNewOpen(true)}
                                >
                                    קמפיין חדש
                                </TopbarAction>
                            }
                        />
                    ) : (
                        <EmptyBlock
                            title={`אין קמפיינים ${status === "active" ? "פעילים" : status === "paused" ? "מושהים" : status === "draft" ? "בטיוטה" : "שהסתיימו"}`}
                            body='עבור למצב "הכל" כדי לצפות בכל הקמפיינים.'
                            cta={
                                <TopbarAction onClick={() => setStatus("all")} variant="ghost">
                                    הצג הכל
                                </TopbarAction>
                            }
                        />
                    )
                ) : (
                    <div className="divide-y divide-slate-200/60">
                        {filtered.map((c) => {
                            const cstatus = c.status ?? "draft";
                            const stateLabel = campaignDisplayLabel(c);
                            const StateIcon =
                                cstatus === "active" ? PauseIcon : PlayIcon;
                            return (
                                <Link
                                    key={c.id}
                                    to={`/app/campaigns/${c.id}`}
                                    onClick={(e) => {
                                        // A modified click still opens the page, in a new tab or not.
                                        if (!canManage || cstatus !== "draft" || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                                        e.preventDefault();
                                        setDraftId(c.id);
                                    }}
                                    className="group h-11 px-5 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                                >
                                    {/* Fixed-width leading slot so every row's name aligns,
                                        whatever state mark (loader or icon) sits in it. */}
                                    <span className="shrink-0 w-3.5 flex items-center justify-center">
                                        <CampaignStatusMark status={cstatus} idle={isIdleCampaign(c)} />
                                    </span>
                                    <span className="text-[12.5px] text-slate-900 font-medium truncate max-w-[40%] text-start">
                                        {c.name}
                                    </span>
                                    <span className="font-mono text-[10.5px] text-slate-400 tabular-nums shrink-0 hidden sm:inline">
                                        {c.id.slice(0, 8)}
                                    </span>
                                    <AdvisorRowFlag findings={advisor.get(c.id)} subject={c.name} />
                                    <CampaignFolderChips campaign={c} folders={folders} />
                                    {c.description && (
                                        <span className="text-[11.5px] text-slate-400 truncate hidden md:inline text-start">
                                            {c.description}
                                        </span>
                                    )}
                                    <span className={cn("ms-auto text-[10px] uppercase tracking-[0.1em] font-medium shrink-0", campaignDisplayTone(c))}>
                                        {stateLabel}
                                    </span>
                                    <span className="font-mono text-[10.5px] text-slate-400 tabular-nums items-center gap-1 shrink-0 hidden sm:flex">
                                        <CalendarIcon className="w-3 h-3" />
                                        {c.created_at
                                            ? new Date(c.created_at).toLocaleDateString("he-IL", {
                                                month: "short",
                                                day: "numeric",
                                            })
                                            : "—"}
                                    </span>
                                    <CampaignFolderMenu campaign={c} folders={folders} />
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            toggleRow(c);
                                        }}
                                        disabled={
                                            (cstatus === "active" && stopCampaign.isPending) ||
                                            (cstatus !== "active" && startCampaign.isPending)
                                        }
                                        className="size-6 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0 disabled:opacity-30"
                                        aria-label={
                                            cstatus === "active" ? "השהה קמפיין" : "הפעל קמפיין"
                                        }
                                    >
                                        <StateIcon className="w-3.5 h-3.5" />
                                    </button>
                                    <CampaignActionsMenu
                                        campaign={c}
                                        variant="row"
                                        onToggle={() => toggleRow(c)}
                                    />
                                </Link>
                            );
                        })}
                    </div>
                )}
            </PageBody>

            <NewCampaignDialog
                open={newOpen || draftId !== null}
                draftId={draftId}
                onClose={() => {
                    setNewOpen(false);
                    setDraftId(null);
                }}
            />
            <LaunchCampaignDialog
                campaign={launchTarget}
                onClose={() => setLaunchTarget(null)}
                onConfirm={(id, options) => startCampaign.mutateAsync({ id, options })}
            />
        </Page>
    );
}

function ErrorState({
    message,
    onRetry,
    isRefetching,
}: {
    message: string;
    onRetry: () => void;
    isRefetching: boolean;
}) {
    return (
        <div className="px-5 py-12 text-center">
            <div className="mx-auto mb-3 size-8 rounded-md bg-red-50 text-red-600 flex items-center justify-center">
                <AlertTriangleIcon className="w-4 h-4" />
            </div>
            <p className="text-[12.5px] text-slate-900 font-medium">לא ניתן לטעון קמפיינים</p>
            <p className="text-[11.5px] text-slate-500 mt-1 max-w-[44ch] mx-auto leading-relaxed">
                {message}
            </p>
            <div className="mt-4 flex items-center justify-center gap-1.5">
                <button
                    type="button"
                    onClick={onRetry}
                    disabled={isRefetching}
                    className="h-7 px-2.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                >
                    {isRefetching ? (
                        <Loader2Icon className="w-3 h-3 animate-spin" />
                    ) : (
                        <RefreshCcwIcon className="w-3 h-3" />
                    )}
                    נסה שוב
                </button>
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="h-7 px-2.5 rounded-md border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 text-[12px] font-medium transition-colors"
                >
                    רענן דף
                </button>
            </div>
        </div>
    );
}

function SkeletonRows() {
    return (
        <div className="divide-y divide-slate-200/60">
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-11 px-5 flex items-center gap-3">
                    <div className="size-1.5 rounded-full bg-slate-200" />
                    <div className="h-3 w-44 bg-slate-100 rounded animate-pulse" />
                    <div className="font-mono h-3 w-12 bg-slate-100 rounded animate-pulse" />
                    <div className="ms-auto h-3 w-16 bg-slate-100 rounded animate-pulse" />
                </div>
            ))}
        </div>
    );
}
