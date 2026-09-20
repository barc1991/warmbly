// Turning 2FA off needs proof of possession (a current authenticator or
// recovery code) and an explicit button: no auto-submit on the sixth digit.

import React from "react";
import toast from "react-hot-toast";
import { Loader2Icon, ShieldOffIcon, TriangleAlertIcon } from "lucide-react";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import { useTwoFactorDisable } from "@/lib/api/hooks/auth/useTwoFactor";
import DialogShell, { SecondaryButton } from "./DialogShell";
import CodeEntry from "./CodeEntry";

export default function DisableDialog({ onClose }: { onClose: () => void }) {
    const disable = useTwoFactorDisable();
    const [code, setCode] = React.useState("");
    const [error, setError] = React.useState<string | null>(null);

    const ready = code.length === 6 || code.includes("-");

    const submit = async (c: string) => {
        if (disable.isPending) return;
        setError(null);
        try {
            await disable.mutateAsync(c.trim());
            toast.success("אימות דו-שלבי כובה בהצלחה");
            onClose();
        } catch (e) {
            const err = e as AppError;
            setError(err.code === "two_fa_invalid_code" ? "קוד האימות אינו תואם. נסה שוב." : buildError(err));
        }
    };

    return (
        <DialogShell
            title="כיבוי אימות דו-שלבי"
            icon={<ShieldOffIcon className="w-3 h-3 text-rose-600" />}
            onClose={onClose}
            footer={
                <div className="w-full flex items-center justify-between">
                    <SecondaryButton onClick={onClose} disabled={disable.isPending}>
                        השאר פעיל
                    </SecondaryButton>
                    <button
                        type="button"
                        onClick={() => submit(code)}
                        disabled={!ready || disable.isPending}
                        className="h-8 px-3 rounded-md bg-rose-600 text-white text-[12.5px] font-medium hover:bg-rose-700 transition-colors inline-flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {disable.isPending && <Loader2Icon className="w-3.5 h-3.5 animate-spin" />}
                        כבה אימות
                    </button>
                </div>
            }
        >
            <div className="px-5 py-5 space-y-4 text-right">
                <div className="flex gap-2.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
                    <TriangleAlertIcon className="w-4 h-4 text-amber-600 shrink-0 mt-px" />
                    <p className="text-[12px] text-amber-900 leading-relaxed">
                        חשבונך יהיה מוגן באמצעות סיסמה וקוד הנשלח בדוא״ל בלבד. קודי השחזור הקיימים יפסיקו לפעול,
                        והפעלה מחדש של 2FA תייצר מפתח חדש.
                    </p>
                </div>
                <p className="text-[12px] text-slate-500">
                    אשר באמצעות קוד עדכני מאפליקציית האימות או קוד שחזור:
                </p>
                <CodeEntry
                    onSubmit={submit}
                    pending={disable.isPending}
                    error={error}
                    allowRecovery
                    autoSubmit={false}
                    onChange={setCode}
                />
            </div>
        </DialogShell>
    );
}
