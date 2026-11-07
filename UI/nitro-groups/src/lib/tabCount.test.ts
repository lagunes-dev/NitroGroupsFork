import { describe, expect, it } from "vitest";
import { tabCountLabel } from "./tabCount";

describe("tabCountLabel", () => {
    it("names the tab with its pending count", () => {
        expect(tabCountLabel("Equipo", 2)).toBe("Equipo, 2 pendientes");
    });
    it("uses the singular for one", () => {
        expect(tabCountLabel("Invitaciones", 1)).toBe("Invitaciones, 1 pendiente");
    });
    it("is the bare title at zero, negative or missing", () => {
        expect(tabCountLabel("Equipo", 0)).toBe("Equipo");
        expect(tabCountLabel("Equipo", -1)).toBe("Equipo");
        expect(tabCountLabel("Equipo")).toBe("Equipo");
    });
});
