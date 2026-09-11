import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { changeAppLanguage, isRTL, syncDocumentDirection } from "./config";

interface DirectionContextValue {
    dir: "rtl" | "ltr";
    isRTL: boolean;
    language: string;
    setLanguage: (lang: string) => Promise<void>;
}

const DirectionContext = createContext<DirectionContextValue>({
    dir: "rtl",
    isRTL: true,
    language: "he",
    setLanguage: async () => {},
});

export function DirectionProvider({ children }: { children: React.ReactNode }) {
    const { i18n } = useTranslation();
    const [currentLanguage, setCurrentLanguage] = useState(i18n.language || "he");

    useEffect(() => {
        const handleLanguageChanged = (lng: string) => {
            setCurrentLanguage(lng);
            syncDocumentDirection(lng);
        };

        i18n.on("languageChanged", handleLanguageChanged);
        syncDocumentDirection(i18n.language);

        return () => {
            i18n.off("languageChanged", handleLanguageChanged);
        };
    }, [i18n]);

    const rtl = isRTL(currentLanguage);

    const value = useMemo(
        () => ({
            dir: rtl ? ("rtl" as const) : ("ltr" as const),
            isRTL: rtl,
            language: currentLanguage,
            setLanguage: changeAppLanguage,
        }),
        [rtl, currentLanguage]
    );

    return (
        <DirectionContext.Provider value={value}>
            {children}
        </DirectionContext.Provider>
    );
}

export function useDirection(): DirectionContextValue {
    return useContext(DirectionContext);
}
