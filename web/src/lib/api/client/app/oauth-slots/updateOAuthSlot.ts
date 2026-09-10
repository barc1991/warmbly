import Request from "../../Request";
import type { UpdateOAuthConnectionSlot, OAuthConnectionSlot } from "@/lib/api/models/app/oauth-slots/OAuthSlot";

export default async function updateOAuthSlot(id: string, data: UpdateOAuthConnectionSlot): Promise<OAuthConnectionSlot> {
    return await Request<OAuthConnectionSlot>({
        method: "PUT",
        url: `/settings/oauth-slots/${id}`,
        data,
        authorization: true,
    });
}
