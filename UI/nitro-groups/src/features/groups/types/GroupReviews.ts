/** One row of `GET api/groups/{groupId}/reviews`. `authorName` arrives as "Nombre A.": never an email. */
export interface GroupReview {
    rating: number;
    comment: string | null;
    createdAt: string;
    eventType: string;
    authorName: string;
}

/** Response of `GET api/groups/{groupId}/reviews?page=&size=`, newest first. */
export interface GroupReviewsPage {
    summary: { average: number; count: number };
    items: GroupReview[];
    totalCount: number;
    pageNumber: number;
    pageSize: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}
