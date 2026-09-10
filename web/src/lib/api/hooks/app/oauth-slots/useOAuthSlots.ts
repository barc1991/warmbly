import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import listOAuthSlots from "@/lib/api/client/app/oauth-slots/listOAuthSlots";
import createOAuthSlot from "@/lib/api/client/app/oauth-slots/createOAuthSlot";
import updateOAuthSlot from "@/lib/api/client/app/oauth-slots/updateOAuthSlot";
import deleteOAuthSlot from "@/lib/api/client/app/oauth-slots/deleteOAuthSlot";
import type {
    NewOAuthConnectionSlot,
    UpdateOAuthConnectionSlot,
} from "@/lib/api/models/app/oauth-slots/OAuthSlot";

export const OAUTH_SLOTS_KEY = ["settings", "oauth-slots"];

export function useOAuthSlots() {
    return useQuery({
        queryKey: OAUTH_SLOTS_KEY,
        queryFn: async () => {
            const res = await listOAuthSlots();
            return res.data ?? [];
        },
        staleTime: 30_000,
    });
}

export function useCreateOAuthSlot() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: NewOAuthConnectionSlot) => createOAuthSlot(data),
        onSuccess: () => qc.invalidateQueries({ queryKey: OAUTH_SLOTS_KEY }),
    });
}

export function useUpdateOAuthSlot() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (input: { id: string; data: UpdateOAuthConnectionSlot }) =>
            updateOAuthSlot(input.id, input.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: OAUTH_SLOTS_KEY }),
    });
}

export function useDeleteOAuthSlot() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteOAuthSlot(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: OAUTH_SLOTS_KEY }),
    });
}
