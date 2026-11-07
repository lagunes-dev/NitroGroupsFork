import { isIsoDate } from "@/lib/format";

/** The only fields the agenda order needs; all of them optional, an API row fits as it arrives. */
export interface AgendaGig {
    id?: number | string | null;
    eventDate?: string | null;
    startTime?: string | null;
}

const readableDate = (value: string | null | undefined): string | null => {
    const trimmed = (value ?? "").trim();
    return isIsoDate(trimmed) ? trimmed : null;
};

function idOf(gig: AgendaGig): number {
    const parsed = typeof gig.id === "number" ? gig.id : Number(gig.id);
    return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Agenda order: date first, then the start time of that day (an untimed gig after the timed ones),
 * then the id so two renders agree. A date we cannot read goes last instead of throwing.
 */
export function compareGigsByDate(a: AgendaGig, b: AgendaGig): number {
    const dateA = readableDate(a.eventDate);
    const dateB = readableDate(b.eventDate);
    if (dateA !== dateB) {
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA < dateB ? -1 : 1;
    }

    const timeA = a.startTime ?? "";
    const timeB = b.startTime ?? "";
    if (timeA !== timeB) {
        if (!timeA) return 1;
        if (!timeB) return -1;
        return timeA < timeB ? -1 : 1;
    }

    return idOf(a) - idOf(b);
}

export interface Agenda<T> {
    /** Today and later, closest first: the answer is still due. */
    upcoming: T[];
    /** Before today, most recent first: what happened is read backwards. */
    past: T[];
}

/**
 * Splits the musician's gigs at today (a `YYYY-MM-DD` day in Mexico). A gig today is upcoming,
 * because the answer is still due. A gig whose date we cannot read stays visible in the upcoming
 * list instead of hiding inside the collapsed history. With an unreadable "today" nothing is hidden.
 */
export function splitAgenda<T extends AgendaGig>(rows: readonly T[], today: string): Agenda<T> {
    const boundary = readableDate(today);
    const upcoming: T[] = [];
    const past: T[] = [];

    for (const row of rows) {
        const date = readableDate(row.eventDate);
        if (!boundary || !date || date >= boundary) upcoming.push(row);
        else past.push(row);
    }

    upcoming.sort(compareGigsByDate);
    past.sort(compareGigsByDate).reverse();
    return { upcoming, past };
}
