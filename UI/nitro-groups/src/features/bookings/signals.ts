import { eventTypeLabel } from "@/lib/eventTypeLabel";
import { formatPrice } from "@/lib/format";
import type { EventRequestParty } from "./types";

/** The other gig of that day as the API sends it; no client data travels with it. */
export interface ClashingGig {
    id?: number;
    eventType?: string | null;
    locationText?: string | null;
}

/** D6: the day already has an accepted gig of this group, or it does not. */
export interface DateClashSignal {
    clashes?: boolean;
    withGig?: ClashingGig | null;
}

/** Above / Below / Equal, or Unknown when either number is missing. */
export type BudgetSignalStatus = "Above" | "Below" | "Equal" | "Unknown";

/** What the client offers against the group's "from $X"; the app never charges either. */
export interface BudgetSignal {
    offered?: number | string | null;
    baseRate?: number | string | null;
    /** Moneda del grupo, para no contar su tarifa con la moneda del cliente. */
    currency?: string | null;
    status?: string | null;
}

/** Both signals of one request thread (`GET api/groups/{groupId}/event-requests/{id}/signals`). */
export interface EventRequestSignals {
    dateClash?: DateClashSignal | null;
    budget?: BudgetSignal | null;
}

/** The three lines the block shows, already written in Spanish. */
export interface SignalsView {
    clash: string;
    budget: string;
    comparison: string;
}

const UNKNOWN_CLASH = "No podemos saber si ese día ya tienes otro toque.";
const UNKNOWN_BUDGET = "No podemos leer el presupuesto ni tu tarifa base.";
const UNKNOWN_COMPARISON = "No podemos compararlos: falta el monto ofrecido o tu tarifa base.";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

/** A usable amount: numbers and numeric strings, never NaN, never negative. */
function readAmount(value: unknown): number | null {
    const amount = typeof value === "string" && value.trim() ? Number(value) : value;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) return null;
    return amount;
}

function readDateClash(value: unknown): { clashes: boolean; withGig: ClashingGig | null } | null {
    if (!isRecord(value) || typeof value.clashes !== "boolean") return null;
    const withGig = isRecord(value.withGig) ? (value.withGig as ClashingGig) : null;
    return { clashes: value.clashes, withGig };
}

function readBudget(value: unknown): BudgetSignal | null {
    return isRecord(value) ? (value as BudgetSignal) : null;
}

/**
 * "Ese día ya tienes un toque: Boda en Hacienda San Gabriel", or "Ese día no tienes otro toque."
 * A gig the payload names without a place or a type is described with what there is: the block
 * never invents a venue, and says so when the signal cannot be read at all.
 */
export function clashLabel(dateClash: unknown): string {
    const signal = readDateClash(dateClash);
    if (!signal) return UNKNOWN_CLASH;
    if (!signal.clashes) return "Ese día no tienes otro toque.";

    const type = eventTypeLabel(signal.withGig?.eventType);
    const place = (signal.withGig?.locationText ?? "").trim();
    if (type && place) return `Ese día ya tienes un toque: ${type} en ${place}`;
    if (type) return `Ese día ya tienes un toque: ${type}.`;
    return "Ese día ya tienes otro toque.";
}

/** "Ofrece $18,000 · tu tarifa base es $12,000", naming whichever number is missing. */
export function budgetLabel(budget: unknown, currency = "MXN"): string {
    const signal = readBudget(budget);
    if (!signal) return UNKNOWN_BUDGET;

    const offered = readAmount(signal.offered);
    const baseRate = readAmount(signal.baseRate);
    // La tarifa base es del grupo: se cuenta en su moneda, no en la del cliente (S15).
    const baseCurrency = typeof signal.currency === "string" && signal.currency.trim() ? signal.currency.trim() : currency;
    const price = (amount: number, forBaseRate = false) =>
        formatPrice(amount, forBaseRate ? baseCurrency : currency) ?? `$${amount}`;

    const offeredText = offered === null ? "El cliente no indicó presupuesto" : `Ofrece ${price(offered)}`;
    const baseText = baseRate === null ? "tu tarifa base no está cargada" : `tu tarifa base es ${price(baseRate, true)}`;
    return `${offeredText} · ${baseText}`;
}

/**
 * The comparison in words. It only names a direction the two numbers actually support: a status
 * the amounts contradict, or a missing amount, reads as "no podemos compararlos".
 */
export function compareLabel(budget: unknown): string {
    const signal = readBudget(budget);
    if (!signal) return UNKNOWN_COMPARISON;

    const offered = readAmount(signal.offered);
    const baseRate = readAmount(signal.baseRate);
    if (offered === null || baseRate === null) return UNKNOWN_COMPARISON;

    const expected = offered > baseRate ? "Above" : offered < baseRate ? "Below" : "Equal";
    if (signal.status !== expected) return UNKNOWN_COMPARISON;

    switch (expected) {
        case "Above":
            return "Está por encima de tu tarifa base.";
        case "Below":
            return "Está por debajo de tu tarifa base.";
        default:
            return "Coincide con tu tarifa base.";
    }
}

/**
 * The signals block of the thread, only for the group that receives the request: the client sees
 * neither the base rate nor what the group already has booked. Null when there is nothing honest
 * to show.
 */
export function toSignalsView(signals: unknown, viewer: EventRequestParty, currency = "MXN"): SignalsView | null {
    if (viewer !== "Group" || !isRecord(signals)) return null;

    return {
        clash: clashLabel(signals.dateClash),
        budget: budgetLabel(signals.budget, currency),
        comparison: compareLabel(signals.budget),
    };
}
