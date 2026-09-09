// AIEditPopover — the floating "edit this with AI" card shared by every
// composer surface (unibox textarea, campaign rich editor). Pure UI: the host
// owns selection tracking, positioning, and applying the rewrite; this renders
// the instruction input, quick actions, the busy shimmer, and the post-apply
// review row (undo / try again).

import React from "react";
import { useTranslation } from "react-i18next";
import { Kbd } from "@/components/ui/shortcut-tooltip";
import formatUsage from "./usage";
import {
    ArrowUpIcon,
    CheckIcon,
    Undo2Icon,
    RefreshCwIcon,
    SparklesIcon,
    WandSparklesIcon,
    MinusIcon,
    PlusIcon,
    SpellCheckIcon,
    SmileIcon,
    BriefcaseIcon,
} from "lucide-react";

export interface AIQuickAction {
    key: string;
    label: string;
    icon: React.ReactNode;
    instruction: string;
}

export const AI_QUICK_ACTIONS: AIQuickAction[] = [
    {
        key: "improve",
        label: "Improve",
        icon: <WandSparklesIcon className="w-3 h-3" />,
        instruction:
            "Improve the writing: clearer, smoother, better flow. Keep the meaning and roughly the same length.",
    },
    {
        key: "shorten",
        label: "Shorten",
        icon: <MinusIcon className="w-3 h-3" />,
        instruction: "Make this more concise. Cut filler and keep the meaning.",
    },
    {
        key: "expand",
        label: "Expand",
        icon: <PlusIcon className="w-3 h-3" />,
        instruction: "Expand this slightly with more substance and specificity. No fluff.",
    },
    {
        key: "grammar",
        label: "Fix grammar",
        icon: <SpellCheckIcon className="w-3 h-3" />,
        instruction: "Fix spelling, grammar, and punctuation only. Change nothing else.",
    },
    {
        key: "friendlier",
        label: "Friendlier",
        icon: <SmileIcon className="w-3 h-3" />,
        instruction: "Make the tone warmer and friendlier without getting sappy.",
    },
    {
        key: "formal",
        label: "More formal",
        icon: <BriefcaseIcon className="w-3 h-3" />,
        instruction: "Make the tone more professional and polished.",
    },
];

export const AI_QUICK_ACTIONS_HE: AIQuickAction[] = [
    {
        key: "improve",
        label: "שפר",
        icon: <WandSparklesIcon className="w-3 h-3" />,
        instruction:
            "שפר את הכתיבה בעברית: בהירה יותר, זורמת ומנוסחת טוב יותר. שמור על המשמעות ועל האורך.",
    },
    {
        key: "shorten",
        label: "קצר",
        icon: <MinusIcon className="w-3 h-3" />,
        instruction: "קצר ותמצת את הטקסט בעברית. הסר מילים מיותרות ושמור על המסר העיקרי.",
    },
    {
        key: "expand",
        label: "הרחב",
        icon: <PlusIcon className="w-3 h-3" />,
        instruction: "הרחב מעט את הטקסט בעברית עם עוד עומק ודיוק ענייני, בלי מריחות.",
    },
    {
        key: "grammar",
        label: "תקן לשון",
        icon: <SpellCheckIcon className="w-3 h-3" />,
        instruction: "תקן שגיאות כתיב, דקדוק ופיסוק בעברית בלבד. אל תשנה שום דבר אחר.",
    },
    {
        key: "friendlier",
        label: "חם ואישי",
        icon: <SmileIcon className="w-3 h-3" />,
        instruction: "שכתב בנימה חמה, ידידותית ונגישה יותר בעברית בגובה העיניים.",
    },
    {
        key: "formal",
        label: "מקצועי",
        icon: <BriefcaseIcon className="w-3 h-3" />,
        instruction: "שכתב בנימה עסקית, מקצועית ומלוטשת יותר בעברית.",
    },
];

export type AIEditPhase = "idle" | "busy" | "applied";

interface AIEditPopoverProps {
    phase: AIEditPhase;
    // What the last run actually cost (usage-based settle), when metered.
    usage: { charged: number; tokens: number } | null;
    onRun: (instruction: string) => void;
    onUndo: () => void;
    onRetry: () => void;
    onDone: () => void;
}

export default function AIEditPopover({
    phase,
    usage,
    onRun,
    onUndo,
    onRetry,
    onDone,
}: AIEditPopoverProps) {
    const { i18n } = useTranslation();
    const isHe = i18n.language === "he";
    const quickActions = isHe ? AI_QUICK_ACTIONS_HE : AI_QUICK_ACTIONS;

    const [instruction, setInstruction] = React.useState("");
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (phase === "idle") inputRef.current?.focus();
    }, [phase]);

    const run = () => {
        const text = instruction.trim();
        if (!text) return;
        onRun(text);
    };

    if (phase === "busy") {
        return (
            <div dir={isHe ? "rtl" : "ltr"} className="w-[300px] px-3 py-2.5 flex items-center gap-2">
                <SparklesIcon className="w-3.5 h-3.5 text-sky-500 animate-pulse shrink-0" />
                <span className="ai-shimmer-text text-[12px] font-medium">{isHe ? "משכתב…" : "Rewriting…"}</span>
                <span className="mr-auto rtl:mr-auto rtl:ml-0 ltr:ml-auto inline-flex items-center gap-1 text-[10px] text-slate-400">
                    <Kbd combo="esc" variant="light" /> {isHe ? "ביטול" : "cancel"}
                </span>
            </div>
        );
    }

    if (phase === "applied") {
        const usageText = usage ? formatUsage(usage.charged, usage.tokens) : "";
        return (
            <div dir={isHe ? "rtl" : "ltr"} className="w-[300px] px-2.5 py-2 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-900 mr-auto rtl:mr-0 rtl:ml-auto">
                    <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
                    {isHe ? "שוכתב" : "Rewritten"}
                    {usageText && (
                        <span className="text-[10.5px] font-normal text-slate-400">
                            · {usageText}
                        </span>
                    )}
                </span>
                <button
                    type="button"
                    onClick={onUndo}
                    className="h-6 px-1.5 rounded inline-flex items-center gap-1 text-[11.5px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                    <Undo2Icon className="w-3 h-3" />
                    {isHe ? "בטל" : "Undo"}
                </button>
                <button
                    type="button"
                    onClick={onRetry}
                    className="h-6 px-1.5 rounded inline-flex items-center gap-1 text-[11.5px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                    <RefreshCwIcon className="w-3 h-3" />
                    {isHe ? "שוב" : "Again"}
                </button>
                <button
                    type="button"
                    onClick={onDone}
                    className="h-6 px-2 rounded bg-slate-900 text-white text-[11.5px] font-medium hover:bg-slate-700 transition-colors"
                >
                    {isHe ? "סיום" : "Done"}
                </button>
            </div>
        );
    }

    return (
        <div dir={isHe ? "rtl" : "ltr"} className="w-[300px]">
            <div className="flex items-center gap-1.5 px-2.5 pt-2.5">
                <SparklesIcon className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                <input
                    ref={inputRef}
                    dir="auto"
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            run();
                        }
                    }}
                    placeholder={isHe ? "הסבר ל-AI כיצד לערוך…" : "Tell AI how to change it…"}
                    maxLength={2000}
                    className="flex-1 min-w-0 h-7 bg-transparent text-[12.5px] text-slate-900 placeholder:text-slate-400 outline-none"
                />
                <button
                    type="button"
                    onClick={run}
                    disabled={!instruction.trim()}
                    aria-label={isHe ? "שכתב בחירה" : "Rewrite selection"}
                    className="size-6 rounded-md bg-sky-600 text-white inline-flex items-center justify-center hover:bg-sky-700 transition-colors disabled:opacity-40 shrink-0"
                >
                    <ArrowUpIcon className="w-3.5 h-3.5" />
                </button>
            </div>
            <div className="px-2.5 pb-2 pt-2 flex flex-wrap gap-1">
                {quickActions.map((a) => (
                    <button
                        key={a.key}
                        type="button"
                        onClick={() => onRun(a.instruction)}
                        className="h-6 px-2 rounded-full border border-slate-200 inline-flex items-center gap-1 text-[11px] text-slate-600 hover:border-sky-300 hover:text-sky-700 hover:bg-sky-50 transition-colors"
                    >
                        {a.icon}
                        {a.label}
                    </button>
                ))}
            </div>
            <div className="px-2.5 pb-2 flex items-center gap-2.5 text-[10px] text-slate-400">
                <span className="inline-flex items-center gap-1">
                    <Kbd combo="enter" variant="light" /> {isHe ? "שכתב" : "rewrite"}
                </span>
                <span className="inline-flex items-center gap-1">
                    <Kbd combo="esc" variant="light" /> {isHe ? "סגור" : "close"}
                </span>
            </div>
        </div>
    );
}
