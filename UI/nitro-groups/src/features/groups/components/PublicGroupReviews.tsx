"use client";

import { useState } from "react";
import { RatingStars } from "@/features/bookings/components/RatingStars";
import { eventTypeLabel } from "@/lib/eventTypeLabel";
import { reviewsService } from "../services/reviews.service";
import type { GroupReview, GroupReviewsPage } from "../types/GroupReviews";

const dateFmt = new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: "America/Mexico_City" });

function reviewDate(value: string): string | null {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : dateFmt.format(date);
}

function summaryLine(average: number, count: number): string {
    return `${average.toFixed(1)} de 5 · ${count} ${count === 1 ? "reseña" : "reseñas"}`;
}

/**
 * "Reseñas" of the public profile (S19): the summary and the reviews newest first, loaded on the
 * server for the first page; "Ver más reseñas" appends the next page without leaving the profile.
 * `initial` is null when the server read failed: the section then falls back to the aggregate the
 * profile already prints, or to the honest empty line.
 */
export function PublicGroupReviews({ groupId, initial, fallbackAverage, fallbackCount }: {
    groupId: number;
    initial: GroupReviewsPage | null;
    fallbackAverage: number;
    fallbackCount: number;
}) {
    const [items, setItems] = useState<GroupReview[]>(initial?.items ?? []);
    const [last, setLast] = useState(initial);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);

    const summary = initial?.summary ?? { average: fallbackAverage, count: fallbackCount };
    const empty = summary.count === 0 && items.length === 0;

    async function loadMore() {
        if (!last) return;
        setLoading(true);
        setFailed(false);
        try {
            const next = await reviewsService.page(groupId, last.pageNumber + 1, last.pageSize);
            setItems((current) => [...current, ...next.items]);
            setLast(next);
        } catch {
            setFailed(true);
        } finally {
            setLoading(false);
        }
    }

    return (
        <section className="page-frame mt-[var(--section-gap)]" aria-labelledby="resenas">
            <h2 id="resenas" className="titulo">Reseñas</h2>

            {empty ? (
                <p className="mt-4 max-w-[52ch] text-lg text-tinta-2">Todavía no tiene reseñas</p>
            ) : (
                <>
                    <p className="mt-4 text-lg tabular text-tinta">{summaryLine(summary.average, summary.count)}</p>

                    {initial === null ? (
                        <p className="mt-2 max-w-[52ch] text-tinta-2">No pudimos cargar las reseñas ahora. Vuelve a intentarlo en un rato.</p>
                    ) : (
                        <ul className="mt-8 max-w-[52rem] border-t border-linea" aria-label="Reseñas del grupo">
                            {items.map((review, i) => {
                                const date = reviewDate(review.createdAt);
                                return (
                                    <li key={`${review.createdAt}-${i}`} className="flex min-w-0 flex-col gap-2 border-b border-linea py-5">
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                            <RatingStars rating={review.rating} />
                                            <span className="text-sm text-tinta-2">{eventTypeLabel(review.eventType)}</span>
                                        </div>
                                        {review.comment && <p className="whitespace-pre-line break-words leading-relaxed text-tinta">{review.comment}</p>}
                                        <p className="text-sm text-tinta-2">
                                            <span>{review.authorName}</span>
                                            {date && <span className="tabular"> · {date}</span>}
                                        </p>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {last?.hasNextPage && (
                        <div className="mt-6">
                            <button
                                type="button"
                                onClick={loadMore}
                                disabled={loading}
                                className="h-12 rounded-xl bg-fondo-2 px-6 font-semibold text-tinta hover:bg-fondo-3 disabled:opacity-45"
                            >
                                {loading ? "Cargando…" : "Ver más reseñas"}
                            </button>
                            {failed && <p role="alert" className="mt-3 text-error">No pudimos cargar más reseñas. Inténtalo de nuevo.</p>}
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
