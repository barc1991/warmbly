// The builder's palette: every block a form can hold, with a factory that
// mints a fresh field with a unique, stable id.

import type { LucideIcon } from "lucide-react";
import {
    AlignLeftIcon,
    AtSignIcon,
    CalendarIcon,
    CheckSquareIcon,
    ChevronDownSquareIcon,
    CircleDotIcon,
    EyeOffIcon,
    HashIcon,
    HeadingIcon,
    ListChecksIcon,
    MinusIcon,
    PhoneIcon,
    SeparatorHorizontalIcon,
    TextIcon,
    TypeIcon,
} from "lucide-react";
import type { FormField, FormFieldType } from "@/lib/api/models/app/forms/Form";

export interface PaletteItem {
    type: FormFieldType;
    label: string;
    icon: LucideIcon;
    group: "Fields" | "Layout";
}

export const PALETTE: PaletteItem[] = [
    { type: "text", label: "טקסט", icon: TypeIcon, group: "Fields" },
    { type: "email", label: "אימייל", icon: AtSignIcon, group: "Fields" },
    { type: "phone", label: "טלפון", icon: PhoneIcon, group: "Fields" },
    { type: "textarea", label: "טקסט ארוך", icon: AlignLeftIcon, group: "Fields" },
    { type: "number", label: "מספר", icon: HashIcon, group: "Fields" },
    { type: "select", label: "תפריט בחירה", icon: ChevronDownSquareIcon, group: "Fields" },
    { type: "radio", label: "כפתורי בחירה (רדיו)", icon: CircleDotIcon, group: "Fields" },
    { type: "checkboxes", label: "קבוצת תיבות סימון", icon: ListChecksIcon, group: "Fields" },
    { type: "checkbox", label: "תיבת סימון בודדת", icon: CheckSquareIcon, group: "Fields" },
    { type: "date", label: "תאריך", icon: CalendarIcon, group: "Fields" },
    { type: "hidden", label: "שדה מוסתר", icon: EyeOffIcon, group: "Fields" },
    { type: "heading", label: "כותרת", icon: HeadingIcon, group: "Layout" },
    { type: "paragraph", label: "בלוק טקסט", icon: TextIcon, group: "Layout" },
    { type: "divider", label: "קו מפריד", icon: MinusIcon, group: "Layout" },
    { type: "page_break", label: "מעבר עמוד", icon: SeparatorHorizontalIcon, group: "Layout" },
];

const DEFAULT_LABELS: Partial<Record<FormFieldType, string>> = {
    text: "טקסט",
    email: "אימייל",
    phone: "טלפון",
    textarea: "הודעה",
    number: "מספר",
    select: "בחר אפשרות",
    radio: "בחר אפשרות",
    checkboxes: "בחר אפשרויות",
    checkbox: "תיבת סימון",
    date: "תאריך",
    hidden: "שדה מוסתר",
    heading: "כותרת",
};

let counter = 0;

/** Mints a new field. Ids only need to be unique inside one form. */
export function newField(type: FormFieldType): FormField {
    counter += 1;
    const id = `${type.replace(/[^a-z0-9]/g, "")}-${Date.now().toString(36)}${counter.toString(36)}`;
    const f: FormField = { id, type, label: DEFAULT_LABELS[type] ?? "", required: false };
    if (type === "select" || type === "radio" || type === "checkboxes") f.options = ["אפשרות 1", "אפשרות 2"];
    if (type === "email") f.map_to = "email";
    if (type === "paragraph") f.value = "כתוב משהו כאן…";
    if (type === "checkbox") f.placeholder = "אני מסכים/ה לתנאים";
    if (type === "textarea") f.rows = 4;
    return f;
}

export function paletteFor(type: FormFieldType): PaletteItem | undefined {
    return PALETTE.find((p) => p.type === type);
}
