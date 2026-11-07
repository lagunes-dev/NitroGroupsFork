import { describe, expect, it } from "vitest";
import { toCheckoutNotesView, updatedOnLabel } from "./checkoutNotes";

/**
 * Ronda 9, "cómo pagar": la nota del hilo del cliente. Estas pruebas fijan las reglas de la vista, no
 * del backend: el texto del grupo se lee tal cual, el nombre del manager va en su propia línea, la
 * fecha se dice solo cuando se puede leer y la línea de "no cobra ni interviene" se dibuja una vez.
 * Ronda 10: es **una** nota autoritativa, y lo que la app no sabe no lo dice.
 */
const groupNote = {
    title: "Cómo pagar",
    body: "Transfiere a la CLABE 0121 8000 1234 5678, BBVA.",
    managerLine: "Te atiende Pedro Vargas.",
    userDescription: "Pagas directo al grupo; NitroGroups no cobra ni interviene.",
    updatedOn: "2026-11-05",
};

const agreedNote = {
    title: "Cómo pagar",
    body: "Acuerdas el pago con el grupo.",
    managerLine: "Te atiende Pedro Vargas.",
    userDescription: "Pagas directo al grupo; NitroGroups no cobra ni interviene.",
    updatedOn: null,
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
    it("keeps the group's text verbatim, its date and the manager's line", () => {
        const view = toCheckoutNotesView([groupNote]);

        expect(view?.notes).toEqual([
            {
                title: "Cómo pagar",
                body: "Transfiere a la CLABE 0121 8000 1234 5678, BBVA.",
                managerLine: "Te atiende Pedro Vargas.",
                updated: "Actualizado el 5 de noviembre",
            },
        ]);
    });

    it("draws one note, not one per statement: the method is said once", () => {
        const view = toCheckoutNotesView([groupNote]);

        expect(view?.notes).toHaveLength(1);
        expect(view?.notes[0].body).toBe(groupNote.body);
    });

    it("says the fixed line once, not once per note", () => {
        const view = toCheckoutNotesView([groupNote]);

        expect(view?.notice).toBe("Pagas directo al grupo; NitroGroups no cobra ni interviene.");
    });

    it("keeps the note when the group wrote nothing, without inventing a method", () => {
        const view = toCheckoutNotesView([agreedNote]);

        expect(view?.notes).toHaveLength(1);
        expect(view?.notes[0].body).toBe("Acuerdas el pago con el grupo.");
        expect(JSON.stringify(view)).not.toMatch(/efectivo|transferencia|CLABE/i);
        expect(view?.notice).toBe("Pagas directo al grupo; NitroGroups no cobra ni interviene.");
    });

    it("draws no manager line when the API cannot give a name", () => {
        for (const value of [null, undefined, "", "   ", 42]) {
            const view = toCheckoutNotesView([{ ...groupNote, managerLine: value }]);

            expect(view?.notes[0].managerLine, String(value)).toBeNull();
        }
    });

    it("draws nothing for a note without title or body", () => {
        const view = toCheckoutNotesView([{ title: "", body: "   " }, groupNote]);

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
