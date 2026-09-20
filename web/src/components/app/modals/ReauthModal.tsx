// Global "confirm it is you" prompt in Hebrew & RTL.
//
// Some changes need a fresh proof of identity, not just a live session:
// minting an API key, registering or removing a passkey, handing a workspace
// to someone else, scheduling a deletion. The backend answers those with
// `reauth_required` until the session has re-authenticated in the last few
// minutes.

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldCheckIcon, XIcon } from "lucide-react";

import reauth from "@/lib/api/client/auth/reauth";

interface ReauthDetail {
    resolve: () => void;
    reject: () => void;
}

export default function ReauthModal() {
    const [pending, setPending] = React.useState<ReauthDetail | null>(null);
    const [password, setPassword] = React.useState("");
    const [code, setCode] = React.useState("");
    const [error, setError] = React.useState("");
    const [busy, setBusy] = React.useState(false);

    React.useEffect(() => {
        const handler = (e: Event) => {
            setPassword("");
            setCode("");
            setError("");
            setBusy(false);
            setPending((e as CustomEvent<ReauthDetail>).detail);
        };
        window.addEventListener("reauth-required", handler);
        return () => window.removeEventListener("reauth-required", handler);
    }, []);

    const cancel = React.useCallback(() => {
        pending?.reject();
        setPending(null);
    }, [pending]);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (busy || !pending) return;
        setBusy(true);
        setError("");
        try {
            await reauth({ password: password || undefined, code: code || undefined });
            pending.resolve();
            setPending(null);
        } catch (err) {
            const errCode = (err as { code?: string } | undefined)?.code;
            if (errCode === "reauth_no_factor") {
                setError(
                    (err as { message?: string }).message ??
                        "לחשבון זה אין עדיין אמצעי אימות להזדהות. הפעל אימות דו-שלבי תחת הגדרות > אבטחה.",
                );
            } else {
                setError("הפרטים שהוזנו אינם תואמים. נסה שוב.");
            }
            setBusy(false);
        }
    }

    return (
        <AnimatePresence>
            {pending && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    dir="rtl"
                    className="fixed inset-0 z-[75] bg-slate-900/30 flex items-center justify-center p-4"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) cancel();
                    }}
                >
                    <motion.form
                        initial={{ opacity: 0, scale: 0.97, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97, y: 8 }}
                        onSubmit={submit}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl text-right"
                    >
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sky-50">
                                <ShieldCheckIcon className="h-4 w-4 text-sky-700" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-[13.5px] font-medium text-slate-900">אשר שזה אתה</h2>
                                <p className="mt-1 text-[12.5px] text-slate-600">
                                    פעולה זו דורשת אימות מחדש של זהותך. הזן את הסיסמה שלך, או קוד מאפליקציית האימות.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={cancel}
                                aria-label="ביטול"
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <XIcon className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="mt-4 space-y-2.5">
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="סיסמה"
                                autoComplete="current-password"
                                autoFocus
                                className="h-9 w-full rounded-md border border-slate-200 px-2.5 text-[12.5px] outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 text-right"
                            />
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder="קוד אימות דו-שלבי או קוד שחזור"
                                inputMode="text"
                                autoComplete="one-time-code"
                                className="h-9 w-full rounded-md border border-slate-200 px-2.5 text-[12.5px] outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 text-right"
                            />
                        </div>

                        {error && <p className="mt-2 text-[12px] text-rose-600">{error}</p>}

                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={cancel}
                                className="h-8 rounded-md px-3 text-[12.5px] text-slate-600 hover:bg-slate-50"
                            >
                                ביטול
                            </button>
                            <button
                                type="submit"
                                disabled={busy || (!password && !code)}
                                className="h-8 rounded-md bg-sky-600 px-3 text-[12.5px] font-medium text-white disabled:opacity-50 hover:bg-sky-700 transition-colors"
                            >
                                {busy ? "בודק…" : "אישור"}
                            </button>
                        </div>
                    </motion.form>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
