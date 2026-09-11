import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enCommon from "./locales/en/common.json";
import enNav from "./locales/en/nav.json";
import enAuth from "./locales/en/auth.json";
import enCampaigns from "./locales/en/campaigns.json";
import enMailboxes from "./locales/en/mailboxes.json";
import enContacts from "./locales/en/contacts.json";
import enCrm from "./locales/en/crm.json";
import enUnibox from "./locales/en/unibox.json";
import enSettings from "./locales/en/settings.json";

import heCommon from "./locales/he/common.json";
import heNav from "./locales/he/nav.json";
import heAuth from "./locales/he/auth.json";
import heCampaigns from "./locales/he/campaigns.json";
import heMailboxes from "./locales/he/mailboxes.json";
import heContacts from "./locales/he/contacts.json";
import heCrm from "./locales/he/crm.json";
import heUnibox from "./locales/he/unibox.json";
import heSettings from "./locales/he/settings.json";

export const RTL_LANGUAGES = ["he", "ar", "fa", "ur"];

export function isRTL(locale?: string): boolean {
    const lang = (locale || i18n.language || "en").toLowerCase().split("-")[0];
    return RTL_LANGUAGES.includes(lang);
}

export function syncDocumentDirection(lang?: string) {
    const activeLang = lang || i18n.language || "en";
    const rtl = isRTL(activeLang);
    document.documentElement.lang = activeLang;
    document.documentElement.dir = rtl ? "rtl" : "ltr";
    if (rtl) {
        document.documentElement.classList.add("rtl");
    } else {
        document.documentElement.classList.remove("rtl");
    }
}

export const resources = {
    en: {
        common: enCommon,
        nav: enNav,
        auth: enAuth,
        campaigns: enCampaigns,
        mailboxes: enMailboxes,
        contacts: enContacts,
        crm: enCrm,
        unibox: enUnibox,
        settings: enSettings,
    },
    he: {
        common: heCommon,
        nav: heNav,
        auth: heAuth,
        campaigns: heCampaigns,
        mailboxes: heMailboxes,
        contacts: heContacts,
        crm: heCrm,
        unibox: heUnibox,
        settings: heSettings,
    },
} as const;

export type LocaleNamespace = keyof (typeof resources)["en"];

// Default strictly to Hebrew ("he")
if (typeof window !== "undefined") {
    localStorage.setItem("warmbly_locale", "he");
}

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: "he",
        fallbackLng: "he",
        defaultNS: "common",
        ns: ["common", "nav", "auth", "campaigns", "mailboxes", "contacts", "crm", "unibox", "settings"],
        interpolation: {
            escapeValue: false, // React already escapes values
        },
    });

// Sync initial HTML direction on module load
if (typeof document !== "undefined") {
    syncDocumentDirection("he");
}

export async function changeAppLanguage(lang: string): Promise<void> {
    await i18n.changeLanguage(lang);
    localStorage.setItem("warmbly_locale", lang);
    syncDocumentDirection(lang);
}

export default i18n;
