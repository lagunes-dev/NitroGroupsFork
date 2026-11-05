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
    it("states what the client offers and the group's base rate", () => {
        expect(budgetLabel({ offered: 18000, baseRate: 12000, status: "Above" })).toBe(
            "Ofrece $18,000 · tu tarifa base es $12,000"
        );
    });

    it("reads amounts that arrive as strings and formats them like the rest of the app", () => {
        expect(budgetLabel({ offered: "18000", baseRate: "12000.00", status: "Above" }, "MXN")).toBe(
            "Ofrece $18,000 · tu tarifa base es $12,000"
        );
    });

    it("says which number is missing instead of inventing it", () => {
        expect(budgetLabel({ offered: null, baseRate: 12000, status: "Unknown" })).toBe(
            "El cliente no indicó presupuesto · tu tarifa base es $12,000"
        );
        expect(budgetLabel({ offered: 18000, baseRate: null, status: "Unknown" })).toBe(
            "Ofrece $18,000 · tu tarifa base no está cargada"
        );
        expect(budgetLabel({ offered: null, baseRate: null, status: "Unknown" })).toBe(
            "El cliente no indicó presupuesto · tu tarifa base no está cargada"
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
            budget: "Ofrece $18,000 · tu tarifa base es $12,000",
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
