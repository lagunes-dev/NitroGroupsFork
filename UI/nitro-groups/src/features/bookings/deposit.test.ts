import { describe, expect, it } from "vitest";
import { depositLabel } from "./deposit";

describe("depositLabel", () => {
    it("says when the deposit was received, with the full date in Spanish", () => {
        expect(depositLabel({ amount: 3000, receivedAt: "2026-11-04T18:00:00Z" })).toBe("Anticipo $3,000 · recibido el 4 de noviembre de 2026");
    });

    it("reads the date in Mexico, not in UTC", () => {
        expect(depositLabel({ amount: 500, receivedAt: "2026-11-05T03:30:00Z" })).toBe("Anticipo $500 · recibido el 4 de noviembre de 2026");
    });

    it("says pending while there is no received date", () => {
        expect(depositLabel({ amount: 3000, receivedAt: null })).toBe("Anticipo $3,000 · pendiente");
        expect(depositLabel({ amount: "3000" })).toBe("Anticipo $3,000 · pendiente");
    });

    it("never invents a date it cannot read", () => {
        expect(depositLabel({ amount: 3000, receivedAt: "yesterday" })).toBe("Anticipo $3,000 · recibido");
    });

    it("returns null when there is no usable deposit", () => {
        expect(depositLabel(null)).toBeNull();
        expect(depositLabel(undefined)).toBeNull();
        expect(depositLabel({ amount: null, receivedAt: null })).toBeNull();
        expect(depositLabel({ amount: -1 })).toBeNull();
        expect(depositLabel({ amount: "abc" })).toBeNull();
        expect(depositLabel("3000")).toBeNull();
    });
});
