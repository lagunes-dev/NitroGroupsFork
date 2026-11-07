import { apiClient } from "@/lib/api-client";
import type { GroupReviewsPage } from "../types/GroupReviews";

/** Public reads of a group's reviews (no token needed). */
export const reviewsService = {
    page: async (groupId: number, page: number, size = 10) =>
        (await apiClient.get<GroupReviewsPage>(`/groups/${groupId}/reviews`, { params: { page, size } })).data,
};
