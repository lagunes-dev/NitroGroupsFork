"use client";

import { Banknote, CalendarClock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { bookingsService } from "../bookings.service";
import { toSignalsView } from "../signals";
import type { EventRequestParty } from "../types";

/** Short enough that an answer from the group shows up on the next look at the thread. */
const SIGNALS_STALE_MS = 60_000;
const HEADING_ID = "senales-del-hilo";

/**
 * D6: the two signals the manager needs before answering a request — the day already has another
 * accepted gig, and what the client offers against the group's "from $X". Only the group sees it:
 * the client's thread never asks for it. When the signals cannot be read the block is simply not
 * there, and the thread works exactly as before.
 *
 * <p><c>currency</c> is the currency of the request: both amounts are stated in the money of the
 * deal, which is the one the client and the group are already talking about.</p>
 */
export function RequestSignals({
    groupId,
    requestId,
    viewer,
    currency = "MXN",
}: {
    groupId: number;
    requestId: number;
    viewer: EventRequestParty;
    currency?: string;
}) {
    const signals = useQuery({
        queryKey: ["event-request-signals", requestId],
        queryFn: () => bookingsService.signals(groupId, requestId),
        enabled: viewer === "Group",
        retry: false,
        staleTime: SIGNALS_STALE_MS,
    });

    if (viewer !== "Group" || !signals.isSuccess) return null;

    const view = toSignalsView(signals.data, viewer, currency);
    if (view === null) return null;

    return (
        <section aria-labelledby={HEADING_ID} className="rounded-xl bg-fondo-2 p-5">
            {/* La fecha manda: un choque decide más rápido que un número. El título pesa más que el contenido. */}
            <h2 id={HEADING_ID} className="type-heading text-lg text-tinta">Antes de responder</h2>
            <ul className="mt-4 flex flex-col gap-4">
                <li className="flex items-start gap-3">
                    <CalendarClock aria-hidden className="mt-1 size-5 shrink-0 text-acento" />
                    <p className="text-lg text-tinta">{view.clash}</p>
                </li>
                <li className="flex items-start gap-3">
                    <Banknote aria-hidden className="mt-1 size-5 shrink-0 text-tinta-2" />
                    <div>
                        <p className="text-lg tabular text-tinta">{view.budget}</p>
                        <p className="mt-1 text-sm text-tinta-2">{view.comparison}</p>
                    </div>
                </li>
            </ul>
        </section>
    );
}
