import { balanceBlock, budgetLabel, dueDateLabel, pendingBalanceLine, receivedDate } from "@/features/bookings/deposit";
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

/**
 * "Mateo Músico $1,500 pagado · Miguel Miembro $1,500 pendiente de pago", per attendee with a pay, for
 * the manager's row only. Every row says whether it was paid: a figure with no state reads as paid.
 */
export function attendeePayLines(attendees: GroupGigPayload["attendees"]): string[] {
    const lines: string[] = [];
    for (const attendee of attendees ?? []) {
        const text = amountText(attendee.pay);
        const name = (attendee.fullName ?? "").trim();
        if (text && name) {
            const state = isRecorded(attendee.paidAt) ? "pagado" : "pendiente de pago";
            lines.push(`${name} ${formatPrice(Number(text))} ${state}`);
        }
    }
    return lines;
}

/** The live counter of the setlist and, once the text is over the maximum, the sentence that says by how much. */
export interface SetlistRead {
    /** "1234 de 4000 caracteres". */
    counter: string;
    /** Null while the text fits. */
    note: string | null;
}

/**
 * The setlist is never cut (a manager may paste a long one and trim it): the field speaks instead, while
 * she types, and saving still refuses the same text in `validateLogistics`.
 */
export function setlistRead(setlist: string): SetlistRead {
    const over = setlist.length - SETLIST_MAX;
    return {
        counter: `${setlist.length} de ${SETLIST_MAX} caracteres`,
        note: over > 0
            ? `Te pasaste por ${over} ${over === 1 ? "carácter" : "caracteres"}: el setlist admite hasta ${SETLIST_MAX} y no se guarda con más.`
            : null,
    };
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
    /**
     * "Pagado $1,500 · pendiente $2,000" once part of the total is recorded as paid, so nobody has to
     * subtract it in their head. Null when nothing is paid yet or when a zero pay leaves no split.
     */
    paidSplit: string | null;
    /** "$11,500", "-$1,500", or "No se puede calcular" without a cachet. Never stated as an error. */
    difference: string;
    /** Says whether the figures are the saved ones or follow what is being typed. */
    note: string;
}

const NO_DIFFERENCE = "No se puede calcular";
const NO_AMOUNT = "Sin monto";

const SETTLEMENT_DISCLAIMER = "La app no cobra ni valida estos montos.";
const NOTE_SAVED = `Estas cifras son las que están guardadas. ${SETTLEMENT_DISCLAIMER}`;
const NOTE_TYPED = `Estas cifras siguen lo que escribes y todavía no están guardadas. ${SETTLEMENT_DISCLAIMER}`;

/** What the pay boxes would save: the same parsing as `buildPayBody`, so the block and the save agree. */
function typedPayments(pay: Record<string, string>): Map<string, number> {
    return new Map(buildPayBody(pay).payments.map((payment) => [String(payment.userId), payment.amount]));
}

/** One pay row of the settlement: what it is worth and whether it already went out. */
interface PayEntry {
    amount: number;
    paid: boolean;
}

/**
 * The pay rows as the API last saved them. Same reading as `initialLogisticsForm`, so the split and the
 * "Pagado" boxes can never disagree about who was paid.
 */
function savedPayEntries(row: Pick<GroupGigPayload, "attendees">): Map<string, PayEntry> {
    const savedPaid = initialLogisticsForm({ attendees: row.attendees }).paid;
    const entries = new Map<string, PayEntry>();
    for (const attendee of row.attendees ?? []) {
        const key = userKey(attendee.userId);
        const amount = readAmount(attendee.pay);
        if (key && amount !== null) entries.set(key, { amount, paid: savedPaid[key] === true });
    }
    return entries;
}

/** The pay rows as the editor would save them: the typed amount and its "Pagado" box. */
function typedPayEntries(
    row: Pick<GroupGigPayload, "attendees">,
    typedPay: Record<string, string>,
    typedPaid: Record<string, boolean> | undefined
): Map<string, PayEntry> {
    const saved = savedPayEntries(row);
    const entries = new Map<string, PayEntry>();
    for (const [userId, amount] of typedPayments(typedPay)) {
        const checked = typedPaid ? typedPaid[userId] : saved.get(userId)?.paid;
        entries.set(userId, { amount, paid: checked === true });
    }
    return entries;
}

function samePayState(a: Map<string, PayEntry>, b: Map<string, PayEntry>): boolean {
    return a.size === b.size && [...a].every(([userId, entry]) => b.get(userId)?.amount === entry.amount && b.get(userId)?.paid === entry.paid);
}

/**
 * The split of the total once something is recorded as paid: "Pagado $1,500 · pendiente $2,000".
 * Null when nothing went out — nobody needs "Pagado $0" — and the app judges nothing (D1, D2).
 */
function paidSplitLabel(entries: Map<string, PayEntry>, currency: string): string | null {
    let owed = 0;
    let paid = 0;
    for (const entry of entries.values()) {
        owed += entry.amount;
        if (entry.paid) paid += entry.amount;
    }
    if (paid <= 0) return null;
    const paidMoney = formatPrice(paid, currency) ?? NO_AMOUNT;
    const pendingMoney = formatPrice(owed - paid, currency) ?? NO_AMOUNT;
    return `Pagado ${paidMoney} · pendiente ${pendingMoney}`;
}

/**
 * The cuadre of one gig. Without `typedPay` it reads the saved row; with it (the editor's pay boxes,
 * as typed) the owed sum and the difference follow the boxes while the cachet stays the saved budget.
 * `typedPaid` is those same boxes' "Pagado" state, so the split follows them too. An empty or
 * unreadable box is no pay. Un cero no es un cachet.
 */
export function gigSettlement(
    row: Pick<GroupGigPayload, "budget" | "currency" | "attendees">,
    typedPay?: Record<string, string>,
    typedPaid?: Record<string, boolean>
): GigSettlement {
    const currency = typeof row.currency === "string" && row.currency.trim() ? row.currency : "MXN";
    const budget = readAmount(row.budget);
    const cachet = budget !== null && budget > 0 ? budget : null;

    const saved = savedPayEntries(row);
    const entries = typedPay ? typedPayEntries(row, typedPay, typedPaid) : saved;
    let owed = 0;
    for (const entry of entries.values()) owed += entry.amount;

    // The split is one of these figures: it is not saved either while the boxes differ from the row.
    const note = typedPay && !samePayState(entries, saved) ? NOTE_TYPED : NOTE_SAVED;

    const difference = cachet === null ? NO_DIFFERENCE : (formatPrice(cachet - owed, currency) ?? NO_DIFFERENCE);
    return {
        cachet: budgetLabel({ budget: cachet, currency }),
        owed: formatPrice(owed, currency) ?? NO_AMOUNT,
        paidSplit: paidSplitLabel(entries, currency),
        difference,
        note,
    };
}

/** The columns of a manager row the balance line reads. */
type BalanceRow = Pick<
    GroupGigPayload,
    "budget" | "currency" | "deposit" | "balanceReceivedAt" | "balanceDueDate" | "eventDate"
>;

/**
 * The cachet the manager agreed, stated in the row (ronda 11): "Cachet total $14,000", or the same
 * "Sin presupuesto" the rest of the app says when the client left it empty. A zero is not a cachet, so
 * it never prints a figure that would let the manager judge an anticipo against money nobody agreed.
 */
export function agendaCachetLabel(row: Pick<GroupGigPayload, "budget" | "currency">): string {
    const currency = typeof row.currency === "string" && row.currency.trim() ? row.currency : "MXN";
    const budget = readAmount(row.budget);
    const money = budget !== null && budget > 0 ? formatPrice(budget, currency) : null;
    return money ? `Cachet total ${money}` : budgetLabel({ budget, currency });
}

/**
 * The balance the manager agreed: the cachet minus the anticipo he set, whatever landed yet. Null when
 * either figure is missing or when the anticipo already covers the cachet, because the app never
 * computes money that does not exist.
 */
function agreedBalance(row: BalanceRow): number | null {
    const budget = readAmount(row.budget);
    const deposit = readAmount(row.deposit?.amount);
    if (budget === null || budget <= 0 || deposit === null) return null;
    return budget - deposit;
}

/**
 * Whether the deal is already settled: the deposit landed and covers the cachet, so there is no balance
 * left to announce. False whenever the figures cannot be compared, which is exactly when the deadline
 * still has something to say.
 */
function nothingOwed(row: BalanceRow): boolean {
    const deposit = readAmount(row.deposit?.amount);
    const landed = typeof row.deposit?.receivedAt === "string" && row.deposit.receivedAt.trim().length > 0;
    const budget = readAmount(row.budget);
    if (!landed || deposit === null || budget === null || budget <= 0) return false;
    return budget - deposit <= 0;
}

/**
 * The balance line of the manager's row (S18, S23, S24): what the client still owes — "Saldo: falta
 * pagar $6,200 · para el 15 de noviembre de 2026", or "Saldo: falta pagar $6,200" when the group loaded
 * no deadline — and, once the group recorded the arrival, "Saldo recibido el …". Null when there is
 * nothing to state, so a gig with nothing owed draws no line.
 *
 * The money, the dates and the wording come from the deal helpers and from nothing else: this only
 * decides when they apply. The manager reads the client's own line on purpose — it is the same debt,
 * said one way — and the app still charges, validates and judges nothing (D1, D2).
 *
 * Ronda 10: the deadline is a fact the manager loaded, so it is said even while the amount is not —
 * the balance is counted against a deposit that already landed, and until then only the deadline is
 * known. Same voice as the deposit's line: noun, state, deadline. Nothing is computed from money that
 * has not arrived.
 *
 * Ronda 11: the amount is what the manager AGREED (cachet minus the anticipo they set), not money that
 * arrived, so the figure is said while the deposit is still pending — the deposit's own state already
 * says nothing is paid. A cachet or an anticipo that does not exist draws no figure: only the deadline,
 * or nothing.
 *
 * Round 12: a pending balance is said in one voice, before and after the deposit lands, and as the
 * client reads it: "Saldo: falta pagar $10,000 · para el 15 de noviembre de 2026". Without a figure to
 * state, the old fallback keeps its words behind the same leading "Saldo:".
 */
export function agendaBalanceLabel(row: BalanceRow): string | null {
    const currency = typeof row.currency === "string" && row.currency.trim() ? row.currency : "MXN";
    const block = balanceBlock(
        {
            // La agenda del manager solo lista toques que el grupo ya aceptó.
            status: "Accepted",
            budget: readAmount(row.budget),
            deposit: row.deposit,
            currency,
            balanceReceivedAt: row.balanceReceivedAt,
            balanceDueDate: row.balanceDueDate,
            eventDate: row.eventDate,
        },
        "Client"
    );
    if (block?.balance) return block.balance;
    // Nada que anunciar: el trato está saldado, o no hay plazo que decir de un saldo que no existe.
    if (nothingOwed(row)) return null;
    const due = dueDateLabel(row.balanceDueDate);
    const agreed = agreedBalance(row);
    if (agreed !== null) {
        // The agreed anticipo already covers the cachet: no balance to state, even with a deadline loaded.
        if (agreed <= 0) return null;
        const money = formatPrice(agreed, currency);
        if (money) return pendingBalanceLine(money, due);
    }
    return due ? `Saldo: pendiente · ${due}` : null;
}
