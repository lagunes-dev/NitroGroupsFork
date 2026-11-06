"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { apiErrorMessage, bookingsService } from "../bookings.service";
import { REVIEW_COMMENT_MAX, commentCounter, ratingText, reviewError } from "../review";
import type { EventRequest } from "../types";

/**
 * D7: the client writes one review for an accepted event that already happened. The rating is a
 * native radio group (arrow keys, one tab stop); the stars only paint the choice.
 */
export function ReviewForm({ requestId }: { requestId: number }) {
    const queryClient = useQueryClient();
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState("");
    const [localError, setLocalError] = useState<string | null>(null);

    const send = useMutation({
        mutationFn: () => {
            const text = comment.trim();
            return bookingsService.review(requestId, text ? { rating, comment: text } : { rating });
        },
        onSuccess: (review) => {
            // The thread swaps the form for the saved review at once; the lists refetch so `canReview` flips everywhere.
            queryClient.setQueryData(["event-request", requestId], (old: EventRequest | undefined) =>
                old ? { ...old, canReview: false, review } : old);
            void queryClient.invalidateQueries({ queryKey: ["event-request", requestId] });
            void queryClient.invalidateQueries({ queryKey: ["event-requests", "mine"] });
            void queryClient.invalidateQueries({ queryKey: ["my-event-requests"] });
        },
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const error = reviewError(rating, comment.trim());
        setLocalError(error);
        if (!error) send.mutate();
    };

    const message = localError ?? (send.isError ? apiErrorMessage(send.error, "No se pudo guardar tu reseña. Inténtalo de nuevo.") : null);

    return (
        <form onSubmit={submit} className="flex flex-col gap-5 rounded-xl bg-fondo-2 p-5" noValidate>
            <h2 className="type-heading text-2xl">¿Cómo te fue con este evento?</h2>

            <fieldset className="min-w-0">
                <legend id="review-rating" className="sr-only">Tu calificación</legend>
                <div role="radiogroup" aria-labelledby="review-rating" className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                        <label key={n} className="relative flex size-11 cursor-pointer items-center justify-center">
                            <input
                                type="radio"
                                name="review-rating"
                                value={n}
                                checked={rating === n}
                                onChange={() => { setRating(n); setLocalError(null); }}
                                className="peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento"
                            />
                            <Star aria-hidden className={`pointer-events-none size-8 ${n <= rating ? "fill-acento text-acento" : "text-tinta-2"}`} />
                            <span className="sr-only">{ratingText(n)}</span>
                        </label>
                    ))}
                </div>
                <p className="mt-1 text-sm text-tinta-2" aria-live="polite">{rating ? ratingText(rating) : "Toca una estrella para calificar."}</p>
            </fieldset>

            <div className="flex flex-col gap-2">
                <label htmlFor="review-comment" className="text-sm font-medium text-tinta-2">Comentario (opcional)</label>
                <textarea
                    id="review-comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                    aria-describedby="review-counter"
                    className="w-full resize-y rounded-xl bg-fondo px-4 py-3 text-tinta outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-acento"
                />
                <p id="review-counter" className={`self-end text-sm tabular ${comment.length > REVIEW_COMMENT_MAX ? "text-error" : "text-tinta-2"}`}>
                    {commentCounter(comment)}
                </p>
            </div>

            {message && <p role="alert" className="text-error">{message}</p>}

            <button type="submit" disabled={send.isPending} className="h-12 self-start rounded-xl bg-acento px-6 font-semibold text-acento-ink hover:bg-acento-press disabled:opacity-45">
                {send.isPending ? "Enviando…" : "Enviar reseña"}
            </button>
        </form>
    );
}
