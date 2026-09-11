import React from "react";
import { Link } from "react-router-dom";
import { SparklesIcon, ChevronLeftIcon } from "lucide-react";
import { useAppStore } from "@/stores";
import { TextInput } from "@/components/ui/field";
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
                eyebrow="בינה מלאכותית וקול המותג"
                description="הגדרות קול המותג, המוצר, כלי הסוכן ותרחישי המענה מנוהלים כעת במרכז הבינה המלאכותית."
            >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-md border border-slate-200/80 bg-slate-50/50">
                    <div className="flex items-center gap-2.5">
                        <SparklesIcon className="w-4 h-4 text-sky-600 shrink-0" />
                        <span className="text-[12.5px] text-slate-700">
                            עבור להגדרות בינה מלאכותית לניהול קול המותג, כלי הסוכן ותרחישי המענה
                        </span>
                    </div>
                    <Link
                        to="/app/settings/ai"
                        className="h-7 px-3 rounded-md bg-white border border-slate-200 hover:bg-slate-50 text-[12px] font-medium text-slate-700 inline-flex items-center gap-1.5 shrink-0 transition-colors"
                    >
                        <span>פתח הגדרות AI</span>
                        <ChevronLeftIcon className="w-3.5 h-3.5 rtl:rotate-0 rotate-180 text-slate-400" />
                    </Link>
                </div>
            </Section>

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
