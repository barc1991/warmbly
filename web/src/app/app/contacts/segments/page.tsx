// Segments: saved contact audiences (issue #266). Each row is one segment
// with its live member count; clicking opens the segment's contact list.

import React from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontalIcon, PlusIcon } from "lucide-react";
import toast from "react-hot-toast";

import { EmptyBlock, Page, PageBody, PageTopbar, SectionBar, StatStrip, Stat, TopbarAction } from "@/components/layout/Page";
import { NoAccess } from "@/components/layout/NoAccess";
import { SearchInput } from "@/components/ui/field";
import {
    PopoverMenu,
    PopoverMenuContent,
    PopoverMenuItem,
    PopoverMenuSeparator,
    PopoverMenuTrigger,
} from "@/components/ui/popover-menu";
import SegmentEditor from "@/components/app/segments/SegmentEditor";
import AddSegmentToCampaignDialog from "@/components/app/segments/AddSegmentToCampaignDialog";
import { useConfirm } from "@/hooks/context/confirm";
import { usePermission, useWriteGuard } from "@/hooks/usePermission";
import { useCreateSegment, useDeleteSegment, useSegments } from "@/lib/api/hooks/app/segments";
import type Segment from "@/lib/api/models/app/segments/Segment";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";

export default function SegmentsPage() {
    const canView = usePermission("VIEW_CONTACTS");
    if (!canView) return <NoAccess feature="segments" permissionLabel="צפייה באנשי קשר" />;
    return <SegmentsList />;
}

function SegmentsList() {
    const navigate = useNavigate();
    const confirm = useConfirm();
    const write = useWriteGuard("MANAGE_CONTACTS");
    // Menu items and topbar actions take a bare () => void, so give the
    // permission guard an empty event to swallow.
    const guarded = (fn: () => void) => () => write.guard(fn)({});
    const campaigns = useWriteGuard("MANAGE_CAMPAIGNS");
    const campaignGuarded = (fn: () => void) => () => campaigns.guard(fn)({});
    const segments = useSegments();
    const remove = useDeleteSegment();
    const create = useCreateSegment();

    async function duplicate(s: Segment) {
        try {
            const copy = await create.mutateAsync({
                name: `${s.name} (עותק)`.slice(0, 120),
                description: s.description,
                color: s.color,
                match: s.match,
                conditions: s.conditions,
            });
            toast.success(`שוכפל בהצלחה כ-${copy.name}`);
            navigate(`/app/contacts/segments/${copy.id}`);
        } catch (err) {
            toast.error(buildError(err as AppError));
        }
    }

    const [query, setQuery] = React.useState("");
    const [editorOpen, setEditorOpen] = React.useState(false);
    const [editing, setEditing] = React.useState<Segment | null>(null);
    const [campaignFor, setCampaignFor] = React.useState<Segment | null>(null);

    const list = React.useMemo(() => {
        const all = segments.data ?? [];
        const q = query.trim().toLowerCase();
        if (!q) return all;
        return all.filter((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
    }, [segments.data, query]);

    const totals = React.useMemo(() => {
        const all = segments.data ?? [];
        return {
            segments: all.length,
            contacts: all.reduce((n, s) => n + s.contact_count, 0),
            manual: all.reduce((n, s) => n + s.included_count + s.excluded_count, 0),
            largest: all.reduce<Segment | null>((best, s) => (!best || s.contact_count > best.contact_count ? s : best), null),
        };
    }, [segments.data]);

    function openNew() {
        setEditing(null);
        setEditorOpen(true);
    }

    function openEdit(s: Segment) {
        setEditing(s);
        setEditorOpen(true);
    }

    // The ID is what the segments API takes; copying needs no write permission.
    async function copyId(s: Segment) {
        try {
            await navigator.clipboard.writeText(s.id);
            toast.success("מזהה הסגמנט הועתק");
        } catch {
            toast.error("ההעתקה נכשלה");
        }
    }

    function askDelete(s: Segment) {
        confirm.show(`למחוק את הסגמנט "${s.name}"? אנשי הקשר עצמם יישמרו.`, async () => {
            try {
                await remove.mutateAsync(s.id);
                toast.success("הסגמנט נמחק");
            } catch (err) {
                toast.error(buildError(err as AppError));
            }
        });
    }

    return (
        <Page>
            <PageTopbar eyebrow="סגמנטים" subtitle="קהלי יעד לשימוש חוזר המבוססים על נתוני אנשי קשר">
                <TopbarAction icon={<PlusIcon className="w-3 h-3" />} onClick={guarded(openNew)}>
                    סגמנט חדש
                </TopbarAction>
            </PageTopbar>

            <StatStrip cols={3}>
                <Stat label="סגמנטים" value={totals.segments} sub="קהלים שמורים" />
                <Stat label="חברויות" value={totals.contacts.toLocaleString()} sub="בכל הסגמנטים" accent={totals.contacts > 0} />
                <Stat
                    label="הגדול ביותר"
                    value={totals.largest ? totals.largest.contact_count.toLocaleString() : "0"}
                    sub={totals.largest ? totals.largest.name : "אין עדיין סגמנטים"}
                    last
                />
            </StatStrip>

            <SectionBar label="כל הסגמנטים" count={list.length}>
                <SearchInput value={query} onChange={setQuery} placeholder="חיפוש סגמנטים…" className="w-full sm:w-64" />
            </SectionBar>

            <PageBody>
                {segments.isPending ? (
                    <div className="p-3 space-y-1.5">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-11 rounded-md bg-slate-100 animate-pulse" />
                        ))}
                    </div>
                ) : segments.isError ? (
                    <EmptyBlock title="לא ניתן לטעון סגמנטים" body="נסה שוב בעוד רגע." />
                ) : list.length === 0 ? (
                    <EmptyBlock
                        title={query ? "לא נמצאו סגמנטים מתאימים" : "אין עדיין סגמנטים"}
                        body={
                            query
                                ? "נסה חיפוש אחר."
                                : "בנה קהל יעד משדות איש קשר, קטגוריות, פעילות קמפיין ומעורבות, והוסף אותו לקמפיין בלחיצה אחת."
                        }
                        cta={
                            query ? undefined : (
                                <TopbarAction icon={<PlusIcon className="w-3 h-3" />} onClick={guarded(openNew)}>
                                    סגמנט חדש
                                </TopbarAction>
                            )
                        }
                    />
                ) : (
                    <div>
                        {list.map((s) => (
                            <div
                                key={s.id}
                                role="link"
                                tabIndex={0}
                                onClick={() => navigate(`/app/contacts/segments/${s.id}`)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") navigate(`/app/contacts/segments/${s.id}`);
                                }}
                                className="group h-11 px-5 flex items-center gap-3 border-b border-slate-200/60 transition-colors hover:bg-slate-50/80 cursor-pointer"
                            >
                                <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-[12.5px] font-medium text-slate-900 truncate">{s.name}</span>
                                        {s.conditions.length === 0 && (
                                            <span className="inline-flex items-center h-4 px-1 rounded bg-slate-100 text-slate-500 text-[10px] font-medium">
                                                ידני
                                            </span>
                                        )}
                                    </div>
                                    {s.description && <div className="text-[11px] text-slate-500 truncate">{s.description}</div>}
                                </div>
                                <span className="hidden md:inline text-[11px] text-slate-400 tabular-nums shrink-0">
                                    {s.conditions.length} {s.conditions.length === 1 ? "תנאי" : "תנאים"}
                                    {s.match === "any" && s.conditions.length > 1 ? " · אחד מהם" : ""}
                                </span>
                                <span className="font-mono text-[12px] text-slate-900 tabular-nums w-20 text-end shrink-0">
                                    {s.contact_count.toLocaleString()}
                                </span>
                                <span className="text-[10.5px] uppercase tracking-[0.1em] text-slate-400 w-16 shrink-0 hidden sm:inline">
                                    אנשי קשר
                                </span>
                                <PopoverMenu align="end">
                                    <PopoverMenuTrigger asChild>
                                        <button
                                            type="button"
                                            onClick={(e) => e.stopPropagation()}
                                            aria-label="עוד"
                                            className="size-7 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center justify-center transition-colors shrink-0"
                                        >
                                            <MoreHorizontalIcon className="w-3.5 h-3.5" />
                                        </button>
                                    </PopoverMenuTrigger>
                                    <PopoverMenuContent minWidth={180}>
                                        <PopoverMenuItem onSelect={() => navigate(`/app/contacts/segments/${s.id}`)}>צפייה באנשי קשר</PopoverMenuItem>
                                        <PopoverMenuItem onSelect={guarded(() => openEdit(s))}>עריכת תנאים</PopoverMenuItem>
                                        <PopoverMenuItem onSelect={campaignGuarded(() => setCampaignFor(s))}>הוסף לקמפיין</PopoverMenuItem>
                                        <PopoverMenuItem onSelect={guarded(() => duplicate(s))}>שכפל</PopoverMenuItem>
                                        <PopoverMenuItem onSelect={() => copyId(s)}>העתק מזהה סגמנט</PopoverMenuItem>
                                        <PopoverMenuSeparator />
                                        <PopoverMenuItem onSelect={guarded(() => askDelete(s))}>מחק</PopoverMenuItem>
                                    </PopoverMenuContent>
                                </PopoverMenu>
                            </div>
                        ))}
                    </div>
                )}
            </PageBody>

            <SegmentEditor
                open={editorOpen}
                onClose={() => setEditorOpen(false)}
                segment={editing}
                onSaved={(saved) => {
                    if (!editing) navigate(`/app/contacts/segments/${saved.id}`);
                }}
            />
            {campaignFor && (
                <AddSegmentToCampaignDialog open={!!campaignFor} onClose={() => setCampaignFor(null)} segment={campaignFor} />
            )}
        </Page>
    );
}
