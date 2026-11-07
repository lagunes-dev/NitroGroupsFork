import { isIsoDate } from "@/lib/format";
import type { AttendeePayload } from "./types";

/** Who answered a gig: everyone asked, how many confirmed, and the names behind that number. */
export interface AttendeeSummary {
    confirmed: number;
    declined: number;
    total: number;
    /** Members who have not answered yet. */
    unanswered: number;
    /** Names of the members who confirmed, in the order the API sent them. Never an email. */
    names: string[];
    /** Names of the members who said they cannot make it: the manager needs them as much as the yeses. */
    declinedNames: string[];
}

/**
 * Counts the answers of a manager row. A status this version does not know is not a confirmation;
 * a confirmation whose name did not arrive still counts, but no empty name is printed.
 */
export function attendeeSummary(attendees: readonly AttendeePayload[] | null | undefined): AttendeeSummary {
    const list = attendees ?? [];
    const names: string[] = [];
    const declinedNames: string[] = [];
    let confirmed = 0;
    let declined = 0;

    for (const attendee of list) {
        const status = typeof attendee.status === "string" ? attendee.status.trim() : "";
        const name = (attendee.fullName ?? "").trim();
        if (status === "Confirmed") {
            confirmed += 1;
            if (name) names.push(name);
        } else if (status === "Declined") {
            declined += 1;
            if (name) declinedNames.push(name);
        }
    }

    const answered = confirmed + declined;
    return { confirmed, declined, total: list.length, unanswered: Math.max(0, list.length - answered), names, declinedNames };
}

/** "No pueden: Ana, Luis", or null when everyone is coming or nobody answered yet. */
export function declinedLabel(summary: AttendeeSummary): string | null {
    if (summary.declined === 0) return null;
    return summary.declinedNames.length > 0
        ? `No pueden: ${summary.declinedNames.join(", ")}`
        : `${summary.declined} no pueden ir`;
}

/** "Faltan 2 por responder", or null when everyone has answered. */
export function unansweredLabel(summary: AttendeeSummary): string | null {
    if (summary.unanswered <= 0) return null;
    return summary.unanswered === 1 ? "Falta 1 por responder" : `Faltan ${summary.unanswered} por responder`;
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
