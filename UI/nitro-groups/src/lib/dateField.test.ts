import { describe, expect, it } from "vitest";
import { clampIsoDate, formatFriendlyDate, isIsoDateDisabled, parseIsoDate, toIsoDate } from "./dateField";

describe("parseIsoDate / toIsoDate", () => {
    it("builds a local date from y/m/d parts", () => {
        const date = parseIsoDate("2026-11-07");
        expect(date).not.toBeNull();
        expect([date!.getFullYear(), date!.getMonth(), date!.getDate()]).toEqual([2026, 10, 7]);
    });
    it("round-trips without timezone drift", () => {
        for (const iso of ["2026-01-01", "2026-03-08", "2026-11-01", "2028-02-29", "2026-12-31"]) {
            expect(toIsoDate(parseIsoDate(iso)!)).toBe(iso);
        }
    });
    it("keeps the picked day when the date is late in the evening", () => {
        expect(toIsoDate(new Date(2026, 10, 7, 23, 59))).toBe("2026-11-07");
    });
    it("pads month and day", () => {
        expect(toIsoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
    });
    it("rejects malformed and impossible dates", () => {
        for (const bad of ["", "abc", "2026-1-5", "2026-13-01", "2026-02-30", "2027-02-29", "2026-11-07T10:00"]) {
            expect(parseIsoDate(bad)).toBeNull();
        }
        expect(parseIsoDate(undefined)).toBeNull();
    });
});

describe("formatFriendlyDate", () => {
    it("writes weekday, day, month and year in es-MX", () => {
        expect(formatFriendlyDate("2026-11-07")).toBe("sáb 7 nov 2026");
        expect(formatFriendlyDate("2026-12-14")).toBe("lun 14 dic 2026");
        expect(formatFriendlyDate("2026-03-04")).toBe("mié 4 mar 2026");
    });
    it("returns null for an invalid or empty value", () => {
        expect(formatFriendlyDate("nope")).toBeNull();
        expect(formatFriendlyDate("")).toBeNull();
        expect(formatFriendlyDate(undefined)).toBeNull();
    });
});

describe("clampIsoDate / isIsoDateDisabled", () => {
    it("raises a date below min and lowers one above max", () => {
        expect(clampIsoDate("2026-11-01", "2026-11-05", "2026-11-30")).toBe("2026-11-05");
        expect(clampIsoDate("2026-12-01", "2026-11-05", "2026-11-30")).toBe("2026-11-30");
        expect(clampIsoDate("2026-11-10", "2026-11-05", "2026-11-30")).toBe("2026-11-10");
    });
    it("passes the date through without bounds", () => {
        expect(clampIsoDate("2026-11-10")).toBe("2026-11-10");
    });
    it("disables only days outside the bounds, bounds included as enabled", () => {
        expect(isIsoDateDisabled("2026-11-04", "2026-11-05")).toBe(true);
        expect(isIsoDateDisabled("2026-11-05", "2026-11-05")).toBe(false);
        expect(isIsoDateDisabled("2026-12-01", undefined, "2026-11-30")).toBe(true);
        expect(isIsoDateDisabled("2026-11-30", undefined, "2026-11-30")).toBe(false);
        expect(isIsoDateDisabled("2026-11-10")).toBe(false);
    });
});
