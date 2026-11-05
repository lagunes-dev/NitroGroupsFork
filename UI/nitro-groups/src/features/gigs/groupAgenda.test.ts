import { describe, expect, it } from "vitest";
import { attendeeSummary, attendanceCountLabel, confirmedGigDates } from "./groupAgenda";

describe("attendeeSummary", () => {
    const ALL = [
        { userId: 1, fullName: "Mateo", status: "Confirmed" },
        { userId: 2, fullName: "Lucía", status: "Declined" },
        { userId: 3, fullName: "Diego", status: null },
        { userId: 4, fullName: "Ana", status: "Confirmed" },
    ];

    it("counts everyone who was asked and names only those who confirmed", () => {
        expect(attendeeSummary(ALL)).toEqual({ confirmed: 2, total: 4, names: ["Mateo", "Ana"] });
    });

    it("does not count a status this version does not know as a confirmation", () => {
        expect(attendeeSummary([{ userId: 1, fullName: "Mateo", status: "Maybe" }])).toEqual({ confirmed: 0, total: 1, names: [] });
    });

    it("reports nobody asked instead of a division by zero", () => {
        expect(attendeeSummary(null)).toEqual({ confirmed: 0, total: 0, names: [] });
        expect(attendeeSummary(undefined)).toEqual({ confirmed: 0, total: 0, names: [] });
        expect(attendeeSummary([])).toEqual({ confirmed: 0, total: 0, names: [] });
    });

    it("counts a confirmation whose name did not arrive, without printing an empty name", () => {
        expect(attendeeSummary([{ userId: 1, fullName: "  ", status: "Confirmed" }, { userId: 2, status: "Confirmed" }])).toEqual({
            confirmed: 2,
            total: 2,
            names: [],
        });
    });
});

describe("attendanceCountLabel", () => {
    it("says how many of how many confirmed", () => {
        expect(attendanceCountLabel({ confirmed: 3, total: 5, names: [] })).toBe("3 de 5 confirmaron");
    });

    it("says nobody has confirmed yet, even before anyone was asked", () => {
        expect(attendanceCountLabel({ confirmed: 0, total: 5, names: [] })).toBe("Nadie ha confirmado todavía");
        expect(attendanceCountLabel({ confirmed: 0, total: 0, names: [] })).toBe("Nadie ha confirmado todavía");
    });
});

describe("confirmedGigDates", () => {
    it("lists one readable date per declared day, without repeating a day", () => {
        expect(confirmedGigDates([{ eventDate: "2026-12-05" }, { eventDate: "2026-11-15" }, { eventDate: "2026-12-05" }])).toEqual([
            "2026-11-15",
            "2026-12-05",
        ]);
    });

    it("skips a date it cannot read", () => {
        expect(confirmedGigDates([{ eventDate: "sin-fecha" }, { eventDate: "2026-11-15" }, { eventDate: null }])).toEqual(["2026-11-15"]);
    });

    it("returns nothing for an empty agenda", () => {
        expect(confirmedGigDates([])).toEqual([]);
    });
});
