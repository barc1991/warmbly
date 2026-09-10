import Request from "../../Request";
import type { OAuthConnectionSlot } from "@/lib/api/models/app/oauth-slots/OAuthSlot";

export interface ListOAuthSlotsResponse {
    data: OAuthConnectionSlot[];
}

export default async function listOAuthSlots(): Promise<ListOAuthSlotsResponse> {
    return await Request<ListOAuthSlotsResponse>({
        method: "GET",
        url: `/settings/oauth-slots`,
        authorization: true,
    });
}
