// GmailAppPasswordPanel — the Gmail path of the connect modal.
//
// New Gmail and Google Workspace mailboxes connect with an app password over
// IMAP and SMTP. Full Hebrew & RTL support, 100% telemetry-free.

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    ArrowLeftIcon,
    ArrowRightIcon,
    CheckIcon,
    ExternalLinkIcon,
    KeyRoundIcon,
    Loader2Icon,
    ShieldCheckIcon,
    SparklesIcon,
} from "lucide-react";
import toast from "react-hot-toast";

import { TextInput } from "@/components/ui/field";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import addEmail from "@/lib/api/client/app/emails/addEmail";
import useAuthConfig from "@/lib/api/hooks/auth/useAuthConfig";
import { cn } from "@/lib/utils";

const EASE = [0.32, 0.72, 0, 1] as const;

/** Gmail's own servers. The same for personal accounts and Workspace. */
const GMAIL_SMTP = { host: "smtp.gmail.com", port: 465 } as const;
const GMAIL_IMAP = { host: "imap.gmail.com", port: 993 } as const;

/** Google shows an app password as four groups of four letters. */
const APP_PASSWORD_LENGTH = 16;

const STEPS = ["אימות דו-שלבי", "סיסמת אפליקציה", "חיבור תיבה"] as const;

function normalizeAppPassword(raw: string): string {
    return raw.replace(/\s+/g, "");
}

export default function GmailAppPasswordPanel({
    onDone,
    onError,
}: {
    onDone: () => void;
    onError: (e: unknown) => void;
}) {
    const [step, setStep] = React.useState(0);
    const [dir, setDir] = React.useState<1 | -1>(1);
    const gmailOAuth = useAuthConfig().config.gmail_oauth_connect === true;

    const go = (next: number) => {
        setDir(next > step ? 1 : -1);
        setStep(next);
    };

    return (
        <div className="flex flex-col min-h-0 text-right" dir="rtl">
            <div className="px-4 py-2 border-b border-slate-200/60 bg-sky-50/60 flex items-center gap-2 text-[11.5px] text-sky-800">
                <SparklesIcon className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span className="min-w-0 truncate">
                    {gmailOAuth
                        ? "סיסמת אפליקציה מחברת את אותה תיבת דואר בכשתי דקות, ללא צורך במסך הרשאות של Google."
                        : "התחברות באמצעות Google תהיה זמינה בקרוב. בינתיים, סיסמת אפליקציה מחברת את התיבה בכשתי דקות."}
                </span>
            </div>
            <Progress step={step} />
            <div className="relative overflow-hidden">
                <AnimatePresence mode="wait" initial={false} custom={dir}>
                    <motion.div
                        key={step}
                        custom={dir}
                        initial={{ opacity: 0, x: dir * -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: dir * 16 }}
                        transition={{ duration: 0.18, ease: EASE }}
                    >
                        {step === 0 && <TwoStepStep onNext={() => go(1)} />}
                        {step === 1 && <AppPasswordStep onBack={() => go(0)} onNext={() => go(2)} />}
                        {step === 2 && <ConnectStep onBack={() => go(1)} onDone={onDone} onError={onError} />}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

function Progress({ step }: { step: number }) {
    return (
        <div className="px-4 pt-3 pb-2 border-b border-slate-200/60">
            <div className="flex items-center gap-1.5">
                {STEPS.map((label, i) => (
                    <div key={label} className="flex-1 min-w-0">
                        <div
                            className={cn(
                                "h-1 rounded-full transition-colors",
                                i < step ? "bg-sky-600" : i === step ? "bg-sky-400" : "bg-slate-200",
                            )}
                        />
                        <div
                            className={cn(
                                "mt-1.5 text-[10px] uppercase tracking-[0.14em] font-medium truncate",
                                i === step ? "text-slate-900" : i < step ? "text-sky-700" : "text-slate-400",
                            )}
                        >
                            {label}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function TwoStepStep({ onNext }: { onNext: () => void }) {
    return (
        <StepFrame
            title="הפעל אימות דו-שלבי (2-Step Verification)"
            sub="Google מנפיקה סיסמאות אפליקציה רק לחשבונות שבהם מופעל אימות דו-שלבי."
            footer={
                <div className="w-full flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 min-w-0 truncate">מופעל כבר? פשוט המשך.</span>
                    <NextButton onClick={onNext}>זה מופעל, המשך</NextButton>
                </div>
            }
        >
            <ol className="space-y-2">
                <Step n={1}>
                    פתח את דף האבטחה של חשבון Google ומצא את <strong className="font-medium text-slate-900">אימות דו-שלבי</strong> תחת &quot;כיצד אתה נכנס ל-Google&quot;.
                </Step>
                <Step n={2}>
                    הפעל אותו באמצעות אישור בטלפון, אפליקציית אימות או קוד SMS. מפתח אבטחה לבדו אינו מספיק: Google דורשת שיטת אימות נוספת כדי לאפשר סיסמאות אפליקציה.
                </Step>
            </ol>
            <ExternalButton href="https://myaccount.google.com/security">פתח הגדרות אבטחה ב-Google</ExternalButton>
            <Note>
                ב-Google Workspace מנהל המערכת יכול לחייב או לחסום הגדרה זו בארגון. חשבון שרשום לתוכנית &quot;הגנה מתקדמת&quot; אינו יכול להשתמש בסיסמת אפליקציה כלל.
            </Note>
        </StepFrame>
    );
}

function AppPasswordStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
    return (
        <StepFrame
            title="צור סיסמת אפליקציה"
            sub="סיסמה בת 16 אותיות ש-Google מנפיקה עבור אפליקציה מסוימת. Warmbly שומרת אותה מוצפנת."
            footer={
                <div className="w-full flex items-center justify-between">
                    <BackButton onClick={onBack} />
                    <NextButton onClick={onNext}>העתקתי, המשך</NextButton>
                </div>
            }
        >
            <ol className="space-y-2">
                <Step n={1}>פתח את דף סיסמאות האפליקציה. Google עשויה לבקש ממך להיכנס שוב.</Step>
                <Step n={2}>
                    הקלד <strong className="font-medium text-slate-900">Warmbly</strong> כשם האפליקציה ולחץ על <strong className="font-medium text-slate-900">צור</strong>.
                </Step>
                <Step n={3}>
                    העתק את 16 התווים שמוצגים. Google מציגה אותם פעם אחת בלבד; אין חשיבות לרווחים שבין הקבוצות.
                </Step>
            </ol>
            <ExternalButton href="https://myaccount.google.com/apppasswords">פתח סיסמאות אפליקציה ב-Google</ExternalButton>
            <Note>
                הדף לא נמצא? ייתכן שאימות דו-שלבי עדיין כבוי, או שב-Workspace מנהל המערכת חסם גישה. אין צורך בהפעלת IMAP ידנית: Google ביטלה את ההגדרה הזו בינואר 2025.
            </Note>
        </StepFrame>
    );
}

function ConnectStep({
    onBack,
    onDone,
    onError,
}: {
    onBack: () => void;
    onDone: () => void;
    onError: (e: unknown) => void;
}) {
    const [name, setName] = React.useState("");
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [submitting, setSubmitting] = React.useState(false);

    const cleaned = normalizeAppPassword(password);
    const lengthOff = cleaned.length > 0 && cleaned.length !== APP_PASSWORD_LENGTH;
    const missing = [
        !name.trim() && "שם שולח",
        !email.trim().includes("@") && "כתובת דוא״ל",
        !cleaned && "סיסמת אפליקציה",
    ].filter((m): m is string => Boolean(m));
    const valid = missing.length === 0;

    async function submit() {
        if (submitting || !valid) return;
        setSubmitting(true);
        const address = email.trim();
        try {
            await toast.promise(
                addEmail({
                    name: name.trim(),
                    email: address,
                    imap: { username: address, password: cleaned, host: GMAIL_IMAP.host, port: GMAIL_IMAP.port, security: "tls" },
                    smtp: { username: address, password: cleaned, host: GMAIL_SMTP.host, port: GMAIL_SMTP.port, security: "tls" },
                }),
                {
                    loading: "בודק את סיסמת האפליקציה מול Google…",
                    success: "תיבת הדואר חוברה בהצלחה",
                    error: (e: AppError) => buildError(e),
                },
            );
            onDone();
        } catch (e) {
            onError(e);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <StepFrame
            title="חבר את תיבת הדואר"
            sub="הכתובת, סיסמת האפליקציה, וזה הכל."
            footer={
                <div className="w-full flex items-center justify-between gap-2">
                    <BackButton onClick={onBack} />
                    <span className="flex-1 min-w-0 text-[11px] text-slate-500 truncate">
                        {valid ? "הפרטים נבדקים מול Google לפני השמירה." : `חסר עדיין: ${missing.join(", ")}.`}
                    </span>
                    <motion.button
                        type="button"
                        onClick={submit}
                        disabled={!valid || submitting}
                        whileTap={valid && !submitting ? { scale: 0.97 } : undefined}
                        className="shrink-0 h-7 px-3 rounded-md text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? <Loader2Icon className="w-3 h-3 animate-spin" /> : <CheckIcon className="w-3 h-3" />}
                        חבר תיבה
                    </motion.button>
                </div>
            }
        >
            <div className="space-y-2">
                <Field label="שם שולח">
                    <TextInput value={name} onChange={setName} placeholder="ישראל ישראלי" />
                </Field>
                <Field label="כתובת דוא״ל">
                    <TextInput value={email} onChange={setEmail} placeholder="alex@gmail.com או alex@yourdomain.co.il" dir="ltr" />
                </Field>
                <Field label="סיסמת אפליקציה">
                    <TextInput
                        value={password}
                        onChange={setPassword}
                        placeholder="xxxx xxxx xxxx xxxx"
                        type="password"
                        dir="ltr"
                        onKeyDown={(e) => {
                            if (e.key === "Enter") void submit();
                        }}
                    />
                </Field>
                {lengthOff && (
                    <p className="text-[11.5px] text-amber-700">
                        סיסמת אפליקציה של Google מכילה בדיוק {APP_PASSWORD_LENGTH} אותיות. ייתכן שהוזנה סיסמת החשבון הראשית במקום.
                    </p>
                )}
            </div>

            <div className="rounded-md border border-slate-200 overflow-hidden">
                <div className="px-3 h-8 flex items-center gap-1.5 border-b border-slate-200 bg-slate-50">
                    <KeyRoundIcon className="w-3 h-3 text-slate-500" />
                    <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium">הגדרות שרת (מוגדרות עבורך אוטומטית)</span>
                </div>
                {[
                    { label: "SMTP", ...GMAIL_SMTP },
                    { label: "IMAP", ...GMAIL_IMAP },
                ].map((s) => (
                    <div key={s.label} className="px-3 py-2 flex items-center gap-3 text-[12px] border-b border-slate-100 last:border-b-0" dir="ltr">
                        <span className="w-10 shrink-0 text-slate-500 font-medium">{s.label}</span>
                        <span className="font-mono text-slate-900 truncate">{s.host}</span>
                        <span className="font-mono tabular-nums text-slate-600">:{s.port}</span>
                        <span className="ml-auto text-slate-500 shrink-0">SSL / TLS</span>
                    </div>
                ))}
                <div className="px-3 py-2 text-[11.5px] text-slate-500 border-t border-slate-100 text-right">
                    שם המשתמש הוא כתובת הדוא״ל המלאה בשני השרתים. מחיקת סיסמת האפליקציה ב-Google תנתק את התיבה.
                </div>
            </div>
        </StepFrame>
    );
}

function StepFrame({
    title,
    sub,
    children,
    footer,
}: {
    title: string;
    sub: string;
    children: React.ReactNode;
    footer: React.ReactNode;
}) {
    return (
        <div>
            <div className="px-4 pt-4 pb-3 space-y-3.5 text-right">
                <div className="flex items-start gap-3">
                    <div className="size-9 rounded-md border border-slate-200 bg-white flex items-center justify-center shrink-0">
                        <ShieldCheckIcon className="w-4 h-4 text-slate-700" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-[13.5px] font-medium text-slate-900">{title}</div>
                        <div className="text-[11.5px] text-slate-500">{sub}</div>
                    </div>
                </div>
                {children}
            </div>
            <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50/60 flex items-center gap-2 min-w-0 sticky bottom-0">
                {footer}
            </div>
        </div>
    );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
    return (
        <li className="flex items-start gap-2.5 text-right">
            <span className="size-4 mt-0.5 shrink-0 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium inline-flex items-center justify-center tabular-nums">
                {n}
            </span>
            <span className="text-[12.5px] text-slate-700 leading-[1.5]">{children}</span>
        </li>
    );
}

function Note({ children }: { children: React.ReactNode }) {
    return <p className="text-[11.5px] text-slate-500 leading-[1.5] text-right">{children}</p>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3 min-w-0">
            <span className="text-[11px] font-medium text-slate-500 w-24 shrink-0 text-right">{label}</span>
            <div className="flex-1 min-w-0">{children}</div>
        </div>
    );
}

function ExternalButton({ href, children }: { href: string; children: React.ReactNode }) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-slate-200 text-[12.5px] text-slate-700 hover:bg-slate-50 transition-colors"
        >
            <ExternalLinkIcon className="w-3.5 h-3.5" />
            {children}
        </a>
    );
}

function BackButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="shrink-0 h-7 px-2 rounded-md text-[12px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center gap-1 transition-colors"
        >
            <ArrowRightIcon className="w-3 h-3" />
            חזרה
        </button>
    );
}

function NextButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
    return (
        <motion.button
            type="button"
            onClick={onClick}
            whileTap={{ scale: 0.97 }}
            className="shrink-0 h-7 px-3 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors"
        >
            {children}
            <ArrowLeftIcon className="w-3 h-3" />
        </motion.button>
    );
}
