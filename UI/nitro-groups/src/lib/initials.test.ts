import { describe, expect, it } from "vitest";
import { initials } from "./initials";

describe("initials", () => {
    it("takes the first letters of the first and last word", () => {
        expect(initials("Emmanuel Hernandez")).toBe("EH");
        expect(initials("María del Carmen López")).toBe("ML");
    });

    it("uses the first letter when there is one word", () => {
        expect(initials("Emmanuel")).toBe("E");
    });

    it("ignores extra spaces", () => {
        expect(initials("  Emmanuel    Hernandez  ")).toBe("EH");
    });

    it("upper-cases lowercase input", () => {
        expect(initials("ana pérez")).toBe("AP");
    });

    it("keeps accented letters", () => {
        expect(initials("Álvaro Núñez")).toBe("ÁN");
    });

    it("falls back to a neutral mark when there is no name", () => {
        expect(initials("")).toBe("?");
        expect(initials("   ")).toBe("?");
        expect(initials(null)).toBe("?");
        expect(initials(undefined)).toBe("?");
    });
});
