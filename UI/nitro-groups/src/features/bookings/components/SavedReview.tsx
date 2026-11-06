import { RatingStars } from "./RatingStars";
import type { EventReview } from "../types";

/** The client's own review, read-only. The comment keeps its line breaks and is never HTML. */
export function SavedReview({ review }: { review: EventReview }) {
    return (
        <section className="rounded-xl bg-fondo-2 p-5" aria-label="Tu reseña">
            <p className="text-sm text-tinta-2">Tu reseña</p>
            <p className="mt-1"><RatingStars rating={review.rating} /></p>
            {review.comment && <p className="mt-3 whitespace-pre-line leading-relaxed text-tinta">{review.comment}</p>}
        </section>
    );
}
