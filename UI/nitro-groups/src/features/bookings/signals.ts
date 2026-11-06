import { eventTypeLabel } from "@/lib/eventTypeLabel";
import { formatPrice } from "@/lib/format";
import type { EventRequestParty } from "./types";

/** The other gig of that day as the API sends it; no client data travels with it. */
export interface ClashingGig {
    id?: number;
    eventType?: string | null;
    locationText?: string | null;
    /** "HH:mm:ss" del otro toque; null si no la cargó. */
    startTime?: string | null;
    /** Duración del otro toque en horas; null si no la cargó. */
    durationHours?: number | null;
}

/** Las horas del pedido que el manager está mirando, para saber si los dos toques se pisan. */
export interface OwnGigWindow {
    startTime?: string | null;
    durationHours?: number | null;
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
/** "20:00–23:00" a partir de la hora y la duración; null cuando falta alguna de las dos. */
function windowLabel(startTime: unknown, durationHours: unknown): string | null {
    const raw = typeof startTime === "string" ? startTime.trim() : "";
    const match = /^(\d{1,2}):(\d{2})/.exec(raw);
    const hours = typeof durationHours === "number" && Number.isFinite(durationHours) ? durationHours : null;
    if (!match || hours === null || hours <= 0) return null;

    const startMinutes = Number(match[1]) * 60 + Number(match[2]);
    const endMinutes = startMinutes + hours * 60;
    const clock = (minutes: number) =>
        `${String(Math.floor((minutes % 1440) / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    return `${match[1].padStart(2, "0")}:${match[2]}–${clock(endMinutes)}`;
}

/** Minutos de cruce entre dos ventanas del mismo día; 0 si no se tocan. */
function overlapMinutes(aStart: string, aHours: number, bStart: string, bHours: number): number {
    const parse = (value: string) => {
        const match = /^(\d{1,2}):(\d{2})/.exec(value);
        return match ? Number(match[1]) * 60 + Number(match[2]) : null;
    };
    const a = parse(aStart);
    const b = parse(bStart);
    if (a === null || b === null) return 0;
    const start = Math.max(a, b);
    const end = Math.min(a + aHours * 60, b + bHours * 60);
    return Math.max(0, end - start);
}

/** ", tu pedido es 21:00–00:00, el otro toque acaba 23:00": la salida, solo con las dos ventanas conocidas. */
function wayOutLabel(other: ClashingGig, own?: OwnGigWindow): string {
    const ownWindow = windowLabel(own?.startTime, own?.durationHours);
    const otherWindow = windowLabel(other.startTime, other.durationHours);
    if (!ownWindow || !otherWindow) return "";
    return ` · tu pedido es ${ownWindow}, el otro toque acaba ${otherWindow.split("–")[1]}`;
}

/** " · se pisan 2 h" o " · no se pisan, pero hay traslado": lo que el manager calcularía a mano. */
function overlapLabel(other: ClashingGig, own?: OwnGigWindow): string | null {
    if (!own?.startTime || !own.durationHours) return null;
    if (!other.startTime || !other.durationHours) return null;
    const shared = overlapMinutes(own.startTime, own.durationHours, other.startTime, other.durationHours);
    if (shared === 0) return ` · no se pisan, pero hay traslado${wayOutLabel(other, own)}`;
    const hours = shared / 60;
    const text = Number.isInteger(hours) ? `${hours} h` : `${hours.toFixed(1).replace(".", ",")} h`;
    return ` · se pisan ${text}${wayOutLabel(other, own)}`;
}

export function clashLabel(dateClash: unknown, own?: OwnGigWindow): string {
    const signal = readDateClash(dateClash);
    if (!signal) return UNKNOWN_CLASH;
    if (!signal.clashes) return "Ese día no tienes otro toque.";

    const other = signal.withGig ?? {};
    const type = eventTypeLabel(other.eventType);
    const place = (other.locationText ?? "").trim();
    const hours = windowLabel(other.startTime, other.durationHours);
    // Con horas y lugar el manager decide sin abrir la agenda; sin ellos, se dice lo que hay.
    const what = [type, hours].filter(Boolean).join(" ");
    const tail = overlapLabel(other, own) ?? "";

    if (what && place) return `Ese día ya tienes un toque: ${what} en ${place}${tail}`;
    if (what) return `Ese día ya tienes un toque: ${what}.${tail}`;
    if (type && place) return `Ese día ya tienes un toque: ${type} en ${place}${tail}`;
    if (type) return `Ese día ya tienes un toque: ${type}.${tail}`;
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

    // El monto ofrecido ya está en la ficha del pedido: acá se repite solo la tarifa base, que es
    // contra lo que se compara (ronda 5, Mónica).
    if (offered === null) return "El cliente no indicó presupuesto.";
    return baseRate === null ? "tu tarifa base no está cargada" : `Tu tarifa base es ${price(baseRate, true)}`;
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
export function toSignalsView(
    signals: unknown,
    viewer: EventRequestParty,
    currency = "MXN",
    own?: OwnGigWindow
): SignalsView | null {
    if (viewer !== "Group" || !isRecord(signals)) return null;

    return {
        clash: clashLabel(signals.dateClash, own),
        budget: budgetLabel(signals.budget, currency),
        comparison: compareLabel(signals.budget),
    };
}
