import { describe, expect, it } from "vitest";
import { gigDayList, gigHourBlocks } from "./gigBlocks";

/** "2026-12-04 19:00" en hora local, el instante que el calendario tiene que pintar. */
function at(hour: number, minute = 0): string {
    return new Date(2026, 11, 4, hour, minute).toISOString();
}

const GIG = { id: 9, eventDate: "2026-12-04", startTime: "19:00:00", durationHours: 2.5 };

describe("gigHourBlocks", () => {
    it("paints a confirmed gig on its real hours instead of only on its day", () => {
        // El informe: "Dec 4 19:00–21:30 is painted in nothing; the only trace is a 27 px all-day chip".
        expect(gigHourBlocks([GIG])).toEqual([
            { id: "gig_hour_9", day: "2026-12-04", start: at(19), end: at(21, 30) },
        ]);
    });

    it("lets a gig that ends after midnight keep its own end, on the next day", () => {
        const [block] = gigHourBlocks([{ ...GIG, startTime: "23:00:00", durationHours: 2 }]);
        expect(block.start).toBe(at(23));
        expect(new Date(block.end).getDate()).toBe(5);
        expect(new Date(block.end).getHours()).toBe(1);
    });

    it("does not invent hours for a gig the manager never timed", () => {
        // Sin hora de inicio la ficha de día completo sigue siendo el único dato honesto.
        expect(gigHourBlocks([{ ...GIG, startTime: null }])).toEqual([]);
        expect(gigHourBlocks([{ ...GIG, durationHours: null }])).toEqual([]);
        expect(gigHourBlocks([{ ...GIG, durationHours: 0 }])).toEqual([]);
    });

    it("does not paint a gig whose day cannot be read", () => {
        expect(gigHourBlocks([{ ...GIG, eventDate: "sin-fecha" }])).toEqual([]);
        expect(gigHourBlocks([])).toEqual([]);
    });

    it("keeps two gigs of the same day apart", () => {
        const blocks = gigHourBlocks([GIG, { ...GIG, id: 10, startTime: "09:00:00", durationHours: 1 }]);
        // El orden es el de la agenda: dos toques el mismo día se pintan los dos, con id propio.
        expect(blocks.map((block) => block.id)).toEqual(["gig_hour_9", "gig_hour_10"]);
        expect(new Set(blocks.map((block) => block.id)).size).toBe(2);
    });
});

describe("gigDayList", () => {
    it("keeps every day the calendar was told about, once each", () => {
        // El calendario recibe los días por prop y además lee la agenda: una ficha por día, no dos.
        expect(gigDayList(["2026-12-04", "2026-11-19"], [{ eventDate: "2026-12-04" }])).toEqual([
            "2026-11-19",
            "2026-12-04",
        ]);
    });

    it("ignores days it cannot read and answers in order", () => {
        expect(gigDayList(["sin-fecha", "2026-12-05"], [{ eventDate: null }, { eventDate: "2026-12-04" }])).toEqual([
            "2026-12-04",
            "2026-12-05",
        ]);
    });

    it("has nothing to mark when neither side names a day", () => {
        expect(gigDayList([], [])).toEqual([]);
    });
});
