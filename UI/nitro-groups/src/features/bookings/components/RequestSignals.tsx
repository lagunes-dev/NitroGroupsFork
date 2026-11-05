"use client";

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
            <h2 id={HEADING_ID} className="text-sm font-medium text-tinta-2">Antes de responder</h2>
            <ul className="mt-3 flex flex-col gap-3">
                <li className="text-lg">{view.clash}</li>
                <li>
                    <p className="text-lg tabular">{view.budget}</p>
                    <p className="mt-1 text-sm text-tinta-2">{view.comparison}</p>
                </li>
            </ul>
        </section>
    );
}
