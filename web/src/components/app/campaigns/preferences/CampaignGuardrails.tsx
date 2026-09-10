// Auto-pause guardrails — the campaign stops itself when its engagement rates
// leave the band you set, instead of waiting for a mailbox provider to react.
//
// The numbers here are percentages. Bounce and complaint rates are ceilings
// (pause at or above); the reply rate is a floor (pause below), because a
// campaign at volume that nobody answers is spending sender reputation for
// nothing. Setting a rate to 0 turns that rule off.

import { PauseCircleIcon } from "lucide-react";
import type Campaign from "@/lib/api/models/app/campaigns/Campaign";
import { Label, NumberInput } from "@/components/ui/field";
import { SettingRow, Toggle } from "./components/CampaignPreferenceBoolBox";

type SetCampaign = React.Dispatch<React.SetStateAction<Campaign>>;

// Provider guidance behind the defaults, shown so the numbers are not magic.
const REFERENCE = [
    "Google דורשת משולחים לשמור על שיעור תלונות ספאם מתחת ל-0.10% ולא להגיע לעולם ל-0.30%.",
    "Amazon SES מעמידה חשבון בבדיקה כאשר שיעור החזרות (Bounce) מגיע ל-5% ועשויה להשהות את השליחה ב-10%.",
];

export function GuardrailsSection({
    newCampaign,
    setNewCampaign,
}: {
    newCampaign: Campaign;
    setNewCampaign: SetCampaign;
}) {
    const trippedAt = newCampaign.guardrail_tripped_at;
    const paused = newCampaign.status === "paused_guardrail";

    return (
        <div className="space-y-5">
            {(paused || trippedAt) && (
                <div className="rounded-md border border-amber-100 bg-amber-50/70 px-3 py-2.5 flex gap-2.5">
                    <PauseCircleIcon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                        <p className="text-[11.5px] text-amber-900/90 leading-relaxed">
                            {newCampaign.guardrail_reason || "קמפיין זה הושהה אוטומטית על ידי מנגנון הגנה."}
                        </p>
                        {trippedAt && (
                            <p className="text-[10.5px] text-amber-800/70 mt-1">
                                {new Date(trippedAt).toLocaleString()}
                            </p>
                        )}
                        {paused && (
                            <p className="text-[10.5px] text-amber-800/70 mt-1">
                                הפעלת הקמפיין מחדש תאפס התראה זו. פתור תחילה את הבעיה המהותית, אחרת הקמפיין ייעצר
                                שוב בבדיקה הבאה.
                            </p>
                        )}
                    </div>
                </div>
            )}

            <SettingRow
                title="השהיה אוטומטית"
                description="עצור קמפיין זה ברגע ששיעור החזרות, התלונות או המענה חורג מהטווח שהוגדר להלן. נבדק כל 15 דקות."
                control={
                    <Toggle
                        id="campaign-pref-guardrail"
                        value={newCampaign.guardrail_enabled}
                        onChange={(v) => setNewCampaign((bef) => ({ ...bef, guardrail_enabled: v }))}
                    />
                }
            />

            {newCampaign.guardrail_enabled && (
                <div className="rounded-md border border-slate-200 bg-slate-50/40 p-3.5 space-y-4">
                    <div className="flex flex-wrap items-end gap-4">
                        <div>
                            <Label>השהה מעל שיעור חזרות</Label>
                            <NumberInput
                                value={newCampaign.guardrail_bounce_rate_max}
                                min={0}
                                max={100}
                                step={0.5}
                                onChange={(v) => setNewCampaign((bef) => ({ ...bef, guardrail_bounce_rate_max: v }))}
                                suffix="%"
                                className="w-36"
                            />
                        </div>
                        <div>
                            <Label>השהה מעל שיעור תלונות</Label>
                            <NumberInput
                                value={newCampaign.guardrail_complaint_rate_max}
                                min={0}
                                max={100}
                                step={0.05}
                                onChange={(v) => setNewCampaign((bef) => ({ ...bef, guardrail_complaint_rate_max: v }))}
                                suffix="%"
                                className="w-36"
                            />
                        </div>
                        <div>
                            <Label>השהה מתחת לשיעור מענה</Label>
                            <NumberInput
                                value={newCampaign.guardrail_reply_rate_min}
                                min={0}
                                max={100}
                                step={0.5}
                                onChange={(v) => setNewCampaign((bef) => ({ ...bef, guardrail_reply_rate_min: v }))}
                                suffix="%"
                                className="w-36"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-end gap-4">
                        <div>
                            <Label>רק לאחר</Label>
                            <NumberInput
                                value={newCampaign.guardrail_min_sample}
                                min={1}
                                max={100000}
                                onChange={(v) => setNewCampaign((bef) => ({ ...bef, guardrail_min_sample: v }))}
                                suffix="שליחות"
                                className="w-40"
                            />
                        </div>
                        <div>
                            <Label>נמדד לאורך</Label>
                            <NumberInput
                                value={newCampaign.guardrail_window_days}
                                min={0}
                                max={365}
                                onChange={(v) => setNewCampaign((bef) => ({ ...bef, guardrail_window_days: v }))}
                                suffix="ימים"
                                className="w-40"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5 pt-0.5">
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                            שיעור של <b>0</b> מכבה את הכלל הרלוונטי. רף שיעור המענה כבוי כברירת מחדל: השהיה בשל
                            מעורבות נמוכה היא החלטה מודעת. חלון של <b>0</b> ימים מודד את כל ההיסטוריה של הקמפיין.
                        </p>
                        {REFERENCE.map((line) => (
                            <p key={line} className="text-[10.5px] text-slate-400 leading-relaxed">
                                {line}
                            </p>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
