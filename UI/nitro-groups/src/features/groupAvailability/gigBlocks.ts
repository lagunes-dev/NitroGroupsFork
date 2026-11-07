import { isIsoDate } from "@/lib/format";
import { confirmedGigDates } from "@/features/gigs/groupAgenda";

/**
 * The confirmed gig's real hours (round 12). The manager reported: "Dec 4 19:00–21:30 is painted in
 * nothing; the only trace is a 27 px all-day chip. A rehearsal is painted 17:00→20:00. So I can drag
 * right on top of my own gig's hours and only learn about it from the confirmation dialog."
 *
 * The calendar already had the day, because a day is all the chip needs. The hours come from the same
 * agenda read: `eventDate` plus `startTime` plus `durationHours`. A gig without a start time or without a
 * duration has no hours to paint, and nothing is invented for it — the chip stays the honest trace.
 */

/** The words the chip already says and the legend already explains; the block repeats them. */
export const GIG_BLOCK_TITLE = "Toque confirmado";

/** Only what a calendar block needs from a row of `GET api/groups/{groupId}/gigs`. */
export interface GigRow {
    id?: number | string | null;
    /** `YYYY-MM-DD`. */
    eventDate?: string | null;
    /** `HH:mm:ss`. */
    startTime?: string | null;
    durationHours?: number | string | null;
}

/** One gig ready to paint on the time grid: local instants, so the column is the day it belongs to. */
export interface GigHourBlock {
    id: string;
    /** `YYYY-MM-DD` of the day the gig starts on. */
    day: string;
    start: string;
    end: string;
}

const CLOCK = /^(\d{1,2}):(\d{2})/;

function hoursOf(value: unknown): number | null {
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : Number.NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function gigHourBlocks(rows: readonly GigRow[]): GigHourBlock[] {
    const blocks: GigHourBlock[] = [];

    for (const [index, row] of rows.entries()) {
        const day = (row.eventDate ?? "").trim();
        if (!isIsoDate(day)) continue;

        const clock = CLOCK.exec((row.startTime ?? "").trim());
        const hours = hoursOf(row.durationHours);
        if (!clock || hours === null) continue;

        const [year, month, date] = day.split("-").map(Number);
        const start = new Date(year, month - 1, date, Number(clock[1]), Number(clock[2]));
        const end = new Date(start.getTime() + hours * 60 * 60 * 1000);

        blocks.push({
            id: `gig_hour_${row.id ?? `${day}-${index}`}`,
            day,
            start: start.toISOString(),
            end: end.toISOString(),
        });
    }

    return blocks;
}

/**
 * Every day the calendar paints a gig chip on, once each: the ones it was told about and the ones the
 * agenda read brings. Both sides go through the rule that already knows what a readable day is, so the
 * prop and the read can never draw the same day twice.
 */
export function gigDayList(known: readonly string[], rows: readonly GigRow[]): string[] {
    const days = new Set<string>([...known.filter((day) => isIsoDate(day)), ...confirmedGigDates(rows)]);
    return [...days].sort();
}
