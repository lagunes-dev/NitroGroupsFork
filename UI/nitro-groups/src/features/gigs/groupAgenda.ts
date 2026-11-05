import { isIsoDate } from "@/lib/format";
import type { AttendeePayload } from "./types";

/** Who answered a gig: everyone asked, how many confirmed, and the names behind that number. */
export interface AttendeeSummary {
    confirmed: number;
    total: number;
    /** Names of the members who confirmed, in the order the API sent them. Never an email. */
    names: string[];
}

/**
 * Counts the answers of a manager row. A status this version does not know is not a confirmation;
 * a confirmation whose name did not arrive still counts, but no empty name is printed.
 */
export function attendeeSummary(attendees: readonly AttendeePayload[] | null | undefined): AttendeeSummary {
    const list = attendees ?? [];
    const names: string[] = [];
    let confirmed = 0;

    for (const attendee of list) {
        const status = typeof attendee.status === "string" ? attendee.status.trim() : "";
        if (status !== "Confirmed") continue;
        confirmed += 1;
        const name = (attendee.fullName ?? "").trim();
        if (name) names.push(name);
    }

    return { confirmed, total: list.length, names };
}

/** "3 de 5 confirmaron", or the plain truth when nobody has answered yet. */
export function attendanceCountLabel(summary: AttendeeSummary): string {
    if (summary.total === 0 || summary.confirmed === 0) return "Nadie ha confirmado todavía";
    return `${summary.confirmed} de ${summary.total} confirmaron`;
}

/** The days that already have a confirmed gig, readable and unique, for marking the calendar. */
export function confirmedGigDates(rows: readonly { eventDate?: string | null }[]): string[] {
    const days = new Set<string>();
    for (const row of rows) {
        const date = (row.eventDate ?? "").trim();
        if (isIsoDate(date)) days.add(date);
    }
    return [...days].sort();
}
