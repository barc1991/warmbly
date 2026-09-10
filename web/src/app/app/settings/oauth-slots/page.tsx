import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import {
    BoxesIcon,
    PlusIcon,
    Trash2Icon,
    CopyIcon,
    CheckIcon,
    ExternalLinkIcon,
    ShieldCheckIcon,
    AlertCircleIcon,
    CheckCircle2Icon,
    KeyIcon,
    XIcon,
    Loader2Icon,
    MailIcon,
    Settings2Icon,
} from "lucide-react";
import {
    useOAuthSlots,
    useCreateOAuthSlot,
    useUpdateOAuthSlot,
    useDeleteOAuthSlot,
} from "@/lib/api/hooks/app/oauth-slots/useOAuthSlots";
import type { OAuthConnectionSlot } from "@/lib/api/models/app/oauth-slots/OAuthSlot";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import { usePermission } from "@/hooks/usePermission";
import { useConfirm } from "@/hooks/context/confirm";
import { Label, TextInput, NumberInput } from "@/components/ui/field";
import { SectionShell, Section, Toggle } from "../_components/SectionShell";

export default function OAuthSlotsSettingsPage() {
    const canManage = usePermission("MANAGE_SETTINGS");
    const slotsQ = useOAuthSlots();
    const [addOpen, setAddOpen] = React.useState(false);

    const slots = slotsQ.data ?? [];
    const redirectUrl = `${window.location.origin}/addresses/google/callback`;

    return (
        <SectionShell
            title="סלוטים לחיבורי מייל (OAuth)"
            description="חבר מספר פרויקטים של Google Cloud או Microsoft כדי לעקוף את מגבלת 100 המשתמשים של גוגל. כל התיבות מתחברות לאותו ארגון בדיוק, מוצגות יחד באותה רשימה ומתרכזות באותו Unibox מאוחד."
            actions={
                canManage ? (
                    <button
                        type="button"
                        onClick={() => setAddOpen(true)}
                        className="h-7 px-3 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                        <PlusIcon className="w-3.5 h-3.5" />
                        הוסף סלוט פרויקט חדש
                    </button>
                ) : undefined
            }
        >
            {/* Guide & Redirect URI Section */}
            <Section eyebrow="הגדרות ב-Google Cloud Console" description="העתק את כתובת החזרה המורשית והדבק אותה בהגדרות ה-OAuth של כל פרויקט שאתה פותח.">
                <div className="rounded-lg border border-slate-200/80 bg-gradient-to-br from-slate-50 to-sky-50/20 p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-[12px] font-semibold text-slate-800 flex items-center gap-1.5">
                            <KeyIcon className="w-4 h-4 text-sky-600" />
                            כתובת חזרה מורשית (Authorized Redirect URI):
                        </span>
                        <CopyBadge text={redirectUrl} />
                    </div>
                    <p className="text-[11.5px] text-slate-500 leading-relaxed">
                        ב-Google Cloud Console: פתח פרויקט &gt; <strong>APIs &amp; Services</strong> &gt; <strong>Credentials</strong> &gt; <strong>Create Credentials</strong> &gt; <strong>OAuth client ID</strong> (Web application). הדבק את הכתובת למעלה, שמור והעתק את ה-Client ID וה-Client Secret לסלוט כאן.
                    </p>
                </div>
            </Section>

            {/* Slots List */}
            <Section eyebrow="פרויקטים וסלוטים פעילים" description="המערכת מנתבת חיבורי תיבות חדשים אוטומטית לסלוט הפנוי הבא. כשהסלוט מגיע ל-100 תיבות, הוא נחסם ועובר לסלוט הבא.">
                {slotsQ.isPending ? (
                    <div className="space-y-3">
                        <div className="h-24 rounded-lg bg-slate-100 animate-pulse" />
                        <div className="h-24 rounded-lg bg-slate-100 animate-pulse" />
                    </div>
                ) : slots.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center space-y-3">
                        <div className="w-10 h-10 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center mx-auto">
                            <BoxesIcon className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                            <h4 className="text-[13px] font-medium text-slate-800">אין עדיין סלוטים של OAuth מוגדרים</h4>
                            <p className="text-[12px] text-slate-500 max-w-md mx-auto">
                                אם לא מוגדרים סלוטים, המערכת משתמשת בפרטי ברירת המחדל של השרת. הוסף סלוט ייעודי כדי לפתוח חיבורים נוספים ללא הגבלה.
                            </p>
                        </div>
                        {canManage && (
                            <button
                                type="button"
                                onClick={() => setAddOpen(true)}
                                className="h-7 px-3 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors"
                            >
                                <PlusIcon className="w-3.5 h-3.5" />
                                צור סלוט ראשון
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {slots.map((slot) => (
                            <SlotCard key={slot.id} slot={slot} canManage={canManage} />
                        ))}
                    </div>
                )}
            </Section>

            <AddSlotModal open={addOpen} onClose={() => setAddOpen(false)} />
        </SectionShell>
    );
}

function CopyBadge({ text }: { text: string }) {
    const [copied, setCopied] = React.useState(false);
    return (
        <div className="inline-flex items-center gap-2 bg-white px-2.5 py-1 rounded-md border border-slate-200 text-[11.5px] font-mono text-slate-700 shadow-sm">
            <span className="truncate max-w-xs">{text}</span>
            <button
                type="button"
                onClick={async () => {
                    await navigator.clipboard.writeText(text);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                title="העתק כתובת"
            >
                {copied ? <CheckIcon className="w-3.5 h-3.5 text-emerald-600" /> : <CopyIcon className="w-3.5 h-3.5" />}
            </button>
        </div>
    );
}

function SlotCard({ slot, canManage }: { slot: OAuthConnectionSlot; canManage: boolean }) {
    const deleteMut = useDeleteOAuthSlot();
    const updateMut = useUpdateOAuthSlot();
    const confirm = useConfirm();
    const [editOpen, setEditOpen] = React.useState(false);

    const isFull = slot.connected_count >= slot.max_accounts;
    const usagePercent = Math.min(100, Math.round((slot.connected_count / slot.max_accounts) * 100));

    function onDelete() {
        if (slot.connected_count > 0) {
            toast.error("לא ניתן למחוק סלוט שמחוברות אליו תיבות פעילות.");
            return;
        }
        confirm.show(`למחוק את סלוט "${slot.name}"?`, async () => {
            try {
                await deleteMut.mutateAsync(slot.id);
                toast.success("הסלוט נמחק בהצלחה");
            } catch (err) {
                toast.error(buildError(err as AppError));
            }
        });
    }

    async function toggleDefault() {
        try {
            await updateMut.mutateAsync({
                id: slot.id,
                data: { is_default: !slot.is_default },
            });
            toast.success(slot.is_default ? "הוסרה ברירת מחדל" : "הוגדר כסלוט ברירת מחדל");
        } catch (err) {
            toast.error(buildError(err as AppError));
        }
    }

    return (
        <div className="rounded-lg border border-slate-200/80 bg-white p-4 space-y-3 shadow-xs hover:border-slate-300 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                        slot.provider === "gmail" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
                    }`}>
                        {slot.provider === "gmail" ? "G" : "M"}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="text-[13px] font-semibold text-slate-900">{slot.name}</h4>
                            {slot.is_default && (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                                    ברירת מחדל
                                </span>
                            )}
                            {isFull ? (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 flex items-center gap-1">
                                    <AlertCircleIcon className="w-3 h-3" /> מלא ({slot.connected_count}/{slot.max_accounts})
                                </span>
                            ) : (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                                    <CheckCircle2Icon className="w-3 h-3" /> פנוי לחיבור ({slot.connected_count}/{slot.max_accounts})
                                </span>
                            )}
                        </div>
                        <div className="text-[11.5px] font-mono text-slate-400 truncate max-w-sm" title={slot.client_id}>
                            Client ID: {slot.client_id.slice(0, 16)}…{slot.client_id.slice(-8)}
                        </div>
                    </div>
                </div>

                {canManage && (
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                            type="button"
                            onClick={toggleDefault}
                            className="text-[11px] text-slate-500 hover:text-slate-800 px-2 py-1 rounded border border-slate-200 transition-colors"
                        >
                            {slot.is_default ? "בטל ברירת מחדל" : "קבע כברירת מחדל"}
                        </button>
                        <button
                            type="button"
                            onClick={() => setEditOpen(true)}
                            className="text-[11px] text-slate-500 hover:text-slate-800 px-2 py-1 rounded border border-slate-200 transition-colors inline-flex items-center gap-1"
                        >
                            <Settings2Icon className="w-3 h-3" />
                            ערוך
                        </button>
                        <button
                            type="button"
                            onClick={onDelete}
                            disabled={slot.connected_count > 0 || deleteMut.isPending}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors disabled:opacity-30 disabled:hover:text-slate-400"
                            title={slot.connected_count > 0 ? "לא ניתן למחוק סלוט עם תיבות פעילות" : "מחק סלוט"}
                        >
                            <Trash2Icon className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>

            {/* Capacity Progress Bar */}
            <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[11px] text-slate-500">
                    <span>קיבולת תיבות מחוברות</span>
                    <span className="font-semibold text-slate-700">
                        {slot.connected_count} מתוך {slot.max_accounts} ({usagePercent}%)
                    </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-300 ${
                            isFull
                                ? "bg-rose-500"
                                : usagePercent > 80
                                ? "bg-amber-500"
                                : "bg-sky-500"
                        }`}
                        style={{ width: `${usagePercent}%` }}
                    />
                </div>
            </div>

            <EditSlotModal open={editOpen} slot={slot} onClose={() => setEditOpen(false)} />
        </div>
    );
}

function AddSlotModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const createMut = useCreateOAuthSlot();
    const [name, setName] = React.useState("");
    const [provider, setProvider] = React.useState<"gmail" | "outlook">("gmail");
    const [clientId, setClientId] = React.useState("");
    const [clientSecret, setClientSecret] = React.useState("");
    const [maxAccounts, setMaxAccounts] = React.useState(100);
    const [isDefault, setIsDefault] = React.useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim() || !clientId.trim() || !clientSecret.trim()) {
            toast.error("נא למלא את כל השדות החובה");
            return;
        }

        try {
            await createMut.mutateAsync({
                name: name.trim(),
                provider,
                client_id: clientId.trim(),
                client_secret: clientSecret.trim(),
                max_accounts: maxAccounts,
                is_default: isDefault,
            });
            toast.success("סלוט ה-OAuth נוצר בהצלחה!");
            onClose();
            setName("");
            setClientId("");
            setClientSecret("");
        } catch (err) {
            toast.error(buildError(err as AppError));
        }
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4" dir="rtl">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-lg rounded-xl bg-white shadow-xl border border-slate-200 overflow-hidden"
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h3 className="text-[14px] font-semibold text-slate-900 flex items-center gap-2">
                        <BoxesIcon className="w-4 h-4 text-sky-600" />
                        הוספת סלוט חיבור חדש (OAuth)
                    </h3>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <XIcon className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4 text-[12.5px]">
                    <div className="space-y-1.5">
                        <Label>שם הסלוט (לזיהוי פנימי) *</Label>
                        <TextInput
                            placeholder="לדוגמה: Google Cloud פרויקט 2"
                            value={name}
                            onChange={setName}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label>ספק שירות</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setProvider("gmail")}
                                className={`h-8 rounded-md border text-[12px] font-medium transition-colors ${
                                    provider === "gmail"
                                        ? "border-sky-500 bg-sky-50 text-sky-700 font-semibold"
                                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                                }`}
                            >
                                Google (Gmail)
                            </button>
                            <button
                                type="button"
                                onClick={() => setProvider("outlook")}
                                className={`h-8 rounded-md border text-[12px] font-medium transition-colors ${
                                    provider === "outlook"
                                        ? "border-sky-500 bg-sky-50 text-sky-700 font-semibold"
                                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                                }`}
                            >
                                Microsoft (Outlook)
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label>Client ID *</Label>
                        <TextInput
                            placeholder="...apps.googleusercontent.com"
                            value={clientId}
                            onChange={setClientId}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label>Client Secret *</Label>
                        <TextInput
                            type="password"
                            placeholder="GOCSPX-..."
                            value={clientSecret}
                            onChange={setClientSecret}
                        />
                        <p className="text-[11px] text-slate-400">הסיקרט מוצפן ברמת בסיס הנתונים באמצעות ה-DEK הארגוני.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 items-center">
                        <div className="space-y-1.5">
                            <Label>מכסת תיבות מקסימלית</Label>
                            <NumberInput
                                min={1}
                                max={10000}
                                value={maxAccounts}
                                onChange={(val) => setMaxAccounts(val || 100)}
                            />
                            <p className="text-[10.5px] text-slate-400">בדיקה בגוגל: 100 משתמשים.</p>
                        </div>

                        <div className="flex items-center gap-2 pt-4">
                            <input
                                id="is_default"
                                type="checkbox"
                                checked={isDefault}
                                onChange={(e) => setIsDefault(e.target.checked)}
                                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                            />
                            <label htmlFor="is_default" className="text-[12px] text-slate-700 select-none cursor-pointer">
                                קבע כברירת מחדל
                            </label>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-8 px-3 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 text-[12px]"
                        >
                            ביטול
                        </button>
                        <button
                            type="submit"
                            disabled={createMut.isPending}
                            className="h-8 px-4 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-medium text-[12px] inline-flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                        >
                            {createMut.isPending && <Loader2Icon className="w-3 h-3 animate-spin" />}
                            שמור סלוט
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}

function EditSlotModal({ open, slot, onClose }: { open: boolean; slot: OAuthConnectionSlot; onClose: () => void }) {
    const updateMut = useUpdateOAuthSlot();
    const [name, setName] = React.useState(slot.name);
    const [clientSecret, setClientSecret] = React.useState("");
    const [maxAccounts, setMaxAccounts] = React.useState(slot.max_accounts);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        try {
            await updateMut.mutateAsync({
                id: slot.id,
                data: {
                    name: name.trim(),
                    client_secret: clientSecret.trim() ? clientSecret.trim() : undefined,
                    max_accounts: maxAccounts,
                },
            });
            toast.success("הסלוט עודכן בהצלחה");
            onClose();
        } catch (err) {
            toast.error(buildError(err as AppError));
        }
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4" dir="rtl">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200 overflow-hidden"
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h3 className="text-[14px] font-semibold text-slate-900">עריכת סלוט: {slot.name}</h3>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <XIcon className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4 text-[12.5px]">
                    <div className="space-y-1.5">
                        <Label>שם הסלוט</Label>
                        <TextInput value={name} onChange={setName} />
                    </div>

                    <div className="space-y-1.5">
                        <Label>Client Secret חדש (השאר ריק אם אין שינוי)</Label>
                        <TextInput
                            type="password"
                            placeholder="השאר ריק כדי לשמור את הקיים"
                            value={clientSecret}
                            onChange={setClientSecret}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label>מכסת תיבות מקסימלית</Label>
                        <NumberInput
                            min={slot.connected_count || 1}
                            max={10000}
                            value={maxAccounts}
                            onChange={(val) => setMaxAccounts(val || 100)}
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-8 px-3 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 text-[12px]"
                        >
                            ביטול
                        </button>
                        <button
                            type="submit"
                            disabled={updateMut.isPending}
                            className="h-8 px-4 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-medium text-[12px] inline-flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                        >
                            {updateMut.isPending && <Loader2Icon className="w-3 h-3 animate-spin" />}
                            שמור שינויים
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
