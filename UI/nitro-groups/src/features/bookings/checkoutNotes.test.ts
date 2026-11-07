import { describe, expect, it } from "vitest";
import { conceptLine, paymentClipboardText, toCheckoutNotesView, updatedOnLabel } from "./checkoutNotes";

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

/**
 * Ronda 11: el texto de pago es uno solo por grupo, así que los dos eventos aceptados dicen las mismas
 * palabras y el concepto de adentro nombra a uno de ellos. La app agrega su propia línea desde el
 * pedido —nunca desde el texto del grupo— para que la clienta sepa qué transferencia es cuál.
 */
describe("El concepto de la transferencia (ronda 11)", () => {
    it("names the request and the event with its date, in the app's voice", () => {
        expect(conceptLine({ id: 20, eventType: "Corporate", eventDate: "2026-12-04" })).toBe(
            "Concepto: pedido 20 · Corporativo, 4 de diciembre de 2026"
        );
        expect(conceptLine({ id: 21, eventType: "Wedding", eventDate: "2026-12-19" })).toBe(
            "Concepto: pedido 21 · Boda, 19 de diciembre de 2026"
        );
    });

    it("never takes its words from the group's text, which stays verbatim", () => {
        const view = toCheckoutNotesView([{ ...groupNote, body: "Transfiere a la CLABE 0121 8000 1234 5678 · boda 19 dic" }]);

        expect(view?.notes[0].body).toBe("Transfiere a la CLABE 0121 8000 1234 5678 · boda 19 dic");
        expect(conceptLine({ id: 20, eventType: "Corporate", eventDate: "2026-12-04" })).not.toMatch(/boda 19 dic/i);
    });

    it("says only what it can read, and never invents a date or a type", () => {
        expect(conceptLine({ id: 20, eventType: "Corporate", eventDate: "no es fecha" })).toBe("Concepto: pedido 20 · Corporativo");
        expect(conceptLine({ id: 20, eventType: "", eventDate: "2026-12-04" })).toBe("Concepto: pedido 20 · 4 de diciembre de 2026");
        expect(conceptLine({ id: 20, eventType: null, eventDate: null })).toBe("Concepto: pedido 20");
        expect(conceptLine({ id: 20, eventType: "Corporate", eventDate: "2026-02-30" })).toBe("Concepto: pedido 20 · Corporativo");
    });

    it("says nothing without a request to name", () => {
        expect(conceptLine({ id: 0, eventType: "Boda", eventDate: "2026-12-04" })).toBeNull();
        expect(conceptLine({ id: -3, eventType: "Boda", eventDate: "2026-12-04" })).toBeNull();
        expect(conceptLine({ id: 1.5, eventType: "Boda", eventDate: "2026-12-04" })).toBeNull();
    });
});

/**
 * Ronda 11: la cuenta y el teléfono son texto muerto y 18 dígitos a mano en un teléfono son una
 * transferencia al azar. Se copia el texto tal cual; la app no adivina qué número es qué.
 */
describe("El texto que se copia de la nota (ronda 11)", () => {
    const concept = "Concepto: pedido 20 · Corporativo, 4 de diciembre de 2026";
    const view = toCheckoutNotesView([groupNote])!;

    it("copies the group's text, who attends and the concept, and nothing else", () => {
        expect(paymentClipboardText(view, concept)).toBe(
            "Transfiere a la CLABE 0121 8000 1234 5678, BBVA.\nTe atiende Pedro Vargas.\nConcepto: pedido 20 · Corporativo, 4 de diciembre de 2026"
        );
        // El título, la fecha de actualización y la línea de "no cobra" no son datos del banco.
        const text = paymentClipboardText(view, concept);
        expect(text).not.toMatch(/Cómo pagar|Actualizado el|NitroGroups no cobra/);
    });

    it("copies it verbatim: no number becomes a link, no account is guessed", () => {
        const text = paymentClipboardText(view, concept);

        expect(text).toContain("0121 8000 1234 5678");
        expect(text).not.toMatch(/https?:|tel:|clabe=|cuenta=/i);
    });

    it("copies what there is when the app cannot name the request", () => {
        expect(paymentClipboardText(view, null)).toBe("Transfiere a la CLABE 0121 8000 1234 5678, BBVA.\nTe atiende Pedro Vargas.");
    });
});
