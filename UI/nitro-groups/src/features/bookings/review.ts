/** Limit the API enforces on the comment (`event_reviews.comment varchar(1000)`). */
export const REVIEW_COMMENT_MAX = 1000;

/** Spoken and printed form of a rating: "4 de 5". */
export function ratingText(rating: number): string {
    return `${rating} de 5`;
}

/** "12/1000": the visible counter of the comment field. */
export function commentCounter(comment: string): string {
    return `${comment.length}/${REVIEW_COMMENT_MAX}`;
}

/** Same rules as the API, so a bad review is refused before the round trip. Null when it is valid. */
export function reviewError(rating: number, comment: string): string | null {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return "Elige una calificación de 1 a 5.";
    if (comment.length > REVIEW_COMMENT_MAX) return `El comentario admite hasta ${REVIEW_COMMENT_MAX} caracteres.`;
    return null;
}
