import React from "react";
import { useUserProfile } from "@/hooks/context/user";
import { NumberInput, TextInput } from "@/components/ui/field";
import useUpdateProfile from "@/lib/api/hooks/auth/useUpdateProfile";
import useUpdateSendPreferences from "@/lib/api/hooks/auth/useUpdateSendPreferences";
import { AvatarUploader } from "@/components/app/avatar/AvatarUploader";
import {
    useDeleteUserAvatar,
    useUploadUserAvatar,
} from "@/lib/api/hooks/app/avatar/useUserAvatar";
import { Row, Section, SectionShell, initials } from "../_components/SectionShell";
import SaveStatus from "../_components/SaveStatus";
import { useAutosave, type AutosaveStatus } from "@/hooks/useAutosave";
import { useRegisterUnsaved } from "@/hooks/context/unsaved";

// Header indicator priority when two autosaves share one SaveStatus.
function combineStatus(a: AutosaveStatus, b: AutosaveStatus): AutosaveStatus {
    for (const s of ["saving", "error", "saved"] as const) {
        if (a === s || b === s) return s;
    }
    return "idle";
}

export default function ProfileSettingsPage() {
    const { user } = useUserProfile();
    const [firstName, setFirstName] = React.useState(user.first_name ?? "");
    const [lastName, setLastName] = React.useState(user.last_name ?? "");

    const uploadAvatar = useUploadUserAvatar();
    const removeAvatar = useDeleteUserAvatar();
    const updateProfile = useUpdateProfile();

    // Auto-save names ~700ms after the user stops typing. Empty names are not
    // persisted (the server requires both), so the field just stays unsaved.
    // Memoized so the debounce timer only resets on an actual name change.
    const value = React.useMemo(
        () => ({ firstName: firstName.trim(), lastName: lastName.trim() }),
        [firstName, lastName],
    );
    const autosave = useAutosave({
        value,
        debounceMs: 700,
        save: async (v) => {
            if (!v.firstName || !v.lastName) throw new Error("name required");
            await updateProfile.mutateAsync({ first_name: v.firstName, last_name: v.lastName });
        },
    });
    useRegisterUnsaved(autosave, () => {
        setFirstName(autosave.savedValue.firstName);
        setLastName(autosave.savedValue.lastName);
    });

    React.useEffect(() => {
        autosave.markSaved({ firstName: user.first_name ?? "", lastName: user.last_name ?? "" });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user.first_name, user.last_name]);

    // Undo-send window. Same autosave idiom as the names; the mutation
    // patches the cached /auth/me user so the value sticks immediately.
    // 0/undefined means the server cache hasn't caught up yet: show 30.
    const [undoSeconds, setUndoSeconds] = React.useState(user.undo_send_seconds || 30);
    const updateSendPrefs = useUpdateSendPreferences();
    const undoAutosave = useAutosave({
        value: undoSeconds,
        debounceMs: 700,
        save: async (v) => {
            await updateSendPrefs.mutateAsync(Math.min(120, Math.max(5, v)));
        },
    });
    useRegisterUnsaved(undoAutosave, () => {
        setUndoSeconds(undoAutosave.savedValue);
    });

    const status = combineStatus(autosave.status, undoAutosave.status);
    const retry = () => {
        autosave.retry();
        undoAutosave.retry();
    };

    return (
        <SectionShell
            title="פרופיל"
            description="משמש באימיילים הנשלחים מטעמך, בתמונת הפרופיל בסרגל הצד ובכל הזמנה שתישלח."
            actions={<SaveStatus status={status} onRetry={retry} />}
        >
            <Section eyebrow="זהות" description="השמות מופיעים באימיילים יוצאים.">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <FieldLabel>שם פרטי</FieldLabel>
                        <TextInput value={firstName} onChange={setFirstName} className="w-full" />
                    </div>
                    <div>
                        <FieldLabel>שם משפחה</FieldLabel>
                        <TextInput value={lastName} onChange={setLastName} className="w-full" />
                    </div>
                </div>
                <Row
                    label="אימייל"
                    description="שינוי כתובת אימייל מתבצע דרך התמיכה כעת."
                    align="start"
                >
                    <input
                        type="email"
                        value={user.email}
                        readOnly
                        dir="ltr"
                        className="w-full max-w-[280px] h-7 px-2.5 rounded-md border border-slate-200 bg-slate-50 text-[12.5px] text-slate-500 font-mono text-left rtl:text-right"
                    />
                </Row>
                <Row
                    label="אזור זמן"
                    description="מזוהה מהדפדפן שלך. משמש להצגת לוחות זמנים של קמפיינים בזמן מקומי."
                    align="start"
                >
                    <input
                        type="text"
                        value={Intl.DateTimeFormat().resolvedOptions().timeZone}
                        readOnly
                        dir="ltr"
                        className="w-full max-w-[280px] h-7 px-2.5 rounded-md border border-slate-200 bg-slate-50 text-[12.5px] text-slate-500 font-mono text-left rtl:text-right"
                    />
                </Row>
            </Section>

            <Section
                eyebrow="ביטול שליחה"
                description="אימיילים יוצאים ממתינים פרק זמן זה לפני שליחה כדי שתוכל לבטל אותם מהסרגל העליון."
            >
                <Row
                    label="חלון ביטול"
                    description="בין 5 ל-120 שניות. חל על שליחות מיידיות מתיבת החיבור ועל מענה להודעות."
                >
                    <NumberInput
                        value={undoSeconds}
                        onChange={setUndoSeconds}
                        min={5}
                        max={120}
                        step={5}
                        suffix="שניות"
                        className="w-[150px]"
                    />
                </Row>
            </Section>

            <Section
                eyebrow="תמונת פרופיל"
                description="מוצגת בסרגל הצד, בתצוגות מקדימות של אימייל ולצד הפעילות שלך. מותאמת לגודל 512px בעת העלאה."
            >
                <AvatarUploader
                    current={user.avatar_url}
                    fallbackInitials={initials(user.email)}
                    shape="circle"
                    onUpload={async (blob) => {
                        await uploadAvatar.mutateAsync(blob);
                    }}
                    onRemove={async () => {
                        await removeAvatar.mutateAsync();
                    }}
                />
            </Section>
        </SectionShell>
    );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
    return (
        <div className="text-[10.5px] uppercase tracking-[0.12em] text-slate-400 font-medium mb-1">
            {children}
        </div>
    );
}
