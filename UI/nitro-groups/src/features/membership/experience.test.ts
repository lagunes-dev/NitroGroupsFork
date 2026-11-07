import { describe, expect, it } from "vitest";
import { experienceLabel } from "./experience";

describe("experienceLabel", () => {
    it("uses the singular for one year", () => {
        expect(experienceLabel(1)).toBe("1 año de experiencia");
    });

    it("uses the plural for several years", () => {
        expect(experienceLabel(8)).toBe("8 años de experiencia");
    });

    it("says nothing was provided when the value is missing or zero", () => {
        expect(experienceLabel(null)).toBe("Experiencia sin indicar");
        expect(experienceLabel(undefined)).toBe("Experiencia sin indicar");
        expect(experienceLabel(0)).toBe("Experiencia sin indicar");
    });
});
