// FieldSettingsPanel — the builder's right rail when a field is selected.

import React from "react";
import { PlusIcon, XIcon } from "lucide-react";

import { Label, NumberInput, TextInput } from "@/components/ui/field";
import { SelectMenu } from "@/components/ui/select-menu";
import { SettingRow, Segmented, Toggle } from "@/components/app/campaigns/preferences/components/CampaignPreferenceBoolBox";
import { FORM_CONTACT_COLUMNS, hasOptions, isInputType } from "@/lib/api/models/app/forms/Form";
import type { FormField } from "@/lib/api/models/app/forms/Form";
import { paletteFor } from "./fieldCatalog";

export default function FieldSettingsPanel({
    field,
    fields,
    onChange,
}: {
    field: FormField;
    fields: FormField[];
    onChange: (patch: Partial<FormField>) => void;
}) {
    const meta = paletteFor(field.type);
    const input = isInputType(field.type);
    const takenColumns = new Set(fields.filter((f) => f.id !== field.id && f.map_to).map((f) => f.map_to as string));

    const mapOptions = FORM_CONTACT_COLUMNS.map((c) => ({
        value: c.value,
        label: c.label,
        disabled: c.value !== "" && takenColumns.has(c.value),
    }));

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex items-center gap-2">
                {meta && <meta.icon className="w-3.5 h-3.5 text-sky-600" />}
                <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">
                    {meta?.label ?? field.type}
                </span>
            </div>

            {field.type === "paragraph" ? (
                <div>
                    <Label>טקסט</Label>
                    <textarea
                        value={field.value ?? ""}
                        onChange={(e) => onChange({ value: e.target.value })}
                        rows={5}
                        className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[16px] md:text-[12.5px] text-slate-900 outline-none transition-colors focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    />
                </div>
            ) : field.type === "page_break" ? (
                <div>
                    <Label>כותרת עמוד</Label>
                    <TextInput value={field.label} onChange={(v) => onChange({ label: v })} placeholder="אופציונלי" />
                    <p className="text-[11px] text-slate-500 mt-1">
                        שדות אחרי מעבר זה יתחילו עמוד חדש. הכותרת מופיעה בסרגל ההתקדמות ובניתוח הנתונים.
                    </p>
                </div>
            ) : field.type !== "divider" ? (
                <div>
                    <Label>{field.type === "heading" ? "כותרת" : "תווית"}</Label>
                    <TextInput value={field.label} onChange={(v) => onChange({ label: v })} placeholder="תווית" />
                </div>
            ) : (
                <p className="text-[11.5px] text-slate-500">קו אופקי מפריד. אין הגדרות לשינוי.</p>
            )}

            {input && field.type !== "hidden" && field.type !== "checkbox" && field.type !== "date" && (
                <div>
                    <Label>טקסט מציין מקום (Placeholder)</Label>
                    <TextInput
                        value={field.placeholder ?? ""}
                        onChange={(v) => onChange({ placeholder: v })}
                        placeholder={field.type === "select" ? "בחר…" : "מוצג בתוך השדה"}
                    />
                </div>
            )}

            {field.type === "checkbox" && (
                <div>
                    <Label>טקסט תיבת הסימון</Label>
                    <TextInput value={field.placeholder ?? ""} onChange={(v) => onChange({ placeholder: v })} placeholder="אני מסכים/ה לתנאים" />
                </div>
            )}

            {field.type === "hidden" && (
                <div>
                    <Label>ערך קבוע</Label>
                    <TextInput value={field.value ?? ""} onChange={(v) => onChange({ value: v })} placeholder="ערך קבוע שנשלח עם כל הגשה" />
                    <p className="text-[11px] text-slate-500 mt-1">
                        בלתי נראה למבקרים. שימושי לתיוג העמוד או הקמפיין שבו הטופס נמצא.
                    </p>
                </div>
            )}

            {hasOptions(field.type) && (
                <div>
                    <Label>אפשרויות</Label>
                    <div className="flex flex-col gap-1.5">
                        {(field.options ?? []).map((opt, i) => (
                            <div key={i} className="flex items-center gap-1.5">
                                <TextInput
                                    value={opt}
                                    onChange={(v) => {
                                        const next = [...(field.options ?? [])];
                                        next[i] = v;
                                        onChange({ options: next });
                                    }}
                                    className="flex-1"
                                />
                                <button
                                    type="button"
                                    aria-label="הסר אפשרות"
                                    disabled={(field.options ?? []).length <= 1}
                                    onClick={() => onChange({ options: (field.options ?? []).filter((_, j) => j !== i) })}
                                    className="size-6 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-40"
                                >
                                    <XIcon className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={() => onChange({ options: [...(field.options ?? []), `אפשרות ${(field.options?.length ?? 0) + 1}`] })}
                            className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[12px] text-sky-700 hover:bg-sky-50 self-start"
                        >
                            <PlusIcon className="w-3 h-3" /> הוסף אפשרות
                        </button>
                    </div>
                </div>
            )}

            {input && field.type !== "hidden" && (
                <div>
                    <Label>טקסט עזרה</Label>
                    <TextInput value={field.help_text ?? ""} onChange={(v) => onChange({ help_text: v })} placeholder="מוצג מתחת לשדה" />
                </div>
            )}

            {field.type === "textarea" && (
                <div>
                    <Label>מספר שורות</Label>
                    <NumberInput value={field.rows ?? 4} onChange={(v) => onChange({ rows: v })} min={2} max={20} className="w-24" />
                </div>
            )}

            {input && field.type !== "hidden" && (
                <SettingRow title="שדה חובה" description="מבקרים אינם יכולים להגיש את הטופס ללא מילוי שדה זה.">
                    <Toggle value={field.required} onChange={(v) => onChange({ required: v })} />
                </SettingRow>
            )}

            {input && field.type !== "hidden" && (
                <div>
                    <Label>רוחב השדה</Label>
                    <Segmented
                        value={field.width === "half" ? "half" : "full"}
                        onChange={(v) => onChange({ width: v })}
                        options={[
                            { value: "full", label: "מלא" },
                            { value: "half", label: "חצי" },
                        ]}
                    />
                </div>
            )}

            {input && (
                <div>
                    <Label>שמירה לאיש קשר</Label>
                    <SelectMenu
                        value={field.type === "email" ? "email" : field.map_to ?? ""}
                        onChange={(v) => onChange({ map_to: v })}
                        options={mapOptions}
                        disabled={field.type === "email"}
                        fullWidth
                        aria-label="עמודת איש קשר"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                        {field.type === "email"
                            ? "שדה האימייל תמיד ממלא את כתובת האימייל של איש הקשר."
                            : field.map_to
                              ? "התשובה תמלא עמודה זו בכרטיס איש הקשר."
                              : "התשובה תישמר כשדה מותאם אישית של איש הקשר הנושא את שם התווית."}
                    </p>
                </div>
            )}
        </div>
    );
}
