import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { TurnstileModal } from "@/components/captcha/TurnstileModal";
import AuthButton from "@/components/auth/button";
import { useResetPasswordConfirmForm } from "../../hooks/useResetPasswordConfirmForm";
import { AlertTriangle } from "lucide-react";

const INPUT = "w-full h-11 rounded-lg border border-slate-200 bg-white px-4 text-[15px] text-slate-900 placeholder:text-slate-400 outline-none transition-colors duration-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-400/15";

const strengthConfig = [
    { label: "חלשה", color: "bg-red-400", width: "25%" },
    { label: "חלשה", color: "bg-red-400", width: "25%" },
    { label: "בינונית", color: "bg-amber-400", width: "50%" },
    { label: "טובה", color: "bg-sky-400", width: "75%" },
    { label: "חזקה", color: "bg-emerald-400", width: "100%" },
] as const;

export default function ResetPasswordConfirmPage() {
    const { isValidToken, password, setPassword, password2, setPassword2, strength, captcha, pending, onSubmit, onToken } = useResetPasswordConfirmForm();

    if (!isValidToken) {
        return (
            <div className="space-y-5 text-center py-4">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center">
                    <AlertTriangle className="w-7 h-7 text-rose-500" />
                </div>
                <div>
                    <h2 className="text-[24px] font-bold text-slate-900 tracking-tight">הקישור פג תוקף</h2>
                    <p className="text-sm text-slate-400 mt-1.5">קישור איפוס סיסמה זה אינו תקף יותר.</p>
                </div>
                <Link
                    to="/auth/reset-password"
                    className="inline-block text-sm text-sky-500 font-medium hover:text-sky-600 transition-colors pt-2"
                >
                    בקש קישור חדש
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="text-center">
                <h1 className="text-[28px] font-bold text-slate-900 tracking-tight leading-tight">סיסמה חדשה</h1>
                <p className="text-sm text-slate-400 mt-1.5">בחר סיסמה חזקה ומאובטחת עבור החשבון שלך</p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-600 pr-0.5 pl-0">סיסמה חדשה</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="הזן סיסמה חדשה" required autoComplete="new-password" className={INPUT} />
                    {password && (() => {
                        const cfg = strengthConfig[strength.score];
                        return (
                            <div className="space-y-1 mt-1.5">
                                <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <motion.div
                                        className={`h-full rounded-full ${cfg.color}`}
                                        initial={{ width: 0 }}
                                        animate={{ width: cfg.width }}
                                        transition={{ duration: 0.35, ease: "easeOut" }}
                                    />
                                </div>
                                <p className="text-xs text-slate-400">סיסמה {cfg.label}</p>
                                {strength.warning && <p className="text-xs text-rose-500">{strength.warning}</p>}
                            </div>
                        );
                    })()}
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-600 pr-0.5 pl-0">אימות סיסמה</label>
                    <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="הזן שוב את הסיסמה החדשה" required autoComplete="new-password" className={INPUT} />
                </div>

                <div className="pt-1">
                    <AuthButton loading={pending}>אפס סיסמה</AuthButton>
                </div>

                <TurnstileModal visible={captcha} onToken={onToken} />
            </form>

            <p className="text-center text-sm text-slate-400 pt-1">
                זוכר את הסיסמה?{" "}
                <Link to="/auth/login" className="text-sky-500 font-medium hover:text-sky-600 transition-colors">התחבר כאן</Link>
            </p>
        </div>
    );
}
