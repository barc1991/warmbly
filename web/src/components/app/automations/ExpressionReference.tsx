// In-app quick reference for the templating + expression mini-language shared by
// campaign emails and automation conditions/actions. Click-to-copy snippets,
// grouped, with a link to the full guide. Mounted next to the Advanced
// expression editor (and reusable anywhere a "?" reference helps).

import toast from "react-hot-toast";
import { CircleHelpIcon, CopyIcon, ExternalLinkIcon } from "lucide-react";
import { PopoverMenu, PopoverMenuTrigger, PopoverMenuContent } from "@/components/ui/popover-menu";

interface Entry {
    code: string;
    label: string;
    note?: string;
}
interface Section {
    title: string;
    blurb: string;
    entries: Entry[];
}

const INTRO =
    "מנוע Go text/template אחיד מפעיל את הודעות הקמפיין ואת תנאי ופעולות האוטומציה. שדות מיזוג באימייל משתמשים ב-PascalCase (כגון {{.FirstName}}); משתני אירוע באוטומציה משתמשים במפתח האירוע (כגון {{.contact_email}}). השתמש תמיד בנקודה מובילה. השוואות gtf/ltf מתאימות למקרים בהם הערך עשוי להגיע כמחרוזת. שגיאות בתבנית אינן מפילות את המערכת, אלא מציגות את הטקסט המקורי.";

const SECTIONS: Section[] = [
    {
        title: "משתנים",
        blurb: "באימייל: PascalCase עם נקודה. באוטומציות: מפתח האירוע עם נקודה מובילה ({{.key}}).",
        entries: [
            { code: "{{.FirstName}}", label: "שדה איש קשר (אימייל)", note: "סטנדרטי: .FirstName .LastName .Email .Company .Phone. שימוש באותיות קטנות {{.firstname}} אינו תואם שדות מיזוג באימייל." },
            { code: "{{.role}}", label: "שדה מותאם אישית לפי מפתח", note: "כל מפתח עובד, כולל שמות עם רווחים או מקפים (למשל {{.job title}}), גם בתוך {{if}} ובפונקציות עזר." },
            { code: "{{.contact_email}}", label: "משתנה אירוע באוטומציה", note: "גישה סטנדרטית עם נקודה מובילה (חובה). מפתחות לא מוכרים יוצגו כריקים." },
            { code: "{{.confidence}}", label: "רמת ודאות של תגובה (בטריגר מענה)", note: "נשמר כמספר הן בתנאים והן בפעולות, כך ש-gt/lt/eq עובדים ישירות. השתמש ב-gtf רק כאשר הערך מגיע כמחרוזת." },
        ],
    },
    {
        title: "תנאים",
        blurb: "בקרת זרימה רגילה. שדה חסר נחשב כריק ושלילי. סגור כל {{if}} באמצעות {{end}}.",
        entries: [
            { code: "{{if .Company}}…{{end}}", label: "רק כאשר השדה מוגדר" },
            { code: "{{if .Company}}…{{else}}…{{end}}", label: "אם / אחרת (if / else)" },
            { code: '{{if eq .role "CEO"}}…{{end}}', label: "בדיקת שוויון", note: "השוואת eq/ne/lt/gt משווה ערכים מאותו סוג ואינה ממירה סוגים." },
            { code: "{{if and .FirstName .Company}}…{{end}}", label: "שניהם קיימים (and / or / not)" },
            { code: 'gt .confidence 0.8', label: "ביטוי ישיר (תנאי אוטומציה)", note: "אין צורך בסוגריים מסולסלים, המערכת עוטפת אוטומטית. ריק = שלילי." },
        ],
    },
    {
        title: "ערך ברירת מחדל",
        blurb: "מילוי ערך חלופי כאשר שדה ריק. המבנה הוא default(ערך_ברירת_מחדל, ערך).",
        entries: [
            { code: '{{.FirstName | default "שם"}}', label: 'שימוש ב-"שם" כאשר ריק', note: "בצורת צינור (pipeline) הערך מוצב בסוף, בהתאם ל-default(def, v)." },
            { code: '{{default "שם" .FirstName}}', label: "צורה ישירה (ברירת מחדל ראשונה)", note: "אין לכתוב default .FirstName \"שם\"; הסדר הוא הפוך." },
        ],
    },
    {
        title: "מספרים",
        blurb: "פעולות חישוב והשוואה ממירות מחרוזות למספרים. השתמש בגרסאות f כאשר הערך עשוי להיות מחרוזת.",
        entries: [
            { code: "{{gtf .confidence 0.8}}", label: "השוואת > עם המרה (gtf ltf gef lef)", note: "ממיר תחילה את שני הצדדים למספרים; ערך שאינו מספרי נחשב 0." },
            { code: "{{num .confidence}}", label: "אילוץ ערך למספר" },
            { code: "{{add .a .b}}", label: "חיבור (קיים גם sub, mul)" },
            { code: "{{div .total .count}}", label: "חילוק (קיים גם mod)", note: "חלוקה ב-0 מחזירה 0, לעולם לא שגיאה." },
        ],
    },
    {
        title: "טקסט",
        blurb: "פונקציות עזר למחרוזות.",
        entries: [
            { code: "{{title .FirstName}}", label: "אותיות ראשיות (קיים גם upper, lower)" },
            { code: "{{trim .role}}", label: "הסרת רווחים עודפים מקצוות" },
            { code: '{{contains .Email "gmail"}}', label: "בדיקת תת-מחרוזת (ללא תלות באותיות רישיות)" },
            { code: '{{hasPrefix .Email "info@"}}', label: "בדיקת תחילית" },
        ],
    },
    {
        title: "וריאציות טקסט (Spintax)",
        blurb: "חילוף אקראי, מורחב עבור כל נמען לאחר עיבוד שדות המיזוג.",
        entries: [
            { code: "{שלום|היי|הי}", label: "בחירה אקראית של אחד מהם", note: "רק ביטויים עם תו | מוחלפים; ביטויי {…} רגילים נשארים ללא שינוי, כך ש-CSS בטוח." },
            { code: "{שלום|היי} {{.FirstName}}", label: "שילוב עם שדות מיזוג" },
        ],
    },
];

const EXAMPLES: { title: string; code: string; explain: string }[] = [
    {
        title: "ברכה עם ערך ברירת מחדל",
        code: '{היי|שלום} {{.FirstName | default "שם"}},',
        explain: 'משתמש ב-"שם" כאשר השם הפרטי ריק, ובוחר "היי" או "שלום" באופן אקראי לכל נמען.',
    },
    {
        title: "שורה מותנית לפי שדה מותאם אישית",
        code: "{{if .role}}ראיתי שאתה מוביל את {{title .role}} ב-{{.Company}}.{{end}}",
        explain: "מציג את המשפט רק כאשר השדה המותאם אישית קיים.",
    },
    {
        title: "אוטומציה: תגובה ברמת ודאות גבוהה",
        code: "gt .confidence 0.8",
        explain: "ביטוי תנאי ישיר; gt הרגיל עובד מכיוון שנתוני התנאי נשמרים כמספר.",
    },
    {
        title: "ערך פעולה: תבנית מלאה ולא רק החלפת משתנה",
        code: "{{if gt .confidence 0.8}}ליד חם{{else}}למעקב{{end}}",
        explain: "ערכי Slack, Webhook ו-CRM מעובדים מול נתוני האירוע המקוריים כולל תנאים, טווחים והשוואות מספריות.",
    },
];

function Code({ code }: { code: string }) {
    return (
        <button
            type="button"
            title="לחץ להעתקה"
            onClick={() => {
                navigator.clipboard?.writeText(code);
                toast.success("הועתק");
            }}
            className="group inline-flex max-w-full items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-left font-mono text-[11px] text-slate-700 transition-colors hover:border-sky-300 hover:bg-sky-50/40"
        >
            <span className="truncate" dir="ltr">{code}</span>
            <CopyIcon className="w-2.5 h-2.5 shrink-0 text-slate-300 group-hover:text-sky-500" />
        </button>
    );
}

export function ExpressionReference({ label = "מדריך עזר" }: { label?: string }) {
    return (
        <PopoverMenu align="end">
            <PopoverMenuTrigger asChild>
                <button
                    type="button"
                    className="inline-flex h-6 items-center gap-1 rounded px-1.5 text-[11px] text-slate-400 transition-colors hover:bg-sky-50 hover:text-sky-600"
                >
                    <CircleHelpIcon className="w-3.5 h-3.5" /> {label}
                </button>
            </PopoverMenuTrigger>
            <PopoverMenuContent className="w-[380px] max-w-[92vw] max-h-[70vh] overflow-y-auto p-3 text-start rtl:text-right">
                <div className="text-[12px] font-medium text-slate-900">משתנים, תנאים ופונקציות</div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{INTRO}</p>

                {SECTIONS.map((s) => (
                    <div key={s.title} className="mt-3 border-t border-slate-100 pt-2.5">
                        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">{s.title}</div>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{s.blurb}</p>
                        <div className="mt-1.5 space-y-1.5">
                            {s.entries.map((e, i) => (
                                <div key={i}>
                                    <Code code={e.code} />
                                    <div className="mt-0.5 text-[11px] text-slate-600">{e.label}</div>
                                    {e.note && <div className="text-[10.5px] leading-relaxed text-slate-400">{e.note}</div>}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                <div className="mt-3 border-t border-slate-100 pt-2.5">
                    <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">דוגמאות</div>
                    <div className="mt-1.5 space-y-2.5">
                        {EXAMPLES.map((ex, i) => (
                            <div key={i}>
                                <div className="mb-0.5 text-[11px] font-medium text-slate-700">{ex.title}</div>
                                <Code code={ex.code} />
                                <div className="mt-0.5 text-[10.5px] leading-relaxed text-slate-400">{ex.explain}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <a
                    href="https://docs.warmbly.com/learn/personalization/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 border-t border-slate-100 pt-2.5 text-[11px] font-medium text-sky-600 hover:text-sky-700"
                >
                    מדריך מלא ודוגמאות <ExternalLinkIcon className="w-3 h-3" />
                </a>
            </PopoverMenuContent>
        </PopoverMenu>
    );
}
