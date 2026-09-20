// Issue a fresh set of recovery codes. Proves possession with a current code
// first; the old codes stop working the moment the new ones are shown.

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import { CheckIcon, KeyRoundIcon } from "lucide-react";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import { useTwoFactorRegenerateRecoveryCodes } from "@/lib/api/hooks/auth/useTwoFactor";
import DialogShell, { PrimaryButton, SecondaryButton } from "./DialogShell";
import CodeEntry from "./CodeEntry";
import RecoveryCodesPanel from "./RecoveryCodesPanel";

export default function RegenerateDialog({
    account,
    remaining,
    onClose,
}: {
    account: string;
    remaining: number;
    onClose: () => void;
}) {
    const regenerate = useTwoFactorRegenerateRecoveryCodes();
    const [codes, setCodes] = React.useState<string[] | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [saved, setSaved] = React.useState(false);

    const submit = async (code: string) => {
        setError(null);
        try {
            const res = await regenerate.mutateAsync(code);
            setCodes(res.recovery_codes);
        } catch (e) {
            const err = e as AppError;
            setError(err.code === "two_fa_invalid_code" ? "קוד האימות אינו תואם. נסה שוב." : buildError(err));
        }
    };

    const locked = codes !== null;

    return (
        <DialogShell
            title={locked ? "קודי השחזור החדשים שלך" : "הפקת קודי שחזור חדשים"}
            icon={<KeyRoundIcon className="w-3 h-3 text-sky-600" />}
            onClose={locked ? undefined : onClose}
            footer={
                locked ? (
                    <div className="w-full flex items-center justify-end">
                        <PrimaryButton
                            disabled={!saved}
                            onClick={() => {
                                toast.success("קודי השחזור הוחלפו בהצלחה");
                                onClose();
                            }}
                        >
                            <CheckIcon className="w-3.5 h-3.5" /> סיום
                        </PrimaryButton>
                    </div>
                ) : (
                    <div className="w-full flex items-center justify-start">
                        <SecondaryButton onClick={onClose} disabled={regenerate.isPending}>
                            ביטול
                        </SecondaryButton>
                    </div>
                )
            }
        >
            <AnimatePresence mode="wait" initial={false}>
                {locked ? (
                    <motion.div
                        key="codes"
                        initial={{ x: -28, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 28, opacity: 0 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        className="px-5 py-5 space-y-3 text-right"
                    >
                        <p className="text-[12px] text-slate-500 leading-relaxed">
                            הקודים הקודמים שלך אינם תקפים עוד. החלף כל עותק ששמרת בעותק חדש זה.
                        </p>
                        <RecoveryCodesPanel codes={codes} account={account} saved={saved} onSavedChange={setSaved} />
                    </motion.div>
                ) : (
                    <motion.div
                        key="verify"
                        initial={{ x: -28, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 28, opacity: 0 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        className="px-5 py-5 space-y-4 text-right"
                    >
                        <p className="text-[12px] text-slate-500 leading-relaxed">
                            {remaining === 0
                                ? "לא נותרו לך קודי שחזור כלל. "
                                : `נותרו לך ${remaining} ${remaining === 1 ? "קוד" : "קודים"} שלא נוצלו. `}
                            הפקת סדרה חדשה תבטל מיידית את כל הקודים הקיימים. אשר תחילה באמצעות אפליקציית האימות.
                        </p>
                        <CodeEntry onSubmit={submit} pending={regenerate.isPending} error={error} allowRecovery />
                    </motion.div>
                )}
            </AnimatePresence>
        </DialogShell>
    );
}
