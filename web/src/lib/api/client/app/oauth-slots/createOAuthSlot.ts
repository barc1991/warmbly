import Request from "../../Request";
import type { NewOAuthConnectionSlot, OAuthConnectionSlot } from "@/lib/api/models/app/oauth-slots/OAuthSlot";

export default async function createOAuthSlot(data: NewOAuthConnectionSlot): Promise<OAuthConnectionSlot> {
    return await Request<OAuthConnectionSlot>({
        method: "POST",
        url: `/settings/oauth-slots`,
        data,
        authorization: true,
    });
}
