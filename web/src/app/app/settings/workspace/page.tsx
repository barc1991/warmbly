import React from "react";
import { Link } from "react-router-dom";
import { useDirection } from "@/i18n";
import { useAppStore, type AppStore, type Organization as StoreOrganization } from "@/stores";
import { TextInput } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import useUpdateOrganization from "@/lib/api/hooks/app/organizations/useUpdateOrganization";
import type Organization from "@/lib/api/models/app/organizations/Organization";
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

// Keyed on the workspace id, which is what makes a switch re-seed the editors
// below. Each of them takes its initial value from the org it mounted with, and
// nothing here re-reads that on a change: the name field kept the previous
// workspace's name while the autosave baseline moved to the new one, so merely
// switching workspaces (or creating one, which switches to it) saved the old
// name over the new workspace's. That is the reported bug where renaming one
// workspace renamed the other.
export default function WorkspaceSettingsPage() {
    const currentOrg = useAppStore((s: AppStore) => s.currentOrganization);
    return <WorkspaceSettings key={currentOrg?.id ?? "none"} org={currentOrg} />;
}

function WorkspaceSettings({ org: currentOrg }: { org: StoreOrganization | null; key?: React.Key }) {
    const { language } = useDirection();
    const isHe = language === "he";
    const [name, setName] = React.useState(currentOrg?.name ?? "");
    const orgID = currentOrg?.id;

    const uploadOrgAvatar = useUploadOrgAvatar();
    const removeOrgAvatar = useDeleteOrgAvatar();
    const updateOrg = useUpdateOrganization();

    // Every save here renames whatever workspace the server session has
    // selected, and a debounce or a blur armed on this page can land after a
    // switch. orgID is the workspace this editor was opened for, so a write
    // that would reach a different one is dropped rather than applied to it.
    const saveToThisWorkspace = React.useCallback(
        async (patch: Partial<Organization>) => {
            if (!orgID || useAppStore.getState().currentOrganization?.id !== orgID) return;
            await updateOrg.mutateAsync(patch);
        },
        [orgID, updateOrg],
    );

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
        void saveToThisWorkspace({ presence_show_online: next });
    };
    const onToggleActivity = (next: boolean) => {
        setShowActivity(next);
        void saveToThisWorkspace({ presence_show_activity: next });
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
        if (value !== saved) void saveToThisWorkspace({ [key]: value });
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
        void saveToThisWorkspace({ inbox_agent_enabled: next });
    };
    const onToggleSharedHistory = (next: boolean) => {
        setSharedHistory(next);
        void saveToThisWorkspace({ assistant_shared_history: next });
    };

    // Auto-save the workspace name ~700ms after typing stops. An empty name is
    // never persisted; the field just stays unsaved until it's valid again.
    const autosave = useAutosave({
        value: name.trim(),
        debounceMs: 700,
        save: async (v) => {
            if (!v) throw new Error("name required");
            await saveToThisWorkspace({ name: v });
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
            description="הגדרות כלל-ארגוניות. גלויות למנהל בלבד."
            actions={<SaveStatus status={autosave.status} onRetry={autosave.retry} />}
        >
            <Section
                eyebrow="זהות"
                description="כיצד סביבת עבודה זו נקראת ומוגדרת."
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
                <Row label="שם סביבת העבודה" description="מוצג בסרגל הצד ובמיילי הזמנה לצוות.">
                    <TextInput value={name} onChange={setName} className="w-full max-w-[280px]" />
                </Row>
                <Row
                    label="מזהה סביבת עבודה"
                    description="מזהה יציב וקבוע. משמש בקריאות API ובפניות תמיכה."
                    align="start"
                >
                    <input
                        type="text"
                        value={currentOrg?.id ?? ""}
                        readOnly
                        className="w-full max-w-[300px] h-7 px-2.5 rounded-md border border-slate-200 bg-slate-50 text-[12px] text-slate-500 font-mono"
                    />
                </Row>
            </Section>

            <Section
                eyebrow="ברירות מחדל לשליחה"
                description="בשימוש עבור קמפיינים חדשים אלא אם הוגדר אחרת."
            >
                <Row
                    label="מגבלת שליחה יומית כברירת מחדל"
                    description="הגנת בטיחות מובנית: 50 ביום לכל תיבת שליחה קרה. ניתן להגדיל לכל קמפיין בנפרד לפי הצורך."
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
                    label="הסרה ובקשות אי-שליחה"
                    description="שורת ההסרה שכל מייל בקמפיין נושא, ורשימת החסימות, מנוהלים תחת הגדרות שליחה."
                >
                    <Link to="/app/settings/sending" className="text-[12px] text-sky-700 hover:text-sky-800 font-medium">
                        פתח הגדרות שליחה
                    </Link>
                </Row>
                <ToggleRow
                    label="מעקב פתיחות כברירת מחדל"
                    description="מכניס פיקסל שקוף 1×1. כבה לקבלת יכולת מסירה מקסימלית."
                />
            </Section>

            <Section
                eyebrow="נוכחות צוות"
                description="מה חברי הצוות יכולים לראות זה על זה בזמן אמת. חל על כולם בסביבת העבודה."
            >
                <ToggleRow
                    label="הצג מי מחובר"
                    description="הצג תמונות של חברים המחוברים כעת למערכת. כיבוי יסתיר נוכחות מחברי הצוות."
                    checked={showOnline}
                    onChange={onToggleOnline}
                    disabled={!canManageSettings}
                />
                <ToggleRow
                    label="הצג פעילות בזמן אמת"
                    description="אפשר לחברי צוות לראות במה מישהו צופה, עורך או משיב. כיבוי ישמור על סטטוס מחובר אך יסתיר את הפרטים."
                    checked={showActivity && showOnline}
                    onChange={onToggleActivity}
                    disabled={!canManageSettings || !showOnline}
                />
            </Section>

            <Section
                eyebrow="פרופיל קול AI"
                description="הגדרת קול המותג עבור כל כלי ה-AI (עוזר כתיבה, טיוטות תשובה, מחקר) כדי שהניסוחים ישמעו אותנטיים. ללא הגבלת תווים."
            >
                <Row
                    label="מה אתה מוכר"
                    description="פירוט מלא על המוצר, השירותים והערך שאתה מספק (ללא הגבלת תווים)."
                    align="start"
                >
                    <Textarea
                        value={productDesc}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setProductDesc(e.target.value)}
                        onBlur={() => saveVoiceField("product_description", productDesc, orgQuery.data?.product_description ?? "")}
                        disabled={!canManageSettings}
                        rows={4}
                        placeholder="אנחנו עוזרים לצוותי מכירות לשמור על CRM נקי על ידי..."
                        className="w-full max-w-[640px] text-[12.5px]"
                    />
                </Row>
                <Row
                    label="למי אתה מוכר"
                    description="פרופיל הלקוח האידיאלי (ICP): תפקידים, ענף, גודל חברות והכאבים שהם חווים."
                    align="start"
                >
                    <Textarea
                        value={icpNotes}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setIcpNotes(e.target.value)}
                        onBlur={() => saveVoiceField("icp_notes", icpNotes, orgQuery.data?.icp_notes ?? "")}
                        disabled={!canManageSettings}
                        rows={4}
                        placeholder="מנהלי מכירות בחברות SaaS B2B של 50-500 עובדים ש..."
                        className="w-full max-w-[640px] text-[12.5px]"
                    />
                </Row>
                <Row
                    label="טון דיבור וסגנון"
                    description="איך אתה רוצה להישמע: הנחיות סגנון, אישיות, ביטויים לשימוש או להימנעות, חוקים ספציפיים."
                    align="start"
                >
                    <Textarea
                        value={voiceProfile}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setVoiceProfile(e.target.value)}
                        onBlur={() => saveVoiceField("voice_profile", voiceProfile, orgQuery.data?.voice_profile ?? "")}
                        disabled={!canManageSettings}
                        rows={5}
                        placeholder="ישיר וחם, שאל שאלות קצרות, הימנע מביטויי שיווק קלישאתיים, הצע תמיד ערך מוחשי לפני קריאה לפעולה."
                        className="w-full max-w-[640px] text-[12.5px]"
                    />
                </Row>
            </Section>

            <Section
                eyebrow="סוכן תיבת דואר"
                description={`כאשר מתקבלת תגובה מאדם, הסוכן מנסח הצעת תשובה בקול שלך וממתין לאישורך בתיבה. לעולם לא נשלח עצמאית.${metered ? " תכונה בתשלום; כל תגובה מנוסחת עולה 5 קרדיטים של AI." : ""}`}
            >
                <ToggleRow
                    label="נסח עבורי תשובות אוטומטית"
                    description="כאשר נמען משיב, הסוכן מנסח תשובה מוצעת ומצרף אותה לשרשור תחת 'טיוטות סוכן'. תוכל לאשר ולשלוח, לערוך או למחוק."
                    checked={inboxAgent}
                    onChange={onToggleInboxAgent}
                    disabled={!canManageSettings}
                />
            </Section>

            <Section
                eyebrow="עוזר AI"
                description="כיצד היסטוריית השיחות של העוזר מנוהלת בין חברי הצוות."
            >
                <ToggleRow
                    label="היסטוריית שיחות משותפת"
                    description="כל חבר צוות עם הרשאת שימוש ב-AI רואה ויכול להמשיך כל שיחת עוזר בסביבת עבודה זו, במקום רק את שלו. הפעלה תחשוף שיחות קיימות לכל הצוות."
                    checked={sharedHistory}
                    onChange={onToggleSharedHistory}
                    disabled={!canManageSettings}
                />
            </Section>

            <AdvisorSettingsSection canManage={canManageSettings} />

            <Section
                eyebrow="סטטיסטיקת סביבת עבודה"
                description="תמונת מצב של השימוש בסביבת עבודה זו."
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
