import React from "react";
import { useNavigate } from "react-router-dom";
import { RowLink, Section, SectionShell } from "../_components/SectionShell";
import PasskeyManager from "./PasskeyManager";
import SessionManager from "./SessionManager";
import TwoFactorManager from "./TwoFactorManager";
import ChangePasswordDialog from "./ChangePasswordDialog";

export default function SecuritySettingsPage() {
    const [pwOpen, setPwOpen] = React.useState(false);
    const navigate = useNavigate();
    return (
        <SectionShell title="אבטחה" description="הגנה על ההתחברות והגישה לחשבונך.">
            <PasskeyManager />

            <TwoFactorManager />

            <Section eyebrow="סיסמה" description="פרטי הזיהוי שבאמצעותם אתה מתחבר.">
                <RowLink
                    title="שינוי סיסמה"
                    description="השתמש ב-12+ תווים עם שילוב אותיות גדולות, קטנות ומספר."
                    cta="שנה סיסמה"
                    onClick={() => setPwOpen(true)}
                />
            </Section>

            <SessionManager />

            <Section eyebrow="התראות אבטחה" description="כיצד אנו מעדכנים אותך על פעילות בחשבון.">
                <RowLink
                    title="התראות התחברות"
                    description="קבל התראה כאשר מתבצעת גישה לחשבונך ממכשיר חדש. הפעל מסירת אימייל תחת התראות."
                    cta="הגדר"
                    onClick={() => navigate("/app/settings/notifications")}
                />
            </Section>

            <Section
                eyebrow="יישומים מורשים"
                description="יישומי צד שלישי המחוברים לחשבונך."
            >
                <p className="text-[12px] text-slate-500 leading-relaxed">
                    אין עדיין יישומים מחוברים. שירותים המחוברים ב-OAuth יוצגו כאן כאשר תעניק להם גישה.
                </p>
            </Section>

            <Section
                eyebrow="אבטחת אימייל"
                description="אימות שולח עבור תיבות הדואר שאתה מחבר."
            >
                <RowLink
                    title="DKIM, SPF, DMARC"
                    description="אימות דומיינים שולחים לעבירות דואר מקסימלית."
                    cta="פתח תיבות דואר"
                    onClick={() => (window.location.href = "/app/emails")}
                />
                <RowLink
                    title="מפתחות API"
                    description="אסימוני גישה תוכנתית. ניתן לבטל בלשונית מפתחות API."
                    cta="נהל"
                    onClick={() => (window.location.href = "/app/api-keys")}
                />
            </Section>
            <ChangePasswordDialog open={pwOpen} onClose={() => setPwOpen(false)} />
        </SectionShell>
    );
}
