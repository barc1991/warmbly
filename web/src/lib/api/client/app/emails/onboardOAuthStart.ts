import Request from "../../Request";

export interface OAuthStartResponse {
    url: string;
    state: string;
}

export default async function onboardOAuthStart(
    provider: "gmail" | "outlook",
    slotId?: string,
): Promise<OAuthStartResponse> {
    return await Request<OAuthStartResponse>({
        method: "POST",
        url: `/emails/onboarding/oauth/start`,
        data: { provider, slot_id: slotId },
        authorization: true,
    });
}
