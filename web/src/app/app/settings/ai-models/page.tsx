import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
    CpuIcon,
    PlusIcon,
    KeyIcon,
    ShieldCheckIcon,
    RefreshCwIcon,
    Trash2Icon,
    AlertTriangleIcon,
    CheckCircle2Icon,
    ClockIcon,
    ArrowRightIcon,
    PauseIcon,
    PlayIcon,
    LayersIcon,
    ZapIcon,
    UploadCloudIcon,
    XIcon,
} from "lucide-react";
import { SectionShell, Section, Toggle } from "../_components/SectionShell";
import { usePermission } from "@/hooks/usePermission";
import { useConfirm } from "@/hooks/context/confirm";
import { TextInput } from "@/components/ui/field";
import {
    useGeminiKeys,
    useGeminiConfig,
    useCreateGeminiKeys,
    useDeleteGeminiKey,
    useUpdateGeminiKeyStatus,
    useTestGeminiKey,
    useUpdateGeminiConfig,
} from "@/lib/api/hooks/app/agent/useGeminiKeys";
import type { OrgGeminiKey, GeminiKeyStatus } from "@/lib/api/client/app/agent/geminiKeys";

const AVAILABLE_MODELS = [
    {
        id: "gemini-3.8-flash",
        name: "Gemini 3.8 Flash",
        badge: "מומלץ - הדור החדש",
        desc: "המודל העדכני ביותר של גוגל: מהירות מקסימלית, הבנה מתקדמת של שפה וכלי עבודה.",
    },
    {
        id: "gemini-3.7-flash",
        name: "Gemini 3.7 Flash",
        badge: "גיבוי שלב 1",
        desc: "מודל מהיר וחכם מאוד, מצוין כגיבוי ראשון בעת עומס על 3.8.",
    },
    {
        id: "gemini-3.6-flash",
        name: "Gemini 3.6 Flash",
        badge: "גיבוי שלב 2",
        desc: "מודל מוכח ויציב ביותר, מבטיח המשכיות עבודה תחת כל תנאי רשת.",
    },
    {
        id: "gemini-3.5-flash-lite",
        name: "Gemini 3.5 Flash-Lite",
        badge: "גיבוי שלב 3",
        desc: "מודל קל משקל וחסכוני ביותר, מגיב מיידית גם בזמני שיא ועומסים חריגים.",
    },
];

export default function AIModelsSettingsPage() {
    const canManage = usePermission("MANAGE_SETTINGS");
    const confirm = useConfirm();

    const { data: keys = [], isLoading: keysLoading } = useGeminiKeys();
    const { data: configData, isLoading: configLoading } = useGeminiConfig();

    const createMutation = useCreateGeminiKeys();
    const deleteMutation = useDeleteGeminiKey();
    const updateStatusMutation = useUpdateGeminiKeyStatus();
    const testMutation = useTestGeminiKey();
    const updateConfigMutation = useUpdateGeminiConfig();

    const [addKeyModal, setAddKeyModal] = useState(false);
    const [bulkModal, setBulkModal] = useState(false);
    const [testingKeyId, setTestingKeyId] = useState<string | null>(null);

    const config = configData?.config || {
        primary_model: "gemini-3.8-flash",
        fallback_enabled: true,
        fallback_chain: [
            "gemini-3.8-flash",
            "gemini-3.7-flash",
            "gemini-3.6-flash",
            "gemini-3.5-flash-lite",
        ],
    };

    const stats = configData?.stats;

    // Handle primary model selection
    const handleModelChange = async (modelId: string) => {
        if (!canManage) return;
        try {
            await updateConfigMutation.mutateAsync({
                ...config,
                primary_model: modelId,
            });
            toast.success(`מודל ראשי עודכן ל-${modelId}`);
        } catch {
            toast.error("שגיאה בעדכון מודל");
        }
    };

    // Toggle fallback
    const handleToggleFallback = async (enabled: boolean) => {
        if (!canManage) return;
        try {
            await updateConfigMutation.mutateAsync({
                ...config,
                fallback_enabled: enabled,
            });
            toast.success(enabled ? "שרשרת גיבוי הופעלה" : "שרשרת גיבוי כובתה");
        } catch {
            toast.error("שגיאה בעדכון הגדרות גיבוי");
        }
    };

    // Test a key
    const handleTestKey = async (key: OrgGeminiKey) => {
        setTestingKeyId(key.id);
        try {
            const res = await testMutation.mutateAsync(key.id);
            if (res.success) {
                toast.success(
                    `המפתח תקין ומחובר! זיהוי: ${res.model} (${res.latency_ms}ms)`,
                );
            } else {
                toast.error(`בדיקת מפתח נכשלה: ${res.error || "שגיאה לא ידועה"}`);
            }
        } catch {
            toast.error("שגיאה בביצוע בדיקת מפתח");
        } finally {
            setTestingKeyId(null);
        }
    };

    // Delete a key
    const handleDeleteKey = (key: OrgGeminiKey) => {
        confirm.show(
            `האם למחוק את המפתח "${key.name}" (${key.masked_key})?`,
            async () => {
                try {
                    await deleteMutation.mutateAsync(key.id);
                    toast.success("המפתח נמחק בהצלחה");
                } catch {
                    toast.error("שגיאה במחיקת מפתח");
                }
            },
        );
    };

    // Toggle key paused/active
    const handleToggleStatus = async (key: OrgGeminiKey) => {
        const nextStatus: GeminiKeyStatus =
            key.status === "paused" ? "active" : "paused";
        try {
            await updateStatusMutation.mutateAsync({
                id: key.id,
                status: nextStatus,
            });
            toast.success(
                nextStatus === "active" ? "המפתח הופעל" : "המפתח הושהה",
            );
        } catch {
            toast.error("שגיאה בעדכון סטטוס מפתח");
        }
    };

    return (
        <SectionShell
            title="מודלי AI ומפתחות Gemini"
            description="ניהול המודל הראשי, שרשרת Fallback רב-שלבית חכמה למניעת עומסים וקטיעות, ומאגר מפתחות API מרובים עם הגנה מפני Rate Limits."
            actions={
                canManage && (
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setBulkModal(true)}
                            className="h-7 px-2.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors shadow-sm"
                        >
                            <UploadCloudIcon className="w-3.5 h-3.5 text-slate-500" />
                            ייבוא מרובה
                        </button>
                        <button
                            type="button"
                            onClick={() => setAddKeyModal(true)}
                            className="h-7 px-3 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors shadow-sm"
                        >
                            <PlusIcon className="w-3.5 h-3.5" />
                            הוסף מפתח
                        </button>
                    </div>
                )
            }
        >
            {/* Overview stats bar */}
            <Section eyebrow="סטטוס מערך Gemini" description="ניטור בזמן אמת של מפתחות ה-API ופעילות הרוטטור.">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/50">
                        <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                            מפתחות פעילים
                        </div>
                        <div className="mt-1 flex items-baseline gap-2">
                            <span className="text-xl font-bold text-slate-900">
                                {stats?.active_keys ?? keys.filter((k) => k.status === "active").length}
                            </span>
                            <span className="text-[11.5px] text-slate-500">
                                מתוך {keys.length}
                            </span>
                        </div>
                    </div>

                    <div className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/50">
                        <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                            בהשהיית קצב (429)
                        </div>
                        <div className="mt-1 flex items-baseline gap-2">
                            <span className="text-xl font-bold text-amber-600">
                                {stats?.cooldown_keys ?? 0}
                            </span>
                            <span className="text-[11px] text-slate-400">
                                משתחררים אוטומטית
                            </span>
                        </div>
                    </div>

                    <div className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/50">
                        <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                            סבבי רוטציה
                        </div>
                        <div className="mt-1 flex items-baseline gap-2">
                            <span className="text-xl font-bold text-sky-600">
                                {stats?.total_rotations ?? 0}
                            </span>
                            <span className="text-[11px] text-slate-400">
                                החלפות מפתח
                            </span>
                        </div>
                    </div>

                    <div className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/50">
                        <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                            מודל פעיל נוכחי
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                            <span className="text-[13px] font-bold text-slate-900 truncate">
                                {config.primary_model}
                            </span>
                        </div>
                    </div>
                </div>
            </Section>

            {/* Cascading Fallback & Model Selection */}
            <Section
                eyebrow="בחירת מודל ראשי ושרשרת Fallback"
                description="במקרה של שגיאת עומס (503) או חריגת מכסות בכל המפתחות במודל הנוכחי, המערכת מדלגת אוטומטית למודל הבא ברשימה."
            >
                {/* Fallback chain visual flow */}
                <div className="mb-4 p-4 rounded-xl border border-sky-100 bg-sky-50/40">
                    <div className="flex items-center justify-between gap-4 mb-3">
                        <div className="flex items-center gap-2">
                            <LayersIcon className="w-4 h-4 text-sky-600" />
                            <span className="text-[13px] font-semibold text-slate-900">
                                מסלול הגיבוי הרב-שלבי (Cascading Fallback)
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[12px] text-slate-600 font-medium">
                                גיבוי אוטומטי
                            </span>
                            <Toggle
                                checked={config.fallback_enabled}
                                onChange={handleToggleFallback}
                                disabled={!canManage}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-[12px]">
                        {AVAILABLE_MODELS.map((m, idx) => {
                            const isPrimary = config.primary_model === m.id;
                            return (
                                <div
                                    key={m.id}
                                    className={`relative p-3 rounded-lg border transition-all ${
                                        isPrimary
                                            ? "border-sky-500 bg-white shadow-sm ring-1 ring-sky-500/20"
                                            : "border-slate-200 bg-white/70"
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-1 mb-1">
                                        <span className="font-semibold text-slate-900 truncate">
                                            {m.name}
                                        </span>
                                        <span
                                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                                isPrimary
                                                    ? "bg-sky-100 text-sky-800"
                                                    : "bg-slate-100 text-slate-600"
                                            }`}
                                        >
                                            {idx === 0 ? "ראשי" : `שלב ${idx}`}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 line-clamp-2">
                                        {m.desc}
                                    </p>
                                    {canManage && !isPrimary && (
                                        <button
                                            type="button"
                                            onClick={() => handleModelChange(m.id)}
                                            className="mt-2 text-[11px] text-sky-600 hover:text-sky-700 font-medium hover:underline inline-flex items-center gap-1"
                                        >
                                            הגדר כמודל ראשי
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </Section>

            {/* API Keys Table & Rotator */}
            <Section
                eyebrow="מאגר מפתחות API (Rotator)"
                description="סבב אוטומטי בין המפתחות. כאשר מפתח נתקל ב-429 או מגבלת Free Tier, הוא מושהה ל-5-30 דקות והמערכת עוברת מיד למפתח הבא."
            >
                {keysLoading ? (
                    <div className="h-24 rounded bg-slate-100 animate-pulse" />
                ) : keys.length === 0 ? (
                    <div className="p-8 text-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50">
                        <KeyIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                        <h4 className="text-[13.5px] font-semibold text-slate-800">
                            אין מפתחות Gemini מוגדרים
                        </h4>
                        <p className="text-[12px] text-slate-500 max-w-md mx-auto mt-1 mb-4">
                            הוסף מפתח או הדבק רשימת מפתחות חינמיים מ-Google AI Studio כדי להפעיל את ה-AI בחינם עם גיבוי מלא.
                        </p>
                        {canManage && (
                            <button
                                type="button"
                                onClick={() => setAddKeyModal(true)}
                                className="h-8 px-4 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-[12.5px] font-medium inline-flex items-center gap-1.5 transition-colors shadow-sm"
                            >
                                <PlusIcon className="w-4 h-4" />
                                הוסף מפתח ראשון
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="rounded-lg border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-right text-[12.5px]">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium text-[11.5px]">
                                    <tr>
                                        <th className="px-4 py-2.5">שם מפתח</th>
                                        <th className="px-4 py-2.5">מפתח מוצפן</th>
                                        <th className="px-4 py-2.5">סטטוס רוטציה</th>
                                        <th className="px-4 py-2.5">בקשות / שגיאות</th>
                                        <th className="px-4 py-2.5">שימוש אחרון</th>
                                        <th className="px-4 py-2.5 text-left">פעולות</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {keys.map((k) => (
                                        <tr
                                            key={k.id}
                                            className="hover:bg-slate-50/80 transition-colors"
                                        >
                                            <td className="px-4 py-3 font-medium text-slate-900">
                                                <div className="flex items-center gap-2">
                                                    <KeyIcon className="w-3.5 h-3.5 text-slate-400" />
                                                    <span>{k.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-[11.5px] text-slate-600">
                                                {k.masked_key}
                                            </td>
                                            <td className="px-4 py-3">
                                                <KeyStatusPill keyItem={k} />
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">
                                                <span>{k.request_count}</span>
                                                <span className="text-slate-400 mx-1">/</span>
                                                <span className={k.fail_count > 0 ? "text-amber-600 font-medium" : "text-slate-400"}>
                                                    {k.fail_count}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 text-[11.5px]">
                                                {k.last_used
                                                    ? new Date(k.last_used).toLocaleString("he-IL", {
                                                          hour: "2-digit",
                                                          minute: "2-digit",
                                                          day: "2-digit",
                                                          month: "2-digit",
                                                      })
                                                    : "טרם בוצע"}
                                            </td>
                                            <td className="px-4 py-3 text-left">
                                                <div className="inline-flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleTestKey(k)}
                                                        disabled={testingKeyId === k.id}
                                                        title="בדיקת חיבור וזמן תגובה"
                                                        className="h-7 px-2.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11.5px] font-medium inline-flex items-center gap-1 transition-colors disabled:opacity-50 shadow-sm"
                                                    >
                                                        <RefreshCwIcon
                                                            className={`w-3 h-3 ${testingKeyId === k.id ? "animate-spin text-sky-600" : "text-slate-500"}`}
                                                        />
                                                        <span>בדוק</span>
                                                    </button>

                                                    {canManage && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleToggleStatus(k)}
                                                                title={k.status === "paused" ? "הפעל מפתח" : "השהה מפתח"}
                                                                className="h-7 w-7 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 inline-flex items-center justify-center transition-colors shadow-sm"
                                                            >
                                                                {k.status === "paused" ? (
                                                                    <PlayIcon className="w-3 h-3 text-emerald-600" />
                                                                ) : (
                                                                    <PauseIcon className="w-3 h-3 text-slate-500" />
                                                                )}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteKey(k)}
                                                                title="מחק מפתח"
                                                                className="h-7 w-7 rounded border border-slate-200 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 inline-flex items-center justify-center transition-colors shadow-sm"
                                                            >
                                                                <Trash2Icon className="w-3 h-3" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </Section>

            {/* Single Key Modal */}
            <AddSingleKeyModal
                open={addKeyModal}
                onClose={() => setAddKeyModal(false)}
                onSubmit={async (name, key) => {
                    await createMutation.mutateAsync({ name, key });
                    toast.success("מפתח Gemini נוסף בהצלחה");
                    setAddKeyModal(false);
                }}
            />

            {/* Bulk Import Modal */}
            <BulkImportModal
                open={bulkModal}
                onClose={() => setBulkModal(false)}
                onSubmit={async (keysText) => {
                    await createMutation.mutateAsync({ keys_text: keysText });
                    toast.success("המפתחות יובאו בהצלחה לרוטטור");
                    setBulkModal(false);
                }}
            />
        </SectionShell>
    );
}

function KeyStatusPill({ keyItem }: { keyItem: OrgGeminiKey }) {
    const now = new Date().getTime();
    const cooldownTime = keyItem.cooldown_until ? new Date(keyItem.cooldown_until).getTime() : 0;
    const inCooldown = cooldownTime > now;

    if (keyItem.status === "paused") {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                <PauseIcon className="w-2.5 h-2.5" />
                מושהה ידנית
            </span>
        );
    }

    if (keyItem.status === "disabled") {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-100 text-rose-700">
                <AlertTriangleIcon className="w-2.5 h-2.5" />
                חסום (לא תקין)
            </span>
        );
    }

    if (inCooldown) {
        const remainingSec = Math.max(0, Math.round((cooldownTime - now) / 1000));
        const remainingMin = Math.ceil(remainingSec / 60);
        return (
            <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800"
                title={keyItem.last_error || "השהיית Rate Limit"}
            >
                <ClockIcon className="w-2.5 h-2.5 text-amber-600" />
                השהיית 429 ({remainingMin} דק')
            </span>
        );
    }

    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800">
            <CheckCircle2Icon className="w-2.5 h-2.5 text-emerald-600" />
            פעיל ומוכן
        </span>
    );
}

function AddSingleKeyModal({
    open,
    onClose,
    onSubmit,
}: {
    open: boolean;
    onClose: () => void;
    onSubmit: (name: string, key: string) => Promise<void>;
}) {
    const [name, setName] = useState("");
    const [key, setKey] = useState("");
    const [loading, setLoading] = useState(false);

    if (!open) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!key.trim()) return;
        setLoading(true);
        try {
            await onSubmit(name.trim() || "Gemini Key", key.trim());
            setName("");
            setKey("");
        } catch {
            // Handled
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <KeyIcon className="w-4 h-4 text-sky-600" />
                        <h3 className="text-[14px] font-semibold text-slate-900">
                            הוספת מפתח Gemini API
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600"
                    >
                        <XIcon className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4 text-[12.5px]">
                    <div>
                        <label className="block font-medium text-slate-700 mb-1">
                            כינוי למפתח (אופציונלי)
                        </label>
                        <TextInput
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="למשל: Free Tier Key 1"
                        />
                    </div>

                    <div>
                        <label className="block font-medium text-slate-700 mb-1">
                            מפתח API מ-Google AI Studio
                        </label>
                        <TextInput
                            type="password"
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            placeholder="AIzaSy..."
                            required
                        />
                        <p className="mt-1 text-[11px] text-slate-500">
                            המפתח מוצפן במערכת באמצעות המפתח הארגוני (DEK) ולעולם אינו נחשף לצד לקוח.
                        </p>
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-8 px-3 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                        >
                            ביטול
                        </button>
                        <button
                            type="submit"
                            disabled={!key.trim() || loading}
                            className="h-8 px-4 rounded-md bg-sky-600 hover:bg-sky-700 text-white font-medium disabled:opacity-50"
                        >
                            {loading ? "שומר..." : "הוסף מפתח"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function BulkImportModal({
    open,
    onClose,
    onSubmit,
}: {
    open: boolean;
    onClose: () => void;
    onSubmit: (keysText: string) => Promise<void>;
}) {
    const [keysText, setKeysText] = useState("");
    const [loading, setLoading] = useState(false);

    if (!open) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!keysText.trim()) return;
        setLoading(true);
        try {
            await onSubmit(keysText.trim());
            setKeysText("");
        } catch {
            // Handled
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <UploadCloudIcon className="w-4 h-4 text-sky-600" />
                        <h3 className="text-[14px] font-semibold text-slate-900">
                            ייבוא מרובה של מפתחות API
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600"
                    >
                        <XIcon className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4 text-[12.5px]">
                    <div>
                        <label className="block font-medium text-slate-700 mb-1">
                            הדבק מפתחות (מפתח אחד בכל שורה)
                        </label>
                        <textarea
                            rows={7}
                            value={keysText}
                            onChange={(e) => setKeysText(e.target.value)}
                            placeholder={`AIzaSyB123...\nAIzaSyB456...\nKey3 AIzaSyB789...`}
                            className="w-full p-2.5 text-[12px] font-mono border border-slate-200 rounded-md focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none"
                            required
                        />
                        <p className="mt-1 text-[11px] text-slate-500">
                            ניתן להדביק רק את המפתח, או כינוי מופרד ברווח לפני המפתח. שורות ריקות ידלגו אוטומטית.
                        </p>
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-8 px-3 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                        >
                            ביטול
                        </button>
                        <button
                            type="submit"
                            disabled={!keysText.trim() || loading}
                            className="h-8 px-4 rounded-md bg-sky-600 hover:bg-sky-700 text-white font-medium disabled:opacity-50"
                        >
                            {loading ? "מייבא..." : "ייבא מפתחות לרוטטור"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
