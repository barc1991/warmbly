// Displays the clocks this workspace runs on: the browser, the workspace,
// the per-campaign and per-mailbox zones, each editable inline.
import React from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { CheckIcon, ChevronDownIcon, ClockIcon, InboxIcon, MegaphoneIcon, UsersIcon } from "lucide-react";
import { Row, Section } from "../_components/SectionShell";
import { SelectMenu, type SelectOption } from "@/components/ui/select-menu";
import { Loading } from "@/components/loader";
import { useUserProfile } from "@/hooks/context/user";
import { useConfirm } from "@/hooks/context/confirm";
import { usePermission } from "@/hooks/usePermission";
import useCurrentOrganization from "@/lib/api/hooks/app/organizations/useCurrentOrganization";
import useUpdateOrganization from "@/lib/api/hooks/app/organizations/useUpdateOrganization";
import useCampaigns from "@/lib/api/hooks/app/campaigns/useCampaigns";
import useUpdateCampaign from "@/lib/api/hooks/app/campaigns/useUpdateCampaign";
import updateCampaign from "@/lib/api/client/app/campaigns/updateCampaign";
import useEmails from "@/lib/api/hooks/app/emails/useEmails";
import useUpdateEmail from "@/lib/api/hooks/app/emails/useUpdateEmail";
import updateEmail from "@/lib/api/client/app/emails/updateEmail";
import type Campaign from "@/lib/api/models/app/campaigns/Campaign";
import type Inbox from "@/lib/api/models/app/emails/Inbox";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import mailboxDisplayStatus from "@/lib/mailboxStatus";
import { browserTimezone, followWorkspaceLabel, timezoneOptions } from "@/lib/timezone";
import { cn } from "@/lib/utils";

// Enough for any workspace's whole campaign and mailbox list in one page.
const LIST_LIMIT = 200;

const CAMPAIGN_TONE: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    paused: "bg-amber-50 text-amber-700 ring-amber-200",
    draft: "bg-slate-100 text-slate-600 ring-slate-200",
};

const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
    active: "פעיל",
    paused: "מושהה",
    draft: "טיוטה",
    completed: "הושלם",
};

const MAILBOX_DOT: Record<string, string> = {
    healthy: "bg-emerald-500",
    warming: "bg-sky-500",
    paused: "bg-amber-500",
    inactive: "bg-slate-300",
};

export default function TimezonesSection() {
    const canManageSettings = usePermission("MANAGE_SETTINGS");
    const org = useCurrentOrganization();
    const updateOrg = useUpdateOrganization();
    const { timezones } = useUserProfile();
    const workspaceZone = org.data?.timezone ?? "";
    const browserZone = browserTimezone();
    const options = React.useMemo<SelectOption[]>(
        () => timezoneOptions(timezones, workspaceZone, browserZone),
        [timezones, workspaceZone, browserZone],
    );
    const saveWorkspace = (zone: string) => {
        if (zone === workspaceZone) return;
        updateOrg.mutateAsync({ timezone: zone }).catch((e) => toast.error(buildError(e as AppError)));
    };

    return (
        <Section eyebrow="אזורי זמן" description="כל השעונים שסביבת העבודה הזו פועלת לפיהם, והיכן כל אחד מוגדר.">
            <Row
                label="הדפדפן שלך"
                description="זוהה ממכשיר זה. תאריכים ושעות בלוח הבקרה מוצגים לפיו. שום דבר אינו נשלח לפיו ישירות."
                align="start"
            >
                <ZoneChip zone={browserZone || "לא ידוע"} />
            </Row>
            <Row
                label="סביבת עבודה"
                description={
                    canManageSettings
                        ? "משותף לכל המשתמשים כאן. קמפיינים חדשים מתחילים את חלון השליחה שלהם לפיו, ותיבת דואר ללא אזור זמן משלה קוראת את שעות החימום ושעות העבודה לפיו."
                        : "משותף לכל המשתמשים כאן. קמפיינים חדשים מתחילים את חלון השליחה שלהם לפיו, ותיבת דואר ללא אזור זמן משלה קוראת את שעות החימום ושעות העבודה לפיו. שינויו דורש הרשאת ניהול הגדרות."
                }
                align="start"
            >
                <div className="flex flex-col items-start gap-1.5">
                    <SelectMenu
                        value={workspaceZone}
                        onChange={saveWorkspace}
                        options={options}
                        placeholder="לא הוגדר"
                        aria-label="אזור זמן סביבת עבודה"
                        minWidth={280}
                        align="end"
                        disabled={!canManageSettings || org.isPending}
                    />
                    {!workspaceZone && browserZone && canManageSettings && (
                        <button
                            type="button"
                            onClick={() => saveWorkspace(browserZone)}
                            className="text-[11.5px] text-sky-700 hover:text-sky-900 hover:underline"
                        >
                            השתמש ב-{browserZone}, אזור הזמן של דפדפן זה
                        </button>
                    )}
                </div>
            </Row>

            <div className="rounded-md border border-slate-200 divide-y divide-slate-200 overflow-hidden">
                <CampaignClocks workspaceZone={workspaceZone} />
                <MailboxClocks workspaceZone={workspaceZone} />
                <ClockRow
                    icon={UsersIcon}
                    title="תזמון נמענים"
                    description="מעכב כל שליחה לשעות המקומיות של איש הקשר כאשר מופעל. הדבר מעכב שליחה בלבד ולעולם אינו מקדים אותה."
                    chips={
                        <Link
                            to="/app/settings/sending"
                            className="h-7 px-2.5 inline-flex items-center rounded-md border border-slate-200 text-[12px] text-slate-600 hover:border-slate-300 hover:text-slate-900 transition-colors"
                        >
                            הגדרות שליחה
                        </Link>
                    }
                />
                <ClockRow
                    icon={ClockIcon}
                    title="מכסות יומיות"
                    description="כל המונים היומיים מתאפסים בחצות UTC ללא תלות באזורי הזמן שלמעלה, כך שסביבת עבודה המרוחקת מ-UTC עשויה לראות את 'נשלחו היום' מתאפס במהלך יום העבודה שלה."
                    chips={<ZoneChip zone="UTC" />}
                />
            </div>
        </Section>
    );
}

/* ── Campaigns ─────────────────────────────────────────────────────── */

// Summaries and "Set all" speak for every row, so keep paging until the list is whole.
// Returns true while pages remain; a failed page stops the loop instead of retrying it.
function useRemainingPages(list: {
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    isFetchNextPageError: boolean;
    fetchNextPage: () => unknown;
}): boolean {
    const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = list;
    React.useEffect(() => {
        if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) void fetchNextPage();
    }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);
    return hasNextPage && !isFetchNextPageError;
}

function CampaignClocks({ workspaceZone }: { workspaceZone: string }) {
    const list = useCampaigns({ query: "", folder: "", limit: LIST_LIMIT });
    const loading = useRemainingPages(list) || list.isPending;
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const [open, setOpen] = React.useState(false);
    const [busy, setBusy] = React.useState(false);

    // A finished campaign has no window left to move.
    const campaigns = React.useMemo(() => list.campaigns.filter((c) => c.status !== "completed"), [list.campaigns]);
    const own = campaigns.filter((c) => !!c.timezone);
    const fallback = workspaceZone || "UTC";
    const zones = summarizeZones(campaigns.map((c) => c.timezone || ""));

    const followAll = () => {
        confirm.show(
            `להגדיר ${own.length} קמפיינים להתאים לאזור הזמן של סביבת העבודה (${fallback})? כל חלון שליחה ישמור על שעותיו וייקרא באזור זמן זה מהשליחה הבאה.`,
            async () => {
                setBusy(true);
                try {
                    for (const c of own) await updateCampaign(c.id, { timezone: "" });
                    toast.success("הקמפיינים מותאמים כעת לאזור הזמן של סביבת העבודה");
                } catch (e) {
                    toast.error(buildError(e as AppError));
                } finally {
                    setBusy(false);
                    void queryClient.invalidateQueries({ queryKey: ["campaigns"] });
                }
            },
        );
    };

    return (
        <ClockRow
            icon={MegaphoneIcon}
            title="חלונות שליחה של קמפיינים"
            description={`חלון השליחה של כל קמפיין נקרא באזור הזמן שלו, או אם לא הוגדר, באזור הזמן של סביבת העבודה (כרגע ${fallback}). ניתן לשנות זאת כאן או בלשונית 'תזמון' של הקמפיין.`}
            summary={loading ? undefined : summaryLabel(campaigns.length, "campaign", zones)}
            open={open}
            onToggle={!loading && campaigns.length > 0 ? () => setOpen((v) => !v) : undefined}
            chips={
                loading ? (
                    <Loading className="!w-4 h-4" />
                ) : campaigns.length === 0 ? (
                    <span className="text-[11.5px] text-slate-400">אין עדיין קמפיינים</span>
                ) : (
                    <ZoneChips zones={zones} highlight={workspaceZone} followLabel={`התאם לסביבת העבודה (${fallback})`} />
                )
            }
        >
            {open && !loading && campaigns.length > 0 && (
                <ClockList
                    action={
                        own.length > 0 ? (
                            <AlignButton busy={busy} onClick={followAll}>
                                הגדר את כל {own.length} להתאים לסביבת העבודה
                            </AlignButton>
                        ) : (
                            <AllAligned>כולם מותאמים לסביבת העבודה</AllAligned>
                        )
                    }
                >
                    {campaigns.map((c) => (
                        <CampaignZoneRow key={c.id} campaign={c} workspaceZone={workspaceZone} fallback={fallback} />
                    ))}
                </ClockList>
            )}
        </ClockRow>
    );
}

function CampaignZoneRow({ campaign, workspaceZone, fallback }: { campaign: Campaign; workspaceZone: string; fallback: string }) {
    const { timezones } = useUserProfile();
    const update = useUpdateCampaign(campaign.id);
    const options = React.useMemo<SelectOption[]>(
        () => [{ value: "", label: followWorkspaceLabel(fallback) }, ...timezoneOptions(timezones, campaign.timezone)],
        [timezones, campaign.timezone, fallback],
    );
    const differs = !!campaign.timezone && !!workspaceZone && campaign.timezone !== workspaceZone;
    const onChange = (zone: string) => {
        if (zone === (campaign.timezone || "")) return;
        update.mutateAsync({ timezone: zone }).catch((e) => toast.error(buildError(e as AppError)));
    };
    return (
        <li className="flex items-center gap-3 px-3.5 py-2">
            <div className="min-w-0 flex-1 flex items-center gap-2">
                <Link to={`/app/campaigns/${campaign.id}/schedule`} className="truncate text-[12.5px] text-slate-800 hover:text-sky-700 hover:underline">
                    {campaign.name || "קמפיין ללא שם"}
                </Link>
                <span className={cn("shrink-0 px-1.5 py-px rounded text-[10px] font-medium ring-1", CAMPAIGN_TONE[campaign.status] ?? CAMPAIGN_TONE.draft)}>
                    {CAMPAIGN_STATUS_LABEL[campaign.status] || campaign.status}
                </span>
                {differs && <span className="shrink-0 text-[10.5px] text-amber-600">אזור זמן ייחודי</span>}
            </div>
            <SelectMenu
                value={campaign.timezone || ""}
                onChange={onChange}
                options={options}
                aria-label={`אזור זמן של ${campaign.name}`}
                minWidth={260}
                align="end"
                disabled={update.isPending}
            />
        </li>
    );
}

/* ── Mailboxes ─────────────────────────────────────────────────────── */

function MailboxClocks({ workspaceZone }: { workspaceZone: string }) {
    const list = useEmails({ query: "", tag: "", limit: LIST_LIMIT });
    const loading = useRemainingPages(list) || list.isPending;
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const [open, setOpen] = React.useState(false);
    const [busy, setBusy] = React.useState(false);

    const mailboxes = list.emails;
    const own = mailboxes.filter((m) => !!m.timezone);
    const fallback = workspaceZone || "UTC";
    const zones = summarizeZones(mailboxes.map((m) => m.timezone || ""));

    const followAll = () => {
        confirm.show(
            `להגדיר ${own.length} תיבות דואר להתאים לאזור הזמן של סביבת העבודה (${fallback})? שעות החימום ושעות העבודה שלהן ייקראו לפיו מהשליחה הבאה.`,
            async () => {
                setBusy(true);
                try {
                    for (const m of own) await updateEmail(m.id, { timezone: "" });
                    toast.success("תיבות הדואר מותאמות כעת לאזור הזמן של סביבת העבודה");
                } catch (e) {
                    toast.error(buildError(e as AppError));
                } finally {
                    setBusy(false);
                    void queryClient.invalidateQueries({ queryKey: ["emails"] });
                }
            },
        );
    };

    return (
        <ClockRow
            icon={InboxIcon}
            title="שעות חימום ושעות עבודה"
            description={`חלון החימום של כל תיבת דואר ויום העבודה בהתנהגות השליחה שלה נקראים באזור הזמן שלה. תיבה ללא אזור זמן מותאם עוקבת אחר סביבת העבודה (כרגע ${fallback}).`}
            summary={loading ? undefined : summaryLabel(mailboxes.length, "mailbox", zones)}
            open={open}
            onToggle={!loading && mailboxes.length > 0 ? () => setOpen((v) => !v) : undefined}
            chips={
                loading ? (
                    <Loading className="!w-4 h-4" />
                ) : mailboxes.length === 0 ? (
                    <span className="text-[11.5px] text-slate-400">אין עדיין תיבות דואר</span>
                ) : (
                    <ZoneChips zones={zones} highlight={workspaceZone} followLabel={`התאם לסביבת העבודה (${fallback})`} />
                )
            }
        >
            {open && !loading && mailboxes.length > 0 && (
                <ClockList
                    action={
                        own.length > 0 ? (
                            <AlignButton busy={busy} onClick={followAll}>
                                הגדר את כל {own.length} להתאים לסביבת העבודה
                            </AlignButton>
                        ) : (
                            <AllAligned>כולם מותאמים לסביבת העבודה</AllAligned>
                        )
                    }
                >
                    {mailboxes.map((m) => (
                        <MailboxZoneRow key={m.id} mailbox={m} fallback={fallback} />
                    ))}
                </ClockList>
            )}
        </ClockRow>
    );
}

function MailboxZoneRow({ mailbox, fallback }: { mailbox: Inbox; fallback: string }) {
    const { timezones } = useUserProfile();
    const update = useUpdateEmail(mailbox.id);
    const options = React.useMemo<SelectOption[]>(
        () => [{ value: "", label: followWorkspaceLabel(fallback) }, ...timezoneOptions(timezones, mailbox.timezone)],
        [timezones, mailbox.timezone, fallback],
    );
    const zone = mailbox.timezone ?? "";
    const onChange = (next: string) => {
        if (next === zone) return;
        update.mutateAsync({ timezone: next }).catch((e) => toast.error(buildError(e as AppError)));
    };
    const status = mailboxDisplayStatus(mailbox);
    return (
        <li className="flex items-center gap-3 px-3.5 py-2">
            <span className={cn("shrink-0 w-1.5 h-1.5 rounded-full", MAILBOX_DOT[status])} title={status} />
            <div className="min-w-0 flex-1 flex items-baseline gap-2">
                <span className="truncate text-[12.5px] text-slate-800">{mailbox.email}</span>
                {mailbox.name && <span className="truncate text-[11px] text-slate-400 hidden sm:inline">{mailbox.name}</span>}
            </div>
            <SelectMenu
                value={zone}
                onChange={onChange}
                options={options}
                aria-label={`אזור זמן של ${mailbox.email}`}
                minWidth={260}
                align="end"
                disabled={update.isPending}
            />
        </li>
    );
}

/* ── Shared pieces ─────────────────────────────────────────────────── */

type ZoneCount = { zone: string; count: number };

// Grouped counts, most common first; "" is "follows the workspace".
function summarizeZones(zones: string[]): ZoneCount[] {
    const counts = new Map<string, number>();
    for (const z of zones) counts.set(z, (counts.get(z) ?? 0) + 1);
    return [...counts.entries()].map(([zone, count]) => ({ zone, count })).sort((a, b) => b.count - a.count);
}

function summaryLabel(total: number, noun: string, zones: ZoneCount[]): string {
    const isMailbox = noun === "mailbox";
    if (total === 0) return isMailbox ? "אין תיבות דואר" : "אין קמפיינים";
    const following = zones.find((z) => z.zone === "")?.count ?? 0;
    if (following === total) {
        return isMailbox
            ? `${total} תיבות דואר, כולן מותאמות לסביבת העבודה`
            : `${total} קמפיינים, כולם מותאמים לסביבת העבודה`;
    }
    return isMailbox
        ? `${total} תיבות דואר (${following} מותאמות לסביבת העבודה, ${total - following} מותאמות אישית)`
        : `${total} קמפיינים (${following} מותאמים לסביבת העבודה, ${total - following} מותאמים אישית)`;
}

function ClockRow({
    icon: Icon,
    title,
    description,
    summary,
    open,
    onToggle,
    chips,
    children,
}: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
    summary?: string;
    open?: boolean;
    onToggle?: () => void;
    // What sits at the right of the header: a chip, a link, the zone counts.
    chips: React.ReactNode;
    // The expanded list, when open.
    children?: React.ReactNode;
}) {
    const header = (
        <>
            <Icon className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[12.5px] font-medium text-slate-900">{title}</span>
                    {summary && <span className="text-[11px] text-slate-400">{summary}</span>}
                </div>
                <p className="text-[11.5px] text-slate-500 leading-snug mt-0.5">{description}</p>
            </div>
            <div className="shrink-0 flex items-center gap-2 sm:ms-auto">
                {chips}
                {onToggle && (
                    <ChevronDownIcon className={cn("w-4 h-4 text-slate-400 transition-transform", open && "rotate-180")} />
                )}
            </div>
        </>
    );
    return (
        <div className="bg-white">
            {onToggle ? (
                <button
                    type="button"
                    onClick={onToggle}
                    aria-expanded={open}
                    className="w-full text-start flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 px-3.5 py-3 hover:bg-slate-50/70 transition-colors"
                >
                    {header}
                </button>
            ) : (
                <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 px-3.5 py-3">{header}</div>
            )}
            {children}
        </div>
    );
}

function ClockList({ action, children }: { action: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="border-t border-slate-200 bg-slate-50/50">
            {action && <div className="flex items-center justify-end px-3.5 py-2 border-b border-slate-200/70">{action}</div>}
            <ul className="divide-y divide-slate-200/70 max-h-[420px] overflow-y-auto">{children}</ul>
        </div>
    );
}

function ZoneChip({ zone, tone = "slate" }: { zone: string; tone?: "slate" | "sky" }) {
    return (
        <span
            className={cn(
                "inline-flex items-center h-6 px-2 rounded-md border text-[11px] font-mono",
                tone === "sky" ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-slate-50 text-slate-600",
            )}
        >
            {zone}
        </span>
    );
}

// The grouped zones as chips, the workspace's own zone in sky. At most three,
// then a "+N" so a scattered workspace does not blow the row up.
function ZoneChips({ zones, highlight, followLabel }: { zones: ZoneCount[]; highlight: string; followLabel?: string }) {
    const shown = zones.slice(0, 3);
    const rest = zones.length - shown.length;
    return (
        <div className="flex flex-wrap items-center justify-end gap-1">
            {shown.map(({ zone, count }) => (
                <span
                    key={zone || "__follow"}
                    className={cn(
                        "inline-flex items-center gap-1 h-6 px-2 rounded-md border text-[11px]",
                        (zone === "" || zone === highlight) && highlight
                            ? "border-sky-200 bg-sky-50 text-sky-700"
                            : "border-slate-200 bg-slate-50 text-slate-600",
                    )}
                >
                    <span className="font-mono">{zone || followLabel || "התאם לסביבת העבודה"}</span>
                    <span className="text-[10px] opacity-70">×{count}</span>
                </span>
            ))}
            {rest > 0 && <span className="text-[11px] text-slate-400">+{rest}</span>}
        </div>
    );
}

function AlignButton({ busy, onClick, children }: { busy: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={busy}
            className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md bg-sky-600 text-white text-[12px] font-medium hover:bg-sky-700 disabled:opacity-60 transition-colors"
        >
            {busy && <Loading className="!w-3.5 h-3.5" />}
            {children}
        </button>
    );
}

function AllAligned({ children }: { children: React.ReactNode }) {
    return (
        <span className="inline-flex items-center gap-1 text-[11.5px] text-emerald-700">
            <CheckIcon className="w-3.5 h-3.5" /> {children}
        </span>
    );
}
