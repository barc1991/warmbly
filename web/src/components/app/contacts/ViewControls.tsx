// The toolbar controls of a saved view: which columns the contacts table shows
// (with drag to reorder) and how it sorts. Both write through the member's view
// preferences, so the list looks the same on their next visit and on their
// other devices. Fully in Hebrew and RTL.

import React from "react";
import { Reorder, useDragControls } from "framer-motion";
import { ArrowDownIcon, ArrowUpIcon, Columns3Icon, GripVerticalIcon, LockIcon, RotateCcwIcon } from "lucide-react";
import { CheckSquare } from "@/components/ui/check-square";
import type { SearchContactsSortBy } from "@/lib/api/models/app/contacts/search-contacts.types";
import {
    PopoverMenu,
    PopoverMenuContent,
    PopoverMenuItem,
    PopoverMenuLabel,
    PopoverMenuSeparator,
    PopoverMenuTrigger,
    SelectButton,
} from "@/components/ui/popover-menu";
import { customColumnId, type ContactColumn, type SortOption } from "./columns";

export interface ViewSortState {
    by: SearchContactsSortBy;
    reverse: boolean;
}

function ColumnLabel({ col }: { col: ContactColumn }) {
    return (
        <>
            <span className="truncate">{col.label}</span>
            {col.custom && (
                <span className="mr-auto shrink-0 text-[10px] uppercase tracking-[0.08em] text-slate-400">מותאם אישית</span>
            )}
        </>
    );
}

function ShownRow({
    col,
    onHide,
    onDragEnd,
    onMove,
}: {
    col: ContactColumn;
    onHide: () => void;
    onDragEnd: () => void;
    onMove: (delta: -1 | 1) => void;
}) {
    const controls = useDragControls();
    return (
        <Reorder.Item
            as="div"
            value={col}
            dragListener={false}
            dragControls={controls}
            onDragEnd={onDragEnd}
            className="relative bg-white"
        >
            <div className="mx-1 h-7 pl-1 pr-2 flex items-center gap-1.5 rounded text-[12px] text-slate-700 hover:bg-slate-100 transition-colors">
                <button
                    type="button"
                    onPointerDown={(e) => controls.start(e)}
                    onKeyDown={(e) => {
                        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                        e.preventDefault();
                        onMove(e.key === "ArrowUp" ? -1 : 1);
                    }}
                    className="size-5 flex items-center justify-center rounded cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:text-slate-600 touch-none"
                    aria-label={`הזז ${col.label}: גרור, או השתמש במקשי החצים מעלה ומטה`}
                >
                    <GripVerticalIcon className="w-3 h-3" />
                </button>
                <button type="button" onClick={onHide} className="flex-1 min-w-0 h-full flex items-center gap-2 text-start">
                    <CheckSquare checked />
                    <ColumnLabel col={col} />
                </button>
            </div>
        </Reorder.Item>
    );
}

function PlainRow({ col, checked, onClick }: { col: ContactColumn; checked: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="w-[calc(100%-8px)] mx-1 h-7 pl-1 pr-2 flex items-center gap-1.5 rounded text-[12px] text-slate-700 hover:bg-slate-100 transition-colors text-start"
        >
            <span className="size-5 shrink-0" />
            <CheckSquare checked={checked} />
            <ColumnLabel col={col} />
        </button>
    );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
    return (
        <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium text-start">{children}</div>
    );
}

export function ColumnChooser({
    visible,
    available,
    customized,
    onChange,
    onReset,
}: {
    visible: ContactColumn[];
    available: ContactColumn[];
    customized: boolean;
    onChange: (ids: string[]) => void;
    onReset: () => void;
}) {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const q = query.trim().toLowerCase();
    const matches = (c: ContactColumn) => !q || c.label.toLowerCase().includes(q);

    const locked = visible.filter((c) => c.locked);
    const shown = visible.filter((c) => !c.locked);
    const layout = (cols: ContactColumn[]) => [...locked.map((c) => c.id), ...cols.map((c) => c.id)];
    const hide = (id: string) => onChange(layout(shown.filter((x) => x.id !== id)));
    const show = (id: string) => onChange(layout([...shown, ...available.filter((c) => c.id === id)]));

    const [order, setOrder] = React.useState(shown);
    const shownKey = shown.map((c) => c.id).join("|");
    React.useEffect(() => {
        setOrder(shown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shownKey]);
    const orderRef = React.useRef(order);
    orderRef.current = order;
    const commitOrder = () => {
        const next = layout(orderRef.current);
        if (next.join("|") !== layout(shown).join("|")) onChange(next);
    };
    const moveBy = (id: string, delta: -1 | 1) => {
        const cur = orderRef.current;
        const from = cur.findIndex((c) => c.id === id);
        const to = from + delta;
        if (from < 0 || to < 0 || to >= cur.length) return;
        const next = [...cur];
        [next[from], next[to]] = [next[to], next[from]];
        setOrder(next);
        onChange(layout(next));
    };

    const builtinAvail = available.filter((c) => !c.custom && matches(c));
    const customAvail = available.filter((c) => !!c.custom && matches(c));
    const shownMatches = shown.filter(matches);
    const nothing = shownMatches.length === 0 && builtinAvail.length === 0 && customAvail.length === 0 && !locked.some(matches);

    return (
        <PopoverMenu align="start" open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
            <PopoverMenuTrigger asChild>
                <SelectButton
                    icon={<Columns3Icon className="w-3.5 h-3.5" />}
                    label="עמודות"
                    className={customized ? "border-sky-200 text-sky-700 hover:text-sky-800" : undefined}
                    aria-label="בחירת עמודות"
                />
            </PopoverMenuTrigger>
            <PopoverMenuContent minWidth={272} className="py-0 w-[272px] text-right">
                <div className="px-2 py-1.5 border-b border-slate-200">
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="חיפוש עמודות…"
                        autoFocus
                        className="w-full h-5 bg-transparent text-[12px] text-slate-900 placeholder:text-slate-400 outline-none text-right"
                    />
                </div>
                <div className="max-h-[min(60vh,420px)] overflow-y-auto pb-1">
                    {nothing && (
                        <div className="px-3 py-4 text-[11.5px] text-slate-400 text-center">לא נמצאו עמודות מתאימות.</div>
                    )}
                    {(locked.some(matches) || shownMatches.length > 0) && (
                        <GroupLabel>{q ? "מוצגות" : "מוצגות · גרור לשינוי סדר"}</GroupLabel>
                    )}
                    {locked.filter(matches).map((col) => (
                        <div
                            key={col.id}
                            className="mx-1 h-7 pl-1 pr-2 flex items-center gap-1.5 rounded text-[12px] text-slate-500"
                            title="מוצג תמיד"
                        >
                            <span className="size-5 flex items-center justify-center text-slate-300">
                                <LockIcon className="w-3 h-3" />
                            </span>
                            <CheckSquare checked />
                            <span className="truncate">{col.label}</span>
                        </div>
                    ))}
                    {q ? (
                        shownMatches.map((col) => (
                            <PlainRow key={col.id} col={col} checked onClick={() => hide(col.id)} />
                        ))
                    ) : (
                        <Reorder.Group as="div" axis="y" values={order} onReorder={setOrder}>
                            {order.map((col) => (
                                <ShownRow
                                    key={col.id}
                                    col={col}
                                    onHide={() => hide(col.id)}
                                    onDragEnd={commitOrder}
                                    onMove={(d) => moveBy(col.id, d)}
                                />
                            ))}
                        </Reorder.Group>
                    )}
                    {builtinAvail.length > 0 && (
                        <>
                            <GroupLabel>זמינות להצגה</GroupLabel>
                            {builtinAvail.map((col) => (
                                <PlainRow key={col.id} col={col} checked={false} onClick={() => show(col.id)} />
                            ))}
                        </>
                    )}
                    {customAvail.length > 0 && (
                        <>
                            <GroupLabel>שדות מותאמים אישית</GroupLabel>
                            {customAvail.map((col) => (
                                <PlainRow key={col.id} col={col} checked={false} onClick={() => show(col.id)} />
                            ))}
                        </>
                    )}
                </div>
                <div className="px-2 py-1.5 border-t border-slate-200 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400 tabular-nums">
                        {visible.length} מתוך {visible.length + available.length} מוצגות
                    </span>
                    <button
                        type="button"
                        disabled={!customized}
                        onClick={() => { onReset(); setOpen(false); }}
                        className="h-6 px-2 rounded inline-flex items-center gap-1 text-[11.5px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                    >
                        <RotateCcwIcon className="w-3 h-3" />
                        אפס לברירת מחדל
                    </button>
                </div>
            </PopoverMenuContent>
        </PopoverMenu>
    );
}

export function SortMenu({
    sort,
    options,
    customKeys,
    onChange,
}: {
    sort: ViewSortState;
    options: SortOption[];
    customKeys: string[];
    onChange: (next: ViewSortState) => void;
}) {
    const active = [...options, ...customKeys.map((k) => ({ key: customColumnId(k) as SearchContactsSortBy, label: k }))]
        .find((o) => o.key === sort.by);
    const Dir = sort.reverse ? ArrowUpIcon : ArrowDownIcon;
    return (
        <PopoverMenu align="start">
            <PopoverMenuTrigger asChild>
                <SelectButton
                    icon={<Dir className="w-3.5 h-3.5" />}
                    label={active ? active.label : "מיון"}
                    aria-label="מיון"
                />
            </PopoverMenuTrigger>
            <PopoverMenuContent className="max-h-[min(60vh,420px)] overflow-y-auto text-right">
                <PopoverMenuLabel>מיין לפי</PopoverMenuLabel>
                {options.map((o) => (
                    <PopoverMenuItem
                        key={o.key}
                        selected={sort.by === o.key}
                        onSelect={() => onChange({ by: o.key, reverse: sort.by === o.key ? sort.reverse : o.asc })}
                    >
                        {o.label}
                    </PopoverMenuItem>
                ))}
                {customKeys.length > 0 && (
                    <>
                        <PopoverMenuSeparator />
                        <PopoverMenuLabel>שדות מותאמים אישית</PopoverMenuLabel>
                        {customKeys.map((k) => {
                            const key = customColumnId(k) as SearchContactsSortBy;
                            return (
                                <PopoverMenuItem
                                    key={key}
                                    selected={sort.by === key}
                                    onSelect={() => onChange({ by: key, reverse: sort.by === key ? sort.reverse : true })}
                                >
                                    {k}
                                </PopoverMenuItem>
                            );
                        })}
                    </>
                )}
                <PopoverMenuSeparator />
                <PopoverMenuItem
                    selected={sort.reverse}
                    onSelect={() => onChange({ ...sort, reverse: !sort.reverse })}
                    closeOnSelect={false}
                >
                    סדר הפוך
                </PopoverMenuItem>
            </PopoverMenuContent>
        </PopoverMenu>
    );
}
