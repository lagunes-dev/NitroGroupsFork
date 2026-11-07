import type { EventRequest, EventRequestParty, EventRequestStatus } from "./types";
import { formatEventDate, formatPrice, isIsoDate, todayInMexico } from "@/lib/format";

/** The deposit as the API sends it: a recorded fact, the app never charges it. */
export interface DepositPayload {
    amount?: number | string | null;
    /** ISO timestamp; null while the deposit has not been received. */
    receivedAt?: string | null;
    /** `YYYY-MM-DD`: the deadline the group loaded for the deposit (S24); null while there is none. */
    dueDate?: string | null;
}

/** "4 de noviembre de 2026" in Mexico time; null when the timestamp cannot be read. */
export function receivedDate(value: string): string | null {
    const moment = new Date(value);
    if (Number.isNaN(moment.getTime())) return null;
    // `formatEventDate` writes the weekday first ("miércoles, 4 de ..."); the money lines do not need it.
    return formatEventDate(todayInMexico(moment))?.replace(/^[^,]+,\s*/, "") ?? null;
}

/**
 * "15 de noviembre" from a `YYYY-MM-DD` calendar day; null when there is no readable day. One rule for
 * every short day in the deal copy, and never a date formatted by hand: `formatEventDate` formats it and
 * its weekday is dropped because the surrounding line already says the rest.
 */
export function shortDayLabel(value: unknown): string | null {
    if (typeof value !== "string" || !value.trim()) return null;
    const day = formatEventDate(value.slice(0, 10));
    return day?.replace(/^[^,]+,\s*/, "").replace(/ de \d{4}$/, "") ?? null;
}

/**
 * "15 de noviembre de 2026": a deadline without the year is ambiguous next to a product that says the
 * year everywhere else (round 10). Same helper as every other long date, minus the weekday.
 */
export function longDayLabel(value: unknown): string | null {
    if (typeof value !== "string" || !value.trim()) return null;
    return formatEventDate(value.slice(0, 10))?.replace(/^[^,]+,\s*/, "") ?? null;
}

/** "para el 15 de noviembre de 2026", o null cuando no hay plazo que decir (T61, S24). */
export function dueDateLabel(value: unknown): string | null {
    const day = longDayLabel(value);
    return day ? `para el ${day}` : null;
}

/** "antes del 15 de noviembre de 2026": el mismo día, dicho como lo que el paso pide (ronda 11). */
export function beforeDateLabel(value: unknown): string | null {
    const day = longDayLabel(value);
    return day ? `antes del ${day}` : null;
}

/** The deposit as the app knows it: an amount the group recorded and whether it already landed. */
function readDeposit(deposit: unknown): { amount: number; received: boolean } | null {
    if (!deposit || typeof deposit !== "object") return null;
    const { amount, receivedAt } = deposit as DepositPayload;
    const value = typeof amount === "string" && amount.trim() ? Number(amount) : amount;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
    return { amount: value, received: typeof receivedAt === "string" && receivedAt.trim().length > 0 };
}

/**
 * Ronda 11: lo que la app ya sabe del anticipo, para que el próximo paso no pida acordar lo que ya está
 * cargado. Null cuando no hay monto recordado o cuando ese anticipo ya entró: ya no hay nada que pagar.
 */
function pendingDeposit(deposit: unknown): DepositPayload | null {
    const read = readDeposit(deposit);
    if (!read || read.received) return null;
    return deposit as DepositPayload;
}

/**
 * "Anticipo $3,000 · recibido el 4 de noviembre de 2026", or "Anticipo $3,000 · pendiente" with the
 * deadline the group loaded when there is one: "Anticipo $3,000 · pendiente · para el 15 de noviembre de 2026".
 * Null when there is no usable amount, so callers render nothing for a gig without a deposit.
 */
export function depositLabel(deposit: unknown): string | null {
    const read = readDeposit(deposit);
    if (!read) return null;

    const head = `Anticipo ${formatPrice(read.amount)}`;
    if (read.received) {
        const date = receivedDate((deposit as DepositPayload).receivedAt as string);
        return date ? `${head} · recibido el ${date}` : `${head} · recibido`;
    }
    // T61: el plazo se dice mientras falta la plata. Ya recibida, la fecha límite no es noticia.
    const due = dueDateLabel((deposit as DepositPayload).dueDate);
    return due ? `${head} · pendiente · ${due}` : `${head} · pendiente`;
}

/**
 * The only piece of the gig logistics a client may see. Shown for an accepted request and only to the
 * client: the setlist, the call time and what musicians are paid never reach this view.
 */
export function clientDepositLabel(request: Pick<EventRequest, "status" | "deposit">, viewer: EventRequestParty): string | null {
    if (viewer !== "Client" || request.status !== "Accepted") return null;
    return depositLabel(request.deposit);
}

/**
 * Ronda 10: cómo pagar en la fila de la lista del cliente, junto al dinero del que habla. Es texto, no
 * un control (la app no cobra, D1/S18). Null cuando el grupo no escribió nada, cuando no hay trato
 * cerrado y cuando no queda nada por pagar: bajo "Saldo recibido" una CLABE es ruido.
 */
export function clientPaymentMethodLabel(
    request: Pick<DealRequest, "status" | "budget" | "deposit" | "balanceReceivedAt" | "paymentMethod">,
    viewer: EventRequestParty
): string | null {
    if (viewer !== "Client" || request.status !== "Accepted" || nothingLeftToPay(request)) return null;
    const method = typeof request.paymentMethod === "string" ? request.paymentMethod.trim() : "";
    return method || null;
}

/**
 * "$18,000", or "Sin presupuesto" when the client left it empty: un cero no es un precio, y la lista
 * y el detalle tienen que decir lo mismo del mismo dato.
 */
export function budgetLabel(request: { budget?: number | null; currency?: string }): string {
    const amount = request.budget;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return "Sin presupuesto";
    return formatPrice(amount, request.currency ?? "MXN") ?? "Sin presupuesto";
}

/** The slice of a request the deal copy needs; the currency falls back to pesos. */
type DealRequest = {
    status: EventRequestStatus;
    budget?: number | null;
    deposit?: unknown;
    currency?: string;
    /** ISO timestamp the group recorded when the balance arrived; null or missing until then. */
    balanceReceivedAt?: string | null;
    /** `YYYY-MM-DD`: the balance deadline the group loaded (T61, S24); null or missing until then. */
    balanceDueDate?: string | null;
    /** `YYYY-MM-DD`: the day of the event, to tell a gig that is over from one still ahead. */
    eventDate?: string | null;
    /** Ronda 10: cómo pagar en una línea, tal como lo manda la API en la lista del cliente. */
    paymentMethod?: string | null;
};

/** Whether the group recorded that the balance arrived (T48): a fact, the app never charges it. */
/** True when `eventDate` is a real `YYYY-MM-DD` strictly before `today`; an unreadable date is not past. */
function isPast(eventDate: string | null | undefined, today: string): boolean {
    return isIsoDate(eventDate) && isIsoDate(today) && eventDate < today;
}

function isBalanceReceived(request: Pick<DealRequest, "balanceReceivedAt">): boolean {
    return typeof request.balanceReceivedAt === "string" && request.balanceReceivedAt.trim().length > 0;
}

/**
 * true cuando no queda nada por pagar, con la misma regla que la línea del saldo (ronda 10): el grupo
 * registró el saldo como recibido, o lo que falta es cero o menos. Un anticipo todavía pendiente no es
 * un trato cerrado, así que ahí sí hay algo que pagar y cómo pagarlo importa.
 */
export function nothingLeftToPay(
    request: Pick<DealRequest, "balanceReceivedAt" | "budget" | "deposit">
): boolean {
    if (isBalanceReceived(request)) return true;
    const remaining = remainingAmount(request);
    return remaining !== null && remaining <= 0;
}

/** What is still owed, in pesos. Null when the numbers cannot be stated honestly. */
function remainingAmount(request: { budget?: number | null; deposit?: unknown }): number | null {
    const deposit = readDeposit(request.deposit);
    if (!deposit || !deposit.received) return null;
    const budget = request.budget;
    if (typeof budget !== "number" || !Number.isFinite(budget) || budget <= 0) return null;
    return budget - deposit.amount;
}

/**
 * "Saldo recibido el 13 de diciembre de 2026" once the group recorded it — with the figure when the
 * cachet and the deposit let it be computed, so the client can check what she was charged; otherwise
 * the fact alone. `Falta pagar $14,000` for the client of an accepted event whose deposit already
 * landed, null while the deposit is pending, for the group's view and without a budget: the app
 * records the deposit, it never charges anything.
 */
export function balanceLabel(
    request: DealRequest,
    viewer: EventRequestParty
): string | null {
    if (viewer !== "Client" || request.status !== "Accepted") return null;
    // T48: what the group recorded wins over what we can compute from the deposit and the budget.
    if (isBalanceReceived(request)) {
        const date = receivedDate(request.balanceReceivedAt as string);
        const fact = date ? `Saldo recibido el ${date}` : "Saldo recibido";
        // Ronda 11: la cifra solo cuando sale de lo que la app ya sabe, y nunca un cero.
        const received = remainingAmount(request);
        const money = received !== null && received > 0 ? formatPrice(received, request.currency ?? "MXN") : null;
        return money ? `${fact} · ${money}` : fact;
    }
    const remaining = remainingAmount(request);
    if (remaining === null) return null;
    if (remaining <= 0) return "Sin saldo pendiente";
    const money = formatPrice(remaining, request.currency ?? "MXN");
    if (!money) return null;
    // T61: "Falta pagar $14,000 · para el 15 de noviembre de 2026", el plazo que cargó el manager.
    const due = dueDateLabel(request.balanceDueDate);
    return due ? `Falta pagar ${money} · ${due}` : `Falta pagar ${money}`;
}

/**
 * "Solicitud enviada el 5 de noviembre de 2026": el cliente espera y merece saber desde cuándo.
 * Null cuando la fecha no se puede leer.
 */
export function sentLabel(request: { createdAt?: string | null }): string | null {
    const raw = request.createdAt;
    if (typeof raw !== "string" || !raw.trim()) return null;
    const day = formatEventDate(raw.slice(0, 10));
    return day ? `Solicitud enviada el ${day}` : null;
}

/**
 * The one line that tells the client what happens next. Only the client gets it: the group answers
 * with its own actions, never with this copy.
 */
export function nextStepLabel(
    request: DealRequest,
    viewer: EventRequestParty,
    today: string = todayInMexico()
): string | null {
    if (viewer !== "Client") return null;
    switch (request.status) {
        // Pendiente no lleva próximo paso: el chip de estado ya lo dice y repetirlo suena a eco.
        case "Pending":
            return null;
        case "Declined":
            return "El grupo no puede con esa fecha. Busca otro grupo.";
        case "Cancelled":
            return "Este evento se canceló.";
        case "Accepted": {
            if (isBalanceReceived(request)) return "No queda nada por pagar.";
            // Ronda 9: un evento que ya pasó no pide "cerrar la fecha" ni "acordar para el día del
            // evento": son acciones sobre un futuro que ya no existe. Sin fecha legible no se inventa.
            if (isPast(request.eventDate, today)) return "Este evento ya pasó.";
            // Ronda 11: el anticipo ya está cargado como pendiente, así que no queda nada que acordar.
            // Con el plazo cargado el paso lo nombra; sin plazo pide pagar y no inventa una fecha.
            const deposit = pendingDeposit(request.deposit);
            if (deposit) {
                const depositBefore = beforeDateLabel(deposit.dueDate);
                return depositBefore ? `Paga el anticipo ${depositBefore}.` : "Paga el anticipo.";
            }
            const remaining = remainingAmount(request);
            if (remaining === null) return "Acuerda el anticipo con el grupo para cerrar la fecha.";
            if (remaining <= 0) return "No queda nada por pagar.";
            // Con la fecha límite ya dicha en la línea del saldo, "el día del evento" sería un segundo
            // plazo para el mismo saldo (y lo contradice): se nombra el plazo cargado y se pide pagar.
            const before = beforeDateLabel(request.balanceDueDate);
            return before ? `Paga el saldo ${before}.` : "Acuerda el saldo con el grupo para el día del evento.";
        }
        default:
            return null;
    }
}

/** What the client's accepted thread opens with: the balance, what it is for and the next step. */
export interface BalanceBlock {
    balance: string;
    /** "para el 19 de noviembre de 2026"; null when the date cannot be read. */
    purpose: string | null;
    nextStep: string;
}

/**
 * The block is only drawn when there is a balance to state: still owed, or recorded as received. A
 * pending deposit, a missing budget, a deposit that covers it all or the group's view leave the
 * thread as it was.
 */
export function balanceBlock(
    request: DealRequest & { eventDate?: string | null },
    viewer: EventRequestParty,
    today: string = todayInMexico()
): BalanceBlock | null {
    const balance = balanceLabel(request, viewer);
    const nextStep = nextStepLabel(request, viewer, today);
    if (!balance || !nextStep) return null;
    // Recorded as received: the fact and the settled step, with no "para el ..." that belongs to a debt.
    if (viewer === "Client" && request.status === "Accepted" && isBalanceReceived(request)) {
        return { balance, purpose: null, nextStep };
    }
    const remaining = remainingAmount(request);
    if (remaining === null || remaining <= 0) return null;

    // T61: si el manager cargó la fecha límite, la línea del saldo ya la dice. Repetir el día del
    // evento como otro "para el …" inventaría un segundo plazo que nadie acordó.
    if (dueDateLabel(request.balanceDueDate)) return { balance, purpose: null, nextStep };

    // "jueves, 19 de noviembre de 2026" -> "para el 19 de noviembre de 2026": es un plazo, y un plazo
    // lleva el año (ronda 10). El mismo helper que la fecha límite, para no tener dos formas del mismo dato.
    return { balance, purpose: dueDateLabel(request.eventDate), nextStep };
}
