import { eventTypeLabel } from "@/lib/eventTypeLabel";
import { longDayLabel, shortDayLabel } from "./deposit";

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

/**
 * Ronda 11: el concepto que la clienta escribe en la transferencia. El texto de pago es uno solo por
 * grupo, así que los dos eventos aceptados dicen las mismas palabras y el concepto de adentro nombra a
 * uno de ellos: seguirlo rotula las dos transferencias igual. Esta línea sale del pedido —nunca del
 * texto del grupo, que se sigue leyendo tal cual— y es información, no un control.
 *
 * <p>Dice solo lo que puede leer: sin fecha legible nombra el pedido y el tipo, y sin tipo ni fecha
 * nombra el pedido. Nunca escribe un día que nadie cargó.</p>
 */
export function conceptLine(request: {
    id: number;
    eventType?: string | null;
    eventDate?: string | null;
}): string | null {
    if (!Number.isInteger(request.id) || request.id <= 0) return null;

    const what = [eventTypeLabel(request.eventType), longDayLabel(request.eventDate)].filter(Boolean).join(", ");
    return what ? `Concepto: pedido ${request.id} · ${what}` : `Concepto: pedido ${request.id}`;
}

/**
 * Ronda 11: el texto que se copia, tal cual, para no teclear 18 dígitos en un teléfono y mandar la
 * transferencia a otra cuenta. La app no analiza el texto del grupo ni adivina qué número es la cuenta
 * y cuál el teléfono.
 *
 * <p>Ronda 12 (la clienta): al pegar lo copiado no había ni monto ni fecha, que era justo lo que faltaba
 * saber. Van primero las dos líneas que arma la app desde el pedido —el dinero que falta en esta etapa y
 * el concepto—, y después el texto del grupo, literal, con quién atiende.</p>
 */
export function paymentClipboardText(view: CheckoutNotesView, concept: string | null, due: string | null): string {
    const head = [due, concept].filter(Boolean).join("\n");
    const notes = view.notes
        .map((note) => [note.body, note.managerLine].filter(Boolean).join("\n"))
        .join("\n\n");
    return [head, notes].filter(Boolean).join("\n");
}
