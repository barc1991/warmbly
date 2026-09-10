import Request from "../../Request";

export default async function deleteOAuthSlot(id: string): Promise<void> {
    await Request<void>({
        method: "DELETE",
        url: `/settings/oauth-slots/${id}`,
        authorization: true,
    });
}
