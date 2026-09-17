import { useQuery } from "@tanstack/react-query";
import getInboxTagReview from "@/lib/api/client/app/inboxtag/getInboxTagReview";

export default function useInboxTagReview(needsReviewOnly = false) {
    return useQuery({
        queryKey: ["inbox-tagging", "review", needsReviewOnly],
        queryFn: () => getInboxTagReview(needsReviewOnly),
    })
}
