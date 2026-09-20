// The 2FA setup wizard: scan a QR code (or type the key), verify one code from
// the app, then save the recovery codes. The same shape GitHub, Stripe and
// Vercel use, so nobody has to learn it.

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";
import {
    ArrowRightIcon,
    CheckIcon,
    ChevronDownIcon,
    CopyIcon,
    KeyRoundIcon,
    Loader2Icon,
    QrCodeIcon,
    ShieldCheckIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import { useTwoFactorEnrollStart, useTwoFactorEnrollConfirm } from "@/lib/api/hooks/auth/useTwoFactor";
import type { TwoFactorEnrollStart } from "@/lib/api/client/auth/twoFactor";
import DialogShell, { PrimaryButton, SecondaryButton } from "./DialogShell";
import CodeEntry from "./CodeEntry";
import RecoveryCodesPanel from "./RecoveryCodesPanel";

const STEPS = [
    { key: "scan", label: "סריקה" },
    { key: "verify", label: "אימות" },
    { key: "codes", label: "שמירת קודים" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

const paneVariants = {
    enter: (dir: 1 | -1) => ({ x: dir * -28, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: 1 | -1) => ({ x: dir * 28, opacity: 0 }),
};

const APPS = ["Google Authenticator", "Microsoft Authenticator", "1Password", "Authy", "Bitwarden"];

export default function EnrollDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
    const start = useTwoFactorEnrollStart();
    const confirm = useTwoFactorEnrollConfirm();

    const [step, setStep] = React.useState<StepKey>("scan");
    const [direction, setDirection] = React.useState<1 | -1>(1);
    const [info, setInfo] = React.useState<TwoFactorEnrollStart | null>(null);
    const [codeError, setCodeError] = React.useState<string | null>(null);
    const [codes, setCodes] = React.useState<string[]>([]);
    const [saved, setSaved] = React.useState(false);
    const started = React.useRef(false);

    React.useEffect(() => {
        if (started.current) return;
        started.current = true;
        start
            .mutateAsync()
            .then(setInfo)
            .catch((e) => {
                toast.error(buildError(e as AppError));
                onClose();
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const goTo = (next: StepKey) => {
        const from = STEPS.findIndex((s) => s.key === step);
        const to = STEPS.findIndex((s) => s.key === next);
        setDirection(to > from ? 1 : -1);
        setStep(next);
    };

    const submitCode = async (code: string) => {
        setCodeError(null);
        try {
            const res = await confirm.mutateAsync(code);
            setCodes(res.recovery_codes);
            goTo("codes");
        } catch (e) {
            const err = e as AppError;
            setCodeError(
                err.code === "two_fa_invalid_code"
                    ? "קוד האימות אינו תואם. המתן לקוד חדש ונסה שוב."
                    : buildError(err),
            );
        }
    };

    const locked = step === "codes";
    const stepIndex = STEPS.findIndex((s) => s.key === step);

    return (
        <DialogShell
            title="הגדרת אימות דו-שלבי (2FA)"
            icon={<ShieldCheckIcon className="w-3 h-3 text-sky-600" />}
            onClose={locked ? undefined : onClose}
            width="md"
            footer={
                step === "scan" ? (
                    <div className="w-full flex items-center justify-between">
                        <SecondaryButton onClick={onClose}>ביטול</SecondaryButton>
                        <PrimaryButton disabled={!info} onClick={() => goTo("verify")}>
                            המשך
                        </PrimaryButton>
                    </div>
                ) : step === "verify" ? (
                    <div className="w-full flex items-center justify-between">
                        <SecondaryButton onClick={() => goTo("scan")} disabled={confirm.isPending}>
                            <ArrowRightIcon className="w-3.5 h-3.5" /> חזרה
                        </SecondaryButton>
                        <span className="text-[11.5px] text-slate-400">מאמת אוטומטית בהזנת 6 ספרות</span>
                    </div>
                ) : (
                    <div className="w-full flex items-center justify-end">
                        <PrimaryButton
                            disabled={!saved}
                            onClick={() => {
                                toast.success("אימות דו-שלבי הופעל בהצלחה");
                                onDone();
                            }}
                        >
                            <CheckIcon className="w-3.5 h-3.5" /> סיום
                        </PrimaryButton>
                    </div>
                )
            }
        >
            <Stepper step={stepIndex} />
            <AnimatePresence mode="wait" initial={false} custom={direction}>
                <motion.div
                    key={step}
                    custom={direction}
                    variants={paneVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className="px-5 py-5"
                >
                    {step === "scan" && <ScanStep info={info} />}
                    {step === "verify" && (
                        <VerifyStep onSubmit={submitCode} pending={confirm.isPending} error={codeError} />
                    )}
                    {step === "codes" && (
                        <div className="space-y-3 text-right">
                            <div>
                                <p className="text-[13px] font-medium text-slate-900">שמור את קודי השחזור שלך</p>
                                <p className="text-[12px] text-slate-500 leading-relaxed mt-0.5">
                                    אימות דו-שלבי הופעל. אם תאבד גישה לטלפון שלך, אחד מהקודים הללו יאפשר לך להתחבר.
                                    כל קוד תקף לפעם אחת בלבד.
                                </p>
                            </div>
                            <RecoveryCodesPanel
                                codes={codes}
                                account={info?.account ?? ""}
                                saved={saved}
                                onSavedChange={setSaved}
                            />
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </DialogShell>
    );
}

function Stepper({ step }: { step: number }) {
    return (
        <div className="px-5 h-11 border-b border-slate-100 flex items-center shrink-0 bg-slate-50/40">
            {STEPS.map((s, i) => {
                const active = i === step;
                const done = i < step;
                return (
                    <React.Fragment key={s.key}>
                        <div className="flex items-center gap-2 shrink-0">
                            <div
                                className={cn(
                                    "size-5 rounded-full text-[11px] font-medium flex items-center justify-center transition-colors",
                                    done
                                        ? "bg-sky-600 text-white"
                                        : active
                                          ? "bg-sky-50 text-sky-700 ring-1 ring-sky-300 font-semibold"
                                          : "bg-slate-100 text-slate-400",
                                )}
                            >
                                {done ? <CheckIcon className="w-3 h-3" /> : i + 1}
                            </div>
                            <span
                                className={cn(
                                    "text-[12px] font-medium whitespace-nowrap",
                                    active ? "text-slate-900" : "text-slate-400",
                                )}
                            >
                                {s.label}
                            </span>
                        </div>
                        {i < STEPS.length - 1 && (
                            <div className={cn("h-px flex-1 min-w-4 mx-2", i < step ? "bg-sky-600/60" : "bg-slate-200")} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

function ScanStep({ info }: { info: TwoFactorEnrollStart | null }) {
    const [manual, setManual] = React.useState(false);
    return (
        <div className="space-y-4 text-right">
            <div className="flex flex-col sm:flex-row gap-5">
                <div className="shrink-0 self-center sm:self-start">
                    <div className="rounded-lg border border-slate-200 bg-white p-2.5 size-[188px] flex items-center justify-center">
                        {info ? (
                            <QRCodeSVG
                                value={info.otpauth_uri}
                                size={164}
                                level="M"
                                marginSize={0}
                                fgColor="#0f172a"
                                bgColor="#ffffff"
                                title={`סרוק להוספת ${info.issuer} לאפליקציית האימות`}
                            />
                        ) : (
                            <div className="flex flex-col items-center gap-2 text-[12px] text-slate-400">
                                <Loader2Icon className="w-4 h-4 animate-spin" />
                                מייצר קוד QR…
                            </div>
                        )}
                    </div>
                </div>
                <ol className="flex-1 min-w-0 space-y-3">
                    <Instruction n={1} title="התקן אפליקציית אימות">
                        כל אפליקציית TOTP סטנדרטית מתאימה:
                        <span className="mt-1.5 flex flex-wrap gap-1">
                            {APPS.map((a) => (
                                <span key={a} className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-[10.5px] text-slate-600">
                                    {a}
                                </span>
                            ))}
                        </span>
                    </Instruction>
                    <Instruction n={2} title="סרוק את קוד ה-QR">
                        באפליקציה, הוסף חשבון חדש וכוון את המצלמה אל הקוד שמופיע כאן.
                    </Instruction>
                    <Instruction n={3} title="הזן את הקוד בן 6 הספרות">
                        לחץ על המשך והקלד את הקוד הזמני שמופיע באפליקציה עבור Warmbly.
                    </Instruction>
                </ol>
            </div>

            <div className="rounded-md border border-slate-200">
                <button
                    type="button"
                    onClick={() => setManual((v) => !v)}
                    aria-expanded={manual}
                    className="w-full h-9 px-3 flex items-center justify-between text-[12px] text-slate-700 hover:bg-slate-50 transition-colors rounded-md"
                >
                    <div className="flex items-center gap-2">
                        <KeyRoundIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span>לא מצליח לסרוק? הזן את המפתח ידנית</span>
                    </div>
                    <ChevronDownIcon className={cn("w-3.5 h-3.5 text-slate-400 transition-transform", manual && "rotate-180")} />
                </button>
                <AnimatePresence initial={false}>
                    {manual && info && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.16 }}
                            className="overflow-hidden"
                        >
                            <div className="px-3 pb-3 pt-1 space-y-2.5 border-t border-slate-100">
                                <SecretField secret={info.secret} />
                                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[11.5px]">
                                    <Detail label="חשבון" value={info.account} />
                                    <Detail label="מנפיק" value={info.issuer} />
                                    <Detail label="סוג" value="מבוסס זמן (TOTP)" />
                                    <Detail label="ספרות" value={String(info.digits)} />
                                    <Detail label="מרווח" value={`${info.period} שניות`} />
                                    <Detail label="אלגוריתם" value={info.algorithm} />
                                </dl>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

function Instruction({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
    return (
        <li className="flex gap-2.5">
            <span className="size-5 shrink-0 rounded-full bg-slate-100 text-slate-600 text-[10.5px] font-semibold inline-flex items-center justify-center tabular-nums">
                {n}
            </span>
            <div className="min-w-0">
                <div className="text-[12.5px] font-medium text-slate-900 leading-5">{title}</div>
                <div className="text-[11.5px] text-slate-500 leading-relaxed">{children}</div>
            </div>
        </li>
    );
}

function Detail({ label, value }: { label: string; value: string }) {
    return (
        <>
            <dt className="text-slate-400">{label}:</dt>
            <dd className="text-slate-700 min-w-0 truncate" dir="ltr">{value}</dd>
        </>
    );
}

function SecretField({ secret }: { secret: string }) {
    const [copied, setCopied] = React.useState(false);
    const grouped = secret.match(/.{1,4}/g)?.join(" ") ?? secret;
    return (
        <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 mb-1">מפתח הגדרה</div>
            <button
                type="button"
                onClick={async () => {
                    try {
                        await navigator.clipboard.writeText(secret);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1600);
                    } catch {
                        toast.error("לא ניתן להעתיק. סמן את המפתח והעתק אותו ידנית.");
                    }
                }}
                className="w-full flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 font-mono text-[12.5px] tracking-wider text-slate-800 hover:border-slate-300 transition-colors"
                title="העתק מפתח הגדרה"
            >
                <span className="min-w-0 flex-1 text-left break-all" dir="ltr">
                    {grouped}
                </span>
                {copied ? (
                    <CheckIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                ) : (
                    <CopyIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
            </button>
        </div>
    );
}

function VerifyStep({
    onSubmit,
    pending,
    error,
}: {
    onSubmit: (code: string) => void;
    pending: boolean;
    error: string | null;
}) {
    return (
        <div className="max-w-[340px] mx-auto text-center space-y-4 py-2">
            <div className="mx-auto size-11 rounded-xl bg-sky-50 flex items-center justify-center">
                <QrCodeIcon className="w-5 h-5 text-sky-500" />
            </div>
            <div>
                <p className="text-[13px] font-medium text-slate-900">הזן את הקוד מאפליקציית האימות</p>
                <p className="text-[12px] text-slate-500 leading-relaxed mt-0.5">
                    פתח את אפליקציית האימות והקלד את הקוד בן 6 הספרות שמוצג עבור Warmbly. הקוד מתחלף כל 30 שניות.
                </p>
            </div>
            <CodeEntry onSubmit={onSubmit} pending={pending} error={error} />
        </div>
    );
}
