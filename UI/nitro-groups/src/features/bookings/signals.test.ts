import { describe, expect, it } from "vitest";
import { budgetLabel, clashLabel, compareLabel, toSignalsView } from "./signals";

const gig = { id: 77, eventType: "Boda", locationText: "Hacienda San Gabriel" };

describe("clashLabel", () => {
    it("names the other gig of that day in words", () => {
        expect(clashLabel({ clashes: true, withGig: gig })).toBe("Ese día ya tienes un toque: Boda en Hacienda San Gabriel");
    });

    it("translates a known event type and keeps what it does not know", () => {
        expect(clashLabel({ clashes: true, withGig: { ...gig, eventType: "wedding" } })).toBe(
            "Ese día ya tienes un toque: Boda en Hacienda San Gabriel"
        );
        expect(clashLabel({ clashes: true, withGig: { ...gig, eventType: "Serenata" } })).toBe(
            "Ese día ya tienes un toque: Serenata en Hacienda San Gabriel"
        );
    });

    it("says the day is free when no other accepted gig clashes", () => {
        expect(clashLabel({ clashes: false, withGig: null })).toBe("Ese día no tienes otro toque.");
    });

    it("states the free day even if the API still sends a gig while not clashing", () => {
        expect(clashLabel({ clashes: false, withGig: gig })).toBe("Ese día no tienes otro toque.");
    });

    it("does not invent a place or a type it does not have", () => {
        expect(clashLabel({ clashes: true, withGig: { id: 7, eventType: "Boda", locationText: "" } })).toBe(
            "Ese día ya tienes un toque: Boda."
        );
        expect(clashLabel({ clashes: true, withGig: { id: 7 } })).toBe("Ese día ya tienes otro toque.");
        expect(clashLabel({ clashes: true, withGig: null })).toBe("Ese día ya tienes otro toque.");
    });

    it("says so when the clash cannot be known", () => {
        expect(clashLabel(undefined)).toBe("No podemos saber si ese día ya tienes otro toque.");
        expect(clashLabel("clash")).toBe("No podemos saber si ese día ya tienes otro toque.");
    });
});

describe("budgetLabel", () => {
    it("compares against the group's base rate without repeating the amount already in the request", () => {
        // El monto ofrecido vive en la ficha del pedido: repetirlo acá sobraba (ronda 5, Mónica).
        expect(budgetLabel({ offered: 18000, baseRate: 12000, status: "Above" })).toBe("Tu tarifa base es $12,000");
    });

    it("reads amounts that arrive as strings and formats them like the rest of the app", () => {
        expect(budgetLabel({ offered: "18000", baseRate: "12000.00", status: "Above" }, "MXN")).toBe(
            "Tu tarifa base es $12,000"
        );
    });

    it("says which number is missing instead of inventing it", () => {
        expect(budgetLabel({ offered: null, baseRate: 12000, status: "Unknown" })).toBe(
            "El cliente no indicó presupuesto."
        );
        expect(budgetLabel({ offered: 18000, baseRate: null, status: "Unknown" })).toBe("tu tarifa base no está cargada");
        expect(budgetLabel({ offered: null, baseRate: null, status: "Unknown" })).toBe(
            "El cliente no indicó presupuesto."
        );
        expect(budgetLabel(undefined)).toBe("No podemos leer el presupuesto ni tu tarifa base.");
    });
});

describe("compareLabel", () => {
    it("says the comparison in words for every status", () => {
        expect(compareLabel({ offered: 18000, baseRate: 12000, status: "Above" })).toBe("Está por encima de tu tarifa base.");
        expect(compareLabel({ offered: 9000, baseRate: 12000, status: "Below" })).toBe("Está por debajo de tu tarifa base.");
        expect(compareLabel({ offered: 12000, baseRate: 12000, status: "Equal" })).toBe("Coincide con tu tarifa base.");
        expect(compareLabel({ offered: null, baseRate: 12000, status: "Unknown" })).toBe(
            "No podemos compararlos: falta el monto ofrecido o tu tarifa base."
        );
    });

    it("never claims a comparison it cannot back with both numbers", () => {
        expect(compareLabel({ offered: null, baseRate: null, status: "Above" })).toBe(
            "No podemos compararlos: falta el monto ofrecido o tu tarifa base."
        );
        expect(compareLabel({ offered: 18000, baseRate: 12000, status: "Whatever" })).toBe(
            "No podemos compararlos: falta el monto ofrecido o tu tarifa base."
        );
        expect(compareLabel(undefined)).toBe("No podemos compararlos: falta el monto ofrecido o tu tarifa base.");
    });
});

describe("toSignalsView", () => {
    const signals = {
        dateClash: { clashes: true, withGig: gig },
        budget: { offered: 18000, baseRate: 12000, status: "Above" },
    };

    it("gives the group both facts with the request currency", () => {
        expect(toSignalsView(signals, "Group", "MXN")).toEqual({
            clash: "Ese día ya tienes un toque: Boda en Hacienda San Gabriel",
            budget: "Tu tarifa base es $12,000",
            comparison: "Está por encima de tu tarifa base.",
        });
    });

    it("shows nothing to the client: the signals belong to the group's thread", () => {
        expect(toSignalsView(signals, "Client", "MXN")).toBeNull();
    });

    it("shows nothing when the payload is not readable", () => {
        expect(toSignalsView(null, "Group")).toBeNull();
        expect(toSignalsView("signals", "Group")).toBeNull();
    });

    it("still states both facts when the API sends one of them broken", () => {
        expect(toSignalsView({ dateClash: null }, "Group")).toEqual({
            clash: "No podemos saber si ese día ya tienes otro toque.",
            budget: "No podemos leer el presupuesto ni tu tarifa base.",
            comparison: "No podemos compararlos: falta el monto ofrecido o tu tarifa base.",
        });
    });
});

describe("budgetLabel currency", () => {
    it("counts the group's base rate in the group's money, not the client's", () => {
        const signal = { offered: 12000, baseRate: 12000, currency: "USD", status: "Equal" };
        // La oferta sigue en pesos del cliente; la tarifa base, en dólares del grupo.
        // Intl usa espacio duro entre la moneda y el número: se normaliza para comparar.
        expect(budgetLabel(signal, "MXN").replace(/\s/g, " ")).toContain("USD 12,000");
    });
});

describe("clashLabel con horas", () => {
    const otherGig = { id: 8, eventType: "Boda", locationText: "Hacienda San Gabriel, Tlaquepaque", startTime: "20:00:00", durationHours: 3 };

    it("says the window of the other gig and how much the two overlap", () => {
        expect(clashLabel({ clashes: true, withGig: otherGig }, { startTime: "21:00:00", durationHours: 3 })).toBe(
            "Ese día ya tienes un toque: Boda 20:00–23:00 en Hacienda San Gabriel, Tlaquepaque · se pisan 2 h · tu pedido es 21:00–00:00, el otro toque acaba 23:00"
        );
    });

    it("says when they do not overlap but the day is still taken", () => {
        expect(clashLabel({ clashes: true, withGig: otherGig }, { startTime: "09:00:00", durationHours: 1 })).toBe(
            "Ese día ya tienes un toque: Boda 20:00–23:00 en Hacienda San Gabriel, Tlaquepaque · no se pisan, pero hay traslado · tu pedido es 09:00–10:00, el otro toque acaba 23:00"
        );
    });

    it("closes with the way out when the request window crosses midnight", () => {
        const late = { ...otherGig, startTime: "22:00:00", durationHours: 4 };
        expect(clashLabel({ clashes: true, withGig: late }, { startTime: "21:00:00", durationHours: 3 })).toBe(
            "Ese día ya tienes un toque: Boda 22:00–02:00 en Hacienda San Gabriel, Tlaquepaque · se pisan 2 h · tu pedido es 21:00–00:00, el otro toque acaba 02:00"
        );
    });

    it("never invents the way out when a window is unknown", () => {
        expect(clashLabel({ clashes: true, withGig: otherGig }, { startTime: "21:00:00" })).not.toMatch(/tu pedido es/);
        expect(clashLabel({ clashes: true, withGig: { ...otherGig, durationHours: null } }, { startTime: "21:00:00", durationHours: 3 })).not.toMatch(/acaba/);
    });

    it("falls back to what it knows when the request has no hours", () => {
        expect(clashLabel({ clashes: true, withGig: otherGig })).toBe(
            "Ese día ya tienes un toque: Boda 20:00–23:00 en Hacienda San Gabriel, Tlaquepaque"
        );
        expect(clashLabel({ clashes: true, withGig: { eventType: "Boda", locationText: "X" } })).toBe(
            "Ese día ya tienes un toque: Boda en X"
        );
    });
});
