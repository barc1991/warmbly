// Contact ordering settings — how the campaign picks who to send to next.
// On-theme: reuses the shared OptionSelect / Segmented / SettingRow primitives
// so it matches the rest of the settings page.

import type Campaign from "@/lib/api/models/app/campaigns/Campaign";
import { Label, TextInput } from "@/components/ui/field";
import { OptionSelect, Segmented, SettingRow } from "./components/CampaignPreferenceBoolBox";

const ORDER_OPTIONS: { value: Campaign["contact_order_by"]; label: string; hint: string }[] = [
    { value: "created_at", label: "זמן יצירה", hint: "מתי איש הקשר נוסף" },
    { value: "email", label: "אימייל", hint: "לפי סדר האלפבית של כתובת האימייל" },
    { value: "name", label: "שם", hint: "לפי שם פרטי, ולאחר מכן שם משפחה" },
    { value: "custom_field", label: "שדה מותאם אישית", hint: "מיון לפי שדה מותאם אישית של איש הקשר" },
];

interface CampaignContactOrderProps {
    campaign: Campaign;
    newCampaign: Campaign;
    setNewCampaign: React.Dispatch<React.SetStateAction<Campaign>>;
}

export default function CampaignContactOrder({ newCampaign, setNewCampaign }: CampaignContactOrderProps) {
    return (
        <div className="space-y-5">
            {/* Order by — same card picker as the rest of settings */}
            <div>
                <Label>מיין אנשי קשר לפי</Label>
                <OptionSelect
                    aria-label="מיין אנשי קשר לפי"
                    cols={2}
                    value={newCampaign.contact_order_by}
                    onChange={(v) => setNewCampaign((prev) => ({ ...prev, contact_order_by: v }))}
                    options={ORDER_OPTIONS}
                />
            </div>

            {/* Direction */}
            <SettingRow
                title="כיוון מיון"
                description={
                    newCampaign.contact_order_dir === "desc"
                        ? "ת → א / מהחדש לישן"
                        : "א → ת / מהישן לחדש"
                }
                control={
                    <Segmented
                        value={newCampaign.contact_order_dir}
                        onChange={(v) => setNewCampaign((prev) => ({ ...prev, contact_order_dir: v }))}
                        options={[
                            { value: "asc", label: "סדר עולה" },
                            { value: "desc", label: "סדר יורד" },
                        ]}
                    />
                }
            />

            {/* Custom field name */}
            {newCampaign.contact_order_by === "custom_field" && (
                <div>
                    <Label>שם שדה מותאם אישית</Label>
                    <TextInput
                        value={newCampaign.contact_order_field || ""}
                        placeholder="לדוגמה: company_size, priority"
                        onChange={(v) => setNewCampaign((prev) => ({ ...prev, contact_order_field: v }))}
                        className="w-full max-w-[280px]"
                    />
                    <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                        הזן את שם השדה המותאם אישית מתוך אנשי הקשר שלך.
                    </p>
                </div>
            )}
        </div>
    );
}
