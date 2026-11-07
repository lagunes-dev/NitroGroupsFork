import { shortDayLabel } from "./deposit";

/**
 * Una nota de "cómo pagar" tal como la manda la API (ronda 9). La app no cobra ni mueve dinero
 * (D1/S18): la nota solo repite cómo dijo el grupo que quiere que se le pague.
 */
export interface CheckoutNotePayload {
    title?: string | null;
    body?: string | null;
    /** "Te atiende Mónica Salinas.": quién atiende el pago, en voz de la app (ronda 10). */
    managerLine?: string | null;
    /** La línea fija de quién cobra; la manda la nota. */
    userDescription?: string | null;
    /** `YYYY-MM-DD` del último cambio del texto; null cuando no se puede leer. */
    updatedOn?: string | null;
}

/** Una nota lista para dibujar. */
export interface CheckoutNote {
    title: string;
    body: string;
    /** "Te atiende Mónica Salinas."; null cuando la API no puede dar un nombre y no se dibuja. */
    managerLine: string | null;
    /** "Actualizado el 5 de noviembre"; null cuando no hay fecha legible y no se dibuja. */
    updated: string | null;
}

/** Lo que se dibuja del bloque: las notas y la línea fija, dicha una sola vez. */
export interface CheckoutNotesView {
    notes: CheckoutNote[];
    /** "Pagas directo al grupo; NitroGroups no cobra ni interviene."; null cuando la API no la manda. */
    notice: string | null;
}

function asText(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * "Actualizado el 5 de noviembre" desde un día `YYYY-MM-DD`; null cuando la fecha no se puede leer.
 * Un texto sin fecha legible se lee sin fecha: no se inventa un día que nadie escribió.
 */
export function updatedOnLabel(value: unknown): string | null {
    const day = shortDayLabel(value);
    return day ? `Actualizado el ${day}` : null;
}

/**
 * Las notas que se pueden leer: una sin título o sin cuerpo no es una nota y no se dibuja. La línea
 * fija se devuelve aparte porque es una sola para el bloque, aunque viaje en cada nota: repetirla bajo
 * las dos sería ruido, y perderla sería leer una nota que parece un cobro de la app.
 *
 * <p>Ronda 10: la API manda una sola nota —el texto del grupo o, si no escribió, la frase que dice con
 * quién se acuerda—. La vista no agrega ningún método propio: lo que llega es lo que se lee.</p>
 */
export function toCheckoutNotesView(payload: unknown): CheckoutNotesView | null {
    if (!Array.isArray(payload)) return null;

    const notes: CheckoutNote[] = [];
    let notice: string | null = null;

    for (const raw of payload) {
        const note = raw as CheckoutNotePayload | null;
        if (!note || typeof note !== "object") continue;

        const title = asText(note.title);
        const body = asText(note.body);
        if (notice === null) notice = asText(note.userDescription);
        if (!title || !body) continue;

        notes.push({ title, body, managerLine: asText(note.managerLine), updated: updatedOnLabel(note.updatedOn) });
    }

    return notes.length ? { notes, notice } : null;
}
