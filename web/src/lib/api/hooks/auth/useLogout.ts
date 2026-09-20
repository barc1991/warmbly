import { useMutation, useQueryClient } from "@tanstack/react-query";
import logout from "../../client/auth/logout";
import { clearClientSession } from "@/lib/session";

// Single source of truth for "log this user out fully". Order matters:
//
//   1. Server revoke first, so the session row is gone before we throw
//      away the access token we'd need to authenticate the revoke call.
//      Wrapped so a network error here still falls through to local
//      cleanup — a stranded server session is recoverable, a stuck
//      client is not.
//   2. clearClientSession() wipes tokens, session storage, cached queries,
//      and resets the persisted store slices.
export default function useLogout() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            try {
                await logout();
            } catch {
                // Server revoke best-effort. We still clear locally so
                // the user isn't stuck in a "logged in" state because
                // the backend hiccuped.
            }
        },
        // Shared with the session-expiry paths, so signing out and being signed
        // out leave the browser in the same state.
        onSettled: () => clearClientSession(queryClient),
    });
}
