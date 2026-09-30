// A lead's Pause and Resume actions, shared by the contact drawer and the unibox contact panel.

import React from "react";
import { Loader2Icon, PauseIcon, PlayIcon } from "lucide-react";
import toast from "react-hot-toast";
import PauseLeadDialog from "./PauseLeadDialog";
import { useResumeLead } from "@/lib/api/hooks/app/campaigns/useLeadHold";
import { useConfirm } from "@/hooks/context/confirm";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";

export function PauseLeadButton({
    campaign,
    lead,
    label = "השהה",
}: {
    campaign: { id: string; name: string };
    lead: { id: string; name: string };
    label?: string;
}) {
    const [open, setOpen] = React.useState(false);
    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                title="השהה את הודעות ההמשך לליד זה עד לתאריך נבחר, מבלי להסיר אותו מרשימת הדיוור"
                className="h-6 px-2 rounded-md border border-slate-200 bg-white hover:border-slate-300 text-[11px] text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 transition-colors shrink-0"
            >
                <PauseIcon className="w-2.5 h-2.5" />
                {label}
            </button>
            <PauseLeadDialog open={open} onClose={() => setOpen(false)} campaign={campaign} lead={open ? lead : null} />
        </>
    );
}

export function ResumeLeadButton({
    campaignId,
    contactId,
    label = "חדש",
    disabled = false,
    onBusyChange,
    confirmText,
}: {
    campaignId: string;
    contactId: string;
    label?: string;
    disabled?: boolean;
    onBusyChange?: (busy: boolean) => void;
    // Asked first when resuming has a consequence worth a second look.
    confirmText?: string;
}) {
    const resume = useResumeLead();
    const confirm = useConfirm();
    async function run() {
        onBusyChange?.(true);
        try {
            await toast.promise(resume.mutateAsync({ campaignId, contactId }), {
                loading: "מחדש ליד…",
                success: "הליד חודש",
                error: (err: AppError) => buildError(err),
            });
        } catch {
            /* toast.promise already surfaced it */
        } finally {
            onBusyChange?.(false);
        }
    }
    return (
        <button
            type="button"
            onClick={() => (confirmText ? confirm.show(confirmText, run) : void run())}
            disabled={disabled || resume.isPending}
            title="בטל את ההשהיה כעת; הרצף ימשיך מהנקודה שבה עצר"
            className="h-6 px-2 rounded-md bg-white border border-violet-200 text-[11px] font-medium text-violet-700 hover:bg-violet-100 inline-flex items-center gap-1 transition-colors disabled:opacity-60 shrink-0"
        >
            {resume.isPending ? <Loader2Icon className="w-2.5 h-2.5 animate-spin" /> : <PlayIcon className="w-2.5 h-2.5 rtl:scale-x-[-1]" />}
            {label}
        </button>
    );
}
