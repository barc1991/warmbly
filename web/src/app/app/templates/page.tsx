// Templates — reusable subject + body for replies and cold opens.
//
// Layout mirrors the rest of the app (slate-900, hairline dividers, 12.5px
// text). A list of template rows on top, a modal editor that opens in
// place. Drag-style reordering is replaced with up/down chevrons so the
// page stays accessible without a dnd lib.

import React from "react";
import {
    CopyIcon,
    FileTextIcon,
    Loader2Icon,
    MoreHorizontalIcon,
    PencilIcon,
    PlusIcon,
    SearchIcon,
    TrashIcon,
    XIcon,
    ChevronUpIcon,
    ChevronDownIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { AnimatePresence, motion } from "framer-motion";
import {
    Page,
    PageBody,
    PageTopbar,
    SectionBar,
    Stat,
    StatStrip,
    TopbarAction,
} from "@/components/layout/Page";
import { Label, TextInput } from "@/components/ui/field";
import {
    PopoverMenu,
    PopoverMenuContent,
    PopoverMenuItem,
    PopoverMenuLabel,
    PopoverMenuSeparator,
    PopoverMenuTrigger,
} from "@/components/ui/popover-menu";
import useCustomFieldKeys from "@/lib/api/hooks/app/contacts/useCustomFieldKeys";
import { STANDARD_VARS, VARIABLES, buildToken, isStandardKey } from "@/lib/templateVars";
import useTemplates from "@/lib/api/hooks/app/templates/useTemplates";
import useCreateTemplate from "@/lib/api/hooks/app/templates/useCreateTemplate";
import useUpdateTemplate from "@/lib/api/hooks/app/templates/useUpdateTemplate";
import useDeleteTemplate from "@/lib/api/hooks/app/templates/useDeleteTemplate";
import useDuplicateTemplate from "@/lib/api/hooks/app/templates/useDuplicateTemplate";
import useReorderTemplates from "@/lib/api/hooks/app/templates/useReorderTemplates";
import { useConfirm } from "@/hooks/context/confirm";
import { usePresenceResource } from "@/hooks/PresenceProvider";
import { useSuppressGlobalCursors } from "@/components/app/presence/GlobalCursors";
import ResourceViewers from "@/components/app/presence/ResourceViewers";
import type Template from "@/lib/api/models/app/templates/Template";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import { TEMPLATE_PRESETS, type TemplatePreset } from "./presets";

// Standard merge fields come from the shared catalog (@/lib/templateVars) so
// this surface never drifts from the campaign editor or the send-time renderer.
const VARIABLE_HINTS = VARIABLES;

export default function TemplatesPage() {
    const [search, setSearch] = React.useState("");
    const [debouncedSearch, setDebouncedSearch] = React.useState("");
    React.useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 200);
        return () => clearTimeout(t);
    }, [search]);

    const query = useTemplates(debouncedSearch || undefined);
    const list = query.data ?? [];

    const [editor, setEditor] = React.useState<
        | { mode: "create" }
        | { mode: "edit"; template: Template }
        | null
    >(null);

    const lastEdited = React.useMemo(() => {
        if (list.length === 0) return "-";
        const max = list.reduce(
            (acc, t) => Math.max(acc, new Date(t.updated_at).getTime()),
            0,
        );
        if (!max) return "-";
        return new Date(max).toLocaleDateString("he-IL", {
            month: "short",
            day: "numeric",
        });
    }, [list]);

    return (
        <Page>
            <PageTopbar
                eyebrow="תבניות"
                subtitle="נושא ותוכן לשימוש חוזר עבור פניות, מעקבים ותשובות"
            >
                <TopbarAction
                    icon={<PlusIcon className="w-3 h-3" />}
                    onClick={() => setEditor({ mode: "create" })}
                >
                    תבנית חדשה
                </TopbarAction>
            </PageTopbar>

            <StatStrip cols={4}>
                <Stat label="שמורות" value={list.length} sub="טיוטות לשימוש חוזר" />
                <Stat label="חיפוש" value={debouncedSearch ? "פעיל" : "ללא"} sub="סינון פעיל" />
                <Stat label="עריכה אחרונה" value={lastEdited} sub="תבנית כלשהי" />
                <Stat label="משתנים" value={VARIABLE_HINTS.length} sub="מובנים במערכת" last />
            </StatStrip>

            <div className="px-5 py-3 border-b border-slate-200/60 flex items-center gap-2">
                <div className="relative flex-1 max-w-[360px]">
                    <SearchIcon className="absolute start-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="חיפוש לפי שם או נושא…"
                        className="w-full h-7 ps-7 pe-7 rounded-md border border-slate-200 bg-white text-[12.5px] text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-sky-400 focus:ring-2 focus:ring-sky-100 text-start"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch("")}
                            aria-label="נקה חיפוש"
                            className="absolute end-1 top-1/2 -translate-y-1/2 size-5 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center justify-center"
                        >
                            <XIcon className="w-3 h-3" />
                        </button>
                    )}
                </div>
                <span className="text-[11px] text-slate-400 font-mono tabular-nums ms-auto">
                    {list.length} {list.length === 1 ? "תבנית" : "תבניות"}
                </span>
            </div>

            <SectionBar label={query.isPending ? "טוען…" : `${list.length} תבניות`} />
            <PageBody className="px-3 py-4 sm:px-5 sm:py-5">
                {query.isPending ? (
                    <SkeletonRows />
                ) : list.length === 0 ? (
                    debouncedSearch ? (
                        <EmptySearch
                            search={debouncedSearch}
                            onClear={() => setSearch("")}
                        />
                    ) : (
                        <EmptyState onCreate={() => setEditor({ mode: "create" })} />
                    )
                ) : (
                    <TemplateList
                        templates={list}
                        onEdit={(t) => setEditor({ mode: "edit", template: t })}
                    />
                )}
            </PageBody>

            <TemplateEditor
                state={editor}
                onClose={() => setEditor(null)}
            />
        </Page>
    );
}

function SkeletonRows() {
    return (
        <div className="space-y-2">
            {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 rounded-md bg-slate-100 animate-pulse" />
            ))}
        </div>
    );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
    return (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/40 p-8 text-center">
            <div className="mx-auto size-9 rounded-md bg-white border border-slate-200 flex items-center justify-center mb-3">
                <FileTextIcon className="w-4 h-4 text-slate-400" />
            </div>
            <h3 className="text-[13px] font-semibold text-slate-900 mb-1">
                אין תבניות עדיין
            </h3>
            <p className="text-[12px] text-slate-500 max-w-md mx-auto mb-4 leading-relaxed">
                שמור את הפניות והמעקבים שאתה שולח באופן קבוע.
                שלב משתנים כמו {VARIABLE_HINTS[0]} או {VARIABLE_HINTS[3]} כך שכל
                שליחה תכלול את פרטי איש הקשר המתאימים.
            </p>
            <button
                type="button"
                onClick={onCreate}
                className="h-7 px-3 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors"
            >
                <PlusIcon className="w-3 h-3" />
                צור תבנית ראשונה
            </button>
        </div>
    );
}

function EmptySearch({ search, onClear }: { search: string; onClear: () => void }) {
    return (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/40 p-6 text-center">
            <p className="text-[12px] text-slate-500 mb-3">
                לא נמצאו תבניות התואמות את <span className="font-mono text-slate-700">"{search}"</span>.
            </p>
            <button
                type="button"
                onClick={onClear}
                className="h-7 px-3 rounded-md border border-slate-200 hover:border-slate-300 text-[12px] text-slate-700 hover:text-slate-900 inline-flex items-center gap-1.5 transition-colors"
            >
                נקה חיפוש
            </button>
        </div>
    );
}

function TemplateList({
    templates,
    onEdit,
}: {
    templates: Template[];
    onEdit: (t: Template) => void;
}) {
    const reorder = useReorderTemplates();

    async function move(idx: number, dir: -1 | 1) {
        const next = idx + dir;
        if (next < 0 || next >= templates.length) return;
        const ids = templates.map((t) => t.id);
        const [moved] = ids.splice(idx, 1);
        ids.splice(next, 0, moved);
        try {
            await reorder.mutateAsync(ids);
        } catch (e) {
            toast.error(buildError(e as AppError));
        }
    }

    return (
        <div className="rounded-md border border-slate-200 bg-white divide-y divide-slate-200 overflow-hidden">
            {templates.map((t, idx) => (
                <TemplateRow
                    key={t.id}
                    template={t}
                    index={idx}
                    total={templates.length}
                    onEdit={() => onEdit(t)}
                    onMoveUp={() => move(idx, -1)}
                    onMoveDown={() => move(idx, 1)}
                    reordering={reorder.isPending}
                />
            ))}
        </div>
    );
}

function TemplateRow({
    template,
    index,
    total,
    onEdit,
    onMoveUp,
    onMoveDown,
    reordering,
}: {
    template: Template;
    index: number;
    total: number;
    onEdit: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    reordering: boolean;
}) {
    const duplicate = useDuplicateTemplate();
    const del = useDeleteTemplate();
    const confirm = useConfirm();
    const [menuOpen, setMenuOpen] = React.useState(false);

    const preview = previewText(template);

    async function doDuplicate() {
        try {
            await toast.promise(duplicate.mutateAsync(template.id), {
                loading: "משכפל…",
                success: "התבנית שוכפלה",
                error: (e: AppError) => buildError(e),
            });
        } catch {
            /* surfaced */
        }
    }

    function doDelete() {
        confirm?.show(`למחוק את התבנית "${template.name}"? לא ניתן לבטל פעולה זו.`, async () => {
            try {
                await toast.promise(del.mutateAsync(template.id), {
                    loading: "מוחק…",
                    success: "התבנית נמחקה",
                    error: (e: AppError) => buildError(e),
                });
            } catch {
                /* surfaced */
            }
        });
    }

    return (
        <div className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50/60 transition-colors">
            <div className="flex flex-col items-center gap-0.5 pt-1 shrink-0">
                <button
                    type="button"
                    onClick={onMoveUp}
                    disabled={index === 0 || reordering}
                    aria-label="העבר למעלה"
                    className="size-5 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center justify-center disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                >
                    <ChevronUpIcon className="w-3 h-3" />
                </button>
                <span className="text-[10px] font-mono text-slate-400 tabular-nums leading-none">
                    {index + 1}
                </span>
                <button
                    type="button"
                    onClick={onMoveDown}
                    disabled={index === total - 1 || reordering}
                    aria-label="העבר למטה"
                    className="size-5 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center justify-center disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                >
                    <ChevronDownIcon className="w-3 h-3" />
                </button>
            </div>

            <button
                type="button"
                onClick={onEdit}
                className="flex-1 min-w-0 text-start"
            >
                <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[12.5px] font-semibold text-slate-900 truncate">
                        {template.name}
                    </span>
                    <span className="hidden sm:inline text-[10.5px] font-mono text-slate-400 tabular-nums shrink-0">
                        נערך {formatRelative(template.updated_at)}
                    </span>
                </div>
                {template.subject && (
                    <div className="text-[11.5px] text-slate-600 truncate mb-0.5">
                        <span className="text-slate-400 me-1">נושא:</span>
                        {template.subject}
                    </div>
                )}
                {preview && (
                    <div className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed break-words">
                        {preview}
                    </div>
                )}
            </button>

            <div className="shrink-0">
                <PopoverMenu open={menuOpen} onOpenChange={setMenuOpen} align="end">
                    <PopoverMenuTrigger asChild>
                        <button
                            type="button"
                            aria-label="תפריט תבנית"
                            className="size-7 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center justify-center transition-colors"
                        >
                            <MoreHorizontalIcon className="w-3.5 h-3.5" />
                        </button>
                    </PopoverMenuTrigger>
                    <PopoverMenuContent minWidth={176} className="text-start">
                        <PopoverMenuItem
                            onSelect={onEdit}
                            icon={<PencilIcon className="w-3 h-3" />}
                        >
                            עריכה
                        </PopoverMenuItem>
                        <PopoverMenuItem
                            onSelect={doDuplicate}
                            disabled={duplicate.isPending}
                            icon={<CopyIcon className="w-3 h-3" />}
                        >
                            שכפול
                        </PopoverMenuItem>
                        <PopoverMenuSeparator />
                        <PopoverMenuItem
                            onSelect={doDelete}
                            disabled={del.isPending}
                            danger
                            icon={<TrashIcon className="w-3 h-3" />}
                        >
                            מחיקה
                        </PopoverMenuItem>
                    </PopoverMenuContent>
                </PopoverMenu>
            </div>
        </div>
    );
}

function previewText(t: Template) {
    if (t.body_plain) return t.body_plain;
    if (t.body_html) return stripHTML(t.body_html);
    return "";
}

function stripHTML(s: string) {
    return s
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+/g, " ")
        .trim();
}

function formatRelative(date: Date | string) {
    const d = typeof date === "string" ? new Date(date) : date;
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "כרגע";
    if (mins < 60) return `לפני ${mins} דק׳`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `לפני ${hours} שע׳`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `לפני ${days} ימים`;
    return d.toLocaleDateString("he-IL", { month: "short", day: "numeric" });
}

type EditorState =
    | { mode: "create" }
    | { mode: "edit"; template: Template }
    | null;

function TemplateEditor({
    state,
    onClose,
}: {
    state: EditorState;
    onClose: () => void;
}) {
    const create = useCreateTemplate();
    const update = useUpdateTemplate();
    const confirm = useConfirm();

    const templateId = state?.mode === "edit" ? state.template.id : null;
    usePresenceResource(templateId ? `template:${templateId}` : null, "editing");
    // While this full-screen editor is open it owns the pointer; silence the page cursor.
    useSuppressGlobalCursors(!!state);

    const [name, setName] = React.useState("");
    const [subject, setSubject] = React.useState("");
    const [bodyPlain, setBodyPlain] = React.useState("");
    const [bodyHTML, setBodyHTML] = React.useState("");
    const [showHTML, setShowHTML] = React.useState(false);
    const [activePresetId, setActivePresetId] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!state) return;
        if (state.mode === "edit") {
            setName(state.template.name);
            setSubject(state.template.subject);
            setBodyPlain(state.template.body_plain);
            setBodyHTML(state.template.body_html);
            setShowHTML(Boolean(state.template.body_html));
            setActivePresetId(null);
        } else {
            setName("");
            setSubject("");
            setBodyPlain("");
            setBodyHTML("");
            setShowHTML(false);
            setActivePresetId(null);
        }
    }, [state]);

    function applyPreset(p: TemplatePreset) {
        const apply = () => {
            setName(p.name);
            setSubject(p.subject);
            setBodyPlain(p.body_plain);
            setBodyHTML("");
            setShowHTML(false);
            setActivePresetId(p.id);
        };
        // Only warn if the user has already started typing, so picking a preset
        // by accident doesn't trash their work.
        const dirty = name.trim() !== "" || subject.trim() !== "" || bodyPlain.trim() !== "" || bodyHTML.trim() !== "";
        if (dirty && activePresetId !== p.id) {
            confirm.show("האם להחליף את מה שכתבת עד כה בתבנית זו?", apply);
            return;
        }
        apply();
    }

    function clearPreset() {
        setName("");
        setSubject("");
        setBodyPlain("");
        setBodyHTML("");
        setShowHTML(false);
        setActivePresetId(null);
    }

    async function submit() {
        const trimmedName = name.trim();
        if (!trimmedName) {
            toast.error("יש להזין שם לתבנית");
            return;
        }
        const payload = {
            name: trimmedName,
            subject,
            body_plain: bodyPlain,
            body_html: showHTML ? bodyHTML : "",
        };
        try {
            if (!state) return;
            if (state.mode === "create") {
                await toast.promise(create.mutateAsync(payload), {
                    loading: "יוצר תבנית…",
                    success: "התבנית נוצרה",
                    error: (e: AppError) => buildError(e),
                });
            } else {
                await toast.promise(
                    update.mutateAsync({ id: state.template.id, data: payload }),
                    {
                        loading: "שומר…",
                        success: "התבנית נשמרה",
                        error: (e: AppError) => buildError(e),
                    },
                );
            }
            onClose();
        } catch {
            /* surfaced */
        }
    }

    const pending = create.isPending || update.isPending;
    const open = state !== null;
    const isEdit = state?.mode === "edit";

    function insertVariable(field: "subject" | "plain" | "html", token: string) {
        const setter =
            field === "subject" ? setSubject : field === "plain" ? setBodyPlain : setBodyHTML;
        const current =
            field === "subject" ? subject : field === "plain" ? bodyPlain : bodyHTML;
        setter(current + token);
    }

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    key="overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onClick={onClose}
                    className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/30 backdrop-blur-[2px] px-4"
                >
                    <motion.div
                        key="card"
                        initial={{ y: 8, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 8, opacity: 0 }}
                        transition={{ duration: 0.16 }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-[640px] rounded-lg bg-white border border-slate-200 shadow-[0_24px_48px_-12px_rgba(15,23,42,0.18)] overflow-hidden text-start"
                    >
                        <div className="h-12 px-4 border-b border-slate-200 flex items-center gap-2.5">
                            <div className="size-5 rounded bg-slate-100 text-slate-600 flex items-center justify-center">
                                <FileTextIcon className="w-3 h-3" />
                            </div>
                            <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">
                                {isEdit ? "עריכה" : "חדשה"}
                            </span>
                            <div className="h-4 w-px bg-slate-200" />
                            <span className="text-[12.5px] text-slate-900 font-medium">תבנית</span>
                            <ResourceViewers
                                resource={templateId ? `template:${templateId}` : null}
                                className="shrink-0"
                            />
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="סגור"
                                className="ms-auto size-7 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center justify-center transition-colors"
                            >
                                <XIcon className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        <div className="px-4 py-4 space-y-3 max-h-[calc(100dvh-8rem)] md:max-h-[68vh] overflow-y-auto">
                            {!isEdit && (
                                <PresetStrip
                                    activeId={activePresetId}
                                    onPick={applyPreset}
                                    onClear={clearPreset}
                                />
                            )}

                            <div>
                                <Label>שם התבנית</Label>
                                <TextInput
                                    value={name}
                                    onChange={setName}
                                    placeholder="פנייה קרה · מוצר"
                                    autoFocus={!isEdit}
                                    className="w-full"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <Label className="!mb-0">נושא ההודעה</Label>
                                    <VariableMenu onPick={(v) => insertVariable("subject", v)} />
                                </div>
                                <TextInput
                                    value={subject}
                                    onChange={setSubject}
                                    placeholder="שאלה קצרה, {{.FirstName}}"
                                    className="w-full"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <Label className="!mb-0">תוכן · טקסט רגיל</Label>
                                    <VariableMenu onPick={(v) => insertVariable("plain", v)} />
                                </div>
                                <textarea
                                    value={bodyPlain}
                                    onChange={(e) => setBodyPlain(e.target.value)}
                                    placeholder="היי {{.FirstName}}, …"
                                    rows={8}
                                    className="w-full rounded-md border border-slate-200 bg-white text-[12.5px] text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-sky-400 focus:ring-2 focus:ring-sky-100 px-2.5 py-2 resize-y leading-relaxed font-sans text-start"
                                />
                            </div>

                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <label className="text-[11px] text-slate-600 inline-flex items-center gap-1.5 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={showHTML}
                                            onChange={(e) => setShowHTML(e.target.checked)}
                                            className="size-3 accent-slate-900"
                                        />
                                        שלח גם גרסת HTML
                                    </label>
                                    {showHTML && (
                                        <div className="ms-auto">
                                            <VariableMenu onPick={(v) => insertVariable("html", v)} />
                                        </div>
                                    )}
                                </div>
                                {showHTML && (
                                    <textarea
                                        value={bodyHTML}
                                        onChange={(e) => setBodyHTML(e.target.value)}
                                        placeholder="<p>היי {{.FirstName}}, …</p>"
                                        rows={6}
                                        dir="ltr"
                                        className="w-full rounded-md border border-slate-200 bg-slate-50 text-[12px] text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-sky-400 focus:ring-2 focus:ring-sky-100 px-2.5 py-2 resize-y leading-relaxed font-mono text-start"
                                    />
                                )}
                            </div>

                            <div className="rounded-md border border-slate-200 bg-slate-50/60 p-2.5">
                                <p className="text-[10.5px] text-slate-500 mb-1.5 uppercase tracking-[0.1em] font-medium">
                                    משתנים מובנים
                                </p>
                                <div className="flex flex-wrap gap-1" dir="ltr">
                                    {VARIABLE_HINTS.map((v) => (
                                        <code
                                            key={v}
                                            className="text-[10.5px] font-mono text-slate-700 bg-white border border-slate-200 rounded px-1.5 py-0.5"
                                        >
                                            {v}
                                        </code>
                                    ))}
                                </div>
                                <p className="text-[10.5px] text-slate-400 mt-1.5 leading-relaxed">
                                    שדות מותאמים אישית של אנשי קשר פועלים באותו אופן:{" "}
                                    <code className="font-mono" dir="ltr">{"{{.YourField}}"}</code>.
                                    משתנים שאינם מוכרים יוצגו כמחרוזת ריקה.
                                </p>
                            </div>
                        </div>

                        <div className="px-3 h-12 border-t border-slate-200 flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={onClose}
                                className="ms-auto h-7 px-2.5 rounded-md text-[12px] text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            >
                                ביטול
                            </button>
                            <button
                                type="button"
                                onClick={submit}
                                disabled={pending}
                                className="h-7 px-3 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                            >
                                {pending && <Loader2Icon className="w-3 h-3 animate-spin" />}
                                {isEdit ? "שמור שינויים" : "צור תבנית"}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

function VariableMenu({ onPick }: { onPick: (token: string) => void }) {
    const [open, setOpen] = React.useState(false);
    const { data: customKeys = [] } = useCustomFieldKeys();
    const custom = customKeys.filter((k) => !isStandardKey(k)).slice(0, 12);

    return (
        <PopoverMenu open={open} onOpenChange={setOpen} align="end">
            <PopoverMenuTrigger asChild>
                <button
                    type="button"
                    className="text-[10.5px] text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 h-5 px-1.5 rounded hover:bg-slate-100 transition-colors"
                >
                    + משתנה
                </button>
            </PopoverMenuTrigger>
            <PopoverMenuContent minWidth={208} className="text-start">
                <PopoverMenuLabel>שדות איש קשר</PopoverMenuLabel>
                {STANDARD_VARS.map((v) => (
                    <PopoverMenuItem key={v.token} onSelect={() => onPick(v.token)}>
                        <span className="flex-1 truncate text-[12px] text-slate-700">{v.label}</span>
                        <code className="me-2 shrink-0 font-mono text-[10px] text-slate-400" dir="ltr">{v.token}</code>
                    </PopoverMenuItem>
                ))}
                {custom.length > 0 && (
                    <>
                        <PopoverMenuSeparator />
                        <PopoverMenuLabel>שדות מותאמים אישית</PopoverMenuLabel>
                        {custom.map((k) => (
                            <PopoverMenuItem key={k} onSelect={() => onPick(buildToken(k))}>
                                <span className="flex-1 truncate text-[12px] text-slate-700">{k}</span>
                                <code className="me-2 shrink-0 font-mono text-[10px] text-slate-400" dir="ltr">
                                    {buildToken(k)}
                                </code>
                            </PopoverMenuItem>
                        ))}
                    </>
                )}
            </PopoverMenuContent>
        </PopoverMenu>
    );
}

function PresetStrip({
    activeId,
    onPick,
    onClear,
}: {
    activeId: string | null;
    onPick: (p: TemplatePreset) => void;
    onClear: () => void;
}) {
    return (
        <div className="rounded-md border border-slate-200 bg-slate-50/60 px-2.5 py-2">
            <div className="flex flex-wrap items-center gap-2 mb-1.5 min-w-0">
                <span className="text-[10.5px] uppercase tracking-[0.1em] font-medium text-slate-500">
                    התחל מתבנית מוכנה
                </span>
                <span className="hidden sm:inline text-[10.5px] text-slate-400">
                    או דלג והתחל מאפס
                </span>
                {activeId && (
                    <button
                        type="button"
                        onClick={onClear}
                        className="ms-auto text-[10.5px] text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 h-5 px-1.5 rounded hover:bg-slate-100 transition-colors"
                    >
                        אפס לריק
                    </button>
                )}
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5">
                {TEMPLATE_PRESETS.map((p) => {
                    const active = activeId === p.id;
                    return (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => onPick(p)}
                            title={p.description}
                            className={
                                "shrink-0 text-start rounded-md border px-2 py-1.5 transition-colors min-w-[140px] " +
                                (active
                                    ? "border-slate-900 bg-white"
                                    : "border-slate-200 bg-white hover:border-slate-300")
                            }
                        >
                            <div className="flex items-center gap-1 mb-0.5">
                                <span className="text-[9.5px] uppercase tracking-[0.1em] text-slate-400 font-medium">
                                    {p.tag}
                                </span>
                                {active && (
                                    <span className="size-1 rounded-full bg-slate-900" />
                                )}
                            </div>
                            <div className="text-[11.5px] font-medium text-slate-900 truncate">
                                {p.label}
                            </div>
                            <div className="text-[10.5px] text-slate-500 truncate">
                                {p.description}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
