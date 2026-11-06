import { budgetLabel, receivedDate } from "@/features/bookings/deposit";
import { formatPrice, isIsoDate } from "@/lib/format";
import { gigTimeLabel } from "./viewModel";
import type { GroupGigPayload } from "./types";

export const SETLIST_MAX = 4000;

/** What the manager edits, all as text so an empty box stays distinguishable from a zero. */
export interface LogisticsForm {
    /** `HH:mm`, or "" when there is no call time. */
    callTime: string;
    setlist: string;
    depositAmount: string;
    depositReceived: boolean;
    /** T48: the balance arrived; recorded as a fact, exactly like the deposit. */
    balanceReceived: boolean;
    /** T61: the deposit deadline as `YYYY-MM-DD`, or "" when the manager loaded none. */
    depositDueDate: string;
    /** T61: the balance deadline as `YYYY-MM-DD`, or "" when the manager loaded none. */
    balanceDueDate: string;
    /** Pay by user id, as typed. */
    pay: Record<string, string>;
    /** T48: whether each musician was paid, by user id. */
    paid: Record<string, boolean>;
}

export type ParsedAmount = { kind: "empty" } | { kind: "ok"; value: number } | { kind: "invalid" };

/** Up to 10 integer digits and 2 decimals: what `numeric(12,2)` holds. */
const AMOUNT = /^\d{1,10}(\.\d{1,2})?$/;

/** Reads an amount box: empty is allowed, negatives, text and more than two decimals are not. */
export function parseAmount(text: string): ParsedAmount {
    const trimmed = text.trim();
    if (!trimmed) return { kind: "empty" };
    return AMOUNT.test(trimmed) ? { kind: "ok", value: Number(trimmed) } : { kind: "invalid" };
}

function amountText(value: unknown): string {
    const number = typeof value === "string" && value.trim() ? Number(value) : value;
    return typeof number === "number" && Number.isFinite(number) && number >= 0 ? String(number) : "";
}

/** A recorded date is any non-empty timestamp: the API sends null until the manager records it. */
function isRecorded(value: unknown): boolean {
    return typeof value === "string" && value.trim().length > 0;
}

/**
 * A deadline the API sends as `YYYY-MM-DD`; "" when there is none or it is not a real calendar day.
 * A due date is a day, never an instant, so it is read the way this repo reads the event date.
 */
function dueDateText(value: unknown): string {
    if (typeof value !== "string") return "";
    const day = value.slice(0, 10);
    return isIsoDate(day) ? day : "";
}

/**
 * The state of a "recorded as a fact" checkbox, in words (T48): what the saved row says and what the
 * manager is about to change. `savedAt` is the timestamp the API sent; `noun` is "Saldo" or "Pago".
 */
export function recordedStateLabel(
    checked: boolean,
    savedAt: string | null | undefined,
    words: { done: string; pending: string }
): string {
    const saved = isRecorded(savedAt);
    if (checked && saved) {
        const date = receivedDate(savedAt as string);
        return date ? `${words.done} el ${date}` : words.done;
    }
    if (checked) return "Se registrará al guardar";
    return saved ? "Se quitará al guardar" : words.pending;
}

function userKey(userId: unknown): string | null {
    const id = typeof userId === "string" && userId.trim() ? Number(userId) : userId;
    return typeof id === "number" && Number.isInteger(id) ? String(id) : null;
}

/** The form as the row last saved it. */
export function initialLogisticsForm(
    row: Pick<GroupGigPayload, "callTime" | "setlist" | "deposit" | "attendees" | "balanceReceivedAt" | "balanceDueDate">
): LogisticsForm {
    const pay: Record<string, string> = {};
    const paid: Record<string, boolean> = {};
    for (const attendee of row.attendees ?? []) {
        const key = userKey(attendee.userId);
        if (key) {
            pay[key] = amountText(attendee.pay);
            paid[key] = isRecorded(attendee.paidAt);
        }
    }
    return {
        callTime: gigTimeLabel(row.callTime) ?? "",
        setlist: typeof row.setlist === "string" ? row.setlist : "",
        depositAmount: amountText(row.deposit?.amount),
        depositReceived: Boolean(row.deposit?.receivedAt),
        balanceReceived: isRecorded(row.balanceReceivedAt),
        depositDueDate: dueDateText(row.deposit?.dueDate),
        balanceDueDate: dueDateText(row.balanceDueDate),
        pay,
        paid,
    };
}

export interface LogisticsErrors {
    setlist?: string;
    depositAmount?: string;
    /** Error by user id. */
    pay: Record<string, string>;
}

export interface LogisticsValidation {
    valid: boolean;
    errors: LogisticsErrors;
    /** Field key in screen order: "setlist", "depositAmount" or "pay-<userId>". Null when valid. */
    firstInvalid: string | null;
}

const AMOUNT_ERROR = "Escribe un monto de 0 o más, con hasta 2 decimales.";

export function validateLogistics(form: LogisticsForm): LogisticsValidation {
    const errors: LogisticsErrors = { pay: {} };
    if (form.setlist.length > SETLIST_MAX) errors.setlist = `El setlist admite hasta ${SETLIST_MAX.toLocaleString("es-MX")} caracteres.`;
    if (parseAmount(form.depositAmount).kind === "invalid") errors.depositAmount = AMOUNT_ERROR;
    for (const [userId, text] of Object.entries(form.pay)) {
        if (parseAmount(text).kind === "invalid") errors.pay[userId] = AMOUNT_ERROR;
    }
    const firstPay = Object.keys(errors.pay)[0];
    const firstInvalid = errors.setlist ? "setlist" : errors.depositAmount ? "depositAmount" : firstPay ? `pay-${firstPay}` : null;
    return { valid: firstInvalid === null, errors, firstInvalid };
}

export interface DetailsBody {
    callTime?: string;
    setlist: string;
    depositAmount?: number;
    depositReceived: boolean;
    balanceReceived: boolean;
    /** T61: `YYYY-MM-DD`, or null to clear the deadline. Always sent so it can be cleared. */
    depositDueDate: string | null;
    balanceDueDate: string | null;
}

/**
 * Body of `PUT groups/{groupId}/gigs/{id}/details`. Empty call time and deposit are left out: the API
 * updates only what is sent. The two deadlines travel even when empty, because a null is the only way to
 * clear one; `null` is not an error, and a day that already passed is saved as it is (S24).
 */
export function buildDetailsBody(form: LogisticsForm): DetailsBody {
    const deposit = parseAmount(form.depositAmount);
    return {
        ...(form.callTime ? { callTime: form.callTime } : {}),
        setlist: form.setlist,
        ...(deposit.kind === "ok" ? { depositAmount: deposit.value } : {}),
        depositReceived: form.depositReceived,
        balanceReceived: form.balanceReceived,
        depositDueDate: form.depositDueDate || null,
        balanceDueDate: form.balanceDueDate || null,
    };
}

export interface PayBody {
    payments: { userId: number; amount: number; paid?: boolean }[];
}

/**
 * Body of `PUT groups/{groupId}/gigs/{id}/pay`: only rows with a valid value; the call replaces the
 * whole set. A row carries `paid` when the form knows it (T48): true keeps or records the date,
 * false clears it, and a row without it leaves what the API already has.
 */
export function buildPayBody(pay: Record<string, string>, paid: Record<string, boolean> = {}): PayBody {
    const payments: PayBody["payments"] = [];
    for (const [userId, text] of Object.entries(pay)) {
        const amount = parseAmount(text);
        if (amount.kind !== "ok") continue;
        payments.push({ userId: Number(userId), amount: amount.value, ...(userId in paid ? { paid: paid[userId] } : {}) });
    }
    return { payments };
}

/** "Mateo Músico $2,000" per attendee with a pay, for the manager's row only. */
export function attendeePayLines(attendees: GroupGigPayload["attendees"]): string[] {
    const lines: string[] = [];
    for (const attendee of attendees ?? []) {
        const text = amountText(attendee.pay);
        const name = (attendee.fullName ?? "").trim();
        if (text && name) lines.push(`${name} ${formatPrice(Number(text))}${isRecorded(attendee.paidAt) ? " pagado" : ""}`);
    }
    return lines;
}

/** "120 / 4,000". */
export function setlistCounter(setlist: string): string {
    return `${setlist.length.toLocaleString("es-MX")} / ${SETLIST_MAX.toLocaleString("es-MX")}`;
}

/** A money field as a number, or null when it is empty or cannot be read as a non-negative amount. */
function readAmount(value: unknown): number | null {
    const text = amountText(value);
    return text ? Number(text) : null;
}

/**
 * The three figures of the gig (S23), as the payload already holds them: the cachet the client
 * offered, everything the manager owes the musicians, and the difference between the two. Text only:
 * the app never charges, moves or validates money (D1 and D2), and a negative difference is a fact.
 */
export interface GigSettlement {
    /** "$15,000", or "Sin presupuesto" when the client left it empty. */
    cachet: string;
    /** "$3,500": every attendee with a pay amount, whatever they answered. "$0" when there is none. */
    owed: string;
    /** "$11,500", "-$1,500", or "No se puede calcular" without a cachet. Never stated as an error. */
    difference: string;
}

const NO_DIFFERENCE = "No se puede calcular";
const NO_AMOUNT = "Sin monto";

/** The cuadre of one gig, read from the row the manager already has. Un cero no es un cachet. */
export function gigSettlement(row: Pick<GroupGigPayload, "budget" | "currency" | "attendees">): GigSettlement {
    const currency = typeof row.currency === "string" && row.currency.trim() ? row.currency : "MXN";
    const budget = readAmount(row.budget);
    const cachet = budget !== null && budget > 0 ? budget : null;

    let owed = 0;
    for (const attendee of row.attendees ?? []) owed += readAmount(attendee.pay) ?? 0;

    const difference = cachet === null ? NO_DIFFERENCE : (formatPrice(cachet - owed, currency) ?? NO_DIFFERENCE);
    return {
        cachet: budgetLabel({ budget: cachet, currency }),
        owed: formatPrice(owed, currency) ?? NO_AMOUNT,
        difference,
    };
}
