// AI skills (org playbooks): the settings surface for the reusable instructions
// the AI assistant, research, and reply drafts follow. A list of skills opens a
// right-side drawer with a name, one-line description, enable toggle, and a
// markdown body. Requires Manage settings.

import React from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import {
    SparklesIcon,
    PlusIcon,
    XIcon,
    Trash2Icon,
    Loader2Icon,
    CheckIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    SearchIcon,
    Code2Icon,
    PlusCircleIcon,
} from "lucide-react";
import {
    useSkills,
    useCreateSkill,
    useUpdateSkill,
    useDeleteSkill,
} from "@/lib/api/hooks/app/skills/useSkills";
import type { AISkill } from "@/lib/api/models/app/skills/Skill";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import { usePermission } from "@/hooks/usePermission";
import { useConfirm } from "@/hooks/context/confirm";
import { TextInput } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "../_components/SectionShell";
import { SectionShell, Section } from "../_components/SectionShell";

type DraftSkill = { id?: string; name: string; description: string; content: string; enabled: boolean };

export default function SkillsSettingsPage() {
    const { i18n } = useTranslation();
    const isHe = i18n.language === "he";
    const canManage = usePermission("MANAGE_SETTINGS");
    const skills = useSkills();
    const [editing, setEditing] = React.useState<DraftSkill | null>(null);

    const rows = skills.data?.data ?? [];

    return (
        <SectionShell
            title={isHe ? "מיומנויות AI" : "AI skills"}
            description={
                isHe
                    ? "ספרי הפעלה לשימוש חוזר שה-AI פועל לפיהם. הגדר כיצד הצוות שלך מאפיין לידים, מתמודד עם התנגדויות או קובע פגישות, ועוזר ה-AI, מחקר והטיוטות ישתמשו בהם."
                    : "Reusable playbooks your AI features follow. Write down how your team qualifies leads, handles objections, or books meetings, and the assistant, research, and reply drafts use them."
            }
            actions={
                canManage ? (
                    <button
                        type="button"
                        onClick={() => setEditing({ name: "", description: "", content: "", enabled: true })}
                        className="h-7 px-3 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors"
                    >
                        <PlusIcon className="w-3 h-3" />
                        {isHe ? "מיומנות חדשה" : "New skill"}
                    </button>
                ) : undefined
            }
        >
            <Section
                eyebrow={isHe ? "ספרי הפעלה" : "Playbooks"}
                description={
                    isHe
                        ? "מיומנויות פעילות מוצגות ל-AI; המודל קורא את תוכן המיומנות המלא לפי הצורך."
                        : "Enabled skills are shown to the AI; the model reads a skill's full content on demand."
                }
            >
                {skills.isPending ? (
                    <div className="h-16 rounded bg-slate-100 animate-pulse" />
                ) : rows.length === 0 ? (
                    <p className="text-[12px] text-slate-500 leading-relaxed">
                        {isHe
                            ? "אין עדיין מיומנויות. הוסף מיומנות כדי ללמד את ה-AI כיצד הצוות שלך עובד."
                            : "No skills yet. Add one to teach your AI how your team works."}
                    </p>
                ) : (
                    <div className="rounded-md border border-slate-200 overflow-hidden divide-y divide-slate-100">
                        {rows.map((s) => (
                            <SkillRow key={s.id} skill={s} onOpen={() => canManage && setEditing({ ...s })} />
                        ))}
                    </div>
                )}
            </Section>

            <SkillDrawer draft={editing} onClose={() => setEditing(null)} />
        </SectionShell>
    );
}

function SkillRow({ skill, onOpen }: { skill: AISkill; onOpen: () => void }) {
    const { i18n } = useTranslation();
    const isHe = i18n.language === "he";

    return (
        <button
            type="button"
            onClick={onOpen}
            className="w-full text-start px-3 py-2.5 flex items-center gap-3 hover:bg-slate-50 transition-colors"
        >
            <div className="size-7 rounded-md bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                <SparklesIcon className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-medium text-slate-900 truncate">{skill.name}</div>
                {skill.description && (
                    <div className="text-[11.5px] text-slate-500 truncate">{skill.description}</div>
                )}
            </div>
            {!skill.enabled && (
                <span className="text-[10px] uppercase tracking-[0.08em] text-slate-400 border border-slate-200 rounded-sm px-1 py-0.5 shrink-0">
                    {isHe ? "כבוי" : "Off"}
                </span>
            )}
        </button>
    );
}

function SkillDrawer({ draft, onClose }: { draft: DraftSkill | null; onClose: () => void }) {
    const { i18n } = useTranslation();
    const isHe = i18n.language === "he";
    const create = useCreateSkill();
    const update = useUpdateSkill();
    const del = useDeleteSkill();
    const confirm = useConfirm();

    const [name, setName] = React.useState("");
    const [description, setDescription] = React.useState("");
    const [content, setContent] = React.useState("");
    const [enabled, setEnabled] = React.useState(true);

    React.useEffect(() => {
        if (!draft) return;
        setName(draft.name);
        setDescription(draft.description);
        setContent(draft.content);
        setEnabled(draft.enabled);
    }, [draft]);

    async function save() {
        if (!name.trim()) {
            toast.error(isHe ? "נדרש שם" : "A name is required");
            return;
        }
        try {
            if (draft?.id) {
                await update.mutateAsync({ id: draft.id, data: { name, description, content, enabled } });
            } else {
                await create.mutateAsync({ name, description, content, enabled });
            }
            toast.success(isHe ? "המיומנות נשמרה" : "Skill saved");
            onClose();
        } catch (e) {
            toast.error(buildError(e as AppError));
        }
    }

    function remove() {
        if (!draft?.id) return;
        confirm.show(
            isHe ? "למחוק מיומנות זו? ה-AI יפסיק להשתמש בה." : "Delete this skill? The AI will stop using it.",
            async () => {
                await del.mutateAsync(draft.id!);
                toast.success(isHe ? "המיומנות נמחקה" : "Skill deleted");
                onClose();
            },
        );
    }

    const saving = create.isPending || update.isPending;

    return (
        <AnimatePresence>
            {draft && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-40 bg-slate-900/30"
                    />
                    <motion.aside
                        dir={isHe ? "rtl" : "ltr"}
                        initial={{ x: isHe ? "-100%" : "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: isHe ? "-100%" : "100%" }}
                        transition={{ type: "spring", stiffness: 380, damping: 40 }}
                        className={`fixed ${
                            isHe ? "left-0 border-r" : "right-0 border-l"
                        } top-0 z-50 h-full w-full sm:w-[520px] bg-white border-slate-200 shadow-[0_0_60px_-12px_rgba(15,23,42,0.3)] flex flex-col`}
                    >
                        <div className="shrink-0 px-5 h-14 flex items-center gap-3 border-b border-slate-200">
                            <div className="size-7 rounded-md bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center">
                                <SparklesIcon className="w-4 h-4" />
                            </div>
                            <div className="text-[13px] font-semibold text-slate-900 flex-1">
                                {draft.id ? (isHe ? "עריכת מיומנות" : "Edit skill") : isHe ? "מיומנות חדשה" : "New skill"}
                            </div>
                            <button
                                onClick={onClose}
                                className="size-7 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center justify-center transition-colors"
                            >
                                <XIcon className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
                            <Field
                                label={isHe ? "שם" : "Name"}
                                hint={isHe ? "קצר וזכיר; ה-AI טוען מיומנות לפי שמה." : "Short and memorable; the AI loads a skill by name."}
                            >
                                <TextInput
                                    value={name}
                                    onChange={setName}
                                    placeholder={isHe ? "טיפול בהתנגדויות" : "Objection handling"}
                                    className="w-full"
                                />
                            </Field>
                            <Field
                                label={isHe ? "תיאור" : "Description"}
                                hint={isHe ? "שורה אחת כדי שה-AI יידע מתי להשתמש בה." : "One line so the AI knows when to use it."}
                            >
                                <TextInput
                                    value={description}
                                    onChange={setDescription}
                                    placeholder={isHe ? "כיצד להגיב להתנגדויות נפוצות" : "How to respond to common pushback"}
                                    className="w-full"
                                />
                            </Field>
                            <Field
                                label={isHe ? "פעיל" : "Enabled"}
                                hint={isHe ? "רק מיומנויות פעילות מוצגות ל-AI." : "Only enabled skills are shown to the AI."}
                            >
                                <Toggle on={enabled} onChange={setEnabled} />
                            </Field>
                            <Field
                                label={isHe ? "ספר הפעלה" : "Playbook"}
                                hint={isHe ? "Markdown. הנחיות ברורות שה-AI צריך לפעול לפיהן." : "Markdown. Plain instructions the AI should follow."}
                            >
                                <Textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    rows={12}
                                    dir="auto"
                                    placeholder={
                                        isHe
                                            ? "כאשר לקוח פוטנציאלי אומר שזה יקר מדי:\n- הכר בחשש שלו\n- שאל למה הוא משווה\n- ..."
                                            : "When a prospect says it's too expensive:\n- acknowledge the concern\n- ask what they are comparing to\n- ..."
                                    }
                                    className="w-full font-mono text-[12px]"
                                />
                            </Field>

                            {/* Catalog of Available AI Tools */}
                            <AvailableToolsCatalog
                                isHe={isHe}
                                onInsert={(snippet) => {
                                    setContent((prev) => (prev ? prev.trimEnd() + "\n" + snippet : snippet));
                                }}
                            />
                        </div>

                        <div className="shrink-0 h-14 px-5 flex items-center gap-2 border-t border-slate-200 bg-slate-50/60">
                            <button
                                type="button"
                                onClick={save}
                                disabled={saving}
                                className="h-7 px-3 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                            >
                                {saving ? <Loader2Icon className="w-3 h-3 animate-spin" /> : <CheckIcon className="w-3 h-3" />}
                                {isHe ? "שמור" : "Save"}
                            </button>
                            {draft.id && (
                                <button
                                    type="button"
                                    onClick={remove}
                                    className="h-7 px-2.5 rounded-md text-[12px] text-red-600 hover:text-white hover:bg-red-600 font-medium inline-flex items-center gap-1.5 transition-colors ms-auto"
                                >
                                    <Trash2Icon className="w-3 h-3" />
                                    {isHe ? "מחק" : "Delete"}
                                </button>
                            )}
                        </div>
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div>
            <div className="text-[12.5px] font-medium text-slate-900">{label}</div>
            {hint && <div className="text-[11px] text-slate-500 mb-1.5">{hint}</div>}
            {children}
        </div>
    );
}

interface ToolItem {
    name: string;
    category: "bdr" | "crm" | "unibox" | "contacts" | "campaigns" | "suppression";
    categoryLabelHe: string;
    descriptionHe: string;
    exampleInstructionHe: string;
    isWriteAction?: boolean;
}

const AVAILABLE_AI_TOOLS: ToolItem[] = [
    // BDR, Enrichment & Web
    {
        name: "serper_google_search",
        category: "bdr",
        categoryLabelHe: "BDR ומחקר",
        descriptionHe: "חיפוש Google בזמן אמת לאיתור אתרים, בעלי תפקידים, חברות ומידע עסקי (מגובה רוטטור Serper ומטמון ל-7 ימים).",
        exampleInstructionHe: "למצוא את אתר החברה של הליד ואת שמות המייסדים.",
        isWriteAction: false,
    },
    {
        name: "fetch_url_content",
        category: "bdr",
        categoryLabelHe: "BDR ומחקר",
        descriptionHe: "סריקה וקריאה מאובטחת של אתר הליד (עמוד ראשי, אודות, צור קשר) עם הגנת SSRF וחילוץ תוכן נקי.",
        exampleInstructionHe: "לקרוא את עמוד האודות של הליד ולחלץ מה העסק שלו מציע.",
        isWriteAction: false,
    },
    {
        name: "update_lead_fields",
        category: "bdr",
        categoryLabelHe: "BDR ומחקר",
        descriptionHe: "עדכון כרטיס איש הקשר ונרמול שמות חכם (הסרת סיומות בע\"מ, LTD, LLC והפרדת תפקידים משמות).",
        exampleInstructionHe: "לעדכן שם חברה נקי, תפקיד ומספר טלפון מחתימת המייל.",
        isWriteAction: true,
    },
    {
        name: "frappe_crm_sync",
        category: "bdr",
        categoryLabelHe: "BDR ומחקר",
        descriptionHe: "סנכרון דו-כיווני ישיר ל-Frappe CRM – יצירה או עדכון של CRM Lead, שדות מותאמים ומשימות מעקב.",
        exampleInstructionHe: "לסנכרן את הליד ל-Frappe CRM כולל יצירת משימת מעקב.",
        isWriteAction: true,
    },
    {
        name: "mark_do_not_contact",
        category: "bdr",
        categoryLabelHe: "BDR ומחקר",
        descriptionHe: "סימון הסרה (DNC) ואיסור פנייה גלובלי גם ב-Warmbly וגם ב-Frappe CRM עבור לידים שביקשו הסרה.",
        exampleInstructionHe: "לסמן כ-DNC בעקבות בקשת הסרה.",
        isWriteAction: true,
    },
    // CRM, Tasks & Deals
    {
        name: "create_task",
        category: "crm",
        categoryLabelHe: "CRM ומשימות",
        descriptionHe: "יצירת משימת מעקב ב-CRM עבור איש הקשר עם תאריך יעד ועדיפות.",
        exampleInstructionHe: "לתזמן שיחת המשך ביומן לעוד 3 ימים.",
        isWriteAction: true,
    },
    {
        name: "list_tasks",
        category: "crm",
        categoryLabelHe: "CRM ומשימות",
        descriptionHe: "שליפת רשימת המשימות הפתוחות לארגון או לליד ספציפי.",
        exampleInstructionHe: "לבדוק אילו משימות פתוחות קיימות כרגע.",
        isWriteAction: false,
    },
    {
        name: "complete_task",
        category: "crm",
        categoryLabelHe: "CRM ומשימות",
        descriptionHe: "סימון משימת CRM קיימת כהושלמה.",
        exampleInstructionHe: "לסגור את משימת המעקב לאחר שנענתה.",
        isWriteAction: true,
    },
    {
        name: "create_deal",
        category: "crm",
        categoryLabelHe: "CRM ומשימות",
        descriptionHe: "פתיחת עסקת מכירה (Deal) חדשה ב-Pipeline של ה-CRM.",
        exampleInstructionHe: "לפתוח הזדמנות מכירה בשלב 'פגישה תואמה'.",
        isWriteAction: true,
    },
    {
        name: "move_deal_stage",
        category: "crm",
        categoryLabelHe: "CRM ומשימות",
        descriptionHe: "העברת עסקה לשלב הבא ב-Pipeline (למשל: מפגישה להצעת מחיר או לסגירה).",
        exampleInstructionHe: "להעביר את העסקה לשלב הבא.",
        isWriteAction: true,
    },
    {
        name: "add_contact_note",
        category: "crm",
        categoryLabelHe: "CRM ומשימות",
        descriptionHe: "הוספת פתק או הערה פנימית על כרטיס איש הקשר ב-CRM.",
        exampleInstructionHe: "לתעד סיכום נקודות מפתח מהתשובה של הליד.",
        isWriteAction: true,
    },
    // Unibox & Email
    {
        name: "draft_reply",
        category: "unibox",
        categoryLabelHe: "תיבת דואר",
        descriptionHe: "ניסוח טיוטת תגובה חכמה המותאמת להקשר השרשור והקול של הארגון.",
        exampleInstructionHe: "לנסח מענה משכנע המציע שני מועדים לשיחה.",
        isWriteAction: true,
    },
    {
        name: "send_reply",
        category: "unibox",
        categoryLabelHe: "תיבת דואר",
        descriptionHe: "שליחת מענה ישיר לשרשור המייל (דורש אישור).",
        exampleInstructionHe: "לשלוח את התשובה המאושרת לליד.",
        isWriteAction: true,
    },
    {
        name: "compose_email",
        category: "unibox",
        categoryLabelHe: "תיבת דואר",
        descriptionHe: "כתיבת מייל חדש מאפס לנמען מתוך אחת מתיבות הדואר המחוברות.",
        exampleInstructionHe: "לפתוח מייל חדש עם נושא ותוכן מותאמים.",
        isWriteAction: true,
    },
    {
        name: "snooze_thread",
        category: "unibox",
        categoryLabelHe: "תיבת דואר",
        descriptionHe: "השהיית שרשור בתיבת הדואר עד לתאריך עתידי או חזרת הליד מחופשה.",
        exampleInstructionHe: "להשהות את השיחה עד תאריך החזרה של הליד מחופשה.",
        isWriteAction: true,
    },
    // Contacts & Leads
    {
        name: "search_contacts",
        category: "contacts",
        categoryLabelHe: "אנשי קשר",
        descriptionHe: "חיפוש אנשי קשר במערכת לפי שם, כתובת אימייל, חברה או תגית.",
        exampleInstructionHe: "למצוא האם איש הקשר כבר קיים בסביבת העבודה.",
        isWriteAction: false,
    },
    {
        name: "create_contact",
        category: "contacts",
        categoryLabelHe: "אנשי קשר",
        descriptionHe: "יצירת איש קשר חדש בסביבת העבודה.",
        exampleInstructionHe: "להוסיף את הליד החדש למאגר.",
        isWriteAction: true,
    },
    {
        name: "add_contact_tag",
        category: "contacts",
        categoryLabelHe: "אנשי קשר",
        descriptionHe: "הוספת תגית קטגוריה או סיווג לכרטיס איש הקשר.",
        exampleInstructionHe: "להוסיף תגית 'ליד חם - מעוניין בפגישה'.",
        isWriteAction: true,
    },
    // Campaigns & Sequences
    {
        name: "list_campaigns",
        category: "campaigns",
        categoryLabelHe: "קמפיינים",
        descriptionHe: "שליפת כל הקמפיינים הקיימים, אחוזי הפתיחה והתגובה, ומצב הריצה.",
        exampleInstructionHe: "לבדוק אילו קמפיינים פעילים כרגע.",
        isWriteAction: false,
    },
    {
        name: "add_campaign_step",
        category: "campaigns",
        categoryLabelHe: "קמפיינים",
        descriptionHe: "הוספת שלב המשך (Follow-up) לרצף השליחה של קמפיין.",
        exampleInstructionHe: "להוסיף שלב תזכורת 3 ימים לאחר הפנייה.",
        isWriteAction: true,
    },
    // Suppressions
    {
        name: "add_suppressions",
        category: "suppression",
        categoryLabelHe: "חסימות והסרות",
        descriptionHe: "הוספת כתובת אימייל או דומיין שלם לרשימת החסימה/ההשתקה (לעולם לא יקבל מייל).",
        exampleInstructionHe: "להוסיף את הדומיין לרשימת ההשתקה.",
        isWriteAction: true,
    },
];

function AvailableToolsCatalog({
    isHe,
    onInsert,
}: {
    isHe: boolean;
    onInsert: (snippet: string) => void;
}) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");
    const [category, setCategory] = React.useState<string>("all");

    const categories = [
        { id: "all", labelHe: "הכל", labelEn: "All" },
        { id: "bdr", labelHe: "BDR ומחקר", labelEn: "BDR & Web" },
        { id: "crm", labelHe: "CRM ומשימות", labelEn: "CRM & Tasks" },
        { id: "unibox", labelHe: "תיבת דואר", labelEn: "Unibox" },
        { id: "contacts", labelHe: "אנשי קשר", labelEn: "Contacts" },
        { id: "campaigns", labelHe: "קמפיינים", labelEn: "Campaigns" },
        { id: "suppression", labelHe: "חסימות", labelEn: "Suppressions" },
    ];

    const filtered = React.useMemo(() => {
        return AVAILABLE_AI_TOOLS.filter((t) => {
            if (category !== "all" && t.category !== category) return false;
            if (!search.trim()) return true;
            const q = search.toLowerCase();
            return (
                t.name.toLowerCase().includes(q) ||
                t.descriptionHe.includes(q) ||
                t.categoryLabelHe.includes(q)
            );
        });
    }, [search, category]);

    return (
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 overflow-hidden text-[12px]">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-slate-100/70 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Code2Icon className="w-4 h-4 text-sky-600" />
                    <span className="font-semibold text-slate-800">
                        {isHe ? "כלי AI זמינים לפלייבוק (AI Tools Catalog)" : "Available AI Tools"}
                    </span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700">
                        {AVAILABLE_AI_TOOLS.length} {isHe ? "כלים" : "tools"}
                    </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <span>{open ? (isHe ? "סגור קטלוג" : "Collapse") : (isHe ? "הצג קטלוג כלים" : "Explore tools")}</span>
                    {open ? <ChevronUpIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />}
                </div>
            </button>

            {open && (
                <div className="p-3 border-t border-slate-200 bg-white space-y-2.5">
                    {/* Search & Category Filter */}
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                            <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute start-2.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={isHe ? "חיפוש כלי (לפי שם או תיאור)..." : "Search tool by name..."}
                                className="w-full ps-8 pe-2.5 py-1 text-[11.5px] border border-slate-200 rounded-md outline-none focus:border-sky-400"
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                            {categories.map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setCategory(c.id)}
                                    className={`px-2 py-0.5 rounded text-[10.5px] font-medium transition-colors ${
                                        category === c.id
                                            ? "bg-sky-600 text-white"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    }`}
                                >
                                    {isHe ? c.labelHe : c.labelEn}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Scrollable list of tools */}
                    <div className="max-h-[220px] overflow-y-auto space-y-1.5 pe-1 divide-y divide-slate-100">
                        {filtered.length === 0 ? (
                            <div className="text-center py-4 text-[11.5px] text-slate-400">
                                {isHe ? "לא נמצאו כלים תואמים" : "No matching tools found"}
                            </div>
                        ) : (
                            filtered.map((t) => (
                                <div
                                    key={t.name}
                                    className="pt-1.5 first:pt-0 flex items-start justify-between gap-2"
                                >
                                    <div className="space-y-0.5 flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <code className="text-[11px] font-mono font-semibold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/80">
                                                {t.name}
                                            </code>
                                            <span
                                                className={`text-[9.5px] font-medium px-1.5 py-0.2 rounded-full ${
                                                    t.isWriteAction
                                                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                                                        : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                }`}
                                            >
                                                {t.isWriteAction ? (isHe ? "כתיבה / פעולה" : "Write") : (isHe ? "קריאה" : "Read")}
                                            </span>
                                            <span className="text-[10px] text-slate-400">
                                                {t.categoryLabelHe}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-600 leading-snug">
                                            {t.descriptionHe}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onInsert(`- השתמש ב-${t.name} כדי ${t.exampleInstructionHe}`);
                                            toast.success(isHe ? `נוסף לפלייבוק: ${t.name}` : `Added ${t.name}`);
                                        }}
                                        title={isHe ? "הוסף הנחיית שימוש לפלייבוק" : "Add to playbook"}
                                        className="shrink-0 mt-0.5 h-6 px-2 rounded border border-slate-200 bg-white hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200 text-slate-600 text-[10.5px] font-medium inline-flex items-center gap-1 transition-colors shadow-xs"
                                    >
                                        <PlusCircleIcon className="w-3 h-3 text-sky-600" />
                                        {isHe ? "הוסף" : "Insert"}
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

