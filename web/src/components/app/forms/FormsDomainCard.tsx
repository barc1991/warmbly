// FormsDomainCard — the workspace's custom forms domain. Shaped like the
// mailbox tracking-domain panel: type a subdomain, add the CNAME, verify. It
// is workspace-wide, so it appears on every form's Share tab. The Share tab's
// section supplies the heading and the explanation; this renders controls only.

import React from "react";
import { CheckIcon, CopyIcon, Loader2Icon } from "lucide-react";
import toast from "react-hot-toast";

import { Label, TextInput } from "@/components/ui/field";
import { useWriteGuard } from "@/hooks/usePermission";
import { useFormsDomain, useSetFormsDomain, useVerifyFormsDomain } from "@/lib/api/hooks/app/forms";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";

// Every status the backend can report, in the customer's words.
const TONE: Record<string, { pill: string; label: string }> = {
    verified: { pill: "bg-emerald-50 text-emerald-700", label: "מאומת" },
    pending: { pill: "bg-amber-50 text-amber-700", label: "לא מאומת" },
    not_found: { pill: "bg-amber-50 text-amber-700", label: "אין רשומת DNS עדיין" },
    wrong_target: { pill: "bg-rose-50 text-rose-700", label: "מצביע למקום אחר" },
    lookup_error: { pill: "bg-slate-100 text-slate-600", label: "בדיקת DNS נכשלה" },
    no_target: { pill: "bg-slate-100 text-slate-600", label: "אין יעד להפניה" },
    unset: { pill: "bg-slate-100 text-slate-600", label: "שרת משותף" },
};

export default function FormsDomainCard() {
    const write = useWriteGuard("MANAGE_SETTINGS");
    const domain = useFormsDomain();
    const save = useSetFormsDomain();
    const verify = useVerifyFormsDomain();

    const [value, setValue] = React.useState("");
    const [touched, setTouched] = React.useState(false);

    // Server state seeds the field until the user starts editing.
    React.useEffect(() => {
        if (!touched && domain.data) setValue(domain.data.forms_domain);
    }, [domain.data, touched]);

    const status = domain.data;
    const tone = TONE[status?.status ?? "unset"] ?? TONE.unset;
    const busy = save.isPending || verify.isPending;
    const dirty = touched && value.trim() !== (status?.forms_domain ?? "");

    async function onSave() {
        try {
            const res = await save.mutateAsync(value.trim());
            setTouched(false);
            toast.success(
                res.forms_domain === ""
                    ? "הדומיין המותאם אישית הוסר; קישורי הטפסים ישתמשו בשרת המשותף"
                    : res.forms_domain_verified
                      ? "אומת בהצלחה. קישורי טפסים חדשים ישתמשו בדומיין שלך."
                      : "נשמר. הדומיין יופעל ברגע שרשומת ה-DNS תתעדכן.",
            );
        } catch (err) {
            toast.error(buildError(err as AppError));
        }
    }

    async function onVerify() {
        try {
            const res = await verify.mutateAsync();
            if (res.forms_domain_verified) toast.success("אומת בהצלחה. קישורי טפסים חדשים ישתמשו בדומיין שלך.");
            else toast(res.message, { icon: "⚠️" });
        } catch (err) {
            toast.error(buildError(err as AppError));
        }
    }

    async function copyTarget() {
        if (!status?.cname_target) return;
        await navigator.clipboard.writeText(status.cname_target);
        toast.success("יעד CNAME הועתק");
    }

    return (
        <div className="grid gap-x-8 gap-y-3 lg:grid-cols-2 items-start">
            <div>
                <div className="flex items-center gap-2">
                    <Label>דומיין לטפסים</Label>
                    <span
                        className={`inline-flex items-center h-4 px-1.5 rounded text-[10px] font-medium mb-1 ${tone.pill}`}
                    >
                        {tone.label}
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <TextInput
                        value={value}
                        onChange={(v) => {
                            setValue(v);
                            setTouched(true);
                        }}
                        placeholder="forms.yourdomain.com"
                        className="flex-1 font-mono dir-ltr text-start"
                        disabled={!write.allowed || busy}
                    />
                    <button
                        type="button"
                        disabled={!write.allowed || busy || (!dirty && !!status?.forms_domain === false)}
                        onClick={() => write.guard(() => void onSave())({})}
                        className="h-7 px-2.5 rounded-md bg-sky-600 text-white text-[12px] font-medium hover:bg-sky-700 disabled:opacity-50 shrink-0"
                    >
                        {save.isPending ? <Loader2Icon className="w-3 h-3 animate-spin" /> : dirty ? "שמור ואמת" : "שמור"}
                    </button>
                </div>
            </div>

            {status?.cname_target ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-medium mb-1">
                        הוסף רשומה זו
                    </div>
                    <div className="flex items-center gap-2 text-[11.5px] font-mono text-slate-700 dir-ltr">
                        <span className="text-slate-400">CNAME</span>
                        <span className="truncate">{value.trim() || "forms.yourdomain.com"}</span>
                        <span className="text-slate-400">to</span>
                        <span className="truncate">{status.cname_target}</span>
                        <button
                            type="button"
                            onClick={() => void copyTarget()}
                            aria-label="העתק יעד CNAME"
                            className="ms-auto size-6 inline-flex items-center justify-center rounded text-slate-400 hover:text-slate-900 hover:bg-slate-200/60 shrink-0"
                        >
                            <CopyIcon className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            ) : (
                <p className="text-[11.5px] text-slate-500 rounded-md bg-slate-50 border border-slate-200 px-3 py-2">
                    במופע זה לא הוגדר שרת טפסים, לכן אין יעד להפנות אליו רשומה. מנהל המערכת צריך להגדיר את FORMS_DOMAIN.
                </p>
            )}

            {status && status.status !== "unset" && (
                <div className="lg:col-span-2 flex items-start justify-between gap-2">
                    <p className="text-[11.5px] text-slate-500">
                        {status.message}
                        {status.observed ? (
                            <>
                                {" "}
                                נמצא: <span className="font-mono text-slate-700 dir-ltr">{status.observed}</span>
                            </>
                        ) : null}
                    </p>
                    {status.forms_domain && (
                        <button
                            type="button"
                            disabled={!write.allowed || busy}
                            onClick={() => write.guard(() => void onVerify())({})}
                            className="h-6 px-2 rounded-md border border-slate-200 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-50 shrink-0 inline-flex items-center gap-1"
                        >
                            {verify.isPending ? (
                                <Loader2Icon className="w-3 h-3 animate-spin" />
                            ) : status.forms_domain_verified ? (
                                <CheckIcon className="w-3 h-3 text-emerald-600" />
                            ) : null}
                            בדוק שוב
                        </button>
                    )}
                </div>
            )}

            <p className="lg:col-span-2 text-[11px] text-slate-400">
                עד לאימות, הקישורים ממשיכים לעבוד בשרת המשותף. המערכת בודקת מחדש מדי שעה, כך שרשומה שהפצתה הסתיימה תתחיל לפעול אוטומטית.
            </p>
        </div>
    );
}
