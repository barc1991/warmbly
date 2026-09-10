// Roles & access — workspace role management.
//
// Roles are data: every workspace starts with seeded Admin / Manager /
// Viewer rows that can be renamed, recolored, reshaped, or deleted like any
// other role. Owner is a membership status, not a role.

import { LockIcon } from "lucide-react";
import { Link } from "react-router-dom";
import useFeatureAccess from "@/hooks/useFeatureAccess";
import { useAppStore } from "@/stores";
import { Section, SectionShell } from "../_components/SectionShell";
import RolesSection from "./RolesSection";

export default function RolesSettingsPage() {
    const access = useFeatureAccess();
    const currentOrg = useAppStore((s) => s.currentOrganization);

    if (!access.loading && !access.canManage) {
        return (
            <SectionShell title="תפקידים והרשאות" description="למנהלי צוות בלבד.">
                <Section eyebrow="הגישה נדחתה">
                    <div className="flex items-start gap-3">
                        <div className="size-9 rounded-md bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                            <LockIcon className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="text-[13px] font-semibold text-slate-900">
                                דרושה לך הרשאת ניהול צוות כדי לנהל תפקידים
                            </div>
                            <p className="text-[12px] text-slate-500 leading-relaxed mt-1 max-w-md">
                                תפקידים קובעים מי יכול לעשות מה בסביבת עבודה זו. בקש ממישהו בעל גישת ניהול צוות לבדוק או לשנות את ההרשאות שלך.
                            </p>
                        </div>
                    </div>
                </Section>
            </SectionShell>
        );
    }

    return (
        <SectionShell
            title="תפקידים והרשאות"
            description={`מה כל תפקיד יכול לעשות ב-${currentOrg?.name ?? "סביבת עבודה זו"}.`}
        >
            <Section
                eyebrow="תפקידי סביבת העבודה"
                description="כל סביבת עבודה מתחילה עם מנהל מערכת, מנהל וצופה. שנה את שמם, צבעם, הרשאותיהם או מחק אותם – והוסף תפקידים משלך. עריכת תפקיד מעדכנת מיד את כל המשויכים אליו."
            >
                <RolesSection canManage={access.canManage} />
                <p className="text-[11.5px] text-slate-500 leading-relaxed">
                    שייך תפקידים מרשימת החברים או מתהליך ההזמנה.{" "}
                    <Link
                        to="/app/settings/members"
                        className="text-slate-700 underline-offset-2 hover:underline"
                    >
                        פתח את רשימת החברים ←
                    </Link>
                </p>
            </Section>
        </SectionShell>
    );
}
