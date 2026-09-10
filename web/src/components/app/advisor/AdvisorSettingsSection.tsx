// Advisor controls in workspace settings: switch it off, mute categories that
// are not relevant to how this workspace sends, or raise the bar so only
// serious findings surface.
//
// Muting is offered rather than resisted. A workspace that has decided it does
// not want copy advice will otherwise dismiss every copy card one at a time,
// which is the same outcome with more friction and a worse feedback signal.

import { useMemo } from "react";
import type { AdvisorCategory, AdvisorSeverity } from "@/lib/api/models/app/advisor/Advisor";
import { CATEGORY_LABEL, SEVERITY_LABEL } from "@/lib/api/models/app/advisor/Advisor";
import { Row, Section, ToggleRow } from "@/app/app/settings/_components/SectionShell";
import { useAdvisorSettings, useUpdateAdvisorSettings } from "@/lib/api/hooks/app/advisor/useAdvisor";

const CATEGORIES: { key: AdvisorCategory; description: string }[] = [
    { key: "deliverability", description: "תלונות, החזרות (bounces), מיקום בספאם ואימות דומיינים" },
    { key: "mailbox", description: "מגבלות יומיות, קצב שליחה ובריאות תיבות הדואר" },
    { key: "warmup", description: "כיסוי חימום, נפח ומעמד ברשת החימום" },
    { key: "campaign", description: "מבנה רצף, אחוזי מענה, קיבולת ותזמון" },
    { key: "copy", description: "משתני שילוב, אורך, שורות נושא וניסוח הודעות המוניות" },
    { key: "list", description: "תיבות שיתופיות, דומיינים פרטיים ואנשי קשר מושתקים" },
];

const SEVERITIES: AdvisorSeverity[] = ["low", "medium", "high", "critical"];

export default function AdvisorSettingsSection({ canManage }: { canManage: boolean }) {
    const { data } = useAdvisorSettings();
    const update = useUpdateAdvisorSettings();

    const muted = useMemo(() => new Set(data?.muted_categories ?? []), [data]);
    const enabled = data?.enabled ?? true;
    const minSeverity = data?.min_severity ?? "low";
    const autopilot = data?.autopilot ?? false;

    // Every control sends the whole settings object: the endpoint replaces
    // rather than merges, so a partial payload would silently clear the rest.
    function save(
        patch: Partial<{
            enabled: boolean;
            muted_categories: string[];
            min_severity: AdvisorSeverity;
            autopilot: boolean;
        }>,
    ) {
        update.mutate({
            enabled,
            muted_categories: [...muted],
            muted_detectors: data?.muted_detectors ?? [],
            min_severity: minSeverity,
            autopilot,
            ...patch,
        });
    }

    function toggleCategory(key: AdvisorCategory, on: boolean) {
        const next = new Set(muted);
        if (on) next.delete(key);
        else next.add(key);
        save({ muted_categories: [...next] });
    }

    const disabled = !canManage || update.isPending;

    return (
        <Section
            eyebrow="יועץ (Advisor)"
            description="Warmbly בודק את השליחה שלך ברציפות ומציג מה לתקן בעמוד שבו התיקון מתבצע. הזיהוי פועל על הנתונים שלך עם ספים קבועים; AI רק מנסח מחדש את ההסבר, ולעולם אינו גובה נקודות זכות."
        >
            <ToggleRow
                label="הצג המלצות"
                description="כיבוי יסתיר את כל ההצעות וינקה את תגי הניווט. שום דבר לא יימחק, והדלקה חוזרת תשחזר את הממצאים הנוכחיים."
                checked={enabled}
                onChange={(v) => save({ enabled: v })}
                disabled={disabled}
            />

            {enabled ? (
                <>
                    <ToggleRow
                        label="טייס אוטומטי (Autopilot)"
                        description="מחיל את התיקונים הבטוחים בעצמו: הורדת מכסה שנמצאת מעל הטווח הבטוח, הרחבת מרווחי שליחה, התאמת מגבלת קמפיין ליכולת תיבות הדואר שלו, והפעלת הסרה מרשימה בלחיצה אחת. הוא לעולם לא משהה שליחה, לא עורך את התוכן שלך ולא מבצע שינוי שאינו ניתן לביטול. כל תיקון פועל עם ההרשאות שלך ומופיע ביומן הביקורת בשמך, ומפסיק אם אתה עוזב את סביבת העבודה."
                        checked={autopilot}
                        onChange={(v) => save({ autopilot: v })}
                        disabled={disabled}
                    />

                    <Row
                        label="רמת חומרה מינימלית"
                        description="הסתר כל ממצא שפחות דחוף מרמה זו. רק ממצאים קריטיים וכאלה שדורשים טיפול יציגו תג בלשונית הניווט, ללא תלות בהגדרה זו."
                    >
                        <div className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 p-0.5">
                            {SEVERITIES.map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => save({ min_severity: s })}
                                    className={`h-6 rounded px-2 text-[12px] transition disabled:opacity-50 ${
                                        minSeverity === s
                                            ? "bg-white text-slate-900 shadow-sm font-medium"
                                            : "text-slate-500 hover:text-slate-700"
                                    }`}
                                >
                                    {SEVERITY_LABEL[s]}
                                </button>
                            ))}
                        </div>
                    </Row>

                    {CATEGORIES.map(({ key, description }) => (
                        <ToggleRow
                            key={key}
                            label={CATEGORY_LABEL[key]}
                            description={description}
                            checked={!muted.has(key)}
                            onChange={(v) => toggleCategory(key, v)}
                            disabled={disabled}
                        />
                    ))}
                </>
            ) : null}
        </Section>
    );
}
