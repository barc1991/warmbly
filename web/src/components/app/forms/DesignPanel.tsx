// DesignPanel — the builder's right rail on the Design tab: theme presets,
// layout/mode, branding images, colors and the button. Everything except the
// Branding uploads writes into the draft's design object; the canvas
// re-renders live. Images save immediately (they are not part of the draft).

import React from "react";
import { ImageIcon, PlusIcon, XIcon } from "lucide-react";
import toast from "react-hot-toast";

import { Label, NumberInput, TextInput } from "@/components/ui/field";
import ColorPicker from "@/components/ui/color-picker";
import { SettingRow, Segmented, Toggle } from "@/components/app/campaigns/preferences/components/CampaignPreferenceBoolBox";
import { useDeleteFormImage, useUploadFormImage } from "@/lib/api/hooks/app/forms";
import type Form from "@/lib/api/models/app/forms/Form";
import type { FormDesign } from "@/lib/api/models/app/forms/Form";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";

import DesignGroup from "./DesignGroup";
import FontPicker from "./FontPicker";
import { FONT_CATALOG, resolveDesign } from "./designCore";
import { THEME_PRESETS, applyThemePreset, type ThemePreset } from "./themePresets";

type GroupKey = "theme" | "layout" | "header" | "cover" | "branding" | "colors" | "button";

const SWATCHES = ["#0284c7", "#7c3aed", "#db2777", "#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#0d9488", "#0f172a", "#475569"];
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function ColorField({
    label,
    value,
    fallback,
    onChange,
    swatches = false,
}: {
    label: string;
    value?: string;
    fallback: string;
    onChange: (v: string) => void;
    swatches?: boolean;
}) {
    const current = value || fallback;
    const [text, setText] = React.useState(current);
    React.useEffect(() => setText(current), [current]);
    return (
        <div>
            <Label>{label}</Label>
            <div className="flex items-center gap-1.5">
                <ColorPicker value={value} fallback={fallback} onChange={onChange} aria-label={label} />
                <TextInput
                    value={text}
                    onChange={(v) => {
                        setText(v);
                        if (HEX_RE.test(v.trim())) onChange(v.trim().toLowerCase());
                    }}
                    onBlur={() => setText(current)}
                    placeholder={fallback}
                    className="w-24 font-mono"
                    invalid={!HEX_RE.test(text.trim())}
                    title="#rrggbb"
                />
            </div>
            {swatches && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                    {SWATCHES.map((c) => (
                        <button
                            key={c}
                            type="button"
                            aria-label={`Use ${c}`}
                            onClick={() => onChange(c)}
                            className={`size-5 rounded-full border ${current === c ? "ring-2 ring-sky-400 ring-offset-1 border-transparent" : "border-slate-200"}`}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ThemeSwatch previews a preset with its real colors: page background frame,
// form card and a button-colored dot.
function ThemeSwatch({ preset, active, onApply }: { preset: ThemePreset; active: boolean; onApply: () => void }) {
    const r = resolveDesign(preset.patch);
    const themeName = THEME_LABELS[preset.id] || preset.label;
    return (
        <button
            type="button"
            onClick={onApply}
            className={`rounded-md border p-1.5 text-start transition-shadow ${
                active ? "border-sky-400 ring-2 ring-sky-100" : "border-slate-200 hover:border-slate-300"
            }`}
        >
            <span className="block h-12 rounded" style={{ background: r.pageBgCss }} aria-hidden>
                <span
                    className="mx-auto mt-2 block h-8 w-3/4 rounded-sm px-1.5 pt-1.5"
                    style={{ background: r.formBg, boxShadow: "0 1px 3px rgba(15,23,42,.12)" }}
                >
                    <span className="block h-1 w-2/3 rounded-full" style={{ background: r.label, opacity: 0.5 }} />
                    <span className="mt-1 block h-2 w-5 rounded-sm" style={{ background: r.btnBg }} />
                </span>
            </span>
            <span className={`mt-1 block text-[11px] ${active ? "text-sky-700 font-medium" : "text-slate-600"}`}>{themeName}</span>
        </button>
    );
}

// LayoutOption is a mini wireframe of one page layout.
function LayoutOption({
    value,
    label,
    active,
    onPick,
    children,
}: {
    value: string;
    label: string;
    active: boolean;
    onPick: (v: string) => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={() => onPick(value)}
            className={`flex-1 rounded-md border p-1.5 transition-shadow ${
                active ? "border-sky-400 ring-2 ring-sky-100" : "border-slate-200 hover:border-slate-300"
            }`}
        >
            <span className="block h-9 rounded bg-slate-100 overflow-hidden" aria-hidden>
                {children}
            </span>
            <span className={`mt-1 block text-center text-[11px] ${active ? "text-sky-700 font-medium" : "text-slate-600"}`}>
                {label}
            </span>
        </button>
    );
}

const THEME_LABELS: Record<string, string> = {
    minimal: "מינימלי",
    "soft-slate": "אפור רך",
    midnight: "חצות",
    ocean: "אוקיינוס",
    sunset: "שקיעה",
    paper: "נייר",
    bold: "מודגש",
    glass: "זכוכית",
};

const FONT_LABELS: Record<string, string> = {
    system: "מערכת",
    inter: "Inter",
    manrope: "Manrope",
    sora: "Sora",
    "space-grotesk": "Space Grotesk",
    fraunces: "Fraunces",
    poppins: "Poppins",
    roboto: "Roboto",
};

const imageCaps = {
    logo: { bytes: 1 << 20, hint: "PNG או JPG, עד 1 MB. מוצג מעל הטופס, או בסרגל העליון." },
    cover: { bytes: 4 << 20, hint: "PNG או JPG, עד 4 MB. ממלא את פאנל הצד במבנה מפוצל." },
    background: { bytes: 4 << 20, hint: "PNG או JPG, עד 4 MB. מוצג ברקע של כל העמוד." },
} as const;

function ImageRow({
    formId,
    kind,
    label,
    url,
    disabled,
    onSaved,
}: {
    formId: string;
    kind: keyof typeof imageCaps;
    label: string;
    url: string;
    disabled: boolean;
    onSaved: (f: Form) => void;
}) {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const upload = useUploadFormImage();
    const remove = useDeleteFormImage();
    const busy = upload.isPending || remove.isPending;

    async function onPick(file: File) {
        if (file.size > imageCaps[kind].bytes) {
            toast.error(`תמונה גדולה מדי: מגבלת ה-${label} היא ${imageCaps[kind].bytes >> 20} MB`);
            return;
        }
        try {
            onSaved(await upload.mutateAsync({ id: formId, kind, file }));
        } catch (err) {
            toast.error(buildError(err as AppError));
        }
    }

    async function onRemove() {
        try {
            onSaved(await remove.mutateAsync({ id: formId, kind }));
        } catch (err) {
            toast.error(buildError(err as AppError));
        }
    }

    return (
        <div>
            <Label>{label}</Label>
            <div className="flex items-center gap-2">
                <span className="size-9 rounded-md border border-slate-200 bg-slate-50 shrink-0 overflow-hidden inline-flex items-center justify-center">
                    {url ? (
                        <img src={url} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <ImageIcon className="w-3.5 h-3.5 text-slate-300" />
                    )}
                </span>
                <button
                    type="button"
                    disabled={disabled || busy}
                    onClick={() => inputRef.current?.click()}
                    className="h-7 px-2.5 rounded-md border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                    {busy ? "מעבד…" : url ? "החלף" : "העלה"}
                </button>
                {url && !busy && (
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => void onRemove()}
                        className="h-7 px-2 rounded-md text-[12px] text-slate-500 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                    >
                        הסר
                    </button>
                )}
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) void onPick(f);
                    }}
                />
            </div>
            <p className="text-[10.5px] text-slate-400 mt-1">{imageCaps[kind].hint}</p>
        </div>
    );
}

export default function DesignPanel({
    formId,
    design,
    logoUrl,
    coverUrl,
    backgroundUrl,
    canEdit,
    onChange,
    onReplaceDesign,
    onAssetsSaved,
}: {
    formId: string;
    design: FormDesign;
    logoUrl: string;
    coverUrl: string;
    backgroundUrl: string;
    canEdit: boolean;
    onChange: (patch: Partial<FormDesign>) => void;
    /** Theme presets clear keys by omission, so they replace the whole object. */
    onReplaceDesign: (d: FormDesign) => void;
    onAssetsSaved: (f: Form) => void;
}) {
    const layout = design.layout === "wide" || design.layout === "split" ? design.layout : "card";
    // Theme and Layout are what people reach for first, so they start open and
    // the rest stay a click away rather than a scroll away.
    const [openGroups, setOpenGroups] = React.useState<Record<GroupKey, boolean>>({
        theme: true,
        layout: true,
        header: false,
        cover: false,
        branding: false,
        colors: false,
        button: false,
    });
    const toggle = (k: GroupKey) => setOpenGroups((g) => ({ ...g, [k]: !g[k] }));
    const group = (k: GroupKey) => ({ open: openGroups[k], onToggle: () => toggle(k) });

    const themeLabel = THEME_PRESETS.find((p) => p.id === design.theme)?.label ?? "מותאם אישית";
    const fontLabel = FONT_CATALOG[design.font_family ?? "system"]?.label ?? "מערכת";
    const assetCount = [logoUrl, coverUrl, backgroundUrl].filter(Boolean).length;
    const [gradientOpen, setGradientOpen] = React.useState(!!design.page_background_end);
    React.useEffect(() => {
        if (design.page_background_end) setGradientOpen(true);
    }, [design.page_background_end]);

    return (
        <div className="flex flex-col">
            <DesignGroup title="ערכת נושא" hint={themeLabel} {...group("theme")}>
                <div className="grid grid-cols-2 gap-2">
                    {THEME_PRESETS.map((p) => (
                        <ThemeSwatch
                            key={p.id}
                            preset={p}
                            active={design.theme === p.id}
                            onApply={() => onReplaceDesign(applyThemePreset(design, p))}
                        />
                    ))}
                </div>
                <p className="text-[10.5px] text-slate-400">ערכת נושא קובעת את הצבעים והגופן; הפריסה והתוכן נשארים ללא שינוי.</p>
            </DesignGroup>

            <DesignGroup
                title="פריסה"
                hint={`${layout === "card" ? "כרטיס" : layout === "wide" ? "רחב" : "מפוצל"} · ${fontLabel}`}
                {...group("layout")}
            >
                <div className="flex gap-2">
                    <LayoutOption value="card" label="כרטיס" active={layout === "card"} onPick={(v) => onChange({ layout: v })}>
                        <span className="mx-auto mt-1.5 block h-6 w-1/2 rounded-sm bg-white shadow-sm" />
                    </LayoutOption>
                    <LayoutOption value="wide" label="רחב" active={layout === "wide"} onPick={(v) => onChange({ layout: v })}>
                        <span className="mx-auto mt-1.5 block h-6 w-4/5 rounded-sm bg-slate-100">
                            <span className="mx-auto mt-1 block h-1 w-2/3 rounded-full bg-slate-300" />
                            <span className="mx-auto mt-0.5 block h-1 w-2/3 rounded-full bg-slate-300" />
                        </span>
                    </LayoutOption>
                    <LayoutOption value="split" label="מפוצל" active={layout === "split"} onPick={(v) => onChange({ layout: v })}>
                        <span className="flex h-full">
                            <span className="block w-2/5 h-full bg-slate-300" />
                            <span className="flex-1 pt-2 px-1.5">
                                <span className="block h-1 w-full rounded-full bg-slate-300" />
                                <span className="mt-0.5 block h-1 w-2/3 rounded-full bg-slate-300" />
                            </span>
                        </span>
                    </LayoutOption>
                </div>
                <div>
                    <Label>זרימה</Label>
                    <Segmented
                        className="w-full [&>button]:flex-1 [&>button]:min-w-0"
                        value={design.mode === "focus" ? "focus" : "classic"}
                        onChange={(v) => onChange({ mode: v })}
                        options={[
                            { value: "classic", label: "עמודים" },
                            { value: "focus", label: "אחד בכל פעם" },
                        ]}
                    />
                    <p className="text-[10.5px] text-slate-400 mt-1">
                        {design.mode === "focus"
                            ? "כל שאלה מקבלת מסך משלה; מקש Enter מעביר קדימה."
                            : "שדות זורמים במורד העמוד; מעברי עמוד מחלקים אותם לשלבים."}
                    </p>
                </div>
                <div>
                    <Label>יישור</Label>
                    <Segmented
                        className="w-full [&>button]:flex-1 [&>button]:min-w-0"
                        value={design.align === "center" ? "center" : "left"}
                        onChange={(v) => onChange({ align: v })}
                        options={[
                            { value: "left", label: "שמאל" },
                            { value: "center", label: "מרכז" },
                        ]}
                    />
                </div>
                <SettingRow title="סרגל התקדמות" description="הצג כמה נותר בטופס מרובה עמודים.">
                    <Toggle value={design.show_progress ?? true} onChange={(v) => onChange({ show_progress: v })} />
                </SettingRow>
                <div>
                    <Label>גופן</Label>
                    <FontPicker
                        value={design.font_family ?? "system"}
                        onChange={(v) => onChange({ font_family: v })}
                    />
                </div>
                <div className="flex items-end gap-3">
                    <div>
                        <Label>רוחב טופס</Label>
                        <NumberInput value={design.max_width ?? 560} onChange={(v) => onChange({ max_width: v })} min={320} max={960} step={20} suffix="px" className="w-28" />
                    </div>
                    <div>
                        <Label>רדיוס פינות</Label>
                        <NumberInput value={design.border_radius ?? 10} onChange={(v) => onChange({ border_radius: v })} min={0} max={24} suffix="px" className="w-24" />
                    </div>
                </div>
                <div>
                    <Label>מרווח בין שדות</Label>
                    <Segmented
                        className="w-full [&>button]:flex-1 [&>button]:min-w-0"
                        value={(design.spacing as "compact" | "normal" | "relaxed") || "normal"}
                        onChange={(v) => onChange({ spacing: v })}
                        options={[
                            { value: "compact", label: "קומפקטי" },
                            { value: "normal", label: "רגיל" },
                            { value: "relaxed", label: "מרווח" },
                        ]}
                    />
                </div>
                {layout === "card" && (
                    <SettingRow title="צללית כרטיס" description="הצללה רכה מאחורי כרטיס הטופס.">
                        <Toggle value={design.shadow ?? true} onChange={(v) => onChange({ shadow: v })} />
                    </SettingRow>
                )}
            </DesignGroup>

            <DesignGroup
                title="שורת כותרת"
                hint={
                    design.header_enabled
                        ? design.header_placement === "inline"
                            ? "בתוך הטופס"
                            : "לרוחב העמוד"
                        : "כבוי"
                }
                {...group("header")}
            >
                <SettingRow title="הצג שורת כותרת" description="סרגל עליון הנושא את הלוגו והכותרת שלך.">
                    <Toggle value={design.header_enabled ?? false} onChange={(v) => onChange({ header_enabled: v })} />
                </SettingRow>
                {design.header_enabled && (
                    <>
                        <div>
                            <Label>כותרת עליונה</Label>
                            <TextInput
                                value={design.header_title ?? ""}
                                onChange={(v) => onChange({ header_title: v })}
                                placeholder="שם החברה שלך"
                            />
                        </div>
                        <div>
                            <Label>מיקום</Label>
                            <Segmented
                                className="w-full [&>button]:flex-1 [&>button]:min-w-0"
                                value={(design.header_placement as "page" | "inline") || "page"}
                                onChange={(v) => onChange({ header_placement: v })}
                                options={[
                                    { value: "page", label: "לרוחב העמוד" },
                                    { value: "inline", label: "בתוך הטופס" },
                                ]}
                            />
                            <p className="text-[10.5px] text-slate-400 mt-1">
                                {design.header_placement === "inline"
                                    ? "יושב על גבי הטופס עצמו, מעל השדות, עם קו מפריד תחתיו."
                                    : "סרגל לרוחב החלק העליון של העמוד, מקצה לקצה."}
                            </p>
                        </div>
                        {logoUrl && (
                            <SettingRow
                                title="הצג את הלוגו כאן"
                                description="כיבוי משאיר אותו על הטופס ומציג בכותרת את הטקסט בלבד."
                            >
                                <Toggle
                                    value={design.header_show_logo ?? true}
                                    onChange={(v) => onChange({ header_show_logo: v })}
                                />
                            </SettingRow>
                        )}
                        <div>
                            <Label>תוכן</Label>
                            <Segmented
                                className="w-full [&>button]:flex-1 [&>button]:min-w-0"
                                value={
                                    (design.header_align as "left" | "center" | "between") ||
                                    (design.align === "center" ? "center" : "left")
                                }
                                onChange={(v) => onChange({ header_align: v })}
                                options={[
                                    { value: "left", label: "שמאל" },
                                    { value: "center", label: "מרכז" },
                                    { value: "between", label: "מפוזר" },
                                ]}
                            />
                        </div>
                        {design.header_placement !== "inline" && (
                            <>
                                <ColorField
                                    label="רקע כותרת עליונה"
                                    value={design.header_background}
                                    fallback={design.form_background || "#ffffff"}
                                    onChange={(v) => onChange({ header_background: v })}
                                />
                                <SettingRow
                                    title="הישאר מקובע במסך"
                                    description="שומר על הסרגל גלוי בזמן גלילת הטופס."
                                >
                                    <Toggle
                                        value={design.header_sticky ?? false}
                                        onChange={(v) => onChange({ header_sticky: v })}
                                    />
                                </SettingRow>
                            </>
                        )}
                        <p className="text-[10.5px] text-slate-400">
                            כותרת ללא לוגו וללא כותרת טקסט מוחרגת בעמוד הפעיל. יישור למרכז מציג את הלוגו מעל הכותרת.
                        </p>
                    </>
                )}
            </DesignGroup>

            {layout === "split" && (
                <DesignGroup title="חלונית צד" hint={design.cover_title || "ללא כותרת"} {...group("cover")}>
                    <div>
                        <Label>כותרת החלונית</Label>
                        <TextInput
                            value={design.cover_title ?? ""}
                            onChange={(v) => onChange({ cover_title: v })}
                            placeholder="תיאום הדגמה"
                        />
                    </div>
                    <div>
                        <Label>טקסט החלונית</Label>
                        <textarea
                            value={design.cover_subtitle ?? ""}
                            onChange={(e) => onChange({ cover_subtitle: e.target.value })}
                            rows={3}
                            placeholder="עשרים דקות, ללא שקופיות."
                            className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[16px] md:text-[12.5px] text-slate-900 outline-none transition-colors focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                        />
                    </div>
                    <p className="text-[10.5px] text-slate-400">
                        מופיע מעל תמונת הנושא, בטקסט לבן עם צל עדין לקריאה מיטבית מעל כל תמונה.
                    </p>
                </DesignGroup>
            )}

            <DesignGroup
                title="מיתוג"
                hint={assetCount ? `${assetCount} תמונ${assetCount > 1 ? "ות" : "ה"}` : "אין תמונות"}
                {...group("branding")}
            >
                <ImageRow formId={formId} kind="logo" label="לוגו" url={logoUrl} disabled={!canEdit} onSaved={onAssetsSaved} />
                {logoUrl && (
                    <>
                        <div>
                            <Label>גודל לוגו</Label>
                            <Segmented
                                className="w-full [&>button]:flex-1 [&>button]:min-w-0"
                                value={(design.logo_size as "sm" | "md" | "lg") || "md"}
                                onChange={(v) => onChange({ logo_size: v })}
                                options={[
                                    { value: "sm", label: "קטן" },
                                    { value: "md", label: "בינוני" },
                                    { value: "lg", label: "גדול" },
                                ]}
                            />
                        </div>
                        {layout === "card" && !design.header_enabled && (
                            <div>
                                <Label>מיקום לוגו</Label>
                                <Segmented
                                    className="w-full [&>button]:flex-1 [&>button]:min-w-0"
                                    value={(design.logo_position as "card" | "page") || "card"}
                                    onChange={(v) => onChange({ logo_position: v })}
                                    options={[
                                        { value: "card", label: "על גבי הכרטיס" },
                                        { value: "page", label: "מעליו" },
                                    ]}
                                />
                                <p className="text-[10.5px] text-slate-400 mt-1">
                                    מעל הכרטיס ממקם אותו על גבי רקע העמוד, ודא שהוא קריא שם.
                                </p>
                            </div>
                        )}
                    </>
                )}
                <ImageRow formId={formId} kind="cover" label="תמונת נושא" url={coverUrl} disabled={!canEdit} onSaved={onAssetsSaved} />
                <ImageRow
                    formId={formId}
                    kind="background"
                    label="תמונת רקע"
                    url={backgroundUrl}
                    disabled={!canEdit}
                    onSaved={onAssetsSaved}
                />
                {backgroundUrl && (
                    <>
                        <div>
                            <Label>התאמת רקע</Label>
                            <Segmented
                                className="w-full [&>button]:flex-1 [&>button]:min-w-0"
                                value={(design.background_size as "cover" | "contain" | "tile") || "cover"}
                                onChange={(v) => onChange({ background_size: v })}
                                options={[
                                    { value: "cover", label: "מילוי" },
                                    { value: "contain", label: "התאמה" },
                                    { value: "tile", label: "פריסה חוזרת" },
                                ]}
                            />
                        </div>
                        <div>
                            <Label>עמעום</Label>
                            <NumberInput
                                value={design.background_overlay ?? 0}
                                onChange={(v) => onChange({ background_overlay: v })}
                                min={0}
                                max={100}
                                step={5}
                                suffix="%"
                                className="w-24"
                            />
                            <p className="text-[10.5px] text-slate-400 mt-1">
                                ממזג את צבע העמוד מעל התמונה. הגדל ערך זה כאשר הטקסט קשה לקריאה.
                            </p>
                        </div>
                    </>
                )}
            </DesignGroup>

            <DesignGroup title="צבעים" hint={design.accent_color || "#0284c7"} {...group("colors")}>
                <ColorField label="צבע הדגשה" value={design.accent_color} fallback="#0284c7" onChange={(v) => onChange({ accent_color: v })} swatches />
                <div className="grid grid-cols-2 gap-3">
                    <ColorField label="רקע עמוד" value={design.page_background} fallback="#f8fafc" onChange={(v) => onChange({ page_background: v })} />
                    {gradientOpen ? (
                        <div className="relative">
                            <ColorField
                                label="מתמזג אל"
                                value={design.page_background_end}
                                fallback={design.page_background || "#f8fafc"}
                                onChange={(v) => onChange({ page_background_end: v })}
                            />
                            <button
                                type="button"
                                aria-label="הסר גרדיאנט"
                                onClick={() => {
                                    setGradientOpen(false);
                                    onChange({ page_background_end: "" });
                                }}
                                className="absolute top-0 end-0 size-5 inline-flex items-center justify-center rounded text-slate-400 hover:text-slate-700"
                            >
                                <XIcon className="w-3 h-3" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-end pb-1">
                            <button
                                type="button"
                                onClick={() => setGradientOpen(true)}
                                className="h-7 px-2 inline-flex items-center gap-1 rounded-md text-[11.5px] text-slate-500 hover:bg-slate-100"
                            >
                                <PlusIcon className="w-3 h-3" /> גרדיאנט
                            </button>
                        </div>
                    )}
                    <ColorField label="רקע טופס" value={design.form_background} fallback="#ffffff" onChange={(v) => onChange({ form_background: v })} />
                    <ColorField label="טקסט" value={design.text_color} fallback="#0f172a" onChange={(v) => onChange({ text_color: v })} />
                    <ColorField label="תוויות" value={design.label_color} fallback="#334155" onChange={(v) => onChange({ label_color: v })} />
                    <ColorField label="רקע שדות" value={design.input_background} fallback="#ffffff" onChange={(v) => onChange({ input_background: v })} />
                    <ColorField label="מסגרת שדות" value={design.input_border_color} fallback="#e2e8f0" onChange={(v) => onChange({ input_border_color: v })} />
                    <ColorField label="טקסט שדות" value={design.input_text_color} fallback="#0f172a" onChange={(v) => onChange({ input_text_color: v })} />
                    <ColorField label="טקסט מציין מיקום" value={design.placeholder_color} fallback="#94a3b8" onChange={(v) => onChange({ placeholder_color: v })} />
                </div>
            </DesignGroup>

            <DesignGroup title="כפתור" hint={design.button_text || "שליחה"} {...group("button")}>
                <div>
                    <Label>טקסט כפתור</Label>
                    <TextInput value={design.button_text ?? ""} onChange={(v) => onChange({ button_text: v })} placeholder="שליחה" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <ColorField label="רקע" value={design.button_background} fallback="#0284c7" onChange={(v) => onChange({ button_background: v })} />
                    <ColorField label="צבע טקסט" value={design.button_text_color} fallback="#ffffff" onChange={(v) => onChange({ button_text_color: v })} />
                </div>
                <div>
                    <Label>גודל</Label>
                    <Segmented
                        className="w-full [&>button]:flex-1 [&>button]:min-w-0"
                        value={(design.button_size as "sm" | "md" | "lg") || "md"}
                        onChange={(v) => onChange({ button_size: v })}
                        options={[
                            { value: "sm", label: "קטן" },
                            { value: "md", label: "בינוני" },
                            { value: "lg", label: "גדול" },
                        ]}
                    />
                </div>
                <SettingRow title="רוחב מלא" description="מתיחת הכפתור לרוחב הטופס כולו.">
                    <Toggle value={design.button_full_width ?? false} onChange={(v) => onChange({ button_full_width: v })} />
                </SettingRow>
            </DesignGroup>
        </div>
    );
}
