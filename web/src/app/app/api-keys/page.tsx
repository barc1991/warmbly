// API keys dashboard.
//
// Top strip: real org-level usage stats (active keys, 24h request volume,
// error rate, avg latency). Refresh every 30s.
//
// Quick start: curl snippet using the user's own prefix once they have a
// key. Pre-create, we show a placeholder snippet so the page isn't empty.
//
// Activity graph: org-wide stacked bars (2xx / 4xx / 5xx) for the last 24
// hours. Read on first paint so the page lands with real data immediately.
//
// Keys list: one row per key with prefix, suffix, status, last used,
// sparkline of recent volume. Clicking a row opens the detail drawer.
//
// Create flow lives in CreateKeyModal. Detail/edit/revoke lives in
// KeyDetailDrawer. This page just orchestrates them.

"use client";

import { NoAccess } from "@/components/layout/NoAccess";
import { usePermission } from "@/hooks/usePermission";
import React from "react";
import {
    ActivityIcon,
    AlertCircleIcon,
    CheckIcon,
    CopyIcon,
    GaugeIcon,
    KeyIcon,
    PlusIcon,
    RefreshCwIcon,
    SearchIcon,
    XIcon,
} from "lucide-react";
import toast from "react-hot-toast";

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
import useAPIKeys from "@/lib/api/hooks/app/api-keys/useAPIKeys";
import useAPIKeyUsageSummary from "@/lib/api/hooks/app/api-keys/useAPIKeyUsageSummary";
import useAPIKeyAnalytics from "@/lib/api/hooks/app/api-keys/useAPIKeyAnalytics";
import type APIKey from "@/lib/api/models/app/apikeys/APIKey";
import CreateKeyModal from "./_components/CreateKeyModal";
import KeyDetailDrawer from "./_components/KeyDetailDrawer";
import { StackedBars } from "./_components/Sparkline";
import useBrand from "@/hooks/useBrand";

export default function APIKeysPage() {
    const canManage = usePermission("MANAGE_API_KEYS");
    const summary = useAPIKeyUsageSummary();
    const keys = useAPIKeys();
    const analytics = useAPIKeyAnalytics("all");

    const [createOpen, setCreateOpen] = React.useState(false);
    const [selected, setSelected] = React.useState<APIKey | null>(null);
    const [search, setSearch] = React.useState("");

    const all = keys.data?.data ?? [];
    const filtered = search.trim()
        ? all.filter(
              (k) =>
                  k.name.toLowerCase().includes(search.trim().toLowerCase()) ||
                  k.key_prefix.toLowerCase().includes(search.trim().toLowerCase()) ||
                  (k.description ?? "").toLowerCase().includes(search.trim().toLowerCase()),
          )
        : all;

    const samplePrefix = all[0]?.key_prefix ? `${all[0].key_prefix}…` : "wmbly_••";

    if (!canManage) return <NoAccess feature="מפתחות API" permissionLabel="ניהול מפתחות API" />;

    return (
        <Page>
            <PageTopbar eyebrow="מפתחות API" subtitle="גישה תכנותית · טוקנים בעלי הרשאות מוגדרות">
                <SearchPill value={search} onChange={setSearch} />
                <button
                    type="button"
                    onClick={() => {
                        summary.refetch();
                        keys.refetch();
                        analytics.refetch();
                    }}
                    aria-label="רענון"
                    className="h-7 w-7 rounded-md border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-900 inline-flex items-center justify-center transition-colors"
                >
                    <RefreshCwIcon className={`w-3 h-3 ${summary.isFetching ? "animate-spin" : ""}`} />
                </button>
                <TopbarAction icon={<PlusIcon className="w-3 h-3" />} onClick={() => setCreateOpen(true)}>
                    <span className="hidden sm:inline">יצירת מפתח</span>
                </TopbarAction>
            </PageTopbar>

            <StatStrip cols={4}>
                <Stat
                    label="מפתחות פעילים"
                    value={summary.data?.active_keys ?? 0}
                    sub={summary.data ? `${summary.data.revoked_keys + summary.data.expired_keys} לא פעילים` : "-"}
                    accent={(summary.data?.active_keys ?? 0) > 0}
                />
                <Stat
                    label="בקשות · 24 שעות"
                    value={summary.data?.requests_24h ?? 0}
                    sub={summary.data ? `${summary.data.errors_24h} שגיאות` : "-"}
                />
                <Stat
                    label="זמן תגובה ממוצע · 24 שעות"
                    value={summary.data ? `${Math.round(summary.data.avg_latency_ms_24h)}ms` : "-"}
                    sub="בכל המפתחות"
                />
                <Stat
                    label="קריאה אחרונה"
                    value={summary.data?.last_call_at ? fmtRelative(summary.data.last_call_at) : "-"}
                    sub={summary.data?.last_call_at ? fmtFull(summary.data.last_call_at) : "אין קריאות עדיין"}
                    last
                />
            </StatStrip>

            <SectionBar
                label="תעבורה · 24 שעות אחרונות"
                count={analytics.data?.total ?? 0}
            >
                {analytics.isFetching && <span className="text-[10px] text-slate-400">סנכרון…</span>}
            </SectionBar>
            <div className="px-5 py-4 border-b border-slate-200/60">
                {analytics.isPending ? (
                    <div className="h-[120px] rounded bg-slate-50 animate-pulse" />
                ) : (
                    <StackedBars buckets={analytics.data?.buckets ?? []} height={120} />
                )}
                <div className="mt-2 flex items-center gap-3 text-[10.5px] text-slate-500">
                    <Legend color="bg-emerald-500/80" label="2xx" />
                    <Legend color="bg-amber-400/80" label="4xx" />
                    <Legend color="bg-rose-500/80" label="5xx" />
                    <span className="ms-auto inline-flex items-center gap-1.5 text-[10.5px] text-slate-400">
                        <GaugeIcon className="w-3 h-3" />
                        בזמן אמת; מתרענן מדי דקה
                    </span>
                </div>
            </div>

            <SectionBar label="התחלה מהירה" />
            <div className="px-5 py-4 border-b border-slate-200/60">
                <CodeSnippet prefix={samplePrefix} />
                <p className="text-[11.5px] text-slate-500 mt-2 leading-relaxed">
                    העבר את המפתח החוצה בכותרת <span className="font-mono">Bearer</span>. כל בקשה מחזירה
                    כותרות מגבלת קצב (<span className="font-mono">X-RateLimit-Limit</span>,{" "}
                    <span className="font-mono">X-RateLimit-Remaining</span>) כדי שלקוחות יוכלו להאט את הקצב בעצמם
                    לפני הגעה לקוד <span className="font-mono">429</span>.
                </p>
            </div>

            <SectionBar label="מפתחות" count={filtered.length} />
            <PageBody>
                {keys.isPending ? (
                    <div className="px-5 py-4 space-y-2">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="h-11 rounded bg-slate-50 animate-pulse" />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-10">
                        <EmptyBlock
                            title={search ? "לא נמצאו מפתחות תואמים" : "אין עדיין מפתחות API"}
                            body={
                                search
                                    ? "נסה חיפוש קצר יותר."
                                    : "צור מפתח כדי להתחיל לבצע קריאות ל-Warmbly מהשרת או ה-CI שלך."
                            }
                            cta={
                                !search && (
                                    <button
                                        type="button"
                                        onClick={() => setCreateOpen(true)}
                                        className="h-7 px-3 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors"
                                    >
                                        <PlusIcon className="w-3 h-3" />
                                        יצירת מפתח
                                    </button>
                                )
                            }
                        />
                    </div>
                ) : (
                    <div className="divide-y divide-slate-200/60">
                        {filtered.map((k) => (
                            <KeyRow key={k.id} apiKey={k} onClick={() => setSelected(k)} />
                        ))}
                    </div>
                )}
            </PageBody>

            <CreateKeyModal open={createOpen} onClose={() => setCreateOpen(false)} />
            <KeyDetailDrawer apiKey={selected} onClose={() => setSelected(null)} />
        </Page>
    );
}

function KeyRow({ apiKey, onClick }: { apiKey: APIKey; onClick: () => void }) {
    const status = apiKey.status;
    return (
        <button
            type="button"
            onClick={onClick}
            className="w-full h-12 px-5 flex items-center gap-3 text-start hover:bg-slate-50/80 transition-colors group"
        >
            <KeyIcon
                className={`w-3.5 h-3.5 shrink-0 ${
                    status === "active" ? "text-slate-500" : "text-slate-300"
                }`}
            />
            <div className="flex flex-col min-w-0 max-w-[40%]">
                <span className="text-[12.5px] text-slate-900 font-medium truncate">{apiKey.name}</span>
                {apiKey.description && (
                    <span className="text-[10.5px] text-slate-500 truncate">{apiKey.description}</span>
                )}
            </div>
            <span className="font-mono text-[10.5px] text-slate-500 truncate">
                {apiKey.key_prefix}…{apiKey.key_suffix}
            </span>
            <StatusPill status={status} />
            <span className="ms-auto flex items-center gap-3 shrink-0">
                <span className="hidden sm:inline text-[10.5px] text-slate-400 tabular-nums">
                    <GaugeIcon className="inline w-3 h-3 me-1 align-[-2px]" />
                    {apiKey.rate_limit_per_minute}/דקה
                </span>
                <span className="hidden md:inline font-mono text-[10.5px] text-slate-400 tabular-nums w-32 text-end truncate">
                    {apiKey.last_used_at ? `בשימוש ${fmtRelative(apiKey.last_used_at)}` : "מעולם לא היה בשימוש"}
                </span>
            </span>
        </button>
    );
}

function StatusPill({ status }: { status: APIKey["status"] }) {
    const tone =
        status === "active"
            ? { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "פעיל" }
            : status === "revoked"
              ? { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500", label: "בוטל" }
              : { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400", label: "פג תוקף" };
    return (
        <span
            className={`inline-flex items-center gap-1 h-5 px-1.5 rounded text-[10px] uppercase tracking-[0.08em] font-medium ${tone.bg} ${tone.text}`}
        >
            <span className={`size-1.5 rounded-full ${tone.dot}`} />
            {tone.label}
        </span>
    );
}

function CodeSnippet({ prefix }: { prefix: string }) {
    // This instance's own API base, not the hosted one: a self-hoster copying
    // the example was being handed a curl aimed at somebody else's server.
    const { apiURL } = useBrand();
    const snippet = `curl ${apiURL}/v1/campaigns \\
  -H "Authorization: Bearer ${prefix}…" \\
  -H "Content-Type: application/json"`;
    const [copied, setCopied] = React.useState(false);
    function copy() {
        navigator.clipboard.writeText(snippet).then(
            () => {
                setCopied(true);
                toast.success("הקטע הועתק");
                setTimeout(() => setCopied(false), 1500);
            },
            () => toast.error("ההעתקה נכשלה"),
        );
    }
    return (
        <div className="rounded-md border border-slate-200 bg-slate-950 overflow-hidden" dir="ltr">
            <div className="h-8 px-3 flex items-center gap-2 border-b border-slate-800/60">
                <div className="size-1.5 rounded-full bg-red-400/70" />
                <div className="size-1.5 rounded-full bg-amber-400/70" />
                <div className="size-1.5 rounded-full bg-emerald-400/70" />
                <span className="ml-2 text-[11px] text-slate-400 font-mono">curl</span>
                <button
                    type="button"
                    onClick={copy}
                    className="ml-auto inline-flex items-center gap-1 h-6 px-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-[11px]"
                >
                    {copied ? <CheckIcon className="w-3 h-3" /> : <CopyIcon className="w-3 h-3" />}
                    {copied ? "הועתק" : "העתק"}
                </button>
            </div>
            <pre className="px-4 py-3 text-[12px] leading-relaxed text-slate-200 font-mono whitespace-pre overflow-x-auto">
                {snippet}
            </pre>
        </div>
    );
}

function SearchPill({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <div className="h-7 px-2 rounded-md border border-slate-200 bg-white flex items-center gap-1.5 focus-within:border-sky-400 transition-colors">
            <SearchIcon className="w-3 h-3 text-slate-400" />
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="חיפוש…"
                className="w-[100px] sm:w-[140px] h-5 bg-transparent text-[12px] text-slate-900 placeholder:text-slate-400 outline-none"
            />
            {value && (
                <button
                    type="button"
                    onClick={() => onChange("")}
                    aria-label="ניקוי"
                    className="text-slate-400 hover:text-slate-700"
                >
                    <XIcon className="w-3 h-3" />
                </button>
            )}
        </div>
    );
}

function Legend({ color, label }: { color: string; label: string }) {
    return (
        <span className="inline-flex items-center gap-1">
            <span className={`size-1.5 rounded-sm ${color}`} />
            {label}
        </span>
    );
}

function fmtRelative(iso: string): string {
    try {
        const d = new Date(iso);
        const diff = Date.now() - d.getTime();
        const s = Math.floor(diff / 1000);
        if (s < 60) return `לפני ${s} שניות`;
        const m = Math.floor(s / 60);
        if (m < 60) return `לפני ${m} דקות`;
        const h = Math.floor(m / 60);
        if (h < 24) return `לפני ${h} שעות`;
        const days = Math.floor(h / 24);
        if (days < 30) return `לפני ${days} ימים`;
        return d.toLocaleDateString("he-IL");
    } catch {
        return "-";
    }
}

function fmtFull(iso: string): string {
    try {
        return new Date(iso).toLocaleString("he-IL", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return "-";
    }
}

// Lint shim: keep imported icons that may render only in transient branches.
void ActivityIcon;
void AlertCircleIcon;
