import { describe, expect, it } from "vitest";
import { membershipSummary } from "./summary";

describe("membershipSummary", () => {
    it("uses the singular for one group", () => {
        expect(membershipSummary(1)).toBe("Eres miembro de 1 grupo.");
    });

    it("uses the plural for several groups", () => {
        expect(membershipSummary(5)).toBe("Eres miembro de 5 grupos.");
    });

    it("returns an empty string when there are none", () => {
        expect(membershipSummary(0)).toBe("");
    });

    it("ignores a negative or non-integer count", () => {
        expect(membershipSummary(-2)).toBe("");
        expect(membershipSummary(Number.NaN)).toBe("");
    });
});
