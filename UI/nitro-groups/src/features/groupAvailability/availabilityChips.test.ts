import { describe, expect, it } from "vitest";
import type { ScheduleEventDto } from "./services/groupAvailability.service";
import { AVAILABILITY_CHIP_PREFIX, availabilityChips } from "./availabilityChips";

function at(day: string, hour: number, minute = 0): string {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(y, m - 1, d, hour, minute).toISOString();
}

function mark(id: string, start: string, end: string): ScheduleEventDto {
    return { id, title: "Disponible", start, end, isAvailable: true, backgroundColor: "", borderColor: "", textColor: "" };
}

describe("availabilityChips", () => {
    it("makes one all-day chip for a marked day, titled just «Disponible» when it covers the whole day", () => {
        const chips = availabilityChips([mark("avail_3", at("2026-11-27", 8), at("2026-11-28", 0))]);

        expect(chips).toHaveLength(1);
        expect(chips[0]).toMatchObject({ allDay: true, start: "2026-11-27", title: "Disponible" });
    });

    it("says the hours when the mark does not cover the whole day", () => {
        const [chip] = availabilityChips([mark("avail_3", at("2026-11-27", 19), at("2026-11-27", 21, 30))]);

        expect(chip.title).toBe("Disponible 19:00 a 21:30");
    });

    it("makes one chip per day a longer mark touches", () => {
        const chips = availabilityChips([mark("avail_3", at("2026-11-27", 8), at("2026-11-29", 0))]);

        expect(chips.map((c) => c.start)).toEqual(["2026-11-27", "2026-11-28"]);
        expect(new Set(chips.map((c) => c.id)).size).toBe(2);
    });

    it("is never editable, so it cannot be dragged or resized", () => {
        const [chip] = availabilityChips([mark("avail_3", at("2026-11-27", 8), at("2026-11-28", 0))]);

        expect(chip).toMatchObject({ editable: false, startEditable: false, durationEditable: false });
    });

    it("carries the id and title the removal must use, and an id the calendar never moves", () => {
        const [chip] = availabilityChips([mark("avail_3", at("2026-11-27", 19), at("2026-11-27", 21))]);

        expect(chip.id?.startsWith(AVAILABILITY_CHIP_PREFIX)).toBe(true);
        expect(chip.extendedProps).toEqual({ removes: { id: "avail_3", title: "Disponible" } });
    });

    it("ignores busy blocks", () => {
        const busy = { ...mark("busy_1", at("2026-11-27", 17), at("2026-11-27", 20)), isAvailable: false };

        expect(availabilityChips([busy])).toEqual([]);
    });
});
