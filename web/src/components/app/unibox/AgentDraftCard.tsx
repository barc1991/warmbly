import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SparklesIcon, SendIcon, Trash2Icon, Loader2Icon } from "lucide-react";
import toast from "react-hot-toast";

import useAgentDrafts from "@/lib/api/hooks/app/unibox/useAgentDrafts";
import { approveAgentDraft, discardAgentDraft } from "@/lib/api/client/app/unibox/agentDrafts";
import { useConfirm } from "@/hooks/context/confirm";

function getIntentBadge(intentClass: string, isHe: boolean) {
    switch (intentClass) {
        case "INTERESTED":
            return {
                label: isHe ? "מתעניין / חיובי" : "Interested",
                cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
            };
        case "MEETING_REQUEST":
            return {
                label: isHe ? "תיאום פגישה" : "Meeting Request",
                cls: "bg-sky-50 text-sky-700 border-sky-200",
            };
        case "OUT_OF_OFFICE":
            return {
                label: isHe ? "מחוץ למשרד" : "Out of Office",
                cls: "bg-amber-50 text-amber-700 border-amber-200",
            };
        case "REFERRAL":
            return {
                label: isHe ? "הפניה לקולגה" : "Referral",
                cls: "bg-purple-50 text-purple-700 border-purple-200",
            };
        case "NOT_INTERESTED":
            return {
                label: isHe ? "לא מעוניין" : "Not Interested",
                cls: "bg-rose-50 text-rose-700 border-rose-200",
            };
        case "UNSUBSCRIBE":
            return {
                label: isHe ? "בקשת הסרה" : "Unsubscribe",
                cls: "bg-rose-50 text-rose-700 border-rose-200",
            };
        default:
            return {
                label: intentClass || (isHe ? "מענה כללי" : "General"),
                cls: "bg-slate-100 text-slate-700 border-slate-200",
            };
    }
}

function extractKeyInsight(researchNotes?: string): string {
    if (!researchNotes) return "";
    const lines = researchNotes.split("\n");
    for (const line of lines) {
        if (line.startsWith("Key Insight:")) {
            return line.replace("Key Insight:", "").trim();
        }
    }
    return lines[0]?.trim() || "";
}

// AgentDraftCard surfaces the inbox agent's suggested reply for the open thread,
// awaiting a human decision. The body is editable inline: "Approve & send" sends
// the (possibly edited) text through the normal reply path; "Discard" dismisses
// it. Nothing is ever sent without one of these explicit actions.
export default function AgentDraftCard({ threadId }: { threadId: string }) {
    const { i18n } = useTranslation();
    const isHe = i18n.language === "he";
    const drafts = useAgentDrafts();
    const draft = useMemo(
        () => (drafts.data?.data ?? []).find((d) => d.thread_id === threadId && d.status === "pending"),
        [drafts.data, threadId],
    );

    const [body, setBody] = useState("");
    useEffect(() => {
        // Seed the editor when a draft arrives (or changes).
        if (draft) setBody(draft.body);
    }, [draft?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const queryClient = useQueryClient();
    const confirm = useConfirm();

    const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: ["unibox", "agent-drafts"] });
        void queryClient.invalidateQueries({ queryKey: ["unibox", "overview"] });
        void queryClient.invalidateQueries({ queryKey: ["unibox", "thread", threadId] });
    };

    const approve = useMutation({
        mutationFn: () => approveAgentDraft(draft!.id, body),
        onSuccess: () => {
            toast.success(isHe ? "התשובה נשלחה" : "Reply sent");
            refresh();
        },
        onError: () => toast.error(isHe ? "לא ניתן לשלוח את התשובה" : "Could not send the reply"),
    });

    const discard = useMutation({
        mutationFn: () => discardAgentDraft(draft!.id),
        onSuccess: () => {
            toast.success(isHe ? "הטיוטה נמחקה" : "Draft discarded");
            refresh();
        },
        onError: () => toast.error(isHe ? "לא ניתן למחוק את הטיוטה" : "Could not discard the draft"),
    });

    if (!draft) return null;

    const busy = approve.isPending || discard.isPending;
    const intent = getIntentBadge(draft.intent_class, isHe);
    const confidencePct = draft.confidence ? Math.round(draft.confidence * 100) : null;
    const keyInsight = extractKeyInsight(draft.research_notes);
    const sig = draft.signature_data;

    return (
        <div
            dir={isHe ? "rtl" : "ltr"}
            className="shrink-0 border-t border-slate-200 bg-gradient-to-b from-violet-50/70 to-white px-3 py-2.5"
        >
            <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-600 ring-1 ring-violet-200/70">
                    <SparklesIcon className="w-3 h-3" />
                </span>
                <span className="text-[12.5px] font-semibold text-slate-800">
                    {isHe ? "טיוטת מענה BDR אוטונומי" : "BDR AI reply draft"}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium border ${intent.cls}`}>
                    {intent.label}
                </span>
                {confidencePct != null && (
                    <span className="rounded-full bg-slate-100 border border-slate-200/80 px-1.5 py-0.5 text-[10.5px] font-medium text-slate-600">
                        {confidencePct}% {isHe ? "ביטחון" : "confidence"}
                    </span>
                )}
                <span className="ms-auto text-[10.5px] text-slate-400">
                    {isHe ? "בדיקה לפני שליחה" : "Review before sending"}
                </span>
            </div>

            {/* BDR Rationale & Extracted Insights */}
            {(keyInsight || (sig && (sig.phone || sig.title || sig.company))) && (
                <div className="mt-2 rounded-md border border-violet-200/60 bg-violet-50/40 p-2 text-[11.5px] space-y-1">
                    {keyInsight && (
                        <div className="flex items-start gap-1.5 text-slate-700">
                            <span className="font-semibold text-violet-700 shrink-0">
                                {isHe ? "תובנת BDR:" : "Key Insight:"}
                            </span>
                            <span className="leading-snug">{keyInsight}</span>
                        </div>
                    )}
                    {sig && (sig.phone || sig.title || sig.company) && (
                        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-violet-100 text-[11px] text-slate-600">
                            <span className="font-medium text-violet-600">
                                {isHe ? "חולץ מחתימה:" : "From Signature:"}
                            </span>
                            {sig.title && <span>{String(sig.title)}</span>}
                            {sig.company && <span>ב-{String(sig.company)}</span>}
                            {sig.phone && <span className="font-mono">{String(sig.phone)}</span>}
                        </div>
                    )}
                </div>
            )}

            <p className="mt-1.5 truncate text-[11px] text-slate-500">
                {isHe ? "מענה ל-" : "Reply to "}
                <span className="font-medium text-slate-700">{draft.to_addr}</span>
            </p>

            <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                dir="auto"
                disabled={busy}
                className="mt-2 w-full resize-y rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] leading-relaxed text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:opacity-60"
            />

            <div className="mt-2 flex items-center gap-1.5">
                <button
                    type="button"
                    onClick={() => approve.mutate()}
                    disabled={busy || body.trim() === ""}
                    className="h-7 px-2.5 rounded-md bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors"
                >
                    {approve.isPending ? <Loader2Icon className="w-3 h-3 animate-spin" /> : <SendIcon className="w-3 h-3" />}
                    {isHe ? "אישור ושליחה" : "Approve & send"}
                </button>
                <button
                    type="button"
                    onClick={() =>
                        confirm.show(isHe ? "למחוק טיוטת AI זו?" : "Discard this AI draft?", async () => {
                            await discard.mutateAsync();
                        })
                    }
                    disabled={busy}
                    className="h-7 px-2 rounded-md border border-slate-200 hover:border-rose-300 text-slate-600 hover:text-rose-600 text-[12px] inline-flex items-center gap-1.5 transition-colors"
                >
                    <Trash2Icon className="w-3 h-3" />
                    {isHe ? "מחק" : "Discard"}
                </button>
                <span className="ms-auto hidden md:inline text-[10.5px] text-slate-400">
                    {isHe ? "ניתן לערוך את הטקסט למעלה לפני השליחה." : "Edit the text above before sending."}
                </span>
            </div>
        </div>
    );
}
