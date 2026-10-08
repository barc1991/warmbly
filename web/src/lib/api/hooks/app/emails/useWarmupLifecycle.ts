import warmupLifecycle, { type WarmupAction } from "@/lib/api/client/app/emails/warmupLifecycle";
import type Inbox from "@/lib/api/models/app/emails/Inbox";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import patchEmailLists from "./patchEmailLists";

// The warmup fields each action leaves behind; ramp progress is the server's to keep.
export function applyWarmup(row: Inbox, action: WarmupAction): Inbox {
    const now = new Date();
    switch (action) {
        case "start":
            return { ...row, warmup: row.warmup ?? now, warmup_paused_at: null, test_mode: "diagnostic", test_send_enabled: true, test_receive_enabled: row.test_mode == null || row.test_mode === "legacy" || row.test_mode === "off" ? true : row.test_receive_enabled };
        case "resume":
            return { ...row, warmup: row.warmup ?? now, warmup_paused_at: null, test_mode: "diagnostic", test_send_enabled: true, test_receive_enabled: row.test_mode == null || row.test_mode === "legacy" || row.test_mode === "off" ? true : row.test_receive_enabled };
        case "pause":
            return { ...row, warmup_paused_at: row.warmup ? row.warmup_paused_at ?? now : null, test_mode: "diagnostic", test_send_enabled: false, test_receive_enabled: row.test_mode == null || row.test_mode === "legacy" ? true : row.test_receive_enabled };
        case "stop":
            return { ...row, warmup_paused_at: row.warmup ? row.warmup_paused_at ?? now : null, test_mode: "off", test_send_enabled: false, test_receive_enabled: false };
    }
}

// Drives the flame-icon dropdown + the warmup tab's enable/pause/resume
// control. Patches the mailbox into every emails list page and the single
// mailbox cache (mirrors useUpdateEmail) and invalidates the account-status
// query so the live warmup/health panel refreshes.
export default function useWarmupLifecycle(id: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (action: WarmupAction) => warmupLifecycle(id, action),
        onSuccess: (data) => {
            patchEmailLists(queryClient, (rows) => rows.map((c) => (c.id === id ? data : c)));

            queryClient.setQueryData<Inbox>(["emails", id], data);
            void queryClient.invalidateQueries({ queryKey: ["analytics", "accounts", id] });
        },
    });
}
