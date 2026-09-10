// Advanced campaign settings, split into the sections rendered on the
// single-scroll preferences page: rotation + ramp-up, ESP matching (with the
// visual coverage panel), lead flow, and tracking/headers. Each export returns
// ONLY its controls — the page's SettingsSection wrapper supplies the heading,
// icon and anchor. On-theme: slate/sky, rounded-md, 12.5px base, NumberInput
// for every number.

import { useState } from "react";
import { AlertCircleIcon } from "lucide-react";
import type Campaign from "@/lib/api/models/app/campaigns/Campaign";
import { Label, NumberInput } from "@/components/ui/field";
import { EmailListInput, OptionSelect, SettingRow, Toggle } from "./components/CampaignPreferenceBoolBox";
import EspCoveragePanel from "./EspCoveragePanel";

type SetCampaign = React.Dispatch<React.SetStateAction<Campaign>>;

/** RampPreview — a small day-by-day projection of the per-mailbox ramp curve
 *  (Day 1 = start, +increment each day, capped at the ceiling). Highlights the
 *  bar nearest today's live cap (ramp_level). */
function RampPreview({
    start,
    increment,
    ceiling,
    level,
}: {
    start: number;
    increment: number;
    ceiling: number;
    level: number;
}) {
    if (start <= 0 || ceiling <= 0 || start > ceiling) return null;
    const days: number[] = [];
    let v = start;
    let guard = 0;
    while (guard < 60) {
        const capped = Math.min(v, ceiling);
        days.push(capped);
        if (capped >= ceiling) break;
        v += Math.max(1, increment);
        guard++;
    }
    const MAX_BARS = 14;
    const shown = days.slice(0, MAX_BARS);
    const more = days.length - shown.length;
    const todayIdx = days.findIndex((d) => d >= level);

    return (
        <div>
            <div className="flex items-end gap-1 h-14" dir="ltr">
                {shown.map((val, i) => {
                    const today = i === todayIdx;
                    return (
                        <div
                            key={i}
                            title={`יום ${i + 1}: ${val}/יום`}
                            className={`flex-1 min-w-[4px] rounded-t-sm ${today ? "bg-sky-500" : "bg-sky-200"}`}
                            style={{ height: `${Math.max(10, (val / ceiling) * 100)}%` }}
                        />
                    );
                })}
            </div>
            <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-400">
                <span>
                    יום 1 · {start}/יום
                </span>
                <span>
                    {more > 0 ? `+עוד ${more} · ` : ""}יום {days.length} · {ceiling}/יום, ולאחר מכן קבוע
                </span>
            </div>
        </div>
    );
}

/** Inbox rotation — distribution mode + per-mailbox daily ramp-up. */
export function RotationRampSection({
    newCampaign,
    setNewCampaign,
}: {
    newCampaign: Campaign;
    setNewCampaign: SetCampaign;
}) {
    const rampInvalid = newCampaign.ramp_enabled && newCampaign.ramp_start > newCampaign.ramp_ceiling;
    return (
        <div className="space-y-5">
            {/* Inbox rotation */}
            <div>
                <SettingRow
                    title="סבב תיבות דואר (Rotation)"
                    description="שלח קמפיין זה ממספר תיבות דואר כדי שאף תיבה לא תשלח יותר מדי — עבירות טובה יותר ונפח כולל גבוה יותר."
                    stack
                    control={
                        <OptionSelect
                            aria-label="סבב תיבות דואר"
                            cols={1}
                            value={newCampaign.rotation_mode}
                            onChange={(v) => setNewCampaign((bef) => ({ ...bef, rotation_mode: v }))}
                            options={[
                                {
                                    value: "least_recently_used",
                                    label: "פיזור שווה (LRU)",
                                    hint: "מומלץ — בוחר תמיד את התיבה שהייתה בלתי פעילה למשך הזמן הארוך ביותר, לדפוס שליחה טבעי במיוחד.",
                                },
                                {
                                    value: "round_robin",
                                    label: "סבב מחזורי (Round-robin)",
                                    hint: "עובר בין תיבות הדואר לפי הסדר (א → ב → ג → א). חלוקה שווה ופשוטה.",
                                },
                                {
                                    value: "weighted",
                                    label: "משוקלל",
                                    hint: "שולח יותר מתיבות הדואר הבריאות ביותר ובעלות המגבלה הגבוהה יותר.",
                                },
                            ]}
                        />
                    }
                />
                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                    סבב התיבות בוחר את התיבה עבור האימייל הראשון של הליד, וכל אימייל המשך לליד זה נשלח מאותה
                    כתובת כדי לשמור על עקביות בשיחה. כל תיבה נשארת בתוך המגבלה היומית שלה, וליד ישנה כתובת שולח
                    רק אם התיבה שלו אינה מסוגלת עוד לשלוח עבור קמפיין זה.
                </p>
            </div>

            {/* Daily ramp-up */}
            <SettingRow
                title="העלאה יומית הדרגתית (Ramp-up)"
                description="העלה בהדרגה את הנפח היומי של כל תיבה במקום להתחיל במגבלה המלאה — עקומת צמיחה חלקה מגינה על עבירות השליחה. (נפרד מחימום תיבות)."
                control={
                    <Toggle
                        id="campaign-pref-ramp"
                        value={newCampaign.ramp_enabled}
                        onChange={(v) => setNewCampaign((bef) => ({ ...bef, ramp_enabled: v }))}
                    />
                }
            />
            {newCampaign.ramp_enabled && (
                <div className="rounded-md border border-slate-200 bg-slate-50/40 p-3.5 space-y-3.5">
                    <div className="flex flex-wrap items-end gap-4">
                        <div>
                            <Label>התחלה</Label>
                            <NumberInput
                                value={newCampaign.ramp_start}
                                min={1}
                                max={5000}
                                onChange={(v) => setNewCampaign((bef) => ({ ...bef, ramp_start: v }))}
                                suffix="/ יום"
                                className="w-36"
                            />
                        </div>
                        <div>
                            <Label>הגדלה בכל יום ב</Label>
                            <NumberInput
                                value={newCampaign.ramp_increment}
                                min={1}
                                max={100}
                                onChange={(v) => setNewCampaign((bef) => ({ ...bef, ramp_increment: v }))}
                                suffix="/ יום"
                                className="w-36"
                            />
                        </div>
                        <div>
                            <Label>תקרה</Label>
                            <NumberInput
                                value={newCampaign.ramp_ceiling}
                                min={1}
                                max={5000}
                                onChange={(v) => setNewCampaign((bef) => ({ ...bef, ramp_ceiling: v }))}
                                suffix="/ יום"
                                className="w-36"
                            />
                        </div>
                        <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-sky-50 text-sky-700 text-[11.5px] font-medium">
                            מגבלה להיום
                            <span className="font-mono tabular-nums">{newCampaign.ramp_level}</span>
                        </span>
                    </div>
                    {rampInvalid ? (
                        <p className="flex items-center gap-1.5 text-[11px] text-rose-500">
                            <AlertCircleIcon className="w-3.5 h-3.5 shrink-0" />
                            הערך ההתחלתי חייב להיות קטן או שווה לתקרה.
                        </p>
                    ) : (
                        <RampPreview
                            start={newCampaign.ramp_start}
                            increment={newCampaign.ramp_increment}
                            ceiling={newCampaign.ramp_ceiling}
                            level={newCampaign.ramp_level}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

/** ESP matching — the mode control + the visual coverage panel. */
export function EspMatchingSection({
    newCampaign,
    setNewCampaign,
    explicitAccounts,
}: {
    newCampaign: Campaign;
    setNewCampaign: SetCampaign;
    explicitAccounts: string[];
}) {
    return (
        <div className="space-y-4">
            <SettingRow
                title="התאמת ספק דואר (ESP Matching)"
                description="התאם את ספק תיבת הדואר השולחת לספק הדואר של הנמען (לדוגמה: Google ← Google)."
                stack
                control={
                    <OptionSelect
                        aria-label="מצב התאמת ספק"
                        cols={3}
                        value={newCampaign.esp_match_mode}
                        onChange={(v) => setNewCampaign((bef) => ({ ...bef, esp_match_mode: v }))}
                        options={[
                            { value: "off", label: "כבוי", hint: "התעלם מהספק בעת בחירת תיבת דואר" },
                            { value: "prefer", label: "העדף ספק זהה", hint: "השתמש בתיבה מאותו ספק כשהיא פנויה" },
                            { value: "strict", label: "ספק זהה בלבד", hint: "שלח אך ורק מתיבה בעלת ספק זהה" },
                        ]}
                    />
                }
            />
            <EspCoveragePanel
                mode={newCampaign.esp_match_mode}
                emailTags={newCampaign.email_tags}
                explicitAccounts={explicitAccounts}
            />
        </div>
    );
}

/** Lead flow — new-lead throttle, prioritization, and risky-address policy. */
export function LeadFlowSection({
    newCampaign,
    setNewCampaign,
}: {
    newCampaign: Campaign;
    setNewCampaign: SetCampaign;
}) {
    return (
        <div className="space-y-5">
            <div>
                <Label>לידים חדשים לפנייה ביום</Label>
                <NumberInput
                    value={newCampaign.max_new_leads_per_day}
                    min={0}
                    max={10000}
                    onChange={(v) => setNewCampaign((bef) => ({ ...bef, max_new_leads_per_day: v }))}
                    suffix={newCampaign.max_new_leads_per_day === 0 ? "= ללא הגבלה" : "לידים / יום"}
                    className="w-48"
                />
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    מגביל לכמה לידים חדשים לחלוטין יישלח האימייל <span className="text-slate-500">הראשון ביותר</span>{" "}
                    מקמפיין זה מדי יום, כדי שרשימה חדשה תצא בטפטוף יציב ולא בבת אחת. אימיילי המשך לאנשים שכבר
                    נמצאים בקמפיין ממשיכים להישלח ואינם נספרים במגבלה זו.
                </p>
            </div>
            <SettingRow
                title="תעדוף לידים חדשים"
                description="שלח ללידים שנוספו לאחרונה לפני המשך התור הקיים."
                control={
                    <Toggle
                        id="campaign-pref-prioritize-new"
                        value={newCampaign.prioritize_new_leads}
                        onChange={(v) => setNewCampaign((bef) => ({ ...bef, prioritize_new_leads: v }))}
                    />
                }
            />
            <SettingRow
                title="המשך לפעול עבור לידים חדשים"
                description="כאשר ייגמרו הלידים, הקמפיין יישאר פעיל וימתין במקום להסתיים, כך שלידים מסגמנט מקושר, מטופס, מה-API או מאוטומציה ימשיכו לקבל את הרצף. קישור סגמנט, טופס או אוטומציה מפעיל הגדרה זו, וכך גם הפעלת הקמפיין לאחר שכל הלידים הסתיימו."
                control={
                    <Toggle
                        id="campaign-pref-continuous"
                        value={newCampaign.continuous}
                        onChange={(v) => setNewCampaign((bef) => ({ ...bef, continuous: v }))}
                    />
                }
            />
            <SettingRow
                title="שלח לכתובות דואר בסיכון"
                description="נסה לשלוח לכתובות שסומנו כבעלות סיכון באימות (עשוי להגדיל חזרות)."
                control={
                    <Toggle
                        id="campaign-pref-risk"
                        value={newCampaign.risky_emails}
                        onChange={(v) => setNewCampaign((bef) => ({ ...bef, risky_emails: v }))}
                    />
                }
            />
        </div>
    );
}

/** CC & BCC — extra recipients copied on every send. Gmail-style: the fields
 *  stay hidden behind "Add CC / Add BCC" until needed, so the section is calm
 *  by default. (Tracking domain is a per-mailbox setting and lives on the
 *  mailbox, not the campaign.) */
export function CcBccSection({
    newCampaign,
    setNewCampaign,
}: {
    newCampaign: Campaign;
    setNewCampaign: SetCampaign;
}) {
    const [showCc, setShowCc] = useState(newCampaign.cc.length > 0);
    const [showBcc, setShowBcc] = useState(newCampaign.bcc.length > 0);

    const addBtn =
        "inline-flex items-center h-7 px-2.5 rounded-md border border-dashed border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700 text-[12px] font-medium transition-colors";

    return (
        <div className="space-y-4">
            {showCc && (
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <Label className="mb-0">CC</Label>
                        <button
                            type="button"
                            onClick={() => {
                                setShowCc(false);
                                setNewCampaign((bef) => ({ ...bef, cc: [] }));
                            }}
                            className="text-[11px] text-slate-400 hover:text-rose-500 transition-colors"
                        >
                            הסר
                        </button>
                    </div>
                    <EmailListInput
                        values={newCampaign.cc}
                        onChange={(v) => setNewCampaign((bef) => ({ ...bef, cc: v }))}
                    />
                    <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                        גלוי לנמענים. הדבק או הקלד מספר כתובות — הפרד באמצעות פסיק, רווח או Enter.
                    </p>
                </div>
            )}

            {showBcc && (
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <Label className="mb-0">BCC</Label>
                        <button
                            type="button"
                            onClick={() => {
                                setShowBcc(false);
                                setNewCampaign((bef) => ({ ...bef, bcc: [] }));
                            }}
                            className="text-[11px] text-slate-400 hover:text-rose-500 transition-colors"
                        >
                            הסר
                        </button>
                    </div>
                    <EmailListInput
                        values={newCampaign.bcc}
                        onChange={(v) => setNewCampaign((bef) => ({ ...bef, bcc: v }))}
                    />
                    <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">מוסתר מהנמענים.</p>
                </div>
            )}

            {(!showCc || !showBcc) && (
                <div className="flex flex-wrap items-center gap-2">
                    {!showCc && (
                        <button type="button" onClick={() => setShowCc(true)} className={addBtn}>
                            + הוסף CC
                        </button>
                    )}
                    {!showBcc && (
                        <button type="button" onClick={() => setShowBcc(true)} className={addBtn}>
                            + הוסף BCC
                        </button>
                    )}
                    {!showCc && !showBcc && (
                        <span className="text-[11px] text-slate-400">
                            אופציונלי: הוסף כתובות מועתקות בכל אימייל שקמפיין זה שולח.
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
