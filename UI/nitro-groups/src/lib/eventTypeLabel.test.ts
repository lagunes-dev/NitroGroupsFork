import { describe, expect, it } from "vitest";
import { eventTypeLabel } from "./eventTypeLabel";

describe("eventTypeLabel", () => {
    it("names every event type the API sends in English", () => {
        expect(eventTypeLabel("Wedding")).toBe("Boda");
        expect(eventTypeLabel("Corporate")).toBe("Corporativo");
        expect(eventTypeLabel("Birthday")).toBe("Cumpleaños");
        expect(eventTypeLabel("Quinceañera")).toBe("XV años");
        expect(eventTypeLabel("Ceremony")).toBe("Ceremonia");
        expect(eventTypeLabel("Other")).toBe("Otro");
    });

    it("shows a value it does not know exactly as it arrived", () => {
        expect(eventTypeLabel("Boda")).toBe("Boda");
        expect(eventTypeLabel("Graduación")).toBe("Graduación");
        expect(eventTypeLabel("wedding party")).toBe("wedding party");
    });

    it("ignores case and stray spaces around a known value", () => {
        expect(eventTypeLabel(" wedding ")).toBe("Boda");
        expect(eventTypeLabel("BIRTHDAY")).toBe("Cumpleaños");
    });

    it("returns an empty label when there is no value", () => {
        expect(eventTypeLabel("")).toBe("");
        expect(eventTypeLabel("   ")).toBe("");
        expect(eventTypeLabel(null)).toBe("");
        expect(eventTypeLabel(undefined)).toBe("");
    });
});
