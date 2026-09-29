import { useQuery } from "@tanstack/react-query";
import getCampaignAnalytics, {
    type CampaignAnalyticsParams,
} from "@/lib/api/client/app/analytics/getCampaignAnalytics";

export default function useCampaignAnalytics(id: string, params?: CampaignAnalyticsParams) {
    const hasRange = Boolean(params?.from || params?.to);
    return useQuery({
        queryKey: hasRange
            ? ["analytics", "campaigns", id, { from: params?.from ?? "", to: params?.to ?? "" }]
            : ["analytics", "campaigns", id],
        queryFn: () => getCampaignAnalytics(id, params),
        enabled: !!id,
    });
}
