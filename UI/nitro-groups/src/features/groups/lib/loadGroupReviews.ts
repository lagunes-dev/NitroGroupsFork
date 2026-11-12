import { FRESH, serverGetResult } from "@/lib/serverApi";
import type { GroupReviewsPage } from "../types/GroupReviews";

/**
 * First page of the public reviews (S19). A failed or malformed read is null, so the profile
 * degrades to the aggregate it already prints instead of breaking.
 */
export async function loadGroupReviews(groupId: number): Promise<GroupReviewsPage | null> {
    const result = await serverGetResult<GroupReviewsPage>(`/groups/${groupId}/reviews?page=1&size=10`, FRESH);
    if (!result.ok || !result.data || !Array.isArray(result.data.items) || !result.data.summary) return null;
    return result.data;
}
