import { useQuery } from "@tanstack/react-query";
import getCampaignDailyStats from "@/lib/api/client/app/analytics/getCampaignDailyStats";

function isoDay(d: Date): string {
    return d.toISOString().slice(0, 10);
}

// Defaults to the trailing `days`-day window; the backend requires from/to.
// The realtime invalidation key ["analytics","campaigns",id,"daily"] still
// matches this (prefix) so live events refresh the chart.
export default function useCampaignDailyStats(
    id: string,
    daysOrRange: number | { from?: string; to?: string } = 30,
) {
    const now = new Date();
    let fromStr: string;
    let toStr: string;
    if (typeof daysOrRange === "number") {
        const from = new Date(now);
        from.setUTCDate(from.getUTCDate() - (daysOrRange - 1));
        fromStr = isoDay(from);
        toStr = isoDay(now);
    } else {
        const fallbackFrom = new Date(now);
        fallbackFrom.setUTCDate(fallbackFrom.getUTCDate() - 29);
        fromStr = daysOrRange.from || isoDay(fallbackFrom);
        toStr = daysOrRange.to || isoDay(now);
    }
    return useQuery({
        queryKey: ["analytics", "campaigns", id, "daily", fromStr, toStr],
        queryFn: () => getCampaignDailyStats(id, fromStr, toStr),
        enabled: !!id,
    });
}
