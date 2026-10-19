// Settings: the API key the connection acts with, and what it is allowed to do.

import React from "react";
import { KeyRoundIcon, Loader2Icon } from "lucide-react";
import toast from "react-hot-toast/headless";
import { useTranslation } from "react-i18next";

import { FieldError, Label, TextInput } from "@/components/ui/field";
import { useReplaceApolloKey } from "@/lib/api/hooks/app/integrations/useApollo";
import type { ApolloOverview } from "@/lib/api/models/app/integrations/Apollo";

import { CardRow, SettingsCard, primaryBtn } from "../../salesforce/_components/shared";
import { errMsg } from "../../salesforce/_components/util";

export default function KeyTab({ connectionId, overview }: { connectionId: string; overview?: ApolloOverview }) {
    const { i18n } = useTranslation();
    const isHe = i18n.language === "he";

    const replace = useReplaceApolloKey(connectionId);
    const [key, setKey] = React.useState("");
    const [error, setError] = React.useState<string | null>(null);

    async function save(e: React.FormEvent) {
        e.preventDefault();
        if (!key.trim()) {
            setError(isHe ? "הדבק את מפתח ה-API החדש." : "Paste the new API key.");
            return;
        }
        setError(null);
        try {
            await replace.mutateAsync({ connectionId, apiKey: key.trim() });
            setKey("");
            toast.success(isHe ? "מפתח ה-API של Apollo עודכן בהצלחה" : "Apollo API key replaced");
        } catch (err) {
            setError(errMsg(err, isHe ? "לא ניתן לאמת את המפתח" : "Could not check the key"));
        }
    }

    return (
        <div className="space-y-6 max-w-3xl text-start rtl:text-right ltr:text-left">
            <SettingsCard
                title={isHe ? "מפתח API" : "API key"}
                description={
                    isHe
                        ? "Warmbly מתקשר עם Apollo באמצעות המפתח שלך. המפתח מוצפן ומאובטח ואינו מוצג שוב לעולם."
                        : "Warmbly calls Apollo with your own key, so imports and enrichment use your Apollo plan and credits. The key is encrypted and never shown again."
                }
            >
                <CardRow>
                    <div className="flex items-center gap-2 text-[12px] text-slate-600">
                        <KeyRoundIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {overview?.account_name || overview?.account_email ? (
                            <span>
                                {isHe ? "פועל בשם " : "Acting as "}
                                <span className="font-medium text-slate-900">{overview.account_name || overview.account_email}</span>
                                {overview.account_name && overview.account_email ? ` (${overview.account_email})` : ""}
                            </span>
                        ) : (
                            <span>{isHe ? "שמור מפתח API עבור חיבור זה." : "A key is saved for this connection."}</span>
                        )}
                    </div>
                </CardRow>
                <CardRow>
                    <form onSubmit={save} className="space-y-2 max-w-md">
                        <Label>{isHe ? "החלף את המפתח" : "Replace the key"}</Label>
                        <TextInput
                            value={key}
                            onChange={(v) => {
                                setKey(v);
                                setError(null);
                            }}
                            type="password"
                            placeholder={isHe ? "מפתח API חדש של Apollo" : "New Apollo API key"}
                            autoComplete="off"
                            className="w-full font-mono text-start rtl:text-left ltr:text-left"
                            dir="ltr"
                        />
                        <FieldError message={error} />
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                            {isHe
                                ? "ניתן להפיק מפתחות ב-Apollo תחת הגדרות > אינטגרציות > API. מפתח מאסטר או מפתח מוגבל עם הרשאות לרשימות, חיפוש אנשי קשר והעשרה."
                                : "Create keys in Apollo under Settings, Integrations, API. A master key works; a restricted key needs lists, contact search and people enrichment."}
                        </p>
                        <button type="submit" disabled={replace.isPending} className={primaryBtn}>
                            {replace.isPending && <Loader2Icon className="w-3.5 h-3.5 animate-spin" />}
                            {replace.isPending
                                ? (isHe ? "בודק..." : "Checking…")
                                : (isHe ? "בדוק ושמור" : "Check and save")}
                        </button>
                    </form>
                </CardRow>
            </SettingsCard>
        </div>
    );
}
