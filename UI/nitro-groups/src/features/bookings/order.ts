import { isIsoDate } from "@/lib/format";
import { statusAppearance, type StatusAppearance } from "./status";
import type { EventRequest, EventRequestStatus } from "./types";

/** Order of the client's groups: what waits for an answer, then the answers, then the cancellations. */
const GROUP_ORDER: EventRequestStatus[] = ["Pending", "Accepted", "Declined", "Cancelled"];

/**
 * Where a request sits in the client list: 0 upcoming, 1 already past, 2 cancelled, 3 without a
 * readable date. Sorting by this rank keeps the closed and the dated-out requests at the end.
 */
function clientRank(request: EventRequest, today: string): number {
    if (!isIsoDate(request.eventDate)) return 3;
    if (request.status === "Cancelled") return 2;
    return isIsoDate(today) && request.eventDate < today ? 1 : 0;
}

/**
 * Client list order: the closest event first, then past and cancelled ones, and a date we cannot
 * read goes last instead of throwing. Ids break ties so two renders agree.
 */
export function compareClientRequests(a: EventRequest, b: EventRequest, today: string): number {
    const rankA = clientRank(a, today);
    const rankB = clientRank(b, today);
    if (rankA !== rankB) return rankA - rankB;
    if (a.eventDate !== b.eventDate) return a.eventDate < b.eventDate ? -1 : 1;
    return a.id - b.id;
}

export interface ClientRequestGroup {
    status: string;
    appearance: StatusAppearance;
    requests: EventRequest[];
}

/**
 * Groups the client list by status with a count per group, so the pending ones are read without
 * reading every row. Empty statuses are left out; an unknown one keeps its own group at the end.
 */
export function groupClientRequests(requests: EventRequest[], today: string): ClientRequestGroup[] {
    const byStatus = new Map<string, EventRequest[]>();
    for (const request of requests) {
        const list = byStatus.get(request.status);
        if (list) list.push(request);
        else byStatus.set(request.status, [request]);
    }

    const known = GROUP_ORDER.filter((status) => byStatus.has(status));
    const unknown = [...byStatus.keys()].filter((status) => !known.includes(status as EventRequestStatus));

    return [...known, ...unknown].map((status) => ({
        status,
        appearance: statusAppearance(status),
        requests: [...(byStatus.get(status) ?? [])].sort((a, b) => compareClientRequests(a, b, today)),
    }));
}

/**
 * Oldest first: a conversation is read from the first message down. Messages written in the same
 * second keep a stable order by id, and a timestamp we cannot read goes last.
 */
export function compareMessages(a: { id: number; createdAt: string }, b: { id: number; createdAt: string }): number {
    const timeA = Date.parse(a.createdAt);
    const timeB = Date.parse(b.createdAt);
    const badA = Number.isNaN(timeA);
    const badB = Number.isNaN(timeB);
    if (badA !== badB) return badA ? 1 : -1;
    if (!badA && timeA !== timeB) return timeA - timeB;
    return a.id - b.id;
}
