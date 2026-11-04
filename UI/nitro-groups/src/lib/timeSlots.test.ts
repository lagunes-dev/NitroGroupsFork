import { describe, expect, it } from "vitest";
import { formatTime12h, generateTimeSlots, isValidTime, parseTime } from "./timeSlots";

describe("parseTime / isValidTime", () => {
    it("parses HH:mm", () => {
        expect(parseTime("18:30")).toEqual({ hours: 18, minutes: 30 });
        expect(parseTime("00:00")).toEqual({ hours: 0, minutes: 0 });
        expect(parseTime("23:59")).toEqual({ hours: 23, minutes: 59 });
    });
    it("rejects anything else", () => {
        for (const bad of ["", "6:00", "24:00", "12:60", "12:5", "ab:cd", "12:30:00", "12-30"]) {
            expect(parseTime(bad)).toBeNull();
            expect(isValidTime(bad)).toBe(false);
        }
        expect(parseTime(undefined)).toBeNull();
        expect(isValidTime("07:30")).toBe(true);
    });
});

describe("formatTime12h", () => {
    it("uses the Mexican 12-hour style", () => {
        expect(formatTime12h("00:00")).toBe("12:00 a. m.");
        expect(formatTime12h("00:30")).toBe("12:30 a. m.");
        expect(formatTime12h("06:00")).toBe("6:00 a. m.");
        expect(formatTime12h("12:00")).toBe("12:00 p. m.");
        expect(formatTime12h("12:30")).toBe("12:30 p. m.");
        expect(formatTime12h("18:00")).toBe("6:00 p. m.");
        expect(formatTime12h("23:30")).toBe("11:30 p. m.");
    });
    it("returns null for invalid values", () => {
        expect(formatTime12h("25:00")).toBeNull();
        expect(formatTime12h("")).toBeNull();
    });
});

describe("generateTimeSlots", () => {
    it("covers the day in 30-minute steps", () => {
        const slots = generateTimeSlots();
        expect(slots).toHaveLength(48);
        expect(slots[0]).toBe("00:00");
        expect(slots[1]).toBe("00:30");
        expect(slots[47]).toBe("23:30");
        expect(new Set(slots).size).toBe(48);
    });
    it("honours inclusive from/to bounds", () => {
        expect(generateTimeSlots("18:00", "20:00")).toEqual(["18:00", "18:30", "19:00", "19:30", "20:00"]);
    });
    it("rounds an off-grid lower bound up and an upper bound down", () => {
        expect(generateTimeSlots("18:10", "19:50")).toEqual(["18:30", "19:00", "19:30"]);
    });
    it("ignores invalid bounds and returns empty when from is after to", () => {
        expect(generateTimeSlots("zz", "yy")).toHaveLength(48);
        expect(generateTimeSlots("20:00", "18:00")).toEqual([]);
    });
});
