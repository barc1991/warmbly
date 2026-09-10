// Cloud side of the same page: the self-hosted instances linked to this
// workspace and the pool allowance they share.

import React from "react";
import toast from "react-hot-toast";
import { Loader2Icon, ServerIcon } from "lucide-react";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import { usePoolLinkInstances, useRevokePoolLinkInstance } from "@/lib/api/hooks/app/cloudlink/useCloudLink";
import { useConfirm } from "@/hooks/context/confirm";
import { TableSurface } from "../_components/SectionShell";

export default function LinkedInstances() {
    const q = usePoolLinkInstances();
    const revoke = useRevokePoolLinkInstance();
    const confirm = useConfirm();

    if (q.isLoading) {
        return (
            <div className="py-8 flex justify-center text-slate-400">
                <Loader2Icon className="w-4 h-4 animate-spin" />
            </div>
        );
    }
    const list = q.data?.data ?? [];
    const plan = q.data?.plan;

    return (
        <div className="space-y-3">
            {plan && (
                <p className="text-[12.5px] text-slate-500">
                    {plan.mailbox_limit === null
                        ? `ללא הגבלת תיבות דואר מקושרות · ${plan.enrolled} רשומות`
                        : `${plan.enrolled} מתוך ${plan.mailbox_limit} תיבות דואר מקושרות חינמיות בשימוש`}
                </p>
            )}
            {list.length === 0 ? (
                <p className="text-[12.5px] text-slate-500">
                    אין מופעים בהתקנה עצמית שמקושרים. במופע שלך, פתח את הגדרות, Warmbly Cloud ולחץ על "התחבר"; אשר את הקוד בכתובת /connect כאן.
                </p>
            ) : (
                <TableSurface>
                    <ul className="divide-y divide-slate-200/70">
                        {list.map((inst) => (
                            <li key={inst.id} className="flex items-center gap-3 px-3 h-12 bg-white">
                                <span className="size-7 rounded-md bg-slate-100 text-slate-600 inline-flex items-center justify-center shrink-0">
                                    <ServerIcon className="w-3.5 h-3.5" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[12.5px] text-slate-900 truncate">{inst.name}</p>
                                    <p className="text-[11px] text-slate-400 truncate">
                                        {inst.mailbox_count} {inst.mailbox_count === 1 ? "תיבת דואר" : "תיבות דואר"}
                                        {inst.version && ` · גרסה v${inst.version}`}
                                        {inst.last_seen_at && ` · נראה לאחרונה ${new Date(inst.last_seen_at).toLocaleString("he-IL")}`}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() =>
                                        confirm.show(`לבטל את הקישור ל-${inst.name}? ${inst.mailbox_count} תיבות הדואר הרשומות שלו יפסיקו להתחמם ויוסרו מהמאגר.`, async () => {
                                            try {
                                                await revoke.mutateAsync(inst.id);
                                                toast.success("הקישור למופע בוטל בהצלחה");
                                            } catch (e) {
                                                toast.error(buildError(e as AppError));
                                            }
                                        })
                                    }
                                    className="h-7 px-2.5 rounded-md text-[12px] text-rose-600 hover:bg-rose-50 transition-colors"
                                >
                                    בטל קישור
                                </button>
                            </li>
                        ))}
                    </ul>
                </TableSurface>
            )}
        </div>
    );
}
