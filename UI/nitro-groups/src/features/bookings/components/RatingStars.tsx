import { Star } from "lucide-react";
import { ratingText } from "../review";

/** Five stars for a rating; the text "4 de 5" carries the meaning, the stars are decoration. */
export function RatingStars({ rating }: { rating: number }) {
    return (
        <span className="inline-flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} aria-hidden className={n <= rating ? "size-4 fill-acento text-acento" : "size-4 text-tinta-2"} />
            ))}
            <span className="sr-only">{ratingText(rating)}</span>
        </span>
    );
}
