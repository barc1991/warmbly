import React from "react";
import { Link } from "react-router-dom";
import { useAppStore } from "@/stores";
import { TextInput } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import useUpdateOrganization from "@/lib/api/hooks/app/organizations/useUpdateOrganization";
import { AvatarUploader } from "@/components/app/avatar/AvatarUploader";
import {
    useDeleteOrgAvatar,
    useUploadOrgAvatar,
} from "@/lib/api/hooks/app/avatar/useOrgAvatar";
import { Row, Section, SectionShell, ToggleRow } from "../_components/SectionShell";
import SaveStatus from "../_components/SaveStatus";
import { useAutosave } from "@/hooks/useAutosave";
import { useRegisterUnsaved } from "@/hooks/context/unsaved";
import useCurrentOrganization from "@/lib/api/hooks/app/organizations/useCurrentOrganization";
import { usePermission } from "@/hooks/usePermission";
import useAiMetered from "@/hooks/useAiMetered";
import AdvisorSettingsSection from "@/components/app/advisor/AdvisorSettingsSection";

export default function WorkspaceSettingsPage() {
    const currentOrg = useAppStore((s) => s.currentOrganization);
    const [name, setName] = React.useState(currentOrg?.name ?? "");

    const uploadOrgAvatar = useUploadOrgAvatar();
    const removeOrgAvatar = useDeleteOrgAvatar();
    const updateOrg = useUpdateOrganization();

    // Team presence privacy. The full org (with the flags) comes from
    // /organization/current; toggling saves immediately and the realtime
    // service re-gates everyone live. Only admins with Manage settings can edit.
    const orgQuery = useCurrentOrganization();
    const canManageSettings = usePermission("MANAGE_SETTINGS");
    const metered = useAiMetered();
    const [showOnline, setShowOnline] = React.useState(true);
    const [showActivity, setShowActivity] = React.useState(true);
    React.useEffect(() => {
        if (!orgQuery.data) return;
        setShowOnline(orgQuery.data.presence_show_online ?? true);
        setShowActivity(orgQuery.data.presence_show_activity ?? true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orgQuery.data?.presence_show_online, orgQuery.data?.presence_show_activity]);

    const onToggleOnline = (next: boolean) => {
        setShowOnline(next);
        updateOrg.mutate({ presence_show_online: next });
    };
    const onToggleActivity = (next: boolean) => {
        setShowActivity(next);
        updateOrg.mutate({ presence_show_activity: next });
    };

    // AI voice profile. Grounds every AI writing surface. Saved on blur when
    // changed. Manage settings only.
    const [productDesc, setProductDesc] = React.useState("");
    const [icpNotes, setIcpNotes] = React.useState("");
    const [voiceProfile, setVoiceProfile] = React.useState("");
    React.useEffect(() => {
        if (!orgQuery.data) return;
        setProductDesc(orgQuery.data.product_description ?? "");
        setIcpNotes(orgQuery.data.icp_notes ?? "");
        setVoiceProfile(orgQuery.data.voice_profile ?? "");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        orgQuery.data?.product_description,
        orgQuery.data?.icp_notes,
        orgQuery.data?.voice_profile,
    ]);
    const saveVoiceField = (key: "product_description" | "icp_notes" | "voice_profile", value: string, saved: string) => {
        if (value !== saved) updateOrg.mutate({ [key]: value });
    };

    // Inbox agent opt-in (paid). When on, an inbound human reply gets an
    // AI-drafted suggested reply awaiting review in the unibox.
    const [inboxAgent, setInboxAgent] = React.useState(false);
    const [sharedHistory, setSharedHistory] = React.useState(false);
    React.useEffect(() => {
        if (orgQuery.data) setInboxAgent(orgQuery.data.inbox_agent_enabled ?? false);
        if (orgQuery.data) setSharedHistory(orgQuery.data.assistant_shared_history ?? false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orgQuery.data?.inbox_agent_enabled, orgQuery.data?.assistant_shared_history]);
    const onToggleInboxAgent = (next: boolean) => {
        setInboxAgent(next);
        updateOrg.mutate({ inbox_agent_enabled: next });
    };
    const onToggleSharedHistory = (next: boolean) => {
        setSharedHistory(next);
        updateOrg.mutate({ assistant_shared_history: next });
    };

    // Auto-save the workspace name ~700ms after typing stops. An empty name is
    // never persisted; the field just stays unsaved until it's valid again.
    const autosave = useAutosave({
        value: name.trim(),
        debounceMs: 700,
        save: async (v) => {
            if (!v) throw new Error("name required");
            await updateOrg.mutateAsync({ name: v });
        },
    });
    useRegisterUnsaved(autosave, () => setName(autosave.savedValue));

    React.useEffect(() => {
        autosave.markSaved(currentOrg?.name ?? "");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentOrg?.name]);

    return (
        <SectionShell
            title="סביבת עבודה"
            description="הגדרות ברמת הארגון. גלוי רק לבעלים."
            actions={<SaveStatus status={autosave.status} onRetry={autosave.retry} />}
        >
            <Section
                eyebrow="זהות"
                description="כיצד סביבת עבודה זו נקראת ומזוהה."
            >
                <Row
                    label="תמונת סביבת עבודה"
                    description="לוגו מרובע או ראשי תיבות. מוצג במחליף הארגונים ובדוחות משותפים."
                    align="start"
                >
                    <AvatarUploader
                        current={currentOrg?.avatar_url ?? currentOrg?.avatar}
                        fallbackInitials={(currentOrg?.name ?? "WS").slice(0, 2).toUpperCase()}
                        shape="square"
                        onUpload={async (blob) => {
                            await uploadOrgAvatar.mutateAsync(blob);
                        }}
                        onRemove={async () => {
                            await removeOrgAvatar.mutateAsync();
                        }}
                    />
                </Row>
                <Row label="שם סביבת העבודה" description="מוצג בסרגל הצד ובמיילים של הזמנות.">
                    <TextInput value={name} onChange={setName} className="w-full max-w-[280px]" />
                </Row>
                <Row
                    label="מזהה סביבת עבודה"
                    description="מזהה ייחודי קבוע. משמש בקריאות API ובפניות תמיכה."
                    align="start"
                >
                    <input
                        type="text"
                        value={currentOrg?.id ?? ""}
                        readOnly
                        dir="ltr"
                        className="w-full max-w-[300px] h-7 px-2.5 rounded-md border border-slate-200 bg-slate-50 text-[12px] text-slate-500 font-mono text-left"
                    />
                </Row>
            </Section>

            <Section
                eyebrow="ברירות מחדל לשליחה"
                description="משמש קמפיינים חדשים אלא אם הוגדר אחרת."
            >
                <Row
                    label="מכסה יומית כברירת מחדל"
                    description="הגנת בטיחות מובנית: 50 ליום לכל תיבת דואר קרה. ניתן להגדיל ברמת הקמפיין במידת הצורך."
                >
                    <input
                        type="text"
                        value="50 / יום"
                        disabled
                        className="w-full max-w-[120px] h-7 px-2.5 rounded-md border border-slate-200 bg-slate-50 text-[12px] text-slate-500"
                    />
                </Row>
            </Section>

            <Section
                eyebrow="פרטיות ותאימות"
                description="כותרות ומזהים המצורפים לכל שליחה."
            >
                <Row
                    label="הסרה מרשימה וביטול הצטרפות"
                    description="שורת ביטול ההצטרפות בכל הודעת קמפיין, ורשימת ההשתקה, נמצאות תחת שליחה."
                >
                    <Link to="/app/settings/sending" className="text-[12px] text-sky-700 hover:text-sky-800 font-medium">
                        פתח הגדרות שליחה
                    </Link>
                </Row>
                <ToggleRow
                    label="מעקב פתיחות כברירת מחדל"
                    description="מוסיף פיקסל 1×1. בטל לעבירות מקסימלית."
                />
            </Section>

            <Section
                eyebrow="נוכחות צוות"
                description="מה חברי הצוות יכולים לראות זה על זה בזמן אמת. חל על כולם בסביבת העבודה."
            >
                <ToggleRow
                    label="הצג מי מחובר"
                    description="הצג את תמונות הפרופיל של החברים שנמצאים כעת במערכת. כיבוי יסתיר את כל נתוני הנוכחות מחברי הצוות."
                    checked={showOnline}
                    onChange={onToggleOnline}
                    disabled={!canManageSettings}
                />
                <ToggleRow
                    label="הצג פעילות"
                    description="אפשר לחברי הצוות לראות במה מישהו צופה, עורך או משיב. כיבוי שומר על סטטוס מחובר אך מסתיר את פרטי הפעילות."
                    checked={showActivity && showOnline}
                    onChange={onToggleActivity}
                    disabled={!canManageSettings || !showOnline}
                />
            </Section>

            <Section
                eyebrow="פרופיל קול בינה מלאכותית (AI)"
                description="מנחה את כל ניסוחי הבינה המלאכותית (עוזר, טיוטות מענה, פתיחי מחקר) כך שיישמעו כמוך ויכירו את מה שאתה מוכר. הכל אופציונלי."
            >
                <Row
                    label="מה אתה מוכר"
                    description="משפט או שניים על המוצר שלך והתוצאה שהוא מספק."
                    align="start"
                >
                    <Textarea
                        value={productDesc}
                        onChange={(e) => setProductDesc(e.target.value)}
                        onBlur={() => saveVoiceField("product_description", productDesc, orgQuery.data?.product_description ?? "")}
                        disabled={!canManageSettings}
                        rows={3}
                        maxLength={2000}
                        placeholder="אנחנו עוזרים לצוותי מכירות לשמור על CRM נקי על ידי..."
                        className="w-full max-w-[420px] text-[12.5px]"
                    />
                </Row>
                <Row
                    label="למי אתה מוכר"
                    description="הלקוח האידיאלי שלך: תפקיד, סוג חברה, והכאב שהם חווים."
                    align="start"
                >
                    <Textarea
                        value={icpNotes}
                        onChange={(e) => setIcpNotes(e.target.value)}
                        onBlur={() => saveVoiceField("icp_notes", icpNotes, orgQuery.data?.icp_notes ?? "")}
                        disabled={!canManageSettings}
                        rows={3}
                        maxLength={2000}
                        placeholder="מנהלי מכירות בחברות SaaS B2B של 50-500 עובדים ש..."
                        className="w-full max-w-[420px] text-[12.5px]"
                    />
                </Row>
                <Row
                    label="טון דיבור וסגנון"
                    description="איך אתה רוצה להישמע. נינוח או רשמי, ביטויים לשימוש או להימנעות."
                    align="start"
                >
                    <Textarea
                        value={voiceProfile}
                        onChange={(e) => setVoiceProfile(e.target.value)}
                        onBlur={() => saveVoiceField("voice_profile", voiceProfile, orgQuery.data?.voice_profile ?? "")}
                        disabled={!canManageSettings}
                        rows={3}
                        maxLength={2000}
                        placeholder="ישיר וחם, אותיות קטנות בהתחלה זה בסדר, לעולם לא מכירתי מדי."
                        className="w-full max-w-[420px] text-[12.5px]"
                    />
                </Row>
            </Section>

            <Section
                eyebrow="סוכן תיבת דואר (Inbox Agent)"
                description={`בעת קבלת מענה אנושי נכנס, מנסח טיוטת תגובה בקול שלך וממתין לאישורך בתיבה המאוחדת. לעולם אינו שולח בעצמו.${metered ? " תכונה בתשלום; כל מענה שמטופל עולה 5 נקודות זכות AI." : ""}`}
            >
                <ToggleRow
                    label="נסח מענה עבורי"
                    description="כאשר מישהו משיב, הסוכן כותב טיוטת תגובה ומצרף אותה לשרשור תחת 'טיוטות סוכן'. אתה מאשר ושולח, עורך או מבטל אותה."
                    checked={inboxAgent}
                    onChange={onToggleInboxAgent}
                    disabled={!canManageSettings}
                />
            </Section>

            <Section
                eyebrow="עוזר בינה מלאכותית"
                description="כיצד היסטוריית השיחות של העוזר פועלת בקרב הצוות."
            >
                <ToggleRow
                    label="היסטוריה משותפת"
                    description="כל חבר בעל הרשאת 'שימוש ב-AI' יוכל לראות ולהמשיך כל שיחת עוזר בסביבת עבודה זו, במקום רק את שלו. הפעלה תחשוף את השיחות הקיימות לכל הצוות."
                    checked={sharedHistory}
                    onChange={onToggleSharedHistory}
                    disabled={!canManageSettings}
                />
            </Section>

            <AdvisorSettingsSection canManage={canManageSettings} />

            <Section
                eyebrow="סטטיסטיקות סביבת העבודה"
                description="מבט חטוף על אופן השימוש בסביבת עבודה זו."
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Stat label="חברים" value={1} />
                    <Stat label="תיבות דואר" value={0} />
                    <Stat label="קמפיינים" value={0} />
                </div>
            </Section>
        </SectionShell>
    );
}

function Stat({ label, value }: { label: string; value: string | number }) {
    return (
        <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">
                {label}
            </div>
            <div className="text-[18px] font-semibold text-slate-900 tabular-nums leading-tight mt-0.5">
                {value}
            </div>
        </div>
    );
}
