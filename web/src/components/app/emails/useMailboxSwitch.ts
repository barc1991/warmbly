import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useConfirm } from "@/hooks/context/confirm";
import useUpdateEmail from "@/lib/api/hooks/app/emails/useUpdateEmail";
import buildError from "@/lib/helper/buildError";
import type { AppError } from "@/lib/api/client/normalizeError";

// Off is the whole mailbox, not campaigns alone, so the prompt points at the hold.
export function switchOffPrompt(subject: string): string {
    return `להשבית את ${subject}? התיבה תפסיק לשלוח, להתחמם ולהסתנכרן עד שתפעיל אותה מחדש, תוך שמירה על ההגדרות וההיסטוריה שלה. כדי לעצור רק שליחת קמפיינים ולהמשיך בחימום, השתמש ב'השהה מקמפיינים' בלשונית הסקירה של התיבה.`;
}

// The mailbox's own on/off switch (status active or inactive).
export default function useMailboxSwitch(id: string, email: string) {
    const update = useUpdateEmail(id);
    const confirm = useConfirm();
    const queryClient = useQueryClient();

    const apply = async (on: boolean) => {
        try {
            await update.mutateAsync({ status: on ? "active" : "inactive" });
            void queryClient.invalidateQueries({ queryKey: ["analytics", "accounts"] });
            toast.success(on ? `${email} הופעלה מחדש` : `${email} הושבתה`);
        } catch (e) {
            toast.error(buildError(e as AppError));
        }
    };

    return {
        pending: update.isPending,
        switchOn: () => void apply(true),
        switchOff: () => confirm.show(switchOffPrompt(email), () => apply(false)),
    };
}
