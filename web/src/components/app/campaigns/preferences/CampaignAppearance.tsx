// Standard campaign settings, split into the sections rendered on the
// single-scroll preferences page: identity, sending accounts, and the
// deliverability toggles. Each export returns ONLY its controls — the page's
// SettingsSection wrapper supplies the heading, icon and anchor.
// On-theme: slate/sky, rounded-md, 12.5px base.

import type Campaign from "@/lib/api/models/app/campaigns/Campaign";
import { Label, NumberInput, TextInput } from "@/components/ui/field";
import SenderSelector from "./SenderSelector";
import { SettingRow, Toggle } from "./components/CampaignPreferenceBoolBox";
import { SelectMenu, type SelectOption } from "@/components/ui/select-menu";
import { useOutreachSettings } from "@/lib/api/hooks/app/outreach/useOutreachSettings";

const UNSUB_MODES: SelectOption[] = [
    { value: "inherit", label: "ברירת המחדל של סביבת העבודה" },
    { value: "text", label: "השב כדי לבטל הצטרפות (שורת טקסט)" },
    { value: "link", label: "קישור להסרה מרשימת תפוצה" },
    { value: "off", label: "ללא" },
];

const DAILY_MIN = 3;
const DAILY_MAX = 5000;

type SetCampaign = React.Dispatch<React.SetStateAction<Campaign>>;

/** General — campaign name + description. */
export function GeneralSection({
    campaign,
    newCampaign,
    setNewCampaign,
}: {
    campaign: Campaign;
    newCampaign: Campaign;
    setNewCampaign: SetCampaign;
}) {
    return (
        <div className="space-y-4">
            <div>
                <Label>שם הקמפיין</Label>
                <TextInput
                    value={newCampaign.name}
                    placeholder={campaign.name}
                    onChange={(v) => setNewCampaign((bef) => ({ ...bef, name: v }))}
                    className="w-full max-w-[420px]"
                />
            </div>
            <div>
                <Label>תיאור</Label>
                <TextInput
                    value={newCampaign.description}
                    placeholder={campaign.description || "אופציונלי — מה מטרת הקמפיין"}
                    onChange={(v) => setNewCampaign((bef) => ({ ...bef, description: v }))}
                    className="w-full max-w-[420px]"
                />
            </div>
        </div>
    );
}

/** Sending accounts — the unified tag/mailbox picker + per-mailbox daily cap. */
export function SendingAccountsSection({
    newCampaign,
    setNewCampaign,
    explicitAccounts,
    setExplicitAccounts,
}: {
    newCampaign: Campaign;
    setNewCampaign: SetCampaign;
    explicitAccounts: string[];
    setExplicitAccounts: React.Dispatch<React.SetStateAction<string[]>>;
}) {
    const dailyInvalid = newCampaign.daily_limit < DAILY_MIN || newCampaign.daily_limit > DAILY_MAX;
    const dailyHigh = !dailyInvalid && newCampaign.daily_limit > 100;
    return (
        <div className="space-y-4">
            <div>
                <Label>חשבונות שולח</Label>
                <SenderSelector
                    selectedTags={newCampaign.email_tags}
                    onTagsChange={(next) => setNewCampaign((bef) => ({ ...bef, email_tags: next }))}
                    selectedAccounts={explicitAccounts}
                    onAccountsChange={setExplicitAccounts}
                />
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    בחר תגיות, תיבות דואר ספציפיות או שתיהן — הנפח יחולק שווה בשווה בין כל התיבות במאגר.
                    השאר ריק כדי לשלוח מכל תיבת דואר פעילה.
                </p>
            </div>
            <div>
                <Label>מגבלה יומית לכל תיבת דואר</Label>
                <NumberInput
                    value={newCampaign.daily_limit}
                    min={DAILY_MIN}
                    max={DAILY_MAX}
                    onChange={(v) => setNewCampaign((bef) => ({ ...bef, daily_limit: v }))}
                    suffix="אימיילים / יום"
                    className="w-48"
                />
                <p className={`text-[11px] mt-1.5 ${dailyInvalid ? "text-rose-500" : dailyHigh ? "text-amber-600" : "text-slate-400"}`}>
                    {dailyInvalid
                        ? `חייב להיות בין ${DAILY_MIN} ל-${DAILY_MAX}.`
                        : dailyHigh
                          ? "הרבה מעל לטווח הבטוח של 30–50 ליום עבור פנייה קרה. כל תיבה במאגר צריכה מוניטין וקיבולת מספקים מהספק כדי לעמוד בכך."
                          : `${DAILY_MIN}–${DAILY_MAX}. ברירת מחדל 50 — שמור על ערך שמרני עד שהמוניטין יוכח.`}
                </p>
            </div>
        </div>
    );
}

/** Deliverability — the per-campaign send/tracking toggles. */
export function DeliverabilitySection({
    newCampaign,
    setNewCampaign,
}: {
    newCampaign: Campaign;
    setNewCampaign: SetCampaign;
}) {
    // The warning below is only true when the opt-out this campaign actually
    // sends is a link, so "inherit" has to be resolved against the workspace
    // default rather than assumed.
    const { data: outreach } = useOutreachSettings();
    const mode = newCampaign.unsubscribe_mode ?? "inherit";
    const effectiveMode = mode === "inherit" || !mode ? (outreach?.unsubscribe?.mode ?? "text") : mode;
    const plainTextLinkOptOut = newCampaign.text_only && effectiveMode === "link";

    return (
        <div className="space-y-5">
            <SettingRow
                title="עצור בעת מענה"
                description="השהה אימיילי המשך לאיש קשר ברגע שהוא משיב."
                control={
                    <Toggle
                        id="campaign-pref-stop-on-reply"
                        value={newCampaign.stop_on_reply}
                        onChange={(v) => setNewCampaign((bef) => ({ ...bef, stop_on_reply: v }))}
                    />
                }
            />
            <SettingRow
                title="טקסט רגיל בלבד"
                description="שלח כטקסט פשוט לעבירות מרבית (מבטל מעקב)."
                control={
                    <Toggle
                        id="campaign-pref-text"
                        value={newCampaign.text_only}
                        onChange={(v) => setNewCampaign((bef) => ({ ...bef, text_only: v }))}
                    />
                }
            />
            <SettingRow
                title="מעקב פתיחות"
                description="עקוב אחר פתיחות אימייל (עשוי להפחית מעט את העבירות)."
                control={
                    <Toggle
                        id="campaign-pref-open-tracking"
                        value={newCampaign.open_tracking}
                        disabled={newCampaign.text_only}
                        onChange={(v) => setNewCampaign((bef) => ({ ...bef, open_tracking: v }))}
                    />
                }
            />
            <SettingRow
                title="מעקב קישורים"
                description="עקוב אחר לחיצות על קישורים למדידת מעורבות (CTR). כל קישור מנוטר בנפרד, כך שפעילות איש הקשר מציגה בדיוק על איזה קישור נלחץ."
                control={
                    <Toggle
                        id="campaign-pref-link-tracking"
                        value={newCampaign.link_tracking}
                        disabled={newCampaign.text_only}
                        onChange={(v) => setNewCampaign((bef) => ({ ...bef, link_tracking: v }))}
                    />
                }
            />
            <SettingRow
                title="פרמטרי UTM"
                description="תייג כל קישור עם utm_source, utm_medium, utm_campaign ו-utm_content (טקסט הקישור עצמו) כדי שהלחיצות ישויכו במערכת האנליטיקס שלך. קישורים שכבר מכילים ערכי UTM ישמרו עליהם."
                control={
                    <Toggle
                        id="campaign-pref-utm-tracking"
                        value={newCampaign.utm_tracking}
                        disabled={newCampaign.text_only}
                        onChange={(v) => setNewCampaign((bef) => ({ ...bef, utm_tracking: v }))}
                    />
                }
            />
            {newCampaign.utm_tracking && !newCampaign.text_only && (
                <UTMFields campaign={newCampaign} setNewCampaign={setNewCampaign} />
            )}
            <SettingRow
                title="כותרת הסרה (List-Unsubscribe)"
                description="הוסף כותרת List-Unsubscribe כדי שלקוחות דוא״ל יוכלו להציג כפתור הסרה בלחיצה אחת. זו כותרת טכנית ולא תוכן גלוי, כך שהיא אינה משנה את מראה האימייל ופועלת גם בשליחת טקסט רגיל. זו אפשרות ההסרה ש-Gmail ו-Yahoo דורשים; מומלץ להשאיר פעיל."
                control={
                    <Toggle
                        id="campaign-pref-unsub"
                        value={newCampaign.unsubscribe_header}
                        onChange={(v) => setNewCampaign((bef) => ({ ...bef, unsubscribe_header: v }))}
                    />
                }
            />
            <SettingRow
                title="שורת הסרה"
                description={
                    <>
                        אפשרות ההסרה שמתווספת לאחר החתימה בכל אימייל בקמפיין זה. מענה לצורך הסרה נקרא כאימייל
                        אישי ומכובד אוטומטית; קישור מיועד לרשימות שדורשות זאת, והכותרת למעלה כבר מכסה את כללי
                        השולחים בכמויות גדולות. ברירת המחדל של סביבת העבודה מוגדרת תחת הגדרות &gt; שליחה.
                        {plainTextLinkOptOut && (
                            <span className="mt-1 block text-amber-700">
                                קמפיין זה נשלח בטקסט רגיל בלבד, שבו קישור אינו יכול להסתיר את כתובתו: הנמען
                                קורא את כתובת ה-URL המלאה של ההסרה. עדיף להשתמש בכותרת ובשורת המענה כאן.
                            </span>
                        )}
                    </>
                }
                control={
                    <SelectMenu
                        value={newCampaign.unsubscribe_mode ?? "inherit"}
                        onChange={(v) =>
                            setNewCampaign((bef) => ({ ...bef, unsubscribe_mode: v as Campaign["unsubscribe_mode"] }))
                        }
                        options={UNSUB_MODES}
                        aria-label="שורת הסרה"
                        minWidth={240}
                        align="end"
                    />
                }
            />
        </div>
    );
}

/** The three campaign-level UTM values; utm_content is per link and not editable. */
export function UTMFields({
    campaign,
    setNewCampaign,
}: {
    campaign: Campaign;
    setNewCampaign: SetCampaign;
}) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 ps-0 sm:ps-4 sm:border-s-2 sm:border-slate-100">
            <div>
                <Label>utm_source</Label>
                <TextInput
                    value={campaign.utm_source}
                    placeholder="warmbly"
                    onChange={(v) => setNewCampaign((bef) => ({ ...bef, utm_source: v }))}
                    className="w-full"
                />
            </div>
            <div>
                <Label>utm_medium</Label>
                <TextInput
                    value={campaign.utm_medium}
                    placeholder="email"
                    onChange={(v) => setNewCampaign((bef) => ({ ...bef, utm_medium: v }))}
                    className="w-full"
                />
            </div>
            <div>
                <Label>utm_campaign</Label>
                <TextInput
                    value={campaign.utm_campaign}
                    placeholder={utmSlug(campaign.name) || "campaign"}
                    onChange={(v) => setNewCampaign((bef) => ({ ...bef, utm_campaign: v }))}
                    className="w-full"
                />
            </div>
            <p className="sm:col-span-3 text-[11px] text-slate-400 -mt-1 leading-relaxed">
                השאר שדה ריק כדי להשתמש בברירת המחדל. utm_content מוגדר לכל קישור מתוך הטקסט שלו
                (לדוגמה <span className="font-mono">pricing</span>), כך שכל קישור משויך באופן עצמאי.
            </p>
        </div>
    );
}

// Mirrors the backend's slug: lowercase words joined with underscores.
function utmSlug(s: string): string {
    return s
        .toLowerCase()
        .trim()
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean)
        .join("_")
        .slice(0, 64);
}
