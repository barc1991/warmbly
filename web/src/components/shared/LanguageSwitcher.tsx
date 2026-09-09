import React from "react";
import { LanguagesIcon } from "lucide-react";
import { useDirection } from "@/i18n";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({
    className,
    compact = false,
}: {
    className?: string;
    compact?: boolean;
}) {
    const { language, setLanguage, isRTL } = useDirection();

    const toggleLanguage = () => {
        const next = language.startsWith("he") ? "en" : "he";
        setLanguage(next);
    };

    return (
        <button
            type="button"
            onClick={toggleLanguage}
            title={language.startsWith("he") ? "Switch to English" : "עבור לעברית"}
            aria-label="Switch Language"
            className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer select-none",
                className
            )}
        >
            <LanguagesIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            {!compact && (
                <span>{language.startsWith("he") ? "עברית" : "English"}</span>
            )}
        </button>
    );
}

export default LanguageSwitcher;
