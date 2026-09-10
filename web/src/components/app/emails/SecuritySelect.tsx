// Segmented picker for a mailbox leg's connection security. Shared by the
// connect modal and the reconnect dialog so both describe the choice the same
// way. Theme primitives only: h-7 control, slate border, sky active state.
//
// The unencrypted option is not a permanent third segment. It appears only
// once the host is a loopback literal on a self-hosted instance, which is the
// only shape the backend and the worker accept, so the form never offers a
// mode that is going to be refused.

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { allowsNoEncryption, type MailSecurity } from "@/lib/api/models/app/emails/Service";

export default function SecuritySelect({
    value,
    onChange,
    host = "",
    selfHosted = false,
}: {
    value: MailSecurity;
    onChange: (v: MailSecurity) => void;
    /** The leg's host, which decides whether "None" is offered at all. */
    host?: string;
    /** Hosted instances never run the worker on the customer's machine. */
    selfHosted?: boolean;
}) {
    const { i18n } = useTranslation();
    const isHe = i18n.language?.startsWith("he");

    const options: { value: MailSecurity; label: string; hint: string }[] = [
        {
            value: "tls",
            label: "SSL / TLS",
            hint: isHe ? "מוצפן מהבייט הראשון (SMTP 465, IMAP 993)" : "Encrypted from the first byte (SMTP 465, IMAP 993)",
        },
        {
            value: "starttls",
            label: "STARTTLS",
            hint: isHe ? "משתדרג להצפנה לאחר התחברות (SMTP 587 או 2525, IMAP 143)" : "Upgrades after connecting (SMTP 587 or 2525, IMAP 143)",
        },
        {
            value: "none",
            label: isHe ? "ללא הצפנה" : "None",
            hint: isHe ? "ללא הצפנה. רק עבור שרת דואר מקומי במחשב זה, כגון Proton Bridge" : "No encryption. Only to a mail server on this machine, such as Proton Bridge",
        },
    ];

    const allowNone = allowsNoEncryption(host, selfHosted);
    const visibleOptions = options.filter((o) => o.value !== "none" || allowNone);

    return (
        <div>
            <div className="flex items-stretch h-7 rounded-md border border-slate-200 bg-white overflow-hidden">
                {visibleOptions.map((o, i) => (
                    <button
                        key={o.value}
                        type="button"
                        title={o.hint}
                        aria-pressed={value === o.value}
                        onClick={() => onChange(o.value)}
                        className={cn(
                            "flex-1 min-w-0 px-2 text-[12.5px] transition-colors",
                            i > 0 && "border-l rtl:border-l-0 rtl:border-r border-slate-200",
                            value === o.value
                                ? o.value === "none"
                                    ? "bg-amber-50 text-amber-700 font-medium"
                                    : "bg-sky-50 text-sky-700 font-medium"
                                : "text-slate-600 hover:bg-slate-50",
                        )}
                    >
                        {o.label}
                    </button>
                ))}
            </div>
            {value === "none" && allowNone && (
                <p className="mt-1 text-[11.5px] leading-[1.4] text-slate-500">
                    {isHe
                        ? "פרטי ההתחברות מועברים בחיבור לא מוצפן למחשב זה בלבד. המערכת דוחה מצב זה עבור כל שרת אחר."
                        : "Credentials go over an unencrypted connection to this machine only. Warmbly refuses this mode for any other host."}
                </p>
            )}
        </div>
    );
}
