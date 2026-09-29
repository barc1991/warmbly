import type CampaignAnalytics from "@/lib/api/models/app/analytics/CampaignAnalytics";
import Request from "../../Request";

export interface CampaignAnalyticsParams {
    from?: string;
    to?: string;
}

export default async function getCampaignAnalytics(
    id: string,
    params?: CampaignAnalyticsParams,
): Promise<CampaignAnalytics> {
    const search = new URLSearchParams();
    if (params?.from) search.set("from", params.from);
    if (params?.to) search.set("to", params.to);
    const qs = search.toString();
    return await Request<CampaignAnalytics>({
        method: "GET",
        url: `/analytics/campaigns/${id}${qs ? `?${qs}` : ""}`,
        authorization: true,
    });
}
