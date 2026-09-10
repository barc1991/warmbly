// Integrations marketplace.
//
// The connect experience is the point of this page: a searchable app directory
// grouped by category, a "connected" rail across the top, a multi-step connect
// drawer (one-click OAuth where the provider supports it), and a management
// drawer for health, reauth, and event automations. Realtime keeps connection
// state live without a manual refresh.

"use client";

import React from "react";
import { motion } from "framer-motion";
import { CalendarCheckIcon, ExternalLinkIcon, RefreshCwIcon, SettingsIcon } from "lucide-react";

import {
    EmptyBlock,
    Page,
    PageBody,
    PageTopbar,
    SectionBar,
    Stat,
    StatStrip,
} from "@/components/layout/Page";
import { SearchInput } from "@/components/ui/field";
import useIntegrationCatalog from "@/lib/api/hooks/app/integrations/useIntegrationCatalog";
import useIntegrationConnections from "@/lib/api/hooks/app/integrations/useIntegrationConnections";
import useMeetingBookings from "@/lib/api/hooks/app/integrations/useMeetingBookings";
import {
    CATEGORY_LABELS,
    CATEGORY_ORDER,
    type IntegrationCatalogEntry,
    type IntegrationCategory,
    type IntegrationConnection,
    type IntegrationProvider,
} from "@/lib/api/models/app/integrations/Integration";
import { cn } from "@/lib/utils";

import ConnectDrawer from "./_components/ConnectDrawer";
import ConnectionDetail from "./_components/ConnectionDetail";
import InboundUrlDialog from "./_components/InboundUrlDialog";
import ProviderGlyph from "./_components/ProviderGlyph";
import StatusPill from "./_components/StatusPill";

import { useTranslation } from "react-i18next";

export default function IntegrationsPage() {
    const { i18n } = useTranslation();
    const isHe = i18n.language === "he";

    const catalogQuery = useIntegrationCatalog();
    const connectionsQuery = useIntegrationConnections();
    const bookingsQuery = useMeetingBookings();

    const [connectTarget, setConnectTarget] = React.useState<IntegrationCatalogEntry | null>(null);
    const [manageTarget, setManageTarget] = React.useState<IntegrationConnection | null>(null);
    const [inboundUrl, setInboundUrl] = React.useState<{ provider: IntegrationProvider; url: string } | null>(null);
    const [query, setQuery] = React.useState("");

    const catalog = React.useMemo(() => catalogQuery.data?.catalog ?? [], [catalogQuery.data?.catalog]);
    const connections = React.useMemo(
        () => connectionsQuery.data?.connections ?? [],
        [connectionsQuery.data?.connections],
    );
    const bookings = bookingsQuery.data?.bookings ?? [];

    const entryByProvider = React.useMemo(() => {
        const m: Record<string, IntegrationCatalogEntry> = {};
        for (const e of catalog) m[e.provider] = e;
        return m;
    }, [catalog]);

    const firstConnByProvider = React.useMemo(() => {
        const m: Record<string, IntegrationConnection> = {};
        for (const c of connections) if (!m[c.provider]) m[c.provider] = c;
        return m;
    }, [connections]);

    const q = query.trim().toLowerCase();
    const filtered = React.useMemo(() => {
        if (!q) return catalog;
        return catalog.filter(
            (e) =>
                e.name.toLowerCase().includes(q) ||
                e.tagline.toLowerCase().includes(q) ||
                e.category.toLowerCase().includes(q),
        );
    }, [catalog, q]);

    const grouped = React.useMemo(() => {
        const map: Partial<Record<IntegrationCategory, IntegrationCatalogEntry[]>> = {};
        for (const entry of filtered) (map[entry.category] ??= []).push(entry);
        return map;
    }, [filtered]);

    const connectedCount = connections.filter((c) => c.status === "connected").length;
    const attentionCount = connections.filter(
        (c) => c.status === "degraded" || c.status === "reauth_required",
    ).length;

    function refreshAll() {
        catalogQuery.refetch();
        connectionsQuery.refetch();
        bookingsQuery.refetch();
    }

    function onCardClick(entry: IntegrationCatalogEntry) {
        const existing = firstConnByProvider[entry.provider];
        if (existing) setManageTarget(existing);
        else setConnectTarget(entry);
    }

    return (
        <Page>
            <PageTopbar
                eyebrow={isHe ? "אינטגרציות" : "Integrations"}
                subtitle={isHe ? "חבר את הכלים שלך: CRM, התראות, אוטומציה, פגישות ונתונים" : "Connect your stack — CRMs, alerts, automation, meetings, and data"}
            >
                <div className="flex items-center gap-2">
                    <div className="w-48 hidden sm:block">
                        <SearchInput value={query} onChange={setQuery} placeholder={isHe ? "חיפוש אינטגרציות…" : "Search integrations"} />
                    </div>
                    <button
                        type="button"
                        onClick={refreshAll}
                        aria-label={isHe ? "רענן" : "Refresh"}
                        className="h-7 w-7 rounded-md border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-900 inline-flex items-center justify-center transition-colors"
                    >
                        <RefreshCwIcon className={cn("w-3 h-3", connectionsQuery.isFetching && "animate-spin")} />
                    </button>
                </div>
            </PageTopbar>

            <div className="sm:hidden px-4 py-2 border-b border-slate-200">
                <SearchInput value={query} onChange={setQuery} placeholder={isHe ? "חיפוש אינטגרציות…" : "Search integrations"} />
            </div>

            <StatStrip cols={4}>
                <Stat label={isHe ? "זמינים" : "Available"} value={catalog.length} sub={isHe ? "ספקים" : "providers"} />
                <Stat
                    label={isHe ? "מחוברים" : "Connected"}
                    value={connectedCount}
                    sub={isHe ? `${connections.length} סה״כ` : `${connections.length} total`}
                    accent={connectedCount > 0}
                />
                <Stat
                    label={isHe ? "דורש תשומת לב" : "Needs attention"}
                    value={attentionCount}
                    sub={attentionCount > 0 ? (isHe ? "חיבור מחדש / שגיאות" : "reconnect / errors") : (isHe ? "הכל תקין" : "all healthy")}
                />
                <Stat label={isHe ? "פגישות" : "Meetings"} value={bookings.length} sub={isHe ? "נקבעו דרך אינטגרציות" : "booked via integrations"} last />
            </StatStrip>

            <PageBody>
                {/* Connected rail */}
                {connections.length > 0 && (
                    <section>
                        <SectionBar label={isHe ? "החיבורים שלך" : "Your connections"} count={connections.length} />
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-slate-200/60 border-b border-slate-200/60">
                            {connections.map((c, i) => (
                                <ConnectionCard
                                    key={c.id}
                                    index={i}
                                    connection={c}
                                    entry={entryByProvider[c.provider]}
                                    onManage={() => setManageTarget(c)}
                                    isHe={isHe}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* Catalog by category */}
                {CATEGORY_ORDER.map((category) => {
                    const entries = grouped[category] ?? [];
                    if (entries.length === 0) return null;
                    return (
                        <section key={category}>
                            <SectionBar label={CATEGORY_LABELS[category]} count={entries.length} />
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-slate-200/60 border-b border-slate-200/60">
                                {entries.map((entry, i) => (
                                    <CatalogCard
                                        key={entry.provider}
                                        index={i}
                                        entry={entry}
                                        connection={firstConnByProvider[entry.provider]}
                                        onClick={() => onCardClick(entry)}
                                        isHe={isHe}
                                    />
                                ))}
                            </div>
                        </section>
                    );
                })}

                {q && filtered.length === 0 && (
                    <EmptyBlock
                        title={isHe ? "אין התאמות" : "No matches"}
                        body={isHe ? `לא נמצאו התאמות עבור “${query}”.` : `Nothing in the catalog matches “${query}”.`}
                    />
                )}

                {/* Meetings */}
                <SectionBar label={isHe ? "פגישות שנקבעו" : "Meeting bookings"} count={bookings.length}>
                    <CalendarCheckIcon className="w-3 h-3 text-slate-400" />
                </SectionBar>
                {bookings.length === 0 ? (
                    <EmptyBlock
                        title={isHe ? "עדיין לא נקבעו פגישות" : "No meetings booked yet"}
                        body={
                            isHe
                                ? "חבר את Calendly או Cal.com כדי לשייך פגישות שנקבעו לקמפיין שהביא את הליד."
                                : "Connect Calendly or Cal.com to credit booked meetings to the campaign that surfaced the lead."
                        }
                    />
                ) : (
                    <div className="divide-y divide-slate-200/60 border-b border-slate-200/60">
                        {bookings.slice(0, 12).map((b) => (
                            <div key={b.id} className="px-5 h-12 flex items-center gap-3 text-[12.5px]">
                                <span
                                    className={cn(
                                        "size-1.5 rounded-full shrink-0",
                                        b.source === "calendly" ? "bg-rose-400" : "bg-indigo-400",
                                    )}
                                />
                                <span className="font-medium text-slate-900 truncate max-w-[40%] sm:max-w-none sm:w-60">{b.invitee_email}</span>
                                <span className="text-slate-500 truncate flex-1">{b.event_name}</span>
                                <span className="font-mono text-[10.5px] text-slate-400 tabular-nums shrink-0">
                                    <span className="sm:hidden">
                                        {b.scheduled_for ? new Date(b.scheduled_for).toLocaleDateString(isHe ? "he-IL" : undefined) : (isHe ? "טרם נקבע" : "tbd")}
                                    </span>
                                    <span className="hidden sm:inline">
                                        {b.scheduled_for ? new Date(b.scheduled_for).toLocaleString(isHe ? "he-IL" : undefined) : (isHe ? "טרם נקבע" : "tbd")}
                                    </span>
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </PageBody>

            {connectTarget && (
                <ConnectDrawer
                    entry={connectTarget}
                    onClose={() => setConnectTarget(null)}
                    onConnected={(conn) => {
                        connectionsQuery.refetch();
                        if (conn.inbound_webhook_url) {
                            setInboundUrl({ provider: conn.provider, url: conn.inbound_webhook_url });
                        } else {
                            // Drop straight into management so the user can wire automations.
                            setManageTarget(conn);
                        }
                    }}
                />
            )}
            {manageTarget && (
                <ConnectionDetail
                    connection={manageTarget}
                    entry={entryByProvider[manageTarget.provider]}
                    onClose={() => {
                        setManageTarget(null);
                        connectionsQuery.refetch();
                    }}
                />
            )}
            {inboundUrl && (
                <InboundUrlDialog
                    provider={inboundUrl.provider}
                    url={inboundUrl.url}
                    onClose={() => setInboundUrl(null)}
                />
            )}
        </Page>
    );
}

function CatalogCard({
    entry,
    connection,
    onClick,
    index = 0,
    isHe = false,
}: {
    entry: IntegrationCatalogEntry;
    connection?: IntegrationConnection;
    onClick: () => void;
    index?: number;
    isHe?: boolean;
}) {
    const connected = !!connection;
    const comingSoon = entry.auth_method === "oauth" && !entry.configured && !connected;
    return (
        <motion.button
            type="button"
            onClick={onClick}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1], delay: Math.min(index, 12) * 0.03 }}
            className="text-start rtl:text-right ltr:text-left bg-white p-5 flex flex-col min-h-[150px] hover:bg-slate-50/60 transition-colors group"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <ProviderGlyph provider={entry.provider} name={entry.name} />
                    <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-slate-900 truncate">{entry.name}</div>
                        <div className="text-[10px] uppercase tracking-normal text-slate-400 font-mono">
                            {entry.auth_method === "oauth" ? (isHe ? "בלחיצה אחת" : "one-click") : entry.auth_method}
                            {entry.beta && <span className="ms-1.5 text-amber-600">· {isHe ? "בטא" : "beta"}</span>}
                        </div>
                    </div>
                </div>
                {connected ? <StatusPill status={connection.status} /> : comingSoon ? <ComingSoon isHe={isHe} /> : null}
            </div>

            <p className="mt-3 text-[12px] text-slate-600 leading-relaxed line-clamp-2">{entry.tagline}</p>

            <div className="mt-auto pt-3 flex items-center justify-between gap-2">
                {entry.docs_url ? (
                    <a
                        href={entry.docs_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[11px] text-slate-400 hover:text-sky-700 inline-flex items-center gap-1 underline decoration-dotted underline-offset-2"
                    >
                        <ExternalLinkIcon className="w-3 h-3" />
                        {isHe ? "תיעוד" : "Docs"}
                    </a>
                ) : (
                    <span />
                )}
                <span
                    className={cn(
                        "h-7 px-2.5 rounded-md text-[11.5px] font-medium inline-flex items-center gap-1 transition-colors",
                        connected
                            ? "text-slate-600 group-hover:text-slate-900 group-hover:bg-slate-100"
                            : comingSoon
                              ? "text-slate-300"
                              : "bg-sky-600 text-white group-hover:bg-sky-700",
                    )}
                >
                    {connected ? (
                        <>
                            <SettingsIcon className="w-3 h-3" />
                            {isHe ? "ניהול" : "Manage"}
                        </>
                    ) : comingSoon ? (
                        isHe ? "בקרוב" : "Coming soon"
                    ) : (
                        isHe ? "התחבר" : "Connect"
                    )}
                </span>
            </div>
        </motion.button>
    );
}

function ConnectionCard({
    connection,
    entry,
    onManage,
    index = 0,
    isHe = false,
}: {
    connection: IntegrationConnection;
    entry?: IntegrationCatalogEntry;
    onManage: () => void;
    index?: number;
    isHe?: boolean;
}) {
    const account =
        connection.external_account_name ||
        (connection.display_fields as Record<string, string>)?.account ||
        (connection.display_fields as Record<string, string>)?.workspace ||
        (connection.display_fields as Record<string, string>)?.channel ||
        "";
    return (
        <motion.button
            type="button"
            onClick={onManage}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1], delay: Math.min(index, 12) * 0.03 }}
            className="text-start rtl:text-right ltr:text-left bg-white p-4 flex items-center gap-3 hover:bg-slate-50/60 transition-colors"
        >
            <ProviderGlyph provider={connection.provider} name={entry?.name ?? connection.label} />
            <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-semibold text-slate-900 truncate">{connection.label}</div>
                <div className="text-[11px] text-slate-400 truncate">{account || (entry?.name ?? connection.provider)}</div>
            </div>
            <StatusPill status={connection.status} />
        </motion.button>
    );
}

function ComingSoon({ isHe = false }: { isHe?: boolean }) {
    return (
        <span className="inline-flex items-center h-5 px-1.5 rounded text-[9.5px] uppercase tracking-normal font-medium bg-slate-100 text-slate-400">
            {isHe ? "בקרוב" : "soon"}
        </span>
    );
}
