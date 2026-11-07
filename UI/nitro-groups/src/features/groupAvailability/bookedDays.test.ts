import { describe, expect, it } from "vitest";
import type { ScheduleEventDto } from "./services/groupAvailability.service";
import { daysCoveredBy, withoutAvailabilityOnBookedDays } from "./bookedDays";

/** A local instant on `day` at `hour`, the way the API hands a block back to the calendar. */
function at(day: string, hour: number): string {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(y, m - 1, d, hour).toISOString();
}

function block(id: string, start: string, end: string, isAvailable: boolean): ScheduleEventDto {
    return {
        id,
        title: isAvailable ? "Disponible" : "No disponible",
        start,
        end,
        isAvailable,
        backgroundColor: isAvailable ? "#34d399" : "#fb7185",
        borderColor: isAvailable ? "#34d399" : "#fb7185",
        textColor: "#0f172a",
    };
}

const BOOKED = new Set(["2026-12-04"]);

describe("daysCoveredBy", () => {
    it("counts one local day for a block that ends at the next midnight", () => {
        // El final es exclusivo: un bloque de día completo termina a las 00:00 del día siguiente.
        expect(daysCoveredBy(at("2026-12-04", 0), at("2026-12-05", 0))).toEqual(["2026-12-04"]);
    });

    it("counts every day a longer block touches", () => {
        expect(daysCoveredBy(at("2026-12-03", 0), at("2026-12-06", 0))).toEqual([
            "2026-12-03",
            "2026-12-04",
            "2026-12-05",
        ]);
    });

    it("counts the day a block starts and ends inside", () => {
        expect(daysCoveredBy(at("2026-12-04", 20), at("2026-12-04", 23))).toEqual(["2026-12-04"]);
    });

    it("has no days for bounds that cannot be read or that end before they start", () => {
        expect(daysCoveredBy("no-es-fecha", at("2026-12-05", 0))).toEqual([]);
        expect(daysCoveredBy(at("2026-12-05", 0), at("2026-12-04", 0))).toEqual([]);
    });
});

describe("withoutAvailabilityOnBookedDays", () => {
    it("drops the availability marker that lands on a booked day, whole day or part of it", () => {
        const events = [
            block("avail_1", at("2026-12-04", 0), at("2026-12-05", 0), true),
            block("avail_2", at("2026-12-04", 20), at("2026-12-04", 23), true),
        ];
        expect(withoutAvailabilityOnBookedDays(events, BOOKED)).toEqual([]);
    });

    it("keeps the blocks of that day: a busy block is not availability", () => {
        const busy = block("busy_1", at("2026-12-04", 10), at("2026-12-04", 12), false);
        expect(withoutAvailabilityOnBookedDays([busy], BOOKED).map((e) => e.id)).toEqual(["busy_1"]);
    });

    it("keeps the availability of the days around it, in the order the API sent them", () => {
        const events = [
            block("avail_1", at("2026-12-03", 0), at("2026-12-04", 0), true),
            block("avail_2", at("2026-12-04", 0), at("2026-12-05", 0), true),
            block("avail_3", at("2026-12-05", 0), at("2026-12-06", 0), true),
        ];
        expect(withoutAvailabilityOnBookedDays(events, BOOKED).map((e) => e.id)).toEqual(["avail_1", "avail_3"]);
    });

    it("changes nothing when no day is booked", () => {
        const events = [block("avail_1", at("2026-12-04", 0), at("2026-12-05", 0), true)];
        expect(withoutAvailabilityOnBookedDays(events, new Set())).toEqual(events);
    });
});
