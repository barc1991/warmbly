// Categories tab: the workspace's contact labels with a live contact count,
// inline rename, color, create and delete. Clicking a row opens the contact
// list filtered to that category.

import React from "react";
import { useNavigate } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { CheckIcon, MoreHorizontalIcon, PlusIcon, XIcon } from "lucide-react";
import toast from "react-hot-toast";

import { EmptyBlock, Page, PageBody, PageTopbar, SectionBar, TopbarAction } from "@/components/layout/Page";
import { SearchInput, TextInput } from "@/components/ui/field";
import {
    PopoverMenu,
    PopoverMenuContent,
    PopoverMenuItem,
    PopoverMenuSeparator,
    PopoverMenuTrigger,
} from "@/components/ui/popover-menu";
import { useConfirm } from "@/hooks/context/confirm";
import { useUserProfile } from "@/hooks/context/user";
import { useWriteGuard } from "@/hooks/usePermission";
import useCreateCategory from "@/lib/api/hooks/app/categories/useCreateCategory";
import useDeleteCategory from "@/lib/api/hooks/app/categories/useDeleteCategory";
import useUpdateCategory from "@/lib/api/hooks/app/categories/useUpdateCategory";
import { previewSegment } from "@/lib/api/client/app/segments";
import type Category from "@/lib/api/models/app/Category";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import { cn } from "@/lib/utils";

const COLORS = ["#0284c7", "#7c3aed", "#db2777", "#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#0d9488", "#475569"];

export default function CategoriesPage() {
    const { user } = useUserProfile();
    const write = useWriteGuard("MANAGE_CONTACTS");
    const guarded = (fn: () => void) => () => write.guard(fn)({});
    const create = useCreateCategory();
    const [query, setQuery] = React.useState("");
    const [creating, setCreating] = React.useState(false);
    const [newTitle, setNewTitle] = React.useState("");

    const categories = React.useMemo(
        () => [...(user.categories ?? [])].sort((a, b) => a.position - b.position),
        [user.categories],
    );
    const list = React.useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? categories.filter((c) => c.title.toLowerCase().includes(q)) : categories;
    }, [categories, query]);

    // One live count per category through the segment preview, so the number
    // agrees with what a "has any of" condition would match.
    const counts = useQueries({
        queries: categories.map((c) => ({
            queryKey: ["segments", "preview", "category", c.id],
            queryFn: () => previewSegment({ match: "all", conditions: [{ field: "category", operator: "in", values: [c.id] }] }),
            staleTime: 30_000,
        })),
    });
    const countById = new Map<string, number | undefined>();
    categories.forEach((c, i) => countById.set(c.id, counts[i]?.data));

    async function submitCreate() {
        const title = newTitle.trim();
        if (!title || create.isPending) return;
        try {
            await create.mutateAsync(title);
            toast.success(`נוצרה קטגוריה: ${title}`);
            setNewTitle("");
            setCreating(false);
        } catch (err) {
            toast.error(buildError(err as AppError));
        }
    }

    return (
        <Page>
            <PageTopbar eyebrow="קטגוריות" subtitle="תגיות המשויכות לאנשי קשר ידנית, בייבוא או מרצף שליחה">
                <TopbarAction icon={<PlusIcon className="w-3 h-3" />} onClick={guarded(() => setCreating(true))}>
                    קטגוריה חדשה
                </TopbarAction>
            </PageTopbar>

            <SectionBar label="כל הקטגוריות" count={list.length}>
                <SearchInput value={query} onChange={setQuery} placeholder="חיפוש קטגוריות…" className="w-full sm:w-64" />
            </SectionBar>

            <PageBody>
                {creating && (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            void submitCreate();
                        }}
                        className="h-11 px-5 flex items-center gap-2 border-b border-slate-200/60 bg-sky-50/40"
                    >
                        <TextInput value={newTitle} onChange={setNewTitle} placeholder="שם הקטגוריה" autoFocus className="w-64" />
                        <button
                            type="submit"
                            disabled={!newTitle.trim() || create.isPending}
                            className="h-7 px-2.5 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-[12px] font-medium transition-colors disabled:opacity-50"
                        >
                            צור
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setCreating(false);
                                setNewTitle("");
                            }}
                            className="h-7 px-2.5 rounded-md text-[12px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                        >
                            ביטול
                        </button>
                    </form>
                )}
                {list.length === 0 ? (
                    <EmptyBlock
                        title={query ? "לא נמצאו קטגוריות מתאימות" : "אין עדיין קטגוריות"}
                        body={
                            query
                                ? "נסה חיפוש אחר."
                                : "קטגוריות הן תגיות המשויכות לאיש קשר. צור קטגוריה כאן, בדף איש קשר, או באמצעות מיפוי עמודה בעת ייבוא."
                        }
                        cta={
                            query ? undefined : (
                                <TopbarAction icon={<PlusIcon className="w-3 h-3" />} onClick={guarded(() => setCreating(true))}>
                                    קטגוריה חדשה
                                </TopbarAction>
                            )
                        }
                    />
                ) : (
                    <div>
                        {list.map((c) => (
                            <CategoryRow key={c.id} category={c} count={countById.get(c.id)} />
                        ))}
                    </div>
                )}
            </PageBody>
        </Page>
    );
}

function CategoryRow({ category, count }: { category: Category; count?: number }) {
    const navigate = useNavigate();
    const confirm = useConfirm();
    const write = useWriteGuard("MANAGE_CONTACTS");
    const guarded = (fn: () => void) => () => write.guard(fn)({});
    const update = useUpdateCategory(category.id);
    const remove = useDeleteCategory(category.id);
    const [renaming, setRenaming] = React.useState(false);
    const [title, setTitle] = React.useState(category.title);

    const open = () => navigate(`/app/contacts?category=${category.id}`);

    async function submitRename() {
        const next = title.trim();
        if (!next || next === category.title) {
            setRenaming(false);
            setTitle(category.title);
            return;
        }
        try {
            await update.mutateAsync({ title: next });
            toast.success("שם הקטגוריה עודכן");
            setRenaming(false);
        } catch (err) {
            toast.error(buildError(err as AppError));
        }
    }

    async function setColor(color: string) {
        if (color === category.color) return;
        try {
            await update.mutateAsync({ color });
        } catch (err) {
            toast.error(buildError(err as AppError));
        }
    }

    function askDelete() {
        confirm.show(`למחוק את הקטגוריה "${category.title}"? היא תוסר מכל אנשי הקשר והשרשורים; אנשי הקשר עצמם יישמרו.`, async () => {
            try {
                await remove.mutateAsync();
                toast.success("הקטגוריה נמחקה");
            } catch (err) {
                toast.error(buildError(err as AppError));
            }
        });
    }

    return (
        <div
            role="link"
            tabIndex={0}
            onClick={() => {
                if (!renaming) open();
            }}
            onKeyDown={(e) => {
                if (e.key === "Enter" && !renaming) open();
            }}
            className="group h-11 px-5 flex items-center gap-3 border-b border-slate-200/60 transition-colors hover:bg-slate-50/80 cursor-pointer"
        >
            <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: category.color }} />
            <div className="min-w-0 flex-1" onClick={(e) => renaming && e.stopPropagation()}>
                {renaming ? (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            void submitRename();
                        }}
                        className="flex items-center gap-1.5"
                    >
                        <TextInput value={title} onChange={setTitle} autoFocus className="w-64" />
                        <button type="submit" aria-label="שמור" className="size-7 rounded-md text-emerald-700 hover:bg-emerald-50 inline-flex items-center justify-center">
                            <CheckIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            aria-label="ביטול"
                            onClick={() => {
                                setRenaming(false);
                                setTitle(category.title);
                            }}
                            className="size-7 rounded-md text-slate-500 hover:bg-slate-100 inline-flex items-center justify-center"
                        >
                            <XIcon className="w-3.5 h-3.5" />
                        </button>
                    </form>
                ) : (
                    <span className="text-[12.5px] font-medium text-slate-900 truncate">{category.title}</span>
                )}
            </div>
            <span className="font-mono text-[12px] text-slate-900 tabular-nums w-20 text-end shrink-0">
                {count === undefined ? <span className="text-slate-300">…</span> : count.toLocaleString()}
            </span>
            <span className="text-[10.5px] uppercase tracking-[0.1em] text-slate-400 w-16 shrink-0 hidden sm:inline">אנשי קשר</span>
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
                <PopoverMenuContent minWidth={200}>
                    <PopoverMenuItem onSelect={open}>צפייה באנשי קשר</PopoverMenuItem>
                    <PopoverMenuItem onSelect={guarded(() => setRenaming(true))}>שנה שם</PopoverMenuItem>
                    <div className="px-2.5 py-1.5 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {COLORS.map((color) => (
                            <button
                                key={color}
                                type="button"
                                aria-label={`בחר צבע ${color}`}
                                onClick={guarded(() => void setColor(color))}
                                className={cn(
                                    "size-4 rounded-full border-2 transition-transform hover:scale-110",
                                    color === category.color ? "border-slate-900" : "border-transparent",
                                )}
                                style={{ backgroundColor: color }}
                            />
                        ))}
                    </div>
                    <PopoverMenuSeparator />
                    <PopoverMenuItem onSelect={guarded(askDelete)}>מחק</PopoverMenuItem>
                </PopoverMenuContent>
            </PopoverMenu>
        </div>
    );
}
