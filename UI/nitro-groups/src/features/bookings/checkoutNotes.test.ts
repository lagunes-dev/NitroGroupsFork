import { describe, expect, it } from "vitest";
import { toCheckoutNotesView, updatedOnLabel } from "./checkoutNotes";

/**
 * Ronda 9, "cómo pagar": las dos notas del hilo del cliente. Estas pruebas fijan las reglas de la
 * vista, no del backend: el texto del grupo se lee tal cual, la fecha se dice solo cuando se puede
 * leer, y la línea de "no cobra ni interviene" se dibuja una sola vez aunque viaje en cada nota.
 */
const agreement = {
    title: "Cómo pagar",
    body: "Acordaste el pago en efectivo con el grupo. Te atiende Pedro Vargas.",
    userDescription: "Pagas directo al grupo; NitroGroups no cobra ni interviene.",
    updatedOn: null,
};

const groupNote = {
    title: "Instrucciones del grupo",
    body: "Transfiere a la CLABE 0121 8000 1234 5678, BBVA.",
    userDescription: "Pagas directo al grupo; NitroGroups no cobra ni interviene.",
    updatedOn: "2026-11-05",
};

describe("La fecha de la nota de cómo pagar", () => {
    it("says the day the group last changed it", () => {
        expect(updatedOnLabel("2026-11-05")).toBe("Actualizado el 5 de noviembre");
    });

    it("does not invent a date it cannot read", () => {
        for (const value of [null, undefined, "", "   ", "no-es-fecha", "2026-02-30", 42])
            expect(updatedOnLabel(value), String(value)).toBeNull();
    });
});

describe("Las notas de cómo pagar", () => {
    it("keeps the group's text verbatim and its date", () => {
        const view = toCheckoutNotesView([agreement, groupNote]);

        expect(view?.notes).toEqual([
            { title: "Cómo pagar", body: agreement.body, updated: null },
            {
                title: "Instrucciones del grupo",
                body: "Transfiere a la CLABE 0121 8000 1234 5678, BBVA.",
                updated: "Actualizado el 5 de noviembre",
            },
        ]);
    });

    it("says the fixed line once, not once per note", () => {
        const view = toCheckoutNotesView([agreement, groupNote]);

        expect(view?.notice).toBe("Pagas directo al grupo; NitroGroups no cobra ni interviene.");
    });

    it("keeps the agreement when the group wrote nothing", () => {
        const view = toCheckoutNotesView([agreement]);

        expect(view?.notes).toHaveLength(1);
        expect(view?.notice).toBe("Pagas directo al grupo; NitroGroups no cobra ni interviene.");
    });

    it("draws nothing for a note without title or body", () => {
        const view = toCheckoutNotesView([{ title: "", body: "   " }, agreement]);

        expect(view?.notes).toHaveLength(1);
        expect(view?.notes[0].title).toBe("Cómo pagar");
    });

    it("draws nothing at all when the payload is not a list of notes", () => {
        expect(toCheckoutNotesView(null)).toBeNull();
        expect(toCheckoutNotesView({})).toBeNull();
        expect(toCheckoutNotesView([])).toBeNull();
        expect(toCheckoutNotesView([null, "nota", 42])).toBeNull();
    });

    it("keeps a readable date when the note arrives with one", () => {
        const view = toCheckoutNotesView([{ ...groupNote, updatedOn: null }]);

        expect(view?.notes[0].updated).toBeNull();
    });
});
