import { describe, expect, it } from "vitest";
import {
    durationOptions,
    eventTypeOptions,
    firstInvalidField,
    startTimeOptions,
    validateRequestFields,
} from "./requestForm";

const valid = { eventDate: "2026-12-12", durationHours: 3, eventType: "Boda", locationText: "Salón Los Arcos" };

describe("validateRequestFields", () => {
    it("accepts a complete request", () => {
        expect(validateRequestFields(valid, "2026-11-04", 2)).toEqual({});
    });

    it("accepts today as the event date", () => {
        expect(validateRequestFields({ ...valid, eventDate: "2026-11-04" }, "2026-11-04", 2)).toEqual({});
    });

    it("requires a date", () => {
        expect(validateRequestFields({ ...valid, eventDate: "" }, "2026-11-04", 2).eventDate).toBe("Elige la fecha del evento.");
    });

    it("rejects a malformed or impossible date", () => {
        expect(validateRequestFields({ ...valid, eventDate: "2026-02-30" }, "2026-11-04", 2).eventDate).toBe("Elige la fecha del evento.");
    });

    it("rejects a date before today", () => {
        expect(validateRequestFields({ ...valid, eventDate: "2026-11-03" }, "2026-11-04", 2).eventDate).toBe("Elige una fecha desde hoy.");
    });

    it("requires the event type", () => {
        expect(validateRequestFields({ ...valid, eventType: "" }, "2026-11-04", 2).eventType).toBe("Elige qué celebras.");
    });

    it("requires a non-blank place", () => {
        expect(validateRequestFields({ ...valid, locationText: "   " }, "2026-11-04", 2).locationText).toBe("Escribe dónde será el evento.");
    });

    it("keeps the duration between the group's minimum and 12 hours", () => {
        expect(validateRequestFields({ ...valid, durationHours: 1 }, "2026-11-04", 2).durationHours).toBe("Elige entre 2 y 12 horas.");
        expect(validateRequestFields({ ...valid, durationHours: 13 }, "2026-11-04", 2).durationHours).toBe("Elige entre 2 y 12 horas.");
        expect(validateRequestFields({ ...valid, durationHours: Number.NaN }, "2026-11-04", 2).durationHours).toBe("Elige entre 2 y 12 horas.");
        expect(validateRequestFields({ ...valid, durationHours: 12 }, "2026-11-04", 2)).toEqual({});
    });
});

describe("firstInvalidField", () => {
    it("follows the order of the form, not the order of the errors", () => {
        expect(firstInvalidField({ locationText: "x", eventType: "x", eventDate: "x" })).toBe("eventDate");
        expect(firstInvalidField({ locationText: "x", durationHours: "x" })).toBe("durationHours");
        expect(firstInvalidField({ locationText: "x", eventType: "x" })).toBe("eventType");
    });

    it("is undefined without errors", () => {
        expect(firstInvalidField({})).toBeUndefined();
    });
});

describe("option lists", () => {
    it("durations run from the minimum to 12 with Spanish plurals", () => {
        const options = durationOptions(1);
        expect(options[0]).toEqual({ value: "1", label: "1 hora" });
        expect(options[1]).toEqual({ value: "2", label: "2 horas" });
        expect(options.at(-1)).toEqual({ value: "12", label: "12 horas" });
        expect(durationOptions(10).map((o) => o.value)).toEqual(["10", "11", "12"]);
    });

    it("event types use their own text as value", () => {
        expect(eventTypeOptions(["Boda", "XV años"])).toEqual([
            { value: "Boda", label: "Boda" },
            { value: "XV años", label: "XV años" },
        ]);
    });

    it("start times are 30-minute slots submitted as HH:mm and labelled in 12h", () => {
        const options = startTimeOptions();
        expect(options[0]).toEqual({ value: "00:00", label: "12:00 a. m." });
        expect(options).toContainEqual({ value: "18:30", label: "6:30 p. m." });
        expect(options).toHaveLength(48);
    });
});
