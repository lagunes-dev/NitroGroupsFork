import type { EventRequest, EventRequestParty, EventRequestStatus } from "./types";
import { formatEventDate, formatPrice, todayInMexico } from "@/lib/format";

/** The deposit as the API sends it: a recorded fact, the app never charges it. */
export interface DepositPayload {
    amount?: number | string | null;
    /** ISO timestamp; null while the deposit has not been received. */
    receivedAt?: string | null;
}

/** "4 de noviembre de 2026" in Mexico time; null when the timestamp cannot be read. */
function receivedDate(value: string): string | null {
    const moment = new Date(value);
    if (Number.isNaN(moment.getTime())) return null;
    // `formatEventDate` writes the weekday first ("miércoles, 4 de ..."); the deposit line does not need it.
    return formatEventDate(todayInMexico(moment))?.replace(/^[^,]+,\s*/, "") ?? null;
}

/** The deposit split into the two facts the deal needs: how much, and whether it already landed. */
function readDeposit(deposit: unknown): { amount: number; received: boolean } | null {
    if (!deposit || typeof deposit !== "object") return null;
    const { amount, receivedAt } = deposit as DepositPayload;
    const value = typeof amount === "string" && amount.trim() ? Number(amount) : amount;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
    return { amount: value, received: typeof receivedAt === "string" && receivedAt.trim().length > 0 };
}

/**
 * "Anticipo $3,000 · recibido el 4 de noviembre de 2026" or "Anticipo $3,000 · pendiente".
 * Null when there is no usable amount, so callers render nothing for a gig without a deposit.
 */
export function depositLabel(deposit: unknown): string | null {
    const read = readDeposit(deposit);
    if (!read) return null;

    const head = `Anticipo ${formatPrice(read.amount)}`;
    if (!read.received) return `${head} · pendiente`;
    const date = receivedDate((deposit as DepositPayload).receivedAt as string);
    return date ? `${head} · recibido el ${date}` : `${head} · recibido`;
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
 * "$18,000", or "Sin presupuesto" when the client left it empty: un cero no es un precio, y la lista
 * y el detalle tienen que decir lo mismo del mismo dato.
 */
export function budgetLabel(request: { budget?: number | null; currency?: string }): string {
    const amount = request.budget;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return "Sin presupuesto";
    return formatPrice(amount, request.currency ?? "MXN") ?? "Sin presupuesto";
}

/** The slice of a request the deal copy needs; the currency falls back to pesos. */
type DealRequest = { status: EventRequestStatus; budget?: number | null; deposit?: unknown; currency?: string };

/** What is still owed, in pesos. Null when the numbers cannot be stated honestly. */
function remainingAmount(request: { budget?: number | null; deposit?: unknown }): number | null {
    const deposit = readDeposit(request.deposit);
    if (!deposit || !deposit.received) return null;
    const budget = request.budget;
    if (typeof budget !== "number" || !Number.isFinite(budget) || budget <= 0) return null;
    return budget - deposit.amount;
}

/**
 * "Falta pagar $14,000" for the client of an accepted event whose deposit already landed. Null while
 * the deposit is pending, for the group's view and when there is no budget to compare against: the app
 * records the deposit, it never charges anything.
 */
export function balanceLabel(
    request: DealRequest,
    viewer: EventRequestParty
): string | null {
    if (viewer !== "Client" || request.status !== "Accepted") return null;
    const remaining = remainingAmount(request);
    if (remaining === null) return null;
    if (remaining <= 0) return "Sin saldo pendiente";
    const money = formatPrice(remaining, request.currency ?? "MXN");
    return money ? `Falta pagar ${money}` : null;
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
    viewer: EventRequestParty
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
            const remaining = remainingAmount(request);
            if (remaining === null) return "Acuerda el anticipo con el grupo para cerrar la fecha.";
            return remaining <= 0 ? "No queda nada por pagar." : "Acuerda el saldo con el grupo para el día del evento.";
        }
        default:
            return null;
    }
}

/** What the client's accepted thread opens with: the balance, what it is for and the next step. */
export interface BalanceBlock {
    balance: string;
    /** "para el 19 de noviembre"; null when the date cannot be read. */
    purpose: string | null;
    nextStep: string;
}

/**
 * The block is only drawn when there is a balance still owed to state: a pending deposit, a missing
 * budget, a settled deal or the group's view leave the thread as it was.
 */
export function balanceBlock(
    request: DealRequest & { eventDate?: string | null },
    viewer: EventRequestParty
): BalanceBlock | null {
    const remaining = remainingAmount(request);
    const balance = balanceLabel(request, viewer);
    const nextStep = nextStepLabel(request, viewer);
    if (!balance || !nextStep || remaining === null || remaining <= 0) return null;

    const day = request.eventDate ? formatEventDate(request.eventDate) : null;
    // "jueves, 19 de noviembre de 2026" -> "19 de noviembre": the thread header already says the rest.
    const short = day?.replace(/^[^,]+,\s*/, "").replace(/ de \d{4}$/, "");
    return { balance, purpose: short ? `para el ${short}` : null, nextStep };
}
