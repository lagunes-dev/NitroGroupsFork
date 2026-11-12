import { formatPrice, isIsoDate } from "@/lib/format";

/** El mínimo y el tope del mensaje de la solicitud: los mismos números que valida la API. */
export const REQUEST_MESSAGE_MIN = 10;
export const REQUEST_MESSAGE_MAX = 2000;

/**
 * El tope del lugar del evento tal como lo ofrece el formulario. La API admite más, pero el campo no
 * deja escribir más: el que se ofrece es el que se dice.
 */
export const REQUEST_LOCATION_MAX = 200;

/** Un monto que se puede nombrar: números y cadenas numéricas, nunca negativos y nunca cero. */
function amountOf(value: unknown): number | null {
    const amount = typeof value === "string" && value.trim() ? Number(value) : value;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return null;
    return amount;
}

/**
 * Ronda 13 (tarea 2): la clienta ofreció $1,000 a un grupo que cobra desde $12,000 y la app no dijo nada.
 * No se bloquea —el cliente puede tener un motivo y el manager ya tiene sus propias señales (S11)—, se
 * dice en voz alta. La app no cobra ni valida dinero (D1/S18), así que esta línea informa y nunca desactiva
 * el envío. Null cuando la oferta alcanza el precio base o cuando falta cualquiera de las dos cifras:
 * tampoco se adivina hacia abajo.
 */
export function belowBasePriceNote(budget: unknown, basePrice: unknown, currency = "MXN"): string | null {
    const offered = amountOf(budget);
    const base = amountOf(basePrice);
    if (offered === null || base === null || offered >= base) return null;

    const money = (value: number) => formatPrice(value, currency) ?? `$${value}`;
    return `Ofreces ${money(offered)} y el grupo suele cobrar desde ${money(base)}.`;
}

/** Lo que el campo tendría si aceptara todo lo pegado: lo que hay, más lo que llega, menos lo que reemplaza. */
export function pastedLength(
    field: { value: string; selectionStart: number | null; selectionEnd: number | null },
    incoming: string
): number {
    const start = field.selectionStart ?? field.value.length;
    const end = field.selectionEnd ?? start;
    const replaced = Math.max(0, end - start);
    return field.value.length - replaced + incoming.length;
}

/** El contador de un campo con tope y, cuando el texto ya no entra, la frase que lo dice. */
export interface LimitRead {
    /** "1200 de 2000". */
    counter: string;
    atLimit: boolean;
    /** Null mientras el texto entra completo. */
    note: string | null;
}

/**
 * Ronda 13 (tarea 3): la clienta pegó 2,500 caracteres en un campo de 2,000 y el texto se cortó sin una
 * palabra. El campo sigue frenando en su tope —así nadie escribe algo que la API va a rechazar— y ahora lo
 * dice junto al contador, con la frase del caso: el freno normal del tope o un pegado que no cupo entero.
 */
export function limitRead(value: string, max: number, cut = false): LimitRead {
    const atLimit = value.length >= max;
    let note: string | null = null;
    if (atLimit) {
        note = cut
            ? `Pegaste más texto del que cabe: el campo se quedó con los primeros ${max} caracteres.`
            : `Llegaste al límite de ${max} caracteres: lo que escribas después no entra.`;
    }
    return { counter: `${value.length} de ${max}`, atLimit, note };
}

/**
 * Ronda 13 (tarea 4): el botón de enviar se apagaba sin decir por qué. Dice lo que falta con las frases que
 * el formulario ya usa para ese campo y en el orden en que se leen, sin agregar ninguna regla nueva.
 */
export function requestSendReason(input: { eventDate: string; message: string }): string | null {
    if (!isIsoDate(input.eventDate)) return "Elige la fecha del evento.";
    if (input.message.trim().length < REQUEST_MESSAGE_MIN) return `Escribe al menos ${REQUEST_MESSAGE_MIN} caracteres.`;
    return null;
}

/** Lo mismo para el botón de la conversación: un mensaje vacío no tiene nada que enviar. */
export function messageSendReason(reply: string): string | null {
    return reply.trim() ? null : "Escribe tu mensaje.";
}
