// Form pieces shared by the new placement test and new placement batch
// dialogs: the copy to test, tracking, pace, seed panel and the pickers they use.

import React from "react";
import { AlertCircleIcon, Loader2Icon, MegaphoneIcon, UserRoundIcon } from "lucide-react";
import { Label, SearchInput, TextInput } from "@/components/ui/field";
import {
    PopoverMenu,
    PopoverMenuContent,
    PopoverMenuItem,
    PopoverMenuLabel,
    PopoverMenuSeparator,
    PopoverMenuTrigger,
    SelectButton,
} from "@/components/ui/popover-menu";
import { SelectMenu } from "@/components/ui/select-menu";
import { OptionSelect, Segmented } from "@/components/app/campaigns/preferences/components/CampaignPreferenceBoolBox";
import RichTextEditor from "@/components/app/campaigns/sequences/RichTextEditor";
import { VARIABLES, htmlToPlain } from "@/components/app/campaigns/sequences/emailPreview";
import { contactLabel } from "@/components/app/campaigns/sequences/previewContext";
import { LINK_VARIABLES } from "@/lib/templateVars";
import useDebouncedValue from "@/hooks/useDebouncedValue";
import useCampaigns from "@/lib/api/hooks/app/campaigns/useCampaigns";
import useSearchContacts from "@/lib/api/hooks/app/contacts/useSearchContacts";
import {
    PANEL_LABEL,
    type PlacementPace,
    type PlacementPanel,
    type PlacementPanelFamily,
    type PlacementPanelInfo,
    type PlacementTracking,
    type PlacementUsage,
} from "@/lib/api/models/app/placement/Placement";
import type Contact from "@/lib/api/models/app/contacts/Contact";
import { cn } from "@/lib/utils";
import type { CopyDraft, CopySource } from "./placementCopy";

export function SectionLabel({ children }: { children: React.ReactNode }) {
    return <span className="block mb-2 text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">{children}</span>;
}

export function CopySourceFields({
    value,
    patch,
    onSource,
    campaignName,
    steps,
    error,
}: {
    value: CopyDraft;
    patch: (p: Partial<CopyDraft>) => void;
    onSource: (s: CopySource) => void;
    campaignName?: string;
    steps: { emailSteps: { id: string; name?: string; subject?: string }[]; isLoading: boolean };
    error?: React.ReactNode;
}) {
    const { emailSteps } = steps;
    return (
        <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">מה לבדוק</span>
                <Segmented<CopySource>
                    value={value.source}
                    onChange={onSource}
                    options={[
                        { value: "step", label: "שלב בקמפיין" },
                        { value: "custom", label: "טקסט מותאם" },
                    ]}
                />
            </div>

            {value.source === "step" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="min-w-0">
                        <Label>קמפיין</Label>
                        <CampaignPicker
                            value={value.campaignId}
                            name={campaignName}
                            onChange={(id) => patch({ campaignId: id, stepId: "", contact: null })}
                        />
                    </div>
                    <div className="min-w-0">
                        <Label>שלב</Label>
                        <SelectMenu
                            value={value.stepId}
                            onChange={(v) => patch({ stepId: v })}
                            disabled={!value.campaignId || steps.isLoading}
                            fullWidth
                            placeholder={
                                !value.campaignId
                                    ? "בחר קמפיין תחילה"
                                    : steps.isLoading
                                      ? "טוען שלבים…"
                                      : emailSteps.length === 0
                                        ? "אין שלבי אימייל"
                                        : "בחר שלב"
                            }
                            options={emailSteps.map((s, i) => ({
                                value: s.id,
                                label: `${s.name || `שלב ${i + 1}`}${s.subject ? `: ${s.subject}` : ""}`,
                            }))}
                            aria-label="שלב"
                        />
                    </div>
                    <p className="sm:col-span-2 text-[11px] text-slate-400 leading-relaxed text-start">
                        השלב השמור מרונדר בדיוק כפי שהקמפיין שולח אותו: שדות מיזוג, spintax,
                        חתימה, הערת הסרה וכותרת ביטול הרשמה.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    <div>
                        <Label>נושא</Label>
                        <TextInput
                            value={value.subject}
                            onChange={(v) => patch({ subject: v })}
                            placeholder="שאלה קצרה, {{.FirstName}}"
                        />
                    </div>
                    <div>
                        <Label>גוף האימייל</Label>
                        <RichTextEditor
                            html={value.bodyHtml}
                            onChange={(html) => patch({ bodyHtml: html, bodyPlain: value.bodyCode ? "" : htmlToPlain(html) })}
                            code={value.bodyCode}
                            onCodeChange={(c) => patch({ bodyCode: c })}
                            variables={VARIABLES}
                            links={LINK_VARIABLES}
                            placeholder="שלום {{.FirstName}}, …"
                        />
                    </div>
                </div>
            )}
            {error}

            <div>
                <Label>רנדר עבור איש קשר</Label>
                <ContactPicker
                    campaignId={value.source === "step" ? value.campaignId : ""}
                    value={value.contact}
                    onChange={(c) => patch({ contact: c })}
                />
                <p className="mt-1.5 text-[11px] text-slate-400 leading-relaxed text-start">
                    ממלא את שדות המיזוג. רק תיבות הבדיקה (Seeds) יקבלו את עותקי האימייל.
                </p>
            </div>
        </section>
    );
}

export function TrackingChoice({
    value,
    onChange,
    source,
    textOnly,
    compareHint = "שתי בדיקות לאותן תיבות בדיקה. נספרות כ-2 בדיקות.",
    error,
}: {
    value: PlacementTracking;
    onChange: (v: PlacementTracking) => void;
    source: CopySource;
    textOnly: boolean;
    compareHint?: string;
    error?: React.ReactNode;
}) {
    return (
        <section>
            <SectionLabel>מעקב</SectionLabel>
            <OptionSelect<PlacementTracking>
                value={value}
                onChange={onChange}
                cols={2}
                aria-label="מעקב"
                options={[
                    ...(source === "step"
                        ? [{ value: "campaign" as const, label: "כמו בקמפיין", hint: "משתמש במעקב פתיחות והקלקות של הקמפיין." }]
                        : []),
                    ...(textOnly ? [] : [{ value: "on" as const, label: "פעיל", hint: "פיקסל פתיחה וקישורים במעקב." }]),
                    { value: "off" as const, label: "כבוי", hint: "ללא פיקסל, קישורים יישארו כפי שנכתבו." },
                    ...(textOnly ? [] : [{ value: "compare" as const, label: "השווה עם ובלי מעקב", hint: compareHint }]),
                ]}
            />
            {textOnly && <p className="mt-1.5 text-[11px] text-slate-400 text-start">קמפיין זה שולח טקסט רגיל, שאינו כולל מעקב.</p>}
            {error}
        </section>
    );
}

export function PaceChoice({ value, onChange }: { value: PlacementPace; onChange: (v: PlacementPace) => void }) {
    return (
        <section>
            <SectionLabel>קצב שליחה</SectionLabel>
            <OptionSelect<PlacementPace>
                value={value}
                onChange={onChange}
                cols={2}
                aria-label="קצב שליחה"
                options={[
                    { value: "spaced", label: "מרווח", hint: "כדקה בין עותקים, בדומה לקצב הקמפיין הרגיל." },
                    { value: "quick", label: "מהיר", hint: "שניות ספורות בין עותקים, לתוצאות תוך מספר דקות." },
                ]}
            />
        </section>
    );
}

// The seed panels as radio cards; an unavailable one says why.
export function PanelChoice({
    panels,
    loading,
    value,
    onChange,
    usage,
}: {
    panels: PlacementPanelInfo[];
    loading: boolean;
    value: PlacementPanel;
    onChange: (p: PlacementPanel) => void;
    usage?: PlacementUsage;
}) {
    if (loading) return <div className="h-16 rounded-md bg-slate-50 animate-pulse" />;
    return (
        <div role="radiogroup" aria-label="פאנל תיבות בדיקה" className="grid gap-1.5">
            {panels.map((p) => {
                const active = p.panel === value;
                return (
                    <button
                        key={p.panel}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={!p.available}
                        onClick={() => onChange(p.panel)}
                        className={cn(
                            "flex w-full items-start gap-2.5 rounded-md border px-3 py-2 text-start transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sky-100",
                            active && p.available
                                ? "border-sky-300 bg-sky-50"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                            !p.available && "opacity-60 cursor-not-allowed hover:bg-white hover:border-slate-200",
                        )}
                    >
                        <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                                <span className={cn("text-[12px] font-medium", active && p.available ? "text-sky-700" : "text-slate-700")}>
                                    {PANEL_LABEL[p.panel]}
                                </span>
                                <span className="font-mono text-[10.5px] text-slate-400 tabular-nums">
                                    {p.seeds} תיבות בדיקה
                                </span>
                            </span>
                            <span className="mt-0.5 block text-[11px] leading-snug text-slate-400">
                                {!p.available
                                    ? p.reason || "אינו זמין בסביבת עבודה זו."
                                    : "ללא הגבלה / אינו נספר כנגד המכסה"}
                            </span>
                        </span>
                        <span
                            className={cn(
                                "mt-0.5 size-4 shrink-0 rounded-full border transition-colors",
                                active && p.available ? "border-sky-600 bg-sky-600 ring-2 ring-inset ring-white" : "border-slate-300 bg-white",
                            )}
                            aria-hidden="true"
                        />
                    </button>
                );
            })}
        </div>
    );
}

export function FamilyChips({
    families,
    value,
    onChange,
}: {
    families: PlacementPanelFamily[];
    value: string[];
    onChange: (families: string[]) => void;
}) {
    const chip = (active: boolean) =>
        cn(
            "h-6 px-2 rounded-md border text-[11px] font-medium inline-flex items-center gap-1 transition-colors",
            active ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
        );
    return (
        <div className="mt-2 text-start">
            <span className="block mb-1.5 text-[11px] text-slate-500">ספקי תיבות דואר</span>
            <div className="flex flex-wrap gap-1">
                <button type="button" aria-pressed={value.length === 0} onClick={() => onChange([])} className={chip(value.length === 0)}>
                    הכל
                </button>
                {families.map((f) => {
                    const active = value.includes(f.family);
                    return (
                        <button
                            key={f.family}
                            type="button"
                            aria-pressed={active}
                            onClick={() => onChange(active ? value.filter((v) => v !== f.family) : [...value, f.family])}
                            className={chip(active)}
                        >
                            {f.label}
                            <span className="font-mono tabular-nums text-slate-400">{f.seeds}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export function InlineError({ message, compact = false }: { message: string; compact?: boolean }) {
    return (
        <p className={cn("flex items-start gap-1.5 text-[11.5px] leading-snug text-rose-600 text-start", !compact && "mt-1.5")}>
            <AlertCircleIcon className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>{message}</span>
        </p>
    );
}

export function CampaignPicker({ value, name, onChange }: { value: string; name?: string; onChange: (id: string) => void }) {
    const [open, setOpen] = React.useState(false);
    const [q, setQ] = React.useState("");
    const debounced = useDebouncedValue(q.trim(), 250);
    const list = useCampaigns({ query: debounced, folder: "", limit: 20, enabled: open });
    return (
        <PopoverMenu open={open} onOpenChange={setOpen}>
            <PopoverMenuTrigger asChild>
                <SelectButton
                    icon={<MegaphoneIcon className="w-3.5 h-3.5" />}
                    label={value ? (name ?? "טוען…") : "בחר קמפיין"}
                    className="w-full [&>span:nth-child(2)]:max-w-none [&>span:nth-child(2)]:flex-1 [&>span:nth-child(2)]:text-start"
                />
            </PopoverMenuTrigger>
            <PopoverMenuContent minWidth={280} className="p-1 max-h-80">
                <div className="p-1.5">
                    <SearchInput value={q} onChange={setQ} placeholder="חיפוש קמפיינים…" autoFocus />
                </div>
                {list.isLoading && list.campaigns.length === 0 ? (
                    <div className="px-3 py-2 text-[11.5px] text-slate-400 inline-flex items-center gap-1.5">
                        <Loader2Icon className="w-3 h-3 animate-spin" /> טוען…
                    </div>
                ) : list.campaigns.length === 0 ? (
                    <div className="px-3 py-2 text-[11.5px] text-slate-400">לא נמצא קמפיין תואם.</div>
                ) : (
                    list.campaigns.map((c) => (
                        <PopoverMenuItem key={c.id} selected={c.id === value} onSelect={() => onChange(c.id)}>
                            {c.name}
                        </PopoverMenuItem>
                    ))
                )}
            </PopoverMenuContent>
        </PopoverMenu>
    );
}

// Whose merge fields fill the copy. Empty = the campaign's first lead, or the
// built-in sample contact for custom copy.
export function ContactPicker({
    campaignId,
    value,
    onChange,
}: {
    campaignId: string;
    value: Contact | null;
    onChange: (c: Contact | null) => void;
}) {
    const [open, setOpen] = React.useState(false);
    const [q, setQ] = React.useState("");
    const debounced = useDebouncedValue(q.trim(), 250);
    const searching = debounced.length > 0;
    const search = useSearchContacts({
        options: {
            query: debounced,
            custom_field_filters: [],
            campaign_ids: searching || !campaignId ? [] : [campaignId],
            sort_by: "updated_at",
            reverse: false,
        },
        limit: 8,
        enabled: open,
        keepPrevious: true,
    });
    const contacts = search.contacts ?? [];
    const fallback = campaignId ? "הליד הראשון בקמפיין" : "איש קשר לדוגמה";
    return (
        <PopoverMenu open={open} onOpenChange={setOpen}>
            <PopoverMenuTrigger asChild>
                <SelectButton
                    icon={<UserRoundIcon className="w-3.5 h-3.5" />}
                    label={value ? contactLabel(value) : fallback}
                    className="w-full [&>span:nth-child(2)]:max-w-none [&>span:nth-child(2)]:flex-1 [&>span:nth-child(2)]:text-start"
                />
            </PopoverMenuTrigger>
            <PopoverMenuContent minWidth={300} matchTriggerWidth className="p-1">
                <div className="p-1.5">
                    <SearchInput value={q} onChange={setQ} placeholder="חיפוש אנשי קשר…" autoFocus />
                </div>
                <PopoverMenuItem selected={value === null} onSelect={() => onChange(null)} icon={<UserRoundIcon className="w-3.5 h-3.5" />}>
                    {fallback}
                </PopoverMenuItem>
                <PopoverMenuSeparator />
                <PopoverMenuLabel>{searching || !campaignId ? "אנשי קשר" : "לידים בקמפיין זה"}</PopoverMenuLabel>
                <div className="max-h-56 overflow-y-auto">
                    {search.isLoading && contacts.length === 0 ? (
                        <div className="px-3 py-2 text-[11.5px] text-slate-400 inline-flex items-center gap-1.5">
                            <Loader2Icon className="w-3 h-3 animate-spin" /> טוען…
                        </div>
                    ) : contacts.length === 0 ? (
                        <div className="px-3 py-2 text-[11.5px] text-slate-400">
                            {searching ? "לא נמצא איש קשר תואם." : "אין אנשי קשר עדיין. הקלד כדי לחפש."}
                        </div>
                    ) : (
                        contacts.map((c) => (
                            <PopoverMenuItem key={c.id} selected={value?.id === c.id} onSelect={() => onChange(c)}>
                                <span className="text-slate-800">{contactLabel(c)}</span>
                                <span className="ms-1.5 text-[11px] text-slate-400 dir-ltr text-start">{c.email}</span>
                            </PopoverMenuItem>
                        ))
                    )}
                </div>
            </PopoverMenuContent>
        </PopoverMenu>
    );
}
