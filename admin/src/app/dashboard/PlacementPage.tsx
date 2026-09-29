// Inbox placement seed panel. The instance panel is the set of mailboxes every
// workspace's placement tests send to; this page is where the operator builds
// it and watches the tests that run against it. No polling: the realtime
// spine's placement group invalidates ["admin","placement"] on
// PLACEMENT_TEST_UPDATED.

import { useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Play, Plus, Search, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ErrorState";
import { useConfirm } from "@/components/ConfirmDialog";
import { DataTable, type Column } from "@/components/data/DataTable";
import { useAdminPerm } from "@/hooks/useAdminPerm";
import { AdminPerm } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import {
    listPlacementSeeds,
    listPlacementTests,
    searchPlacementSeedCandidates,
    setPlacementSeed,
    type AdminPlacementSeed,
    type PlacementTestView,
} from "@/lib/api/client/admin/placement";
import { StatusBadge } from "@/app/dashboard/placement/badges";
import { absolute, describeError, ORIGIN_LABEL, PANEL_LABEL, pct, relative } from "@/app/dashboard/placement/format";
import { RunTestDialog } from "@/app/dashboard/placement/RunTestDialog";
import { TestDetailSheet } from "@/app/dashboard/placement/TestDetailSheet";
import { useDebounced } from "@/app/dashboard/placement/useDebounced";

// A provider family with fewer seeds than this gives a verdict one mailbox can swing.
const MIN_SEEDS_PER_FAMILY = 3;

const SEED_STATUS_LABEL: Record<string, string> = {
    active: "פעיל",
    inactive: "לא פעיל",
    revoked: "בוטל",
};

const SEED_STATUS_TONE: Record<string, string> = {
    active: "border-emerald-300 bg-emerald-50 text-emerald-700",
    inactive: "border-amber-300 bg-amber-50 text-amber-700",
    revoked: "border-red-300 bg-red-50 text-red-700",
};

export default function PlacementPage() {
    const [params, setParams] = useSearchParams();
    const openTest = params.get("test");
    const [runOpen, setRunOpen] = useState(false);
    const canManage = useAdminPerm(AdminPerm.ManageWarmupBans);

    function setOpenTest(id: string | null) {
        setParams(
            (p) => {
                if (id) p.set("test", id);
                else p.delete("test");
                return p;
            },
            { replace: true },
        );
    }

    return (
        <div>
            <PageHeader
                title="פאנל תיבות בדיקה"
                description="תיבות הדואר שאליהן נשלחות בדיקות מיקום בתיבת הדואר מכל סביבות העבודה במופע זה, וכל בדיקה שהורצה מול פאנל."
            >
                {canManage && (
                    <Button size="sm" onClick={() => setRunOpen(true)}>
                        <Play className="size-4 rtl:rotate-180" /> הרצת בדיקה
                    </Button>
                )}
            </PageHeader>

            <SeedsSection canManage={canManage} />
            {canManage && <AddSeedsSection />}
            <TestsSection onOpen={setOpenTest} />

            <TestDetailSheet
                testId={openTest}
                onOpenChange={(open) => !open && setOpenTest(null)}
                onOpenTest={setOpenTest}
            />
            {canManage && (
                <RunTestDialog
                    open={runOpen}
                    onOpenChange={setRunOpen}
                    onStarted={(tests) => {
                        setRunOpen(false);
                        if (tests[0]) setOpenTest(tests[0].id);
                    }}
                />
            )}
        </div>
    );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
    return (
        <div className="mb-2">
            <h2 className="text-sm font-semibold">{title}</h2>
            {hint && <p className="mt-0.5 max-w-3xl text-xs text-muted-foreground">{hint}</p>}
        </div>
    );
}

function SeedsSection({ canManage }: { canManage: boolean }) {
    const qc = useQueryClient();
    const confirm = useConfirm();
    const canViewOrgs = useAdminPerm(AdminPerm.ViewOrganizations);
    const canViewWorkers = useAdminPerm(AdminPerm.ViewWorkers);

    const seedsQ = useQuery({
        queryKey: ["admin", "placement", "seeds"],
        queryFn: listPlacementSeeds,
    });
    const seeds = useMemo(() => seedsQ.data ?? [], [seedsQ.data]);

    const mix = useMemo(() => {
        const counts = new Map<string, number>();
        for (const s of seeds) {
            const label = s.family_label || "ספק אחר";
            counts.set(label, (counts.get(label) ?? 0) + 1);
        }
        return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    }, [seeds]);

    const remove = useMutation({
        mutationFn: (seed: AdminPlacementSeed) => setPlacementSeed(seed.id, false),
        onSuccess: (seed) => {
            toast.success(`${seed.email} הוסרה מהפאנל`);
            qc.invalidateQueries({ queryKey: ["admin", "placement"] });
        },
        onError: (err) => toast.error(describeError(err).message || "לא ניתן להסיר את תיבת הבדיקה"),
    });

    async function onRemove(seed: AdminPlacementSeed) {
        const ok = await confirm({
            title: "להסיר תיבת בדיקה זו?",
            description: `${seed.email} תפסיק לקבל עותקים מבדיקות מיקום חדשות. תיבת הדואר תישאר מחוברת, והחימום שלה יישאר כבוי עד שמישהו יפעיל אותו מחדש.`,
            confirmLabel: "הסר תיבת בדיקה",
            destructive: true,
        });
        if (!ok) return;
        remove.mutate(seed);
    }

    const columns: Column<AdminPlacementSeed>[] = [
        {
            id: "mailbox",
            header: "תיבת דואר",
            cell: (s) => (
                <div className="min-w-0">
                    <div className="font-mono text-xs" dir="ltr">
                        {s.email}
                    </div>
                    {s.name && <div className="text-[11px] text-muted-foreground">{s.name}</div>}
                </div>
            ),
            csv: (s) => s.email,
        },
        {
            id: "family",
            header: "ספק",
            cell: (s) => <span className="text-xs">{s.family_label}</span>,
            csv: (s) => s.family_label,
        },
        {
            id: "status",
            header: "סטטוס",
            cell: (s) => (
                <Badge
                    variant="outline"
                    className={cn("text-[10px]", SEED_STATUS_TONE[s.status] ?? "border-zinc-300 text-zinc-600")}
                >
                    {SEED_STATUS_LABEL[s.status] ?? s.status}
                </Badge>
            ),
            csv: (s) => s.status,
        },
        {
            id: "worker",
            header: "תהליך עבודה (Worker)",
            cell: (s) =>
                s.worker_id ? (
                    canViewWorkers ? (
                        <Link
                            to={`/workers/${s.worker_id}`}
                            className="font-mono text-[11px] text-[var(--admin-accent-strong)] hover:underline"
                            dir="ltr"
                        >
                            {s.worker_id.slice(0, 8)}
                        </Link>
                    ) : (
                        <span className="font-mono text-[11px]" dir="ltr">
                            {s.worker_id.slice(0, 8)}
                        </span>
                    )
                ) : (
                    <Badge
                        variant="outline"
                        className="border-amber-300 bg-amber-50 text-[10px] text-amber-700"
                        title="שום תהליך אינו מסנכרן תיבה זו, ולכן עותקים שנשלחים אליה יסומנו כחסרים"
                    >
                        לא משויך
                    </Badge>
                ),
            csv: (s) => s.worker_id ?? "",
        },
        {
            id: "organization",
            header: "ארגון",
            cell: (s) =>
                s.organization_id ? (
                    canViewOrgs ? (
                        <Link
                            to={`/organizations/${s.organization_id}`}
                            className="font-mono text-[11px] text-[var(--admin-accent-strong)] hover:underline"
                            dir="ltr"
                        >
                            {s.organization_id.slice(0, 8)}
                        </Link>
                    ) : (
                        <span className="font-mono text-[11px]" dir="ltr">
                            {s.organization_id.slice(0, 8)}
                        </span>
                    )
                ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                ),
            csv: (s) => s.organization_id ?? "",
        },
    ];
    if (canManage) {
        columns.push({
            id: "actions",
            header: "",
            align: "right",
            cell: (s) => (
                <Button
                    size="xs"
                    variant="outline"
                    disabled={remove.isPending && remove.variables?.id === s.id}
                    onClick={(e) => {
                        e.stopPropagation();
                        void onRemove(s);
                    }}
                >
                    <Trash2 /> הסרה
                </Button>
            ),
        });
    }

    return (
        <section>
            <SectionTitle
                title="תיבות בדיקה (Seeds)"
                hint="העותקים מופצים בסבב (Round-robin) בין משפחות הספקים, כך שכל משפחה בפאנל מכוסה בכל בדיקה. תיבות בדיקה בדומיין של השולח עצמו תמיד מדולגות."
            />

            <div className="mb-3 rounded-lg border border-border bg-card p-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    התפלגות לפי ספק
                </div>
                {seedsQ.isLoading ? (
                    <Skeleton className="h-6 w-2/3" />
                ) : mix.length === 0 ? (
                    <p className="text-xs text-muted-foreground">הפאנל ריק, ולכן אף סביבת עבודה אינה יכולה להריץ עליו בדיקות עדיין.</p>
                ) : (
                    <div className="flex flex-wrap gap-1.5">
                        {mix.map(([label, n]) => (
                            <span
                                key={label}
                                className={cn(
                                    "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs",
                                    n < MIN_SEEDS_PER_FAMILY
                                        ? "border-amber-300 bg-amber-50 text-amber-800"
                                        : "border-border bg-muted/30",
                                )}
                                title={n < MIN_SEEDS_PER_FAMILY ? `פחות מ-${MIN_SEEDS_PER_FAMILY} תיבות בדיקה` : undefined}
                            >
                                {label}
                                <span className="font-semibold tabular-nums">{n}</span>
                            </span>
                        ))}
                    </div>
                )}
                <p className="mt-2 max-w-3xl text-xs text-muted-foreground">
                    פאנל תקין מוטה לטובת Microsoft 365 ו-Google Workspace, שם נמצאים רוב נמעני ה-B2B, יחד עם מספר תיבות
                    בדיקה של Gmail,‏ Outlook.com ו-Yahoo, ולפחות {MIN_SEEDS_PER_FAMILY} תיבות לכל ספק. תיבות בדיקה
                    חייבות להיות תיבות שאיש אינו קורא או מבצע בהן פעולות: פתיחה, תיוק או מענה לעותק מלמדים את הספק לתת
                    אמון בשולח ומטים את כל התוצאות הבאות.
                </p>
            </div>

            <DataTable
                columns={columns}
                rows={seeds}
                getRowId={(s) => s.id}
                loading={seedsQ.isLoading}
                error={seedsQ.error}
                onRetry={() => seedsQ.refetch()}
                errorTitle="טעינת פאנל תיבות הבדיקה נכשלה"
                storageKey="admin.placement.seeds"
                csvName="warmbly-placement-seeds"
                noun="תיבות בדיקה"
                emptyTitle="אין תיבות בדיקה עדיין"
                emptyHint={
                    canManage
                        ? "הוסף תיבות דואר מחוברות למטה כדי לבנות את הפאנל."
                        : "מנהל מערכת עם הרשאת ניהול חסימות חימום יכול להוסיף אותן."
                }
            />
        </section>
    );
}

function AddSeedsSection() {
    const qc = useQueryClient();
    const confirm = useConfirm();
    const [search, setSearch] = useState("");
    const debounced = useDebounced(search.trim(), 250);

    const candidatesQ = useQuery({
        queryKey: ["admin", "placement", "candidates", debounced],
        queryFn: () => searchPlacementSeedCandidates(debounced),
        enabled: debounced.length >= 2,
        staleTime: 30_000,
    });
    const rows = candidatesQ.data ?? [];

    const add = useMutation({
        mutationFn: (seed: AdminPlacementSeed) => setPlacementSeed(seed.id, true),
        onSuccess: (seed) => {
            toast.success(`${seed.email} נוספה לפאנל, והחימום שלה כובה`);
            qc.invalidateQueries({ queryKey: ["admin", "placement"] });
        },
        onError: (err) => toast.error(describeError(err).message || "לא ניתן להוסיף את תיבת הבדיקה"),
    });

    async function onAdd(seed: AdminPlacementSeed) {
        if (seed.seed_scope === "workspace") {
            const ok = await confirm({
                title: "להעביר תיבת בדיקה זו מסביבת העבודה?",
                description: `${seed.email} מוגדרת כתיבת בדיקה פרטית של סביבת העבודה שלה. הוספתה לכאן תעביר אותה לפאנל המערכת, כך שסביבת העבודה לא תוכל עוד לבדוק מולה באופן פרטי.`,
                confirmLabel: "הוסף לפאנל",
            });
            if (!ok) return;
        }
        add.mutate(seed);
    }

    return (
        <section className="mt-6">
            <SectionTitle
                title="הוספת תיבות בדיקה"
                hint="כל תיבת דואר מחוברת יכולה להצטרף לפאנל. הוספת תיבה מכבה את החימום שלה ומונעת ממנה לשלוח בקמפיינים, לכן מומלץ לבחור תיבות שנועדו אך ורק לקבלת בדיקות."
            />
            <div className="relative mb-2 max-w-md">
                <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="חיפוש תיבות דואר מחוברות לפי כתובת…"
                    className="h-8 ps-8 text-[12.5px]"
                    autoComplete="off"
                />
            </div>

            {debounced.length < 2 ? null : candidatesQ.isLoading ? (
                <Skeleton className="h-24 w-full" />
            ) : candidatesQ.error ? (
                <ErrorState error={candidatesQ.error} title="החיפוש נכשל" onRetry={() => candidatesQ.refetch()} />
            ) : rows.length === 0 ? (
                <div className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
                    לא נמצאה תיבת דואר מחוברת תואמת.
                </div>
            ) : (
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/40 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                                <tr>
                                    <th className="px-3 py-2 text-start">תיבת דואר</th>
                                    <th className="px-3 py-2 text-start">ספק</th>
                                    <th className="px-3 py-2 text-start">סטטוס</th>
                                    <th className="px-3 py-2 text-end" />
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((m) => {
                                    const onPanel = m.seed_scope === "instance";
                                    return (
                                        <tr key={m.id} className="border-t border-border">
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono text-xs" dir="ltr">
                                                        {m.email}
                                                    </span>
                                                    {m.seed_scope === "workspace" && (
                                                        <Badge
                                                            variant="outline"
                                                            className="border-sky-300 bg-sky-50 text-[10px] text-sky-700"
                                                        >
                                                            תיבת בדיקה של סביבת עבודה
                                                        </Badge>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-xs">{m.family_label}</td>
                                            <td className="px-3 py-2">
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "text-[10px]",
                                                        SEED_STATUS_TONE[m.status] ?? "border-zinc-300 text-zinc-600",
                                                    )}
                                                >
                                                    {SEED_STATUS_LABEL[m.status] ?? m.status}
                                                </Badge>
                                            </td>
                                            <td className="px-3 py-2 text-end">
                                                <Button
                                                    size="xs"
                                                    variant="outline"
                                                    disabled={onPanel || (add.isPending && add.variables?.id === m.id)}
                                                    onClick={() => void onAdd(m)}
                                                >
                                                    <Plus /> {onPanel ? "בפאנל" : "הוספה"}
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </section>
    );
}

function TestsSection({ onOpen }: { onOpen: (id: string) => void }) {
    const testsQ = useInfiniteQuery({
        queryKey: ["admin", "placement", "tests"],
        queryFn: ({ pageParam }) => listPlacementTests(pageParam),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (last) =>
            last.pagination?.has_more ? (last.pagination.next_cursor ?? undefined) : undefined,
    });
    const rows = useMemo(() => (testsQ.data?.pages ?? []).flatMap((p) => p.data ?? []), [testsQ.data]);
    const total = testsQ.data?.pages[0]?.pagination?.total;

    const columns: Column<PlacementTestView>[] = [
        {
            id: "created",
            header: "נוצר",
            cell: (t) => (
                <span className="whitespace-nowrap text-xs text-muted-foreground" title={absolute(t.created_at)}>
                    {relative(t.created_at)}
                </span>
            ),
            csv: (t) => t.created_at,
        },
        {
            id: "sender",
            header: "שולח",
            cell: (t) => (
                <span className="font-mono text-xs" dir="ltr">
                    {t.sender_email || "—"}
                </span>
            ),
            csv: (t) => t.sender_email,
        },
        {
            id: "subject",
            header: "נושא",
            cell: (t) => <span className="block max-w-72 truncate text-xs">{t.subject || "—"}</span>,
            csv: (t) => t.subject,
        },
        {
            id: "panel",
            header: "פאנל",
            cell: (t) => <span className="text-xs">{PANEL_LABEL[t.panel] ?? t.panel}</span>,
            csv: (t) => t.panel,
        },
        {
            id: "origin",
            header: "מקור",
            cell: (t) => <span className="text-xs">{ORIGIN_LABEL[t.origin] ?? t.origin}</span>,
            csv: (t) => t.origin,
        },
        {
            id: "status",
            header: "סטטוס",
            cell: (t) => <StatusBadge status={t.status} />,
            csv: (t) => t.status,
        },
        {
            id: "inbox",
            header: "תיבה ראשית",
            align: "right",
            cell: (t) => <span className="text-xs font-medium tabular-nums">{pct(t.summary?.inbox_rate)}</span>,
            csv: (t) => pct(t.summary?.inbox_rate),
        },
        {
            id: "spam",
            header: "ספאם",
            align: "right",
            cell: (t) => (
                <span className={cn("text-xs tabular-nums", (t.summary?.spam ?? 0) > 0 && "text-red-700")}>
                    {pct(t.summary?.spam_rate)}
                </span>
            ),
            csv: (t) => pct(t.summary?.spam_rate),
        },
        {
            id: "delivered",
            header: "נמסרו",
            align: "right",
            cell: (t) => (
                <span className="text-xs tabular-nums" dir="ltr">
                    {t.summary?.delivered ?? 0}
                    <span className="text-muted-foreground"> / {t.summary?.total ?? 0}</span>
                </span>
            ),
            csv: (t) => t.summary?.delivered ?? 0,
        },
    ];

    return (
        <section className="mt-6">
            <SectionTitle
                title="בדיקות אחרונות"
                hint={`כל בדיקת מיקום במופע זה, מכל סביבת עבודה, מהחדשה לישנה.${
                    total !== undefined ? ` ${total.toLocaleString("he-IL")} בסך הכל.` : ""
                }`}
            />
            <DataTable
                columns={columns}
                rows={rows}
                getRowId={(t) => t.id}
                loading={testsQ.isLoading}
                error={testsQ.error}
                onRetry={() => testsQ.refetch()}
                onRowClick={(t) => onOpen(t.id)}
                errorTitle="טעינת בדיקות המיקום נכשלה"
                storageKey="admin.placement.tests"
                csvName="warmbly-placement-tests"
                noun="בדיקות"
                emptyTitle="אין בדיקות מיקום עדיין"
                emptyHint="בדיקות יופיעו כאן ברגע שסביבת עבודה, ניטור קמפיין או מנהל מערכת יריצו בדיקה."
            />
            {testsQ.hasNextPage && (
                <div className="mt-3 flex justify-center">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testsQ.fetchNextPage()}
                        disabled={testsQ.isFetchingNextPage}
                    >
                        {testsQ.isFetchingNextPage ? "טוען…" : "טען עוד"}
                    </Button>
                </div>
            )}
        </section>
    );
}
