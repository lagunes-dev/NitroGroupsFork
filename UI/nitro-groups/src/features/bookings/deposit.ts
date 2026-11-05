import type { EventRequest, EventRequestParty } from "./types";
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

/**
 * "Anticipo $3,000 · recibido el 4 de noviembre de 2026" or "Anticipo $3,000 · pendiente".
 * Null when there is no usable amount, so callers render nothing for a gig without a deposit.
 */
export function depositLabel(deposit: unknown): string | null {
    if (!deposit || typeof deposit !== "object") return null;
    const { amount, receivedAt } = deposit as DepositPayload;
    const value = typeof amount === "string" && amount.trim() ? Number(amount) : amount;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;

    const head = `Anticipo ${formatPrice(value)}`;
    if (typeof receivedAt !== "string" || !receivedAt.trim()) return `${head} · pendiente`;
    const date = receivedDate(receivedAt);
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
