// Modal that surfaces the per-org inbound webhook URL exactly once after
// a Calendly/Cal.com/DMARC connection is created. The secret is embedded
// in the URL path — if the user closes without copying, they must
// rotate the secret to get it again.

"use client";

import React from "react";
import { CheckIcon, CopyIcon, XIcon } from "lucide-react";
import toast from "react-hot-toast";

import type { IntegrationProvider } from "@/lib/api/models/app/integrations/Integration";

import { useTranslation } from "react-i18next";

const PROVIDER_NAMES: Partial<Record<IntegrationProvider, string>> = {
    calendly: "Calendly",
    cal_com: "Cal.com",
};

const HINTS: Partial<Record<IntegrationProvider, string>> = {
    calendly: "Paste this in Calendly under Account, Integrations, Webhooks, Create Webhook. Subscribe to invitee.created.",
    cal_com: "Paste this in Cal.com under Settings, Developer, Webhooks. Subscribe to BOOKING_CREATED.",
};

const HINTS_HE: Partial<Record<IntegrationProvider, string>> = {
    calendly: "הדבק כתובת זו ב-Calendly תחת חשבון, אינטגרציות, Webhooks, יצירת Webhook. הירשם לאירוע invitee.created.",
    cal_com: "הדבק כתובת זו ב-Cal.com תחת הגדרות, מפתחים, Webhooks. הירשם לאירוע BOOKING_CREATED.",
};

export default function InboundUrlDialog({
    provider,
    url,
    onClose,
}: {
    provider: IntegrationProvider;
    url: string;
    onClose: () => void;
}) {
    const { i18n } = useTranslation();
    const isHe = i18n.language === "he";
    const [copied, setCopied] = React.useState(false);

    const fullUrl = url.startsWith("http")
        ? url
        : `${window.location.origin}${url}`;

    function copy() {
        navigator.clipboard.writeText(fullUrl).then(
            () => {
                setCopied(true);
                toast.success(isHe ? "הועתק ללוח" : "Copied to clipboard");
                setTimeout(() => setCopied(false), 1500);
            },
            () => toast.error(isHe ? "ההעתקה נכשלה" : "Failed to copy"),
        );
    }

    const hints = isHe ? HINTS_HE : HINTS;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <button
                type="button"
                aria-label={isHe ? "סגור" : "Close"}
                onClick={onClose}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            />
            <div className="relative z-10 w-[520px] max-w-[92vw] max-h-[90dvh] flex flex-col bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden">
                <div className="h-12 px-5 border-b border-slate-200 flex items-center gap-3 shrink-0">
                    <div className="text-[10px] uppercase tracking-normal text-slate-400 font-medium">
                        {isHe ? "כתובת Webhook" : "Webhook URL"}
                    </div>
                    <div className="h-4 w-px bg-slate-200" />
                    <div className="text-[12.5px] text-slate-900 font-medium truncate flex-1">
                        {PROVIDER_NAMES[provider] ?? provider}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={isHe ? "סגור" : "Close"}
                        className="h-7 w-7 rounded border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-900 inline-flex items-center justify-center transition-colors"
                    >
                        <XIcon className="w-3.5 h-3.5" />
                    </button>
                </div>

                <div className="px-5 py-5 space-y-4 overflow-y-auto flex-1">
                    <p className="text-[12.5px] text-slate-600 leading-relaxed">
                        {hints[provider] ?? (isHe ? "הדבק כתובת URL זו בהגדרות ה-Webhook של הספק." : "Paste this URL in the provider's webhook configuration.")}
                    </p>

                    <div className="rounded border border-slate-200 bg-slate-50 p-2.5 flex items-center gap-2">
                        <code className="flex-1 font-mono text-[11.5px] text-slate-800 break-all">{fullUrl}</code>
                        <button
                            type="button"
                            onClick={copy}
                            className="h-7 px-2 rounded border border-slate-200 bg-white hover:border-slate-300 text-slate-700 inline-flex items-center gap-1 text-[11px] font-medium transition-colors"
                        >
                            {copied ? <CheckIcon className="w-3 h-3 text-emerald-600" /> : <CopyIcon className="w-3 h-3" />}
                            {copied ? (isHe ? "הועתק" : "Copied") : (isHe ? "העתק" : "Copy")}
                        </button>
                    </div>

                    <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2.5">
                        <p className="text-[11.5px] text-amber-900 leading-relaxed">
                            {isHe
                                ? "כתובת URL זו כוללת מפתח סודי שמוצג פעם אחת בלבד. אם תאבד אותו, בצע רענון של החיבור כדי להנפיק חדש — הכתובת הישנה תפסיק לפעול באופן מיידי."
                                : "This URL contains a secret that is only shown once. If you lose it, rotate the connection to mint a new one — the old URL will stop working immediately."}
                        </p>
                    </div>
                </div>

                <div className="border-t border-slate-200 px-5 py-3 flex items-center justify-end gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-7 px-3 rounded bg-slate-900 text-white text-[12px] font-medium hover:bg-slate-800 transition-colors"
                    >
                        {isHe ? "סיום" : "Done"}
                    </button>
                </div>
            </div>
        </div>
    );
}
