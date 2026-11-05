import { describe, expect, it } from "vitest";
import { attendeeSummary, attendanceCountLabel, confirmedGigDates, declinedLabel, unansweredLabel } from "./groupAgenda";

describe("attendeeSummary", () => {
    const ALL = [
        { userId: 1, fullName: "Mateo", status: "Confirmed" },
        { userId: 2, fullName: "Lucía", status: "Declined" },
        { userId: 3, fullName: "Diego", status: null },
        { userId: 4, fullName: "Ana", status: "Confirmed" },
    ];

    it("counts everyone who was asked and names only those who confirmed", () => {
        const summary = attendeeSummary(ALL);
        expect(summary).toEqual({
            confirmed: 2,
            declined: 1,
            total: 4,
            unanswered: 1,
            names: ["Mateo", "Ana"],
            declinedNames: ["Lucía"],
        });
    });

    it("does not count a status this version does not know as a confirmation", () => {
        expect(attendeeSummary([{ userId: 1, fullName: "Mateo", status: "Maybe" }])).toEqual({ confirmed: 0, declined: 0, total: 1, unanswered: 1, declinedNames: [], names: [] });
    });

    it("reports nobody asked instead of a division by zero", () => {
        expect(attendeeSummary(null)).toEqual({ confirmed: 0, declined: 0, total: 0, unanswered: 0, names: [], declinedNames: [] });
        expect(attendeeSummary(undefined)).toEqual({ confirmed: 0, declined: 0, total: 0, unanswered: 0, names: [], declinedNames: [] });
        expect(attendeeSummary([])).toEqual({ confirmed: 0, declined: 0, total: 0, unanswered: 0, names: [], declinedNames: [] });
    });

    it("counts a confirmation whose name did not arrive, without printing an empty name", () => {
        expect(attendeeSummary([{ userId: 1, fullName: "  ", status: "Confirmed" }, { userId: 2, status: "Confirmed" }])).toEqual({
            confirmed: 2,
            declined: 0,
            total: 2,
            unanswered: 0,
            names: [],
            declinedNames: [],
        });
    });
});

describe("attendanceCountLabel", () => {
    it("says how many of how many confirmed", () => {
        expect(attendanceCountLabel({ confirmed: 3, declined: 0, total: 5, unanswered: 2, names: [], declinedNames: [] })).toBe("3 de 5 confirmaron");
    });

    it("says nobody has confirmed yet, even before anyone was asked", () => {
        expect(attendanceCountLabel({ confirmed: 0, declined: 0, total: 5, unanswered: 5, names: [], declinedNames: [] })).toBe("Nadie ha confirmado todavía");
        expect(attendanceCountLabel({ confirmed: 0, declined: 0, total: 0, unanswered: 0, names: [], declinedNames: [] })).toBe("Nadie ha confirmado todavía");
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

describe("declinedLabel / unansweredLabel", () => {
    const rows = [
        { userId: 1, fullName: "Mateo", status: "Confirmed" },
        { userId: 2, fullName: "Lucía", status: "Declined" },
        { userId: 3, fullName: "Diego", status: null },
    ];

    it("names the members who cannot make it, because the manager needs them as much as the yeses", () => {
        expect(declinedLabel(attendeeSummary(rows))).toBe("No pueden: Lucía");
    });

    it("counts a decline whose name did not arrive without printing an empty name", () => {
        expect(declinedLabel(attendeeSummary([{ userId: 2, status: "Declined" }]))).toBe("1 no pueden ir");
    });

    it("says nothing about declines when nobody declined", () => {
        expect(declinedLabel(attendeeSummary([{ userId: 1, fullName: "Mateo", status: "Confirmed" }]))).toBeNull();
    });

    it("reports how many are still missing", () => {
        expect(unansweredLabel(attendeeSummary(rows))).toBe("Falta 1 por responder");
        expect(unansweredLabel(attendeeSummary([{ userId: 3, status: null }, { userId: 4, status: null }]))).toBe("Faltan 2 por responder");
    });

    it("says nothing when everyone answered", () => {
        expect(unansweredLabel(attendeeSummary([{ userId: 1, fullName: "A", status: "Confirmed" }]))).toBeNull();
        expect(unansweredLabel(attendeeSummary([]))).toBeNull();
    });
});
