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
    SearchIcon,
    GlobeIcon,
    BotIcon,
    SparklesIcon,
    SendIcon,
    SlidersHorizontalIcon,
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
import {
    useSerperKeys,
    useSerperStats,
    useBDRSettings,
    useCreateSerperKeys,
    useDeleteSerperKey,
    useUpdateSerperKeyStatus,
    useTestSerperKey,
    useUpdateBDRSettings,
} from "@/lib/api/hooks/app/agent/useSerperKeys";
import type {
    OrgSerperKey,
    SerperKeyStatus,
    BDRSettings,
} from "@/lib/api/client/app/agent/serperKeys";

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

    // Serper & BDR state & mutations
    const { data: serperKeys = [], isLoading: serperKeysLoading } = useSerperKeys();
    const { data: serperStats } = useSerperStats();
    const { data: bdrSettingsData } = useBDRSettings();

    const createSerperMutation = useCreateSerperKeys();
    const deleteSerperMutation = useDeleteSerperKey();
    const updateSerperStatusMutation = useUpdateSerperKeyStatus();
    const testSerperMutation = useTestSerperKey();
    const updateBDRMutation = useUpdateBDRSettings();

    const [addSerperModal, setAddSerperModal] = useState(false);
    const [bulkSerperModal, setBulkSerperModal] = useState(false);
    const [testingSerperKeyId, setTestingSerperKeyId] = useState<string | null>(null);

    const bdrSettings: BDRSettings = bdrSettingsData || {
        inbox_auto_send_enabled: false,
        inbox_auto_send_min_confidence: 0.85,
        first_reply_website_crawl: true,
        signature_extraction_enabled: true,
    };

    const handleUpdateBDR = async (partial: Partial<BDRSettings>) => {
        if (!canManage) return;
        try {
            await updateBDRMutation.mutateAsync({
                ...bdrSettings,
                ...partial,
            });
            toast.success("הגדרות BDR עודכנו");
        } catch {
            toast.error("שגיאה בעדכון הגדרות BDR");
        }
    };

    const handleTestSerperKey = async (key: OrgSerperKey) => {
        setTestingSerperKeyId(key.id);
        try {
            const res = await testSerperMutation.mutateAsync(key.id);
            if (res.success) {
                toast.success(
                    `מפתח Serper תקין! יתרה: ${res.credits ?? 2500} שאילתות (${res.latency_ms}ms)`,
                );
            } else {
                toast.error(`בדיקת מפתח נכשלה: ${res.error || "שגיאה לא ידועה"}`);
            }
        } catch {
            toast.error("שגיאה בביצוע בדיקת מפתח Serper");
        } finally {
            setTestingSerperKeyId(null);
        }
    };

    const handleDeleteSerperKey = (key: OrgSerperKey) => {
        confirm.show(
            `האם למחוק את מפתח Serper "${key.name}" (${key.masked_key})?`,
            async () => {
                try {
                    await deleteSerperMutation.mutateAsync(key.id);
                    toast.success("מפתח Serper נמחק בהצלחה");
                } catch {
                    toast.error("שגיאה במחיקת מפתח");
                }
            },
        );
    };

    const handleToggleSerperStatus = async (key: OrgSerperKey) => {
        const nextStatus: SerperKeyStatus =
            key.status === "paused" ? "active" : "paused";
        try {
            await updateSerperStatusMutation.mutateAsync({
                id: key.id,
                status: nextStatus,
            });
            toast.success(
                nextStatus === "active" ? "מפתח Serper הופעל" : "מפתח Serper הושהה",
            );
        } catch {
            toast.error("שגיאה בעדכון סטטוס מפתח Serper");
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
                                on={config.fallback_enabled}
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

            {/* Autonomous BDR & Enrichment Engine */}
            <Section
                eyebrow="מנוע BDR והעשרת נתונים אוטונומי"
                description="הגדרות בינה מלאכותית למענה אוטונומי ב-Unibox, סריקת אתרי לקוחות מחתימות מיילים והעשרת כרטיסי אנשי קשר."
            >
                <div className="space-y-4">
                    <div className="p-4 rounded-lg border border-slate-200/80 bg-white space-y-4">
                        <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <BotIcon className="w-4 h-4 text-sky-600" />
                                    <span className="text-[13px] font-semibold text-slate-900">
                                        מענה אוטונומי ללידים (Auto-Send) ב-Unibox
                                    </span>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800">
                                        סוכנות B2B
                                    </span>
                                </div>
                                <p className="text-[12px] text-slate-600">
                                    ה-AI ינסח וישלח תגובה מותאמת אישית ישירות ללידים שהביעו עניין או ביקשו פגישה, כולל בדיקת Deliverability & Spam Guardrail וחתימת המייל שלך.
                                </p>
                            </div>
                            <Toggle
                                on={bdrSettings.inbox_auto_send_enabled}
                                onChange={(on) => handleUpdateBDR({ inbox_auto_send_enabled: on })}
                                disabled={!canManage}
                            />
                        </div>

                        {bdrSettings.inbox_auto_send_enabled && (
                            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <span className="text-[12px] font-medium text-slate-800">
                                        סף ביטחון מינימלי למשלוח אוטונומי
                                    </span>
                                    <p className="text-[11px] text-slate-500">
                                        מענה יישלח אוטומטית רק אם רמת הוודאות של המודל בזיהוי כוונת הליד עולה על סף זה. מתחת לסף תיווצר טיוטה לאישור ידני.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={bdrSettings.inbox_auto_send_min_confidence}
                                        onChange={(e) => handleUpdateBDR({ inbox_auto_send_min_confidence: parseFloat(e.target.value) })}
                                        disabled={!canManage}
                                        className="h-8 px-2.5 rounded-md border border-slate-200 bg-white text-[12px] font-medium text-slate-700 outline-none focus:border-sky-400"
                                    >
                                        <option value="0.75">75% ומעלה (מתירני)</option>
                                        <option value="0.80">80% ומעלה</option>
                                        <option value="0.85">85% ומעלה (מומלץ)</option>
                                        <option value="0.90">90% ומעלה (שמרני)</option>
                                        <option value="0.95">95% ומעלה (קפדני ביותר)</option>
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg border border-slate-200/80 bg-white flex items-start justify-between gap-3">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <GlobeIcon className="w-4 h-4 text-emerald-600" />
                                    <span className="text-[13px] font-semibold text-slate-900">
                                        סריקת אתר הליד במענה ראשון
                                    </span>
                                </div>
                                <p className="text-[12px] text-slate-600">
                                    סריקה מאובטחת של דומיין הליד בעת קבלת המענה הראשון, לשליפת תחום פעילות ושילוב תובנות עסקיות בתשובה.
                                </p>
                            </div>
                            <Toggle
                                on={bdrSettings.first_reply_website_crawl}
                                onChange={(on) => handleUpdateBDR({ first_reply_website_crawl: on })}
                                disabled={!canManage}
                            />
                        </div>

                        <div className="p-4 rounded-lg border border-slate-200/80 bg-white flex items-start justify-between gap-3">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <SparklesIcon className="w-4 h-4 text-purple-600" />
                                    <span className="text-[13px] font-semibold text-slate-900">
                                        חילוץ נתונים מחתימת המייל
                                    </span>
                                </div>
                                <p className="text-[12px] text-slate-600">
                                    זיהוי אוטומטי של מספרי טלפון, תפקיד, שם חברה וקישורי אתר מחתימת המייל הנכנס ועדכון פרטי הליד.
                                </p>
                            </div>
                            <Toggle
                                on={bdrSettings.signature_extraction_enabled}
                                onChange={(on) => handleUpdateBDR({ signature_extraction_enabled: on })}
                                disabled={!canManage}
                            />
                        </div>
                    </div>
                </div>
            </Section>

            {/* Serper Google Search Keys & Rotator */}
            <Section
                eyebrow="רוטטור מפתחות Serper (חיפוש Google)"
                description="חיפוש Google בזמן אמת להעשרת לידים, חקירת חברות ומציאת אתרים. כולל מעקב מדויק אחר מכסת 2,500 השאילתות לכל מפתח חינמי ורוטציה אוטומטית."
                actions={
                    canManage && (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setBulkSerperModal(true)}
                                className="h-7 px-2.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors shadow-sm"
                            >
                                <UploadCloudIcon className="w-3.5 h-3.5 text-slate-500" />
                                ייבוא מרובה
                            </button>
                            <button
                                type="button"
                                onClick={() => setAddSerperModal(true)}
                                className="h-7 px-3 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors shadow-sm"
                            >
                                <PlusIcon className="w-3.5 h-3.5" />
                                הוסף מפתח Serper
                            </button>
                        </div>
                    )
                }
            >
                {/* Serper stats tiles */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <div className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/50">
                        <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                            יתרת שאילתות זמינה
                        </div>
                        <div className="mt-1 flex items-baseline gap-2">
                            <span className="text-xl font-bold text-slate-900">
                                {(serperStats?.remaining_credits ?? serperKeys.reduce((acc, k) => acc + k.remaining_credits, 0)).toLocaleString()}
                            </span>
                            <span className="text-[11.5px] text-slate-500">
                                קרדיטים
                            </span>
                        </div>
                    </div>

                    <div className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/50">
                        <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                            שאילתות שבוצעו
                        </div>
                        <div className="mt-1 flex items-baseline gap-2">
                            <span className="text-xl font-bold text-slate-900">
                                {(serperStats?.total_requests ?? serperKeys.reduce((acc, k) => acc + k.request_count, 0)).toLocaleString()}
                            </span>
                            <span className="text-[11.5px] text-slate-500">
                                חיפושים
                            </span>
                        </div>
                    </div>

                    <div className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/50">
                        <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                            מפתחות פעילים
                        </div>
                        <div className="mt-1 flex items-baseline gap-2">
                            <span className="text-xl font-bold text-emerald-700">
                                {serperStats?.active_keys ?? serperKeys.filter((k) => k.status === "active").length}
                            </span>
                            <span className="text-[11.5px] text-slate-500">
                                מתוך {serperKeys.length}
                            </span>
                        </div>
                    </div>

                    <div className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/50">
                        <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                            מפתחות שמוצו (2,500)
                        </div>
                        <div className="mt-1 flex items-baseline gap-2">
                            <span className="text-xl font-bold text-slate-700">
                                {serperStats?.exhausted_keys ?? serperKeys.filter((k) => k.status === "exhausted" || k.remaining_credits <= 0).length}
                            </span>
                            <span className="text-[11.5px] text-slate-500">
                                מלאים
                            </span>
                        </div>
                    </div>
                </div>

                {/* Serper Keys Table */}
                {serperKeys.length === 0 ? (
                    <div className="p-8 text-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50">
                        <SearchIcon className="w-8 h-8 mx-auto text-slate-300" />
                        <h4 className="mt-2 text-[13px] font-semibold text-slate-800">
                            טרם הוגדרו מפתחות Serper
                        </h4>
                        <p className="mt-1 text-[12px] text-slate-500 max-w-sm mx-auto">
                            הוסף מפתחות Serper (כל חשבון חינמי מקבל 2,500 שאילתות חיפוש) להעשרת לידים וחקר שוק אוטונומי.
                        </p>
                        {canManage && (
                            <div className="mt-4 flex items-center justify-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setBulkSerperModal(true)}
                                    className="h-7 px-3 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-medium transition-colors shadow-sm"
                                >
                                    ייבוא מרובה
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAddSerperModal(true)}
                                    className="h-7 px-3 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-[12px] font-medium transition-colors shadow-sm"
                                >
                                    הוסף מפתח ראשון
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                        <div className="overflow-x-auto">
                            <table className="w-full text-right text-[12.5px]">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-medium">
                                        <th className="py-2.5 px-3">שם מפתח</th>
                                        <th className="py-2.5 px-3">מפתח API מוסתר</th>
                                        <th className="py-2.5 px-3">ניצול מכסה (עד 2,500)</th>
                                        <th className="py-2.5 px-3">סטטוס</th>
                                        <th className="py-2.5 px-3 text-left">פעולות</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {serperKeys.map((k) => {
                                        const used = Math.min(2500, k.request_count);
                                        const pct = Math.min(100, Math.round((used / 2500) * 100));
                                        return (
                                            <tr key={k.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="py-2.5 px-3 font-medium text-slate-900">
                                                    {k.name}
                                                </td>
                                                <td className="py-2.5 px-3 font-mono text-[12px] text-slate-600">
                                                    {k.masked_key}
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    <div className="w-full max-w-[140px]">
                                                        <div className="flex items-center justify-between text-[10.5px] text-slate-500 mb-1">
                                                            <span>{used.toLocaleString()} / 2,500</span>
                                                            <span className="font-semibold">{pct}%</span>
                                                        </div>
                                                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all ${
                                                                    pct >= 95
                                                                        ? "bg-rose-500"
                                                                        : pct >= 75
                                                                        ? "bg-amber-500"
                                                                        : "bg-sky-500"
                                                                }`}
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    <SerperKeyStatusPill keyItem={k} />
                                                </td>
                                                <td className="py-2.5 px-3 text-left">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleTestSerperKey(k)}
                                                            disabled={testingSerperKeyId === k.id}
                                                            title="בדיקת תקינות מפתח"
                                                            className="h-7 px-2 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-medium inline-flex items-center gap-1 transition-colors shadow-sm disabled:opacity-50"
                                                        >
                                                            <RefreshCwIcon
                                                                className={`w-3 h-3 text-slate-500 ${
                                                                    testingSerperKeyId === k.id ? "animate-spin" : ""
                                                                }`}
                                                            />
                                                            בדוק
                                                        </button>
                                                        {canManage && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleToggleSerperStatus(k)}
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
                                                                    onClick={() => handleDeleteSerperKey(k)}
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
                                        );
                                    })}
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

            {/* Single Serper Key Modal */}
            <AddSingleSerperKeyModal
                open={addSerperModal}
                onClose={() => setAddSerperModal(false)}
                onSubmit={async (name, key) => {
                    await createSerperMutation.mutateAsync({ name, key });
                    toast.success("מפתח Serper נוסף בהצלחה");
                    setAddSerperModal(false);
                }}
            />

            {/* Bulk Import Serper Modal */}
            <BulkImportSerperModal
                open={bulkSerperModal}
                onClose={() => setBulkSerperModal(false)}
                onSubmit={async (keysText) => {
                    await createSerperMutation.mutateAsync({ keys_text: keysText });
                    toast.success("מפתחות Serper יובאו בהצלחה לרוטטור");
                    setBulkSerperModal(false);
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
                            onChange={setName}
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
                            onChange={setKey}
                            placeholder="AIzaSy..."
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

function SerperKeyStatusPill({ keyItem }: { keyItem: OrgSerperKey }) {
    const now = new Date().getTime();
    const cooldownTime = keyItem.cooldown_until ? new Date(keyItem.cooldown_until).getTime() : 0;
    const inCooldown = cooldownTime > now;

    if (keyItem.status === "exhausted" || keyItem.remaining_credits <= 0) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-100 text-rose-700">
                <AlertTriangleIcon className="w-2.5 h-2.5" />
                מכסה מוצתה (2,500/2,500)
            </span>
        );
    }

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
                לא תקין
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
            פעיל ({keyItem.remaining_credits.toLocaleString()} נותרו)
        </span>
    );
}

function AddSingleSerperKeyModal({
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
            await onSubmit(name.trim() || "Serper Key", key.trim());
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
                        <SearchIcon className="w-4 h-4 text-sky-600" />
                        <h3 className="text-[14px] font-semibold text-slate-900">
                            הוספת מפתח Serper (Google Search)
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
                            כינוי למפתח (למשל: Serper Account 1)
                        </label>
                        <TextInput
                            value={name}
                            onChange={setName}
                            placeholder="Serper Account 1"
                            className="w-full"
                        />
                    </div>

                    <div>
                        <label className="block font-medium text-slate-700 mb-1">
                            מפתח API מ-serper.dev
                        </label>
                        <TextInput
                            type="password"
                            value={key}
                            onChange={setKey}
                            placeholder="הזן מפתח API של Serper"
                            className="w-full font-mono text-[12px]"
                        />
                        <p className="mt-1 text-[11px] text-slate-500">
                            כל מפתח נרשם עם מכסה של 2,500 שאילתות חיפוש חינמיות ומוצפן במפתח הארגון (Org DEK).
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

function BulkImportSerperModal({
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
                            ייבוא מרובה של מפתחות Serper
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
                            הדבק מפתחות Serper (מפתח אחד בכל שורה)
                        </label>
                        <textarea
                            rows={7}
                            value={keysText}
                            onChange={(e) => setKeysText(e.target.value)}
                            placeholder={`serper_key_1...\nserper_key_2...\nAccount3 serper_key_3...`}
                            className="w-full p-2.5 text-[12px] font-mono border border-slate-200 rounded-md focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none"
                            required
                        />
                        <p className="mt-1 text-[11px] text-slate-500">
                            ניתן להדביק רק את המפתח, או כינוי מופרד ברווח לפני המפתח. כל מפתח מקבל אוטומטית הקצאה של 2,500 שאילתות.
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

