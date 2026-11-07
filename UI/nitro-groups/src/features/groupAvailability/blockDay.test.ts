import { describe, expect, it } from "vitest";
import type { ScheduleEventDto } from "./services/groupAvailability.service";
import { confirmedGigFact, dayBounds, longDayName, shortDayName, wholeDayBlocks } from "./blockDay";

const DAY = "2026-11-19";

function at(day: string, hour: number) {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(y, m - 1, d, hour).toISOString();
}

describe("dayBounds", () => {
    it("covers one whole local day, from midnight to the next midnight", () => {
        const bounds = dayBounds(DAY);
        expect(bounds).not.toBeNull();
        expect(new Date(bounds!.start).getHours()).toBe(0);
        expect(new Date(bounds!.end).getHours()).toBe(0);
        expect(bounds!.start).toBe(at(DAY, 0));
        expect(bounds!.end).toBe(at("2026-11-20", 0));
    });

    it("has no bounds for something that is not a day", () => {
        expect(dayBounds("19/11/2026")).toBeNull();
        expect(dayBounds("2026-02-30")).toBeNull();
    });
});

/** Whether the day of a confirmed gig can be stated: done, nothing, or not known yet. */
describe("confirmedGigFact", () => {
    const read = (days: string[], failed = false) => ({ days, failed });

    it("says the day has a confirmed gig when the agenda lists it", () => {
        expect(confirmedGigFact(DAY, read([DAY]))).toBe("confirmed");
    });

    it("says the day is free only when the agenda was actually read", () => {
        expect(confirmedGigFact(DAY, read([]))).toBe("none");
        expect(confirmedGigFact(DAY, read(["2026-11-20"]))).toBe("none");
    });

    it("does not claim the day is free when the agenda could not be read", () => {
        // El silencio se lee como "no tengo toque": sin lectura, el diálogo tiene que decirlo.
        expect(confirmedGigFact(DAY, read([], true))).toBe("unknown");
    });

    it("keeps a gig it already knows even when the last read failed", () => {
        expect(confirmedGigFact(DAY, read([DAY], true))).toBe("confirmed");
    });
});

describe("wholeDayBlocks", () => {
    const busy = (id: string, start: string, end: string, isAvailable = false): ScheduleEventDto => ({
        id,
        title: "No disponible",
        start,
        end,
        isAvailable,
        backgroundColor: "#fb7185",
        borderColor: "#fb7185",
        textColor: "#0f172a",
    });

    it("counts a block that claims the whole day", () => {
        const bounds = dayBounds(DAY)!;
        expect(wholeDayBlocks([busy("busy_1", bounds.start, bounds.end)], DAY)).toHaveLength(1);
    });

    it("leaves out a block that only covers part of the day", () => {
        expect(wholeDayBlocks([busy("busy_1", at(DAY, 10), at(DAY, 12))], DAY)).toHaveLength(0);
    });

    it("leaves out a marked availability, which is not a block", () => {
        const bounds = dayBounds(DAY)!;
        expect(wholeDayBlocks([busy("avail_1", bounds.start, bounds.end, true)], DAY)).toHaveLength(0);
    });

    it("keeps the whole-day blocks in the order the API sent them", () => {
        const bounds = dayBounds(DAY)!;
        const blocks = wholeDayBlocks(
            [busy("busy_1", bounds.start, bounds.end), busy("busy_2", at(DAY, 9), at(DAY, 10)), busy("busy_3", at("2026-11-18", 0), at("2026-11-21", 0))],
            DAY
        );
        expect(blocks.map((block) => block.id)).toEqual(["busy_1", "busy_3"]);
    });
});

describe("shortDayName", () => {
    it("says the short day in abbreviated Spanish, without the year", () => {
        expect(shortDayName(DAY)).toBe("jue 19 nov");
        expect(shortDayName("2026-12-24")).toBe("jue 24 dic");
    });

    it("has nothing to say about an invalid day", () => {
        expect(shortDayName("2026-02-30")).toBeNull();
        expect(shortDayName("no-es-fecha")).toBeNull();
        expect(shortDayName("")).toBeNull();
    });
});

describe("longDayName", () => {
    it("says the long day as a Spanish phrase piece", () => {
        expect(longDayName(DAY)).toBe("jueves 19 de noviembre de 2026");
    });

    it("has nothing to say about an invalid day", () => {
        expect(longDayName("2026-02-30")).toBeNull();
    });
});
