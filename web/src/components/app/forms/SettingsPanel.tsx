// SettingsPanel — what happens after a submission, plus spam protection.
//
// Laid out like the campaign preferences page: stacked sections split by
// hairlines, each a heading over a responsive grid of controls. Controls
// spread across the width rather than sitting in one narrow column, and each
// declares how much room it needs with a col-span.

import React from "react";
import { PlusIcon, XIcon } from "lucide-react";

import { Label, TextInput } from "@/components/ui/field";
import { SelectMenu } from "@/components/ui/select-menu";
import { SettingRow, Toggle } from "@/components/app/campaigns/preferences/components/CampaignPreferenceBoolBox";
import CategoryPicker from "@/components/app/contacts/CategoryPicker";
import useCampaigns from "@/lib/api/hooks/app/campaigns/useCampaigns";

import Section from "./SettingsSection";

export interface FormSettingsDraft {
    success_message: string;
    redirect_url: string;
    campaign_id: string | null;
    category_ids: string[];
    allowed_domains: string[];
    captcha_enabled: boolean;
}

export default function SettingsPanel({
    draft,
    captchaAvailable,
    onChange,
}: {
    draft: FormSettingsDraft;
    captchaAvailable: boolean;
    onChange: (patch: Partial<FormSettingsDraft>) => void;
}) {
    const campaigns = useCampaigns({ query: "", folder: "" });
    const [domainInput, setDomainInput] = React.useState("");

    function addDomain() {
        const host = domainInput
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\//, "")
            .replace(/[/?#].*$/, "");
        if (!host) return;
        if (!draft.allowed_domains.includes(host)) {
            onChange({ allowed_domains: [...draft.allowed_domains, host] });
        }
        setDomainInput("");
    }

    return (
        <div className="px-4 lg:px-6 py-5 divide-y divide-slate-200/60">
            <Section
                title="לאחר הגשה"
                description="מה שהמבקר רואה ברגע סיום מילוי הטופס."
            >
                <div className="xl:col-span-2">
                    <Label>הודעת הצלחה</Label>
                    <textarea
                        value={draft.success_message}
                        onChange={(e) => onChange({ success_message: e.target.value })}
                        rows={3}
                        className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[16px] md:text-[12.5px] text-slate-900 outline-none transition-colors focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    />
                </div>
                <div>
                    <Label>כתובת URL להפניה</Label>
                    <TextInput
                        value={draft.redirect_url}
                        onChange={(v) => onChange({ redirect_url: v })}
                        placeholder="https://example.com/thanks (אופציונלי)"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                        השאר ריק כדי להציג את הודעת ההצלחה במקום זאת.
                    </p>
                </div>
            </Section>

            <Section
                title="קליטת לידים"
                description="היכן איש קשר שהוגש נקלט בסביבת העבודה שלך."
            >
                <div>
                    <Label>הוסף לקטגוריות</Label>
                    <CategoryPicker
                        value={draft.category_ids}
                        onChange={(next) => onChange({ category_ids: next })}
                        placeholder="בחר קטגוריות, למשל לידים מהאתר"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">כל איש קשר שמוגש יתוייג תחת קטגוריות אלו.</p>
                </div>
                <div>
                    <Label>הוסף לקמפיין</Label>
                    <SelectMenu
                        value={draft.campaign_id ?? ""}
                        onChange={(v) => onChange({ campaign_id: v === "" ? null : v })}
                        options={[
                            { value: "", label: "ללא" },
                            ...(campaigns.campaigns ?? []).map((c) => ({ value: c.id, label: c.name })),
                        ]}
                        fullWidth
                        aria-label="קמפיין"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                        אנשי קשר חדשים יצטרפו לקמפיין זה כלידים. השליחה ממשיכה לפעול לפי לוח הזמנים והמגבלות של הקמפיין.
                    </p>
                </div>
            </Section>

            <Section
                title="הגנה מפני ספאם"
                description="כל טופס כבר כולל מלכודת honeypot, זמן מילוי מינימלי והגבלת קצב שליחה לפי כתובת."
            >
                {captchaAvailable ? (
                    <div className="col-span-full">
                        <SettingRow
                            title="אימות Captcha"
                            description="דרוש מהמבקרים לעבור בדיקת Cloudflare Turnstile לפני ההגשה."
                        >
                            <Toggle
                                value={draft.captcha_enabled}
                                onChange={(v) => onChange({ captcha_enabled: v })}
                            />
                        </SettingRow>
                    </div>
                ) : (
                    <p className="col-span-full text-[11.5px] text-slate-500 rounded-md bg-slate-50 border border-slate-200 px-3 py-2 max-w-3xl">
                        בדיקת Captcha תהיה זמינה לאחר שהמפעיל יגדיר את Cloudflare Turnstile
                        (TURNSTILE_SECRET ו-TURNSTILE_SITE_KEY).
                    </p>
                )}
            </Section>

            <Section
                title="הטמעה באתרים"
                description="אילו אתרים רשאים לארח טופס זה. השאר ריק כדי לאפשר הטמעה בכל אתר."
            >
                <div className="xl:col-span-2">
                    <Label>דומיינים מורשים</Label>
                    <div className="flex items-center gap-1.5 max-w-md">
                        <TextInput
                            value={domainInput}
                            onChange={setDomainInput}
                            placeholder="example.com"
                            className="flex-1"
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    addDomain();
                                }
                            }}
                        />
                        <button
                            type="button"
                            onClick={addDomain}
                            aria-label="הוסף דומיין"
                            className="h-7 px-2 inline-flex items-center gap-1 rounded-md border border-slate-200 text-[12px] text-slate-600 hover:bg-slate-50 shrink-0"
                        >
                            <PlusIcon className="w-3 h-3" /> הוסף
                        </button>
                    </div>
                    {draft.allowed_domains.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                            {draft.allowed_domains.map((d) => (
                                <span
                                    key={d}
                                    className="inline-flex items-center gap-1 h-5 ps-2 pe-1 rounded bg-sky-50 text-sky-700 text-[11px]"
                                >
                                    {d}
                                    <button
                                        type="button"
                                        aria-label={`הסר ${d}`}
                                        onClick={() =>
                                            onChange({
                                                allowed_domains: draft.allowed_domains.filter((x) => x !== d),
                                             })
                                        }
                                        className="size-4 inline-flex items-center justify-center rounded hover:bg-sky-100"
                                    >
                                        <XIcon className="w-2.5 h-2.5" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                    <p className="text-[11px] text-slate-500 mt-1.5">
                        כאשר מוגדרים דומיינים, רק אתרים אלו ותת-הדומיינים שלהם יוכלו להטמיע את הטופס.
                    </p>
                </div>
            </Section>
        </div>
    );
}
