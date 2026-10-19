// Imports: saved Apollo lists that bring people into Warmbly, once or every hour.

import React from "react";
import {
    AlertTriangleIcon,
    DownloadCloudIcon,
    Loader2Icon,
    MoreHorizontalIcon,
    PauseIcon,
    PencilIcon,
    PlayIcon,
    PlusIcon,
    RefreshCwIcon,
    Trash2Icon,
} from "lucide-react";
import toast from "react-hot-toast/headless";
import { useTranslation } from "react-i18next";

import {
    PopoverMenu,
    PopoverMenuContent,
    PopoverMenuItem,
    PopoverMenuSeparator,
    PopoverMenuTrigger,
} from "@/components/ui/popover-menu";
import { CategoryChip } from "@/components/app/contacts/CategoryPicker";
import { useConfirm } from "@/hooks/context/confirm";
import { useUserProfile } from "@/hooks/context/user";
import useCampaigns from "@/lib/api/hooks/app/campaigns/useCampaigns";
import {
    useApolloImportSources,
    useDeleteApolloImportSource,
    useRunApolloImportSource,
    useUpdateApolloImportSource,
} from "@/lib/api/hooks/app/integrations/useApollo";
import type { ApolloImportSource } from "@/lib/api/models/app/integrations/Apollo";
import { cn } from "@/lib/utils";

import { Pill, primaryBtn } from "../../salesforce/_components/shared";
import { absolute, ago, errMsg } from "../../salesforce/_components/util";
import ImportDialog, { EditImportDialog } from "./ImportDialog";

export default function ImportTab({ connectionId, disabled }: { connectionId: string; disabled?: boolean }) {
    const { i18n } = useTranslation();
    const isHe = i18n.language === "he";

    const sources = useApolloImportSources(connectionId);
    const [creating, setCreating] = React.useState(false);
    const [editing, setEditing] = React.useState<ApolloImportSource | null>(null);
    const campaigns = useCampaigns({ query: "", folder: "" });
    const campaignName = React.useCallback(
        (id?: string | null) => (id ? (campaigns.campaigns.find((c) => c.id === id)?.name ?? (isHe ? "קמפיין" : "A campaign")) : null),
        [campaigns.campaigns, isHe],
    );

    const list = sources.data ?? [];

    return (
        <div className="space-y-4 max-w-5xl text-start rtl:text-right ltr:text-left">
            <div className="flex flex-wrap items-center gap-3">
                <p className="text-[12px] text-slate-600 flex-1 min-w-[240px]">
                    {isHe
                        ? "ייבא אנשי קשר מתוך רשימת Apollo שמורה. אנשי קשר שכבר קיימים ב-Warmbly יתעדכנו מבלי ליצור כפילויות."
                        : "Bring people in from a saved Apollo list. Anyone already in Warmbly is updated, never duplicated."}
                </p>
                <button
                    type="button"
                    onClick={() => setCreating(true)}
                    disabled={disabled}
                    title={disabled ? (isHe ? "יש להחליף מפתח API תחילה" : "Replace the API key first") : undefined}
                    className={primaryBtn}
                >
                    <PlusIcon className="w-3.5 h-3.5" />
                    {isHe ? "ייבוא חדש" : "New import"}
                </button>
            </div>

            {sources.isPending ? (
                <div className="space-y-2">
                    {[0, 1].map((i) => (
                        <div key={i} className="h-20 rounded-md bg-slate-100 animate-pulse" />
                    ))}
                </div>
            ) : sources.isError ? (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-700">
                    {errMsg(sources.error, isHe ? "לא ניתן לטעון פעולות ייבוא" : "Could not load imports")}
                </div>
            ) : list.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-300 px-6 py-10 text-center">
                    <DownloadCloudIcon className="w-5 h-5 text-slate-300 mx-auto" />
                    <p className="text-[12.5px] font-medium text-slate-700 mt-2">
                        {isHe ? "אין פעולות ייבוא עדיין" : "No imports yet"}
                    </p>
                    <p className="text-[11.5px] text-slate-500 mt-0.5">
                        {isHe
                            ? "שמור אנשים לרשימה ב-Apollo, ולאחר מכן ייבא אותה לכאן ושמור על סנכרון רציף."
                            : "Save people to a list in Apollo, then import it here and keep it in sync."}
                    </p>
                    <button type="button" onClick={() => setCreating(true)} disabled={disabled} className={cn(primaryBtn, "mt-3")}>
                        <PlusIcon className="w-3.5 h-3.5" />
                        {isHe ? "ייבוא חדש" : "New import"}
                    </button>
                </div>
            ) : (
                <div className="rounded-md border border-slate-200 bg-white divide-y divide-slate-100">
                    {list.map((s) => (
                        <SourceRow
                            key={s.id}
                            connectionId={connectionId}
                            source={s}
                            campaign={campaignName(s.campaign_id)}
                            onEdit={() => setEditing(s)}
                            isHe={isHe}
                        />
                    ))}
                </div>
            )}

            {creating && <ImportDialog connectionId={connectionId} onClose={() => setCreating(false)} />}
            {editing && <EditImportDialog connectionId={connectionId} source={editing} onClose={() => setEditing(null)} />}
        </div>
    );
}

function SourceRow({
    connectionId,
    source: s,
    campaign,
    onEdit,
    isHe,
}: {
    connectionId: string;
    source: ApolloImportSource;
    campaign: string | null;
    onEdit: () => void;
    isHe?: boolean;
}) {
    const confirm = useConfirm();
    const { user } = useUserProfile();
    const run = useRunApolloImportSource(connectionId);
    const update = useUpdateApolloImportSource(connectionId);
    const del = useDeleteApolloImportSource(connectionId);

    const categories = (s.category_ids ?? [])
        .map((id) => (user.categories ?? []).find((c) => c.id === id))
        .filter((c): c is NonNullable<typeof c> => !!c);
    const running = s.status === "running";
    const r = s.last_result;

    function runNow() {
        run.mutate(
            { connectionId, sourceId: s.id },
            {
                onSuccess: () => toast.success(isHe ? "הייבוא הופעל" : "Import started"),
                onError: (err) => toast.error(errMsg(err, isHe ? "לא ניתן להפעיל את הייבוא" : "Could not start the import")),
            },
        );
    }
    function toggleEnabled() {
        update.mutate(
            { connectionId, sourceId: s.id, body: { enabled: !s.enabled } },
            {
                onSuccess: () => toast.success(s.enabled ? (isHe ? "הייבוא הושהה" : "Import paused") : (isHe ? "הייבוא חודש" : "Import resumed")),
                onError: (err) => toast.error(errMsg(err, isHe ? "לא ניתן לעדכן את הייבוא" : "Could not update the import")),
            },
        );
    }
    function remove() {
        confirm.show(
            isHe
                ? `למחוק את הייבוא "${s.name}"? אנשי קשר שכבר יובאו יישארו ב-Warmbly.`
                : `Delete the import “${s.name}”? Contacts it already brought in stay in Warmbly.`,
            async () => {
                try {
                    await del.mutateAsync({ connectionId, sourceId: s.id });
                    toast.success(isHe ? "הייבוא נמחק" : "Import deleted");
                } catch (err) {
                    toast.error(errMsg(err, isHe ? "לא ניתן למחוק את הייבוא" : "Could not delete the import"));
                    throw err;
                }
            },
        );
    }

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onEdit}
            onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onEdit();
                }
            }}
            className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50/60 transition-colors cursor-pointer outline-none focus-visible:bg-slate-50"
        >
            <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[12.5px] font-medium text-slate-900 truncate">{s.name}</span>
                    {s.verified_only && <Pill>{isHe ? "מאומתים בלבד" : "Verified only"}</Pill>}
                    {s.recurring && s.enabled && <Pill tone="sky">{isHe ? "מסנכרן כל שעה" : "Syncs every hour"}</Pill>}
                    {!s.enabled && <Pill tone="amber">{isHe ? "מושהה" : "Paused"}</Pill>}
                    <StatusBadge status={s.status} isHe={isHe} />
                </div>
                <div className="text-[11.5px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="truncate">
                        {isHe ? `מתוך ${s.list_name || "רשימת Apollo"}` : `From ${s.list_name || "an Apollo list"}`}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span>
                        {campaign
                            ? (isHe ? `מוסיף אל ${campaign}` : `Adds to ${campaign}`)
                            : (isHe ? "אנשי קשר בלבד" : "Contacts only")}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span title={absolute(s.last_run_at)}>
                        {isHe ? `ריצה אחרונה ${ago(s.last_run_at)}` : `Last run ${ago(s.last_run_at)}`}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span>
                        {isHe
                            ? `סך הכל ${s.total_imported.toLocaleString()} יובאו`
                            : `${s.total_imported.toLocaleString()} imported in total`}
                    </span>
                </div>
                {categories.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {categories.map((c) => (
                            <CategoryChip key={c.id} category={c} compact />
                        ))}
                    </div>
                )}
                {r && (
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500 tabular-nums">
                        <Count label={isHe ? "נקראו" : "read"} value={r.read} />
                        <Count label={isHe ? "חדשים" : "new"} value={r.imported} strong />
                        <Count label={isHe ? "עודכנו" : "updated"} value={r.updated} />
                        <Count label={isHe ? "כבר יובאו" : "already imported"} value={r.already_seen} />
                        <Count label={isHe ? "ללא דוא\"ל" : "without email"} value={r.no_email} />
                        {s.verified_only && <Count label={isHe ? "לא מאומתים" : "unverified"} value={r.unverified} />}
                        <Count label={isHe ? "ברשימת חסימה" : "suppressed"} value={r.suppressed} />
                        {r.failed > 0 && <Count label={isHe ? "נכשלו" : "failed"} value={r.failed} tone="rose" />}
                        {r.truncated && (
                            <span className="text-amber-700">
                                {isHe ? "נעצר במגבלת הריצה, ימשיך בריצה הבאה" : "Stopped at the per-run limit, continues next run"}
                            </span>
                        )}
                    </div>
                )}
                {s.last_error && (
                    <p className="text-[11px] text-rose-700 flex items-start gap-1.5 break-words">
                        <AlertTriangleIcon className="w-3 h-3 mt-0.5 shrink-0" />
                        {s.last_error}
                    </p>
                )}
            </div>
            <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                <PopoverMenu align="end">
                    <PopoverMenuTrigger asChild>
                        <button
                            type="button"
                            aria-label={`Actions for ${s.name}`}
                            className="size-7 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center justify-center transition-colors"
                        >
                            {run.isPending || update.isPending ? (
                                <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <MoreHorizontalIcon className="w-3.5 h-3.5" />
                            )}
                        </button>
                    </PopoverMenuTrigger>
                    <PopoverMenuContent minWidth={180}>
                        <PopoverMenuItem icon={<RefreshCwIcon className="w-3 h-3" />} onSelect={runNow} disabled={running || !s.enabled}>
                            {isHe ? "הפעל עכשיו" : "Run now"}
                        </PopoverMenuItem>
                        <PopoverMenuItem
                            icon={s.enabled ? <PauseIcon className="w-3 h-3" /> : <PlayIcon className="w-3 h-3" />}
                            onSelect={toggleEnabled}
                        >
                            {s.enabled ? (isHe ? "השהה" : "Pause") : (isHe ? "המשך" : "Resume")}
                        </PopoverMenuItem>
                        <PopoverMenuItem icon={<PencilIcon className="w-3 h-3" />} onSelect={onEdit}>
                            {isHe ? "ערוך" : "Edit"}
                        </PopoverMenuItem>
                        <PopoverMenuSeparator />
                        <PopoverMenuItem icon={<Trash2Icon className="w-3 h-3" />} onSelect={remove} danger>
                            {isHe ? "מחק" : "Delete"}
                        </PopoverMenuItem>
                    </PopoverMenuContent>
                </PopoverMenu>
            </div>
        </div>
    );
}

function StatusBadge({ status, isHe }: { status: ApolloImportSource["status"]; isHe?: boolean }) {
    if (status === "running")
        return (
            <Pill tone="sky">
                <Loader2Icon className="w-2.5 h-2.5 animate-spin" />
                {isHe ? "רץ" : "Running"}
            </Pill>
        );
    if (status === "error") return <Pill tone="rose">{isHe ? "שגיאה" : "Error"}</Pill>;
    return <Pill tone="emerald">{isHe ? "ממתין" : "Idle"}</Pill>;
}

export function Count({ label, value, strong, tone }: { label: string; value: number; strong?: boolean; tone?: "rose" }) {
    return (
        <span className={cn(tone === "rose" && "text-rose-700")}>
            <span className={cn(strong ? "text-slate-900 font-medium" : "text-slate-700", tone === "rose" && "text-rose-700")}>
                {value.toLocaleString()}
            </span>{" "}
            {label}
        </span>
    );
}
