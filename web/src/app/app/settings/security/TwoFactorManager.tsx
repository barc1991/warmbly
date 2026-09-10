// Two-factor (TOTP) enrollment + management. The enroll wizard: show the secret
// (manual entry into an authenticator app) -> verify a code -> show recovery
// codes once. Disable requires a current code.

import React from "react";
import toast from "react-hot-toast";
import { CheckIcon, CopyIcon, Loader2Icon, ShieldCheckIcon, XIcon } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import {
    useTwoFactorStatus,
    useTwoFactorEnrollStart,
    useTwoFactorEnrollConfirm,
    useTwoFactorDisable,
} from "@/lib/api/hooks/auth/useTwoFactor";
import type { TwoFactorEnrollStart } from "@/lib/api/client/auth/twoFactor";
import { Row, Section } from "../_components/SectionShell";

type WizardStep = "secret" | "confirm" | "recovery";

export default function TwoFactorManager() {
    const { data: status } = useTwoFactorStatus();
    const enabled = !!status?.enabled;

    const [enrolling, setEnrolling] = React.useState(false);
    const [disabling, setDisabling] = React.useState(false);

    return (
        <Section eyebrow="אימות" description="כיצד אתה מוכיח את זהותך בעת התחברות.">
            <Row
                label="אימות דו-שלבי (2FA)"
                description="הוסף קוד חד-פעמי מאפליקציית אימות לכל התחברות לחשבון."
            >
                {enabled ? (
                    <span className="inline-flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                            <ShieldCheckIcon className="w-3.5 h-3.5" /> מופעל
                        </span>
                        <button
                            type="button"
                            onClick={() => setDisabling(true)}
                            className="h-7 px-2.5 rounded-md border border-slate-200 text-[12px] text-slate-700 hover:border-rose-300 hover:text-rose-600 transition-colors cursor-pointer"
                        >
                            השבת
                        </button>
                    </span>
                ) : (
                    <button
                        type="button"
                        onClick={() => setEnrolling(true)}
                        className="h-7 px-2.5 rounded-md bg-sky-600 text-white text-[12px] font-medium hover:bg-sky-700 transition-colors cursor-pointer"
                    >
                        הפעל 2FA
                    </button>
                )}
            </Row>

            {enrolling && <EnrollWizard onClose={() => setEnrolling(false)} />}
            {disabling && <DisableDialog onClose={() => setDisabling(false)} />}
        </Section>
    );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onMouseDown={onClose}>
            <div
                className="w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
                onMouseDown={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </div>
    );
}

function EnrollWizard({ onClose }: { onClose: () => void }) {
    const start = useTwoFactorEnrollStart();
    const confirm = useTwoFactorEnrollConfirm();
    const [step, setStep] = React.useState<WizardStep>("secret");
    const [info, setInfo] = React.useState<TwoFactorEnrollStart | null>(null);
    const [code, setCode] = React.useState("");
    const [codes, setCodes] = React.useState<string[]>([]);
    const [saved, setSaved] = React.useState(false);

    React.useEffect(() => {
        start
            .mutateAsync()
            .then(setInfo)
            .catch((e) => {
                toast.error(buildError(e as AppError));
                onClose();
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const submitCode = async (c: string) => {
        try {
            const res = await confirm.mutateAsync(c);
            setCodes(res.recovery_codes);
            setStep("recovery");
        } catch (e) {
            toast.error(buildError(e as AppError));
            setCode("");
        }
    };

    // The recovery codes are shown only once — don't allow closing that step
    // (backdrop or X) until the user confirms they've saved them.
    const canClose = step !== "recovery";

    return (
        <Overlay onClose={canClose ? onClose : () => {}}>
            <div className="h-11 px-4 flex items-center border-b border-slate-200">
                <span className="text-[13px] font-medium text-slate-900">הגדרת אימות דו-שלבי</span>
                {canClose && (
                    <button type="button" onClick={onClose} className="ms-auto h-7 w-7 rounded-md inline-flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer">
                        <XIcon className="w-4 h-4" />
                    </button>
                )}
            </div>
            <div className="p-4 space-y-4">
                {step === "secret" && (
                    <>
                        <p className="text-[12.5px] text-slate-500 leading-relaxed">
                            הוסף מפתח סודי זה לאפליקציית האימות שלך (Google Authenticator, 1Password, Authy וכו'), ולאחר מכן הזן את הקוד בן 6 הספרות שמוצג בה.
                        </p>
                        {info ? (
                            <CopyField label="מפתח סודי" value={info.secret} />
                        ) : (
                            <div className="flex items-center gap-2 text-[12px] text-slate-400">
                                <Loader2Icon className="w-4 h-4 animate-spin" /> יוצר מפתח…
                            </div>
                        )}
                        <button
                            type="button"
                            disabled={!info}
                            onClick={() => setStep("confirm")}
                            className="h-8 w-full rounded-md bg-sky-600 text-white text-[12.5px] font-medium hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
                        >
                            הוספתי לאפליקציה
                        </button>
                    </>
                )}

                {step === "confirm" && (
                    <>
                        <p className="text-[12.5px] text-slate-500">הזן את הקוד בן 6 הספרות מהאפליקציה שלך.</p>
                        <div className="flex justify-center" dir="ltr">
                            <InputOTP
                                maxLength={6}
                                value={code}
                                onChange={(v) => {
                                    setCode(v);
                                    if (v.length === 6 && !confirm.isPending) void submitCode(v);
                                }}
                                containerClassName="gap-2"
                            >
                                <InputOTPGroup className="gap-2">
                                    {[0, 1, 2, 3, 4, 5].map((i) => (
                                        <InputOTPSlot key={i} index={i} className="!w-10 !h-12 !rounded-lg !border-slate-200 text-base font-semibold !border" />
                                    ))}
                                </InputOTPGroup>
                            </InputOTP>
                        </div>
                        {confirm.isPending && (
                            <div className="flex items-center justify-center gap-2 text-[12px] text-slate-400">
                                <Loader2Icon className="w-4 h-4 animate-spin" /> מאמת…
                            </div>
                        )}
                    </>
                )}

                {step === "recovery" && (
                    <>
                        <p className="text-[12.5px] text-slate-600 font-medium">שמור את קודי השחזור שלך</p>
                        <p className="text-[11.5px] text-slate-500 leading-relaxed">
                            כל קוד ניתן לשימוש פעם אחת אם תאבד את מכשירך. קודים אלה לא יוצגו שוב לעולם.
                        </p>
                        <div className="grid grid-cols-2 gap-1.5 rounded-md border border-slate-200 bg-slate-50 p-2.5 font-mono text-[12px] text-slate-700" dir="ltr">
                            {codes.map((c) => (
                                <span key={c}>{c}</span>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() => navigator.clipboard?.writeText(codes.join("\n"))}
                            className="inline-flex items-center gap-1.5 text-[11.5px] text-sky-600 hover:text-sky-700 cursor-pointer"
                        >
                            <CopyIcon className="w-3 h-3" /> העתק הכל
                        </button>
                        <label className="flex items-center gap-2 text-[12px] text-slate-600 cursor-pointer">
                            <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
                            שמרתי את הקודים במקום בטוח
                        </label>
                        <button
                            type="button"
                            disabled={!saved}
                            onClick={() => {
                                toast.success("אימות דו-שלבי הופעל בהצלחה");
                                onClose();
                            }}
                            className="h-8 w-full rounded-md bg-slate-900 text-white text-[12.5px] font-medium hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                        >
                            סיום
                        </button>
                    </>
                )}
            </div>
        </Overlay>
    );
}

function DisableDialog({ onClose }: { onClose: () => void }) {
    const disable = useTwoFactorDisable();
    const [code, setCode] = React.useState("");

    const submit = async () => {
        try {
            await disable.mutateAsync(code.trim());
            toast.success("אימות דו-שלבי הושבת");
            onClose();
        } catch (e) {
            toast.error(buildError(e as AppError));
        }
    };

    return (
        <Overlay onClose={onClose}>
            <div className="h-11 px-4 flex items-center border-b border-slate-200">
                <span className="text-[13px] font-medium text-slate-900">השבתת אימות דו-שלבי</span>
                <button type="button" onClick={onClose} className="ms-auto h-7 w-7 rounded-md inline-flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer">
                    <XIcon className="w-4 h-4" />
                </button>
            </div>
            <div className="p-4 space-y-3">
                <p className="text-[12.5px] text-slate-500">הזן קוד אימות נוכחי או קוד שחזור כדי לאשר.</p>
                <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="123456 או קוד שחזור"
                    dir="ltr"
                    autoFocus
                    className="w-full h-9 px-3 rounded-md border border-slate-200 text-[13px] outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 text-start"
                />
                <button
                    type="button"
                    onClick={submit}
                    disabled={!code.trim() || disable.isPending}
                    className="h-8 w-full rounded-md bg-rose-600 text-white text-[12.5px] font-medium hover:bg-rose-700 inline-flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                    {disable.isPending && <Loader2Icon className="w-3.5 h-3.5 animate-spin" />}
                    השבת 2FA
                </button>
            </div>
        </Overlay>
    );
}

function CopyField({ label, value }: { label: string; value: string }) {
    const [copied, setCopied] = React.useState(false);
    return (
        <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 mb-1">{label}</div>
            <button
                type="button"
                onClick={() => {
                    navigator.clipboard?.writeText(value);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                }}
                className="w-full flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 font-mono text-[12px] text-slate-700 hover:border-slate-300"
            >
                <span className="min-w-0 flex-1 truncate text-start break-all" dir="ltr">{value}</span>
                {copied ? <CheckIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <CopyIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
            </button>
        </div>
    );
}
