// SubmissionsTab — the responses table: every submission plus every identified
// visitor who opened their link but has not finished, one activity-sorted list.
// The newest submissions page stays live through the realtime spine; older
// pages are appended on demand.

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckIcon, Loader2Icon, Trash2Icon, XIcon } from "lucide-react";
import toast from "react-hot-toast";

import { EmptyBlock } from "@/components/layout/Page";
import { SearchInput } from "@/components/ui/field";
import { useConfirm } from "@/hooks/context/confirm";
import { useWriteGuard } from "@/hooks/usePermission";
import { listFormSubmissions } from "@/lib/api/client/app/forms";
import { useDeleteFormSubmission, useFormStats, useFormSubmissions } from "@/lib/api/hooks/app/forms";
import type Form from "@/lib/api/models/app/forms/Form";
import type { FormSubmission } from "@/lib/api/models/app/forms/Form";
import type { FormIdentifiedVisitor } from "@/lib/api/models/app/forms/FormStats";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import timeAgo from "@/lib/helper/timeAgo";

import { splitPages } from "./designCore";
import { InitialsAvatar, MiniProgress, StatusPill } from "./RowBits";

function answerText(v: string | string[] | undefined): string {
    if (v === undefined) return "";
    return Array.isArray(v) ? v.join(", ") : String(v);
}

type Row =
    | { kind: "submission"; key: string; time: number; sub: FormSubmission }
    | { kind: "visitor"; key: string; time: number; visitor: FormIdentifiedVisitor };

type StatusFilter = "all" | "completed" | "in_progress";

export default function SubmissionsTab({ form }: { form: Form }) {
    const confirm = useConfirm();
    const write = useWriteGuard("MANAGE_CONTACTS");
    const first = useFormSubmissions(form.id);
    // Identified-visitor rows come from the stats payload; widest range so an
    // in-progress opener does not vanish from the list after a week.
    const stats = useFormStats(form.id, "90d");
    const remove = useDeleteFormSubmission();

    const totalPages = React.useMemo(() => splitPages(form.fields).length, [form.fields]);

    // Older pages, loaded past the live first page.
    const [older, setOlder] = React.useState<FormSubmission[]>([]);
    const [olderHasMore, setOlderHasMore] = React.useState(false);
    const [loadingMore, setLoadingMore] = React.useState(false);
    const [selected, setSelected] = React.useState<FormSubmission | null>(null);

    const [query, setQuery] = React.useState("");
    const [status, setStatus] = React.useState<StatusFilter>("all");
    const [checked, setChecked] = React.useState<string[]>([]);
    const [bulkBusy, setBulkBusy] = React.useState(false);

    const firstPage = React.useMemo(() => first.data?.data ?? [], [first.data]);
    const firstIds = React.useMemo(() => new Set(firstPage.map((s) => s.id)), [firstPage]);
    const submissions = React.useMemo(
        () => [...firstPage, ...older.filter((s) => !firstIds.has(s.id))],
        [firstPage, older, firstIds],
    );
    const hasMore = older.length > 0 ? olderHasMore : (first.data?.has_more ?? false);

    const rows = React.useMemo<Row[]>(() => {
        const out: Row[] = submissions.map((s) => ({
            kind: "submission",
            key: `s-${s.id}`,
            time: new Date(s.created_at).getTime(),
            sub: s,
        }));
        // Visitors who completed are already represented by their submission.
        const submittedContacts = new Set(submissions.map((s) => s.contact_id).filter(Boolean));
        for (const v of stats.data?.identified ?? []) {
            if (v.completed || submittedContacts.has(v.contact_id)) continue;
            out.push({ kind: "visitor", key: `v-${v.contact_id}`, time: new Date(v.last_seen).getTime(), visitor: v });
        }
        out.sort((a, b) => b.time - a.time);
        return out;
    }, [submissions, stats.data]);

    const counts = React.useMemo(() => {
        const completed = rows.filter((r) => r.kind === "submission").length;
        return { all: rows.length, completed, in_progress: rows.length - completed };
    }, [rows]);

    const visible = React.useMemo(() => {
        const q = query.trim().toLowerCase();
        return rows.filter((r) => {
            if (status === "completed" && r.kind !== "submission") return false;
            if (status === "in_progress" && r.kind !== "visitor") return false;
            if (!q) return true;
            if (r.kind === "submission") {
                const s = r.sub;
                const haystack = [
                    s.contact_email ?? "",
                    s.contact_name ?? "",
                    s.campaign_name ?? "",
                    ...Object.values(s.data).map(answerText),
                ];
                return haystack.some((h) => h.toLowerCase().includes(q));
            }
            const v = r.visitor;
            return [v.name, v.email, v.campaign ?? ""].some((h) => h.toLowerCase().includes(q));
        });
    }, [rows, query, status]);

    const checkedSet = React.useMemo(() => new Set(checked), [checked]);
    const visibleSubs = React.useMemo(
        () => visible.filter((r): r is Extract<Row, { kind: "submission" }> => r.kind === "submission"),
        [visible],
    );
    const allChecked = visibleSubs.length > 0 && visibleSubs.every((r) => checkedSet.has(r.sub.id));

    function toggleAll() {
        setChecked(allChecked ? [] : visibleSubs.map((r) => r.sub.id));
    }

    function toggleOne(id: string, on: boolean) {
        setChecked((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)));
    }

    async function loadMore() {
        const last = submissions[submissions.length - 1];
        if (!last) return;
        setLoadingMore(true);
        try {
            const res = await listFormSubmissions(form.id, 50, new Date(last.created_at).toISOString());
            setOlder((prev) => [...prev, ...res.data]);
            setOlderHasMore(res.has_more);
        } catch (err) {
            toast.error(buildError(err as AppError));
        } finally {
            setLoadingMore(false);
        }
    }

    function askDelete(s: FormSubmission) {
        write.guard(() => {
            confirm.show("האם למחוק הגשה זו? איש הקשר שנוצר יישמר.", async () => {
                try {
                    await remove.mutateAsync({ formId: form.id, submissionId: s.id });
                    setOlder((prev) => prev.filter((x) => x.id !== s.id));
                    setChecked((prev) => prev.filter((x) => x !== s.id));
                    setSelected((cur) => (cur?.id === s.id ? null : cur));
                    toast.success("ההגשה נמחקה");
                } catch (err) {
                    toast.error(buildError(err as AppError));
                }
            });
        })({});
    }

    function askBulkDelete() {
        const ids = [...checked];
        write.guard(() => {
            confirm.show(`האם למחוק ${ids.length} הגשות? אנשי הקשר שנוצרו יישמרו.`, async () => {
                setBulkBusy(true);
                const results = await Promise.allSettled(
                    ids.map((id) => remove.mutateAsync({ formId: form.id, submissionId: id })),
                );
                setBulkBusy(false);
                const okIds = new Set(ids.filter((_, i) => results[i].status === "fulfilled"));
                setOlder((prev) => prev.filter((x) => !okIds.has(x.id)));
                setSelected((cur) => (cur && okIds.has(cur.id) ? null : cur));
                setChecked([]);
                if (okIds.size === ids.length) toast.success(`${okIds.size} הגשות נמחקו`);
                else toast.error(`${okIds.size} מתוך ${ids.length} נמחקו; השאר נכשלו`);
            });
        })({});
    }

    const labelFor = React.useMemo(() => {
        const map = new Map<string, string>();
        for (const f of form.fields) map.set(f.id, f.label || f.id);
        return map;
    }, [form.fields]);

    if (first.isPending) {
        return (
            <div className="p-4 space-y-1.5">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-11 rounded-md bg-slate-100 animate-pulse" />
                ))}
            </div>
        );
    }

    if (rows.length === 0) {
        return (
            <EmptyBlock
                title="אין עדיין הגשות"
                body={
                    form.status === "published"
                        ? "שתף את הטופס או הטמע אותו באתרך; התגובות יופיעו כאן בזמן אמת."
                        : "פרסם את הטופס כדי להתחיל לאסוף תגובות."
                }
            />
        );
    }

    const filterTabs: { value: StatusFilter; label: string }[] = [
        { value: "all", label: "הכל" },
        { value: "completed", label: "הושלם" },
        { value: "in_progress", label: "בתהליך" },
    ];

    return (
        <div className="flex flex-col min-h-0">
            <div className="px-4 h-11 shrink-0 flex items-center gap-2 border-b border-slate-200 bg-white">
                <SearchInput value={query} onChange={setQuery} placeholder="חפש תגובות…" className="w-full sm:w-56" />
                <div className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 p-0.5">
                    {filterTabs.map((t) => (
                        <button
                            key={t.value}
                            type="button"
                            onClick={() => setStatus(t.value)}
                            className={`h-6 px-2 rounded text-[11.5px] font-medium transition-colors ${
                                status === t.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                            }`}
                        >
                            {t.label}
                            <span className={`ms-1 tabular-nums ${status === t.value ? "text-slate-400" : "text-slate-400/80"}`}>
                                {counts[t.value]}
                            </span>
                        </button>
                    ))}
                </div>
                <div className="flex-1" />
                <span className="text-[11.5px] text-slate-400 tabular-nums whitespace-nowrap hidden sm:block">
                    {visible.length} מתוך {counts.all} תגובות
                </span>
            </div>

            {visible.length === 0 ? (
                <EmptyBlock title="אין תגובות התואמות לסינון." body="נסה חיפוש או סטטוס אחר." />
            ) : (
                <table className="w-full text-start">
                    <thead className="sticky top-0 bg-white z-[1]">
                        <tr className="border-b border-slate-200">
                            <th className="ps-5 pe-2 py-2 w-9">
                                <input
                                    type="checkbox"
                                    className="w-3.5 h-3.5 rounded accent-sky-600"
                                    checked={allChecked}
                                    onChange={toggleAll}
                                    disabled={visibleSubs.length === 0}
                                />
                            </th>
                            <Th className="max-w-0 w-full text-start">איש קשר</Th>
                            <Th className="w-28 text-start">סטטוס</Th>
                            <Th className="w-36 hidden md:table-cell text-start">התקדמות</Th>
                            <Th className="w-36 hidden lg:table-cell text-start">קמפיין</Th>
                            <Th className="w-56 hidden xl:table-cell text-start">תשובה</Th>
                            <Th className="w-24 text-start">פעילות</Th>
                            <th className="w-12" />
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((r) =>
                            r.kind === "submission" ? (
                                <SubmissionRow
                                    key={r.key}
                                    sub={r.sub}
                                    totalPages={totalPages}
                                    checked={checkedSet.has(r.sub.id)}
                                    onCheck={(on) => toggleOne(r.sub.id, on)}
                                    onOpen={() => setSelected(r.sub)}
                                    onDelete={() => askDelete(r.sub)}
                                />
                            ) : (
                                <VisitorRow key={r.key} visitor={r.visitor} totalPages={totalPages} />
                            ),
                        )}
                    </tbody>
                </table>
            )}

            {hasMore && (
                <div className="flex justify-center py-3">
                    <button
                        type="button"
                        disabled={loadingMore}
                        onClick={() => void loadMore()}
                        className="h-7 px-3 rounded-md border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                        {loadingMore ? "טוען…" : "טען ישנים יותר"}
                    </button>
                </div>
            )}

            {checked.length > 0 && (
                <div className="fixed bottom-4 start-1/2 -translate-x-1/2 z-30 flex items-center max-w-[calc(100vw-16px)] flex-wrap justify-center md:max-w-none md:flex-nowrap gap-1.5 rounded-md border border-slate-200 bg-white shadow-[0_6px_20px_-4px_rgba(15,23,42,0.12),0_2px_4px_rgba(15,23,42,0.04)] px-2 py-1.5">
                    <div className="inline-flex items-center gap-1.5 px-2 h-7 rounded bg-sky-50 text-sky-700 text-[12px] font-medium">
                        <CheckIcon className="w-3 h-3" />
                        <span>{checked.length} נבחרו</span>
                    </div>
                    <button
                        type="button"
                        disabled={bulkBusy}
                        onClick={askBulkDelete}
                        className="h-7 px-2.5 rounded text-[12px] font-medium inline-flex items-center gap-1.5 text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-60"
                    >
                        {bulkBusy ? <Loader2Icon className="w-3 h-3 animate-spin" /> : "מחק"}
                    </button>
                    <button
                        type="button"
                        aria-label="נקה בחירה"
                        onClick={() => setChecked([])}
                        className="size-7 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center justify-center"
                    >
                        <XIcon className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            <AnimatePresence>
                {selected && (
                    <>
                        <motion.div
                            key="backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onMouseDown={() => setSelected(null)}
                            className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px]"
                        />
                        <motion.aside
                            key="panel"
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 32, stiffness: 320 }}
                            className="fixed end-0 top-0 bottom-0 z-50 w-[460px] max-w-[95%] bg-white shadow-xl flex flex-col"
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <div className="shrink-0 h-12 px-4 flex items-center justify-between border-b border-slate-200">
                                <div className="min-w-0">
                                    <div className="text-[12.5px] font-medium text-slate-900 truncate">
                                        {selected.contact_email || "הגשה"}
                                    </div>
                                    <div className="text-[11px] text-slate-500">{new Date(selected.created_at).toLocaleString("he-IL")}</div>
                                </div>
                                <button
                                    type="button"
                                    aria-label="סגור"
                                    onClick={() => setSelected(null)}
                                    className="size-7 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center justify-center"
                                >
                                    <XIcon className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                                {Object.entries(selected.data).map(([key, value]) => (
                                    <div key={key}>
                                        <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">
                                            {labelFor.get(key) ?? key}
                                        </div>
                                        <div className="text-[12.5px] text-slate-900 whitespace-pre-wrap break-words">
                                            {answerText(value)}
                                        </div>
                                    </div>
                                ))}
                                {selected.campaign_name && (
                                    <div>
                                        <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">קמפיין</div>
                                        <div className="text-[12.5px] text-slate-900">{selected.campaign_name}</div>
                                    </div>
                                )}
                                {selected.source_url && (
                                    <div>
                                        <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">הוגש מ-</div>
                                        <div className="text-[12px] text-slate-600 break-all dir-ltr text-start">{selected.source_url}</div>
                                    </div>
                                )}
                            </div>
                            <div className="shrink-0 px-4 py-3 border-t border-slate-200 flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => askDelete(selected)}
                                    className="h-7 px-3 rounded-md text-[12px] text-rose-600 hover:bg-rose-50 inline-flex items-center gap-1.5"
                                >
                                    <Trash2Icon className="w-3 h-3" /> מחק הגשה
                                </button>
                            </div>
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

function SubmissionRow({
    sub,
    totalPages,
    checked,
    onCheck,
    onOpen,
    onDelete,
}: {
    sub: FormSubmission;
    totalPages: number;
    checked: boolean;
    onCheck: (on: boolean) => void;
    onOpen: () => void;
    onDelete: () => void;
}) {
    const firstAnswer = Object.values(sub.data).map(answerText).find((v) => v.trim() !== "") ?? "";
    const name = sub.contact_name || (sub.contact_email ? "" : "אנונימי");
    return (
        <tr
            onClick={onOpen}
            className={`group h-11 border-b border-slate-100 cursor-pointer transition-colors ${
                checked ? "bg-sky-50/60 hover:bg-sky-50/80" : "hover:bg-slate-50/80"
            }`}
        >
            <td className="ps-5 pe-2" onClick={(e) => e.stopPropagation()}>
                <input
                    type="checkbox"
                    className="w-3.5 h-3.5 rounded accent-sky-600"
                    checked={checked}
                    onChange={(e) => onCheck(e.target.checked)}
                />
            </td>
            <td className="px-3 max-w-0 w-full text-start">
                <div className="flex items-center gap-2.5 min-w-0">
                    <InitialsAvatar name={sub.contact_name} email={sub.contact_email} />
                    <div className="min-w-0">
                        <div className="text-[12.5px] font-medium text-slate-900 truncate leading-tight">
                            {name || sub.contact_email || "אנונימי"}
                        </div>
                        {sub.contact_email && name && (
                            <div className="text-[11px] text-slate-500 truncate">{sub.contact_email}</div>
                        )}
                    </div>
                </div>
            </td>
            <td className="px-3">
                <StatusPill completed />
            </td>
            <td className="px-3 hidden md:table-cell">
                <MiniProgress done={totalPages} total={totalPages} />
            </td>
            <td className="px-3 hidden lg:table-cell">
                {sub.campaign_name ? (
                    <span className="inline-flex items-center h-4 px-1.5 rounded bg-sky-50 text-sky-700 text-[10px] font-medium max-w-32">
                        <span className="truncate">{sub.campaign_name}</span>
                    </span>
                ) : (
                    <span className="text-[11px] text-slate-300">–</span>
                )}
            </td>
            <td className="px-3 hidden xl:table-cell">
                <span className="block text-[12px] text-slate-500 truncate max-w-52">{firstAnswer || "–"}</span>
            </td>
            <td className="px-3 text-[12px] text-slate-500 whitespace-nowrap" title={new Date(sub.created_at).toLocaleString("he-IL")}>
                {timeAgo(sub.created_at)}
            </td>
            <td className="pe-3" onClick={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    aria-label="מחק הגשה"
                    onClick={onDelete}
                    className="size-7 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 inline-flex items-center justify-center transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                >
                    <Trash2Icon className="w-3.5 h-3.5" />
                </button>
            </td>
        </tr>
    );
}

// A visitor who opened their personalized link but has not submitted yet.
// Nothing to open and nothing to delete, so the row is inert.
function VisitorRow({ visitor, totalPages }: { visitor: FormIdentifiedVisitor; totalPages: number }) {
    const name = visitor.name || visitor.email || "אנונימי";
    return (
        <tr className="h-11 border-b border-slate-100">
            <td className="ps-5 pe-2" />
            <td className="px-3 max-w-0 w-full text-start">
                <div className="flex items-center gap-2.5 min-w-0">
                    <InitialsAvatar name={visitor.name} email={visitor.email} />
                    <div className="min-w-0">
                        <div className="text-[12.5px] font-medium text-slate-900 truncate leading-tight">{name}</div>
                        {visitor.email && visitor.name && (
                            <div className="text-[11px] text-slate-500 truncate">{visitor.email}</div>
                        )}
                    </div>
                </div>
            </td>
            <td className="px-3">
                <StatusPill completed={false} />
            </td>
            <td className="px-3 hidden md:table-cell">
                {totalPages > 1 ? (
                    <MiniProgress done={visitor.furthest_page + 1} total={totalPages} />
                ) : (
                    <span className="text-[11px] text-slate-300">–</span>
                )}
            </td>
            <td className="px-3 hidden lg:table-cell">
                {visitor.campaign ? (
                    <span className="inline-flex items-center h-4 px-1.5 rounded bg-sky-50 text-sky-700 text-[10px] font-medium max-w-32">
                        <span className="truncate">{visitor.campaign}</span>
                    </span>
                ) : (
                    <span className="text-[11px] text-slate-300">–</span>
                )}
            </td>
            <td className="px-3 hidden xl:table-cell">
                <span className="block text-[12px] text-slate-400 italic truncate max-w-52">פתח את הקישור</span>
            </td>
            <td className="px-3 text-[12px] text-slate-500 whitespace-nowrap" title={new Date(visitor.last_seen).toLocaleString("he-IL")}>
                {timeAgo(visitor.last_seen)}
            </td>
            <td className="pe-3" />
        </tr>
    );
}


function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
    return (
        <th className={`px-3 py-2 text-[10px] font-medium text-slate-400 uppercase tracking-[0.14em] ${className ?? ""}`}>
            {children}
        </th>
    );
}
