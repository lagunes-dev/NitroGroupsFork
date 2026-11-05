import { formatPrice } from "@/lib/format";
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
    /** Pay by user id, as typed. */
    pay: Record<string, string>;
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

function userKey(userId: unknown): string | null {
    const id = typeof userId === "string" && userId.trim() ? Number(userId) : userId;
    return typeof id === "number" && Number.isInteger(id) ? String(id) : null;
}

/** The form as the row last saved it. */
export function initialLogisticsForm(row: Pick<GroupGigPayload, "callTime" | "setlist" | "deposit" | "attendees">): LogisticsForm {
    const pay: Record<string, string> = {};
    for (const attendee of row.attendees ?? []) {
        const key = userKey(attendee.userId);
        if (key) pay[key] = amountText(attendee.pay);
    }
    return {
        callTime: gigTimeLabel(row.callTime) ?? "",
        setlist: typeof row.setlist === "string" ? row.setlist : "",
        depositAmount: amountText(row.deposit?.amount),
        depositReceived: Boolean(row.deposit?.receivedAt),
        pay,
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
}

/** Body of `PUT groups/{groupId}/gigs/{id}/details`. Empty call time and deposit are left out: the API updates only what is sent. */
export function buildDetailsBody(form: LogisticsForm): DetailsBody {
    const deposit = parseAmount(form.depositAmount);
    return {
        ...(form.callTime ? { callTime: form.callTime } : {}),
        setlist: form.setlist,
        ...(deposit.kind === "ok" ? { depositAmount: deposit.value } : {}),
        depositReceived: form.depositReceived,
    };
}

export interface PayBody {
    payments: { userId: number; amount: number }[];
}

/** Body of `PUT groups/{groupId}/gigs/{id}/pay`: only rows with a valid value; the call replaces the whole set. */
export function buildPayBody(pay: Record<string, string>): PayBody {
    const payments: PayBody["payments"] = [];
    for (const [userId, text] of Object.entries(pay)) {
        const amount = parseAmount(text);
        if (amount.kind === "ok") payments.push({ userId: Number(userId), amount: amount.value });
    }
    return { payments };
}

/** "Mateo Músico $2,000" per attendee with a pay, for the manager's row only. */
export function attendeePayLines(attendees: GroupGigPayload["attendees"]): string[] {
    const lines: string[] = [];
    for (const attendee of attendees ?? []) {
        const text = amountText(attendee.pay);
        const name = (attendee.fullName ?? "").trim();
        if (text && name) lines.push(`${name} ${formatPrice(Number(text))}`);
    }
    return lines;
}

/** "120 / 4,000". */
export function setlistCounter(setlist: string): string {
    return `${setlist.length.toLocaleString("es-MX")} / ${SETLIST_MAX.toLocaleString("es-MX")}`;
}
