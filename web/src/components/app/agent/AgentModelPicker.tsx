import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    CpuIcon,
    ChevronDownIcon,
    CheckIcon,
    LayersIcon,
    SettingsIcon,
    SparklesIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAppStore } from "@/stores";

export const GEMINI_PANEL_MODELS = [
    {
        id: "gemini-3.8-flash",
        name: "Gemini 3.8 Flash",
        badge: "ראשי",
        description: "הדגם החדש והמהיר ביותר",
    },
    {
        id: "gemini-3.7-flash",
        name: "Gemini 3.7 Flash",
        badge: "גיבוי 1",
        description: "חכם, יציב ומהיר",
    },
    {
        id: "gemini-3.6-flash",
        name: "Gemini 3.6 Flash",
        badge: "גיבוי 2",
        description: "מאוזן ואמין לעבודה רציפה",
    },
    {
        id: "gemini-3.5-flash-lite",
        name: "Gemini 3.5 Flash-Lite",
        badge: "גיבוי 3",
        description: "קל משקל ומגיב מיידית",
    },
];

export default function AgentModelPicker() {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const activeKey = useAppStore((s) => s.agentActiveKey);
    const activeTab = useAppStore((s) =>
        s.agentTabs.find((t) => t.key === activeKey),
    );
    const patchTab = useAppStore((s) => s.agentPatchTab);

    const currentModelId = activeTab?.model || "gemini-3.8-flash";
    const currentModel =
        GEMINI_PANEL_MODELS.find((m) => m.id === currentModelId) ||
        GEMINI_PANEL_MODELS[0];

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        }
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false);
        }
        if (open) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleKeyDown);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [open]);

    const handleSelectModel = (modelId: string) => {
        if (activeKey) {
            patchTab(activeKey, { model: modelId });
        }
        setOpen(false);
    };

    return (
        <div ref={containerRef} className="relative inline-block text-right">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="h-7 px-2 rounded-md border border-slate-200 hover:border-slate-300 bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 text-[11.5px] font-medium inline-flex items-center gap-1.5 transition-colors shadow-xs"
                title="החלף מודל AI"
            >
                <CpuIcon className="w-3.5 h-3.5 text-sky-600" />
                <span className="font-semibold text-slate-800">
                    {currentModel.name}
                </span>
                <ChevronDownIcon
                    className={`w-3 h-3 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
                />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-1 w-64 rounded-lg border border-slate-200 bg-white shadow-lg p-1.5 z-50 text-[12px]"
                    >
                        <div className="px-2.5 py-1.5 border-b border-slate-100 flex items-center justify-between mb-1">
                            <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                                מודל פעיל לשיחה זו
                            </span>
                            <span className="text-[10.5px] text-sky-600 font-medium flex items-center gap-1">
                                <SparklesIcon className="w-2.5 h-2.5" />
                                Gemini Flash
                            </span>
                        </div>

                        <div className="space-y-0.5">
                            {GEMINI_PANEL_MODELS.map((m) => {
                                const selected = m.id === currentModelId;
                                return (
                                    <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => handleSelectModel(m.id)}
                                        className={`w-full p-2 rounded-md flex items-center justify-between text-right transition-colors ${
                                            selected
                                                ? "bg-sky-50 text-sky-900 font-medium"
                                                : "hover:bg-slate-50 text-slate-700"
                                        }`}
                                    >
                                        <div className="min-w-0 pr-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className="truncate">
                                                    {m.name}
                                                </span>
                                                <span
                                                    className={`text-[9.5px] px-1 py-0.2 rounded ${
                                                        selected
                                                            ? "bg-sky-200/80 text-sky-900"
                                                            : "bg-slate-100 text-slate-500"
                                                    }`}
                                                >
                                                    {m.badge}
                                                </span>
                                            </div>
                                            <div className="text-[10.5px] text-slate-500 truncate">
                                                {m.description}
                                            </div>
                                        </div>
                                        {selected && (
                                            <CheckIcon className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Fallback & Settings Footer */}
                        <div className="mt-1.5 pt-1.5 border-t border-slate-100 px-2 py-1 text-[11px] text-slate-500 flex items-center justify-between">
                            <div className="flex items-center gap-1 text-[10.5px] text-emerald-700">
                                <LayersIcon className="w-3 h-3 text-emerald-600" />
                                <span>גיבוי רב-שלבי פעיל</span>
                            </div>
                            <Link
                                to="/app/settings/ai-models"
                                onClick={() => setOpen(false)}
                                className="text-slate-400 hover:text-sky-600 flex items-center gap-1 transition-colors"
                                title="ניהול מפתחות ומודלים בהגדרות"
                            >
                                <SettingsIcon className="w-3 h-3" />
                                <span className="text-[10px]">הגדרות</span>
                            </Link>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
