/**
 * The preset notice the musician sends the group when a gig is missing its call time, its pay or
 * its setlist (odd/tasks/ola-3-descubrimiento-y-logistica.md, S12). It is a request for
 * information, not a complaint: every sentence says "falta", never "no hiciste".
 *
 * The three kinds are the whole vocabulary. There is no free text anywhere in this path, so the
 * copy lives here and only here.
 */
export type GigNoticeKind = "CallTime" | "Pay" | "Setlist";

/** The three kinds, in the order the card shows the missing slots. */
export const NOTICE_KINDS: readonly GigNoticeKind[] = ["CallTime", "Pay", "Setlist"];

/** The article each kind takes, so every sentence reads naturally in Spanish. */
const MISSING: Record<GigNoticeKind, string> = {
    CallTime: "la llegada",
    Pay: "el pago",
    Setlist: "el setlist",
};

const FALLBACK_MUSICIAN = "Un músico del grupo";

/** A notice as the API sends it. Every field optional: a partial row must never break the list. */
export interface NoticePayload {
    id?: number | string | null;
    gigId?: number | string | null;
    userId?: number | string | null;
    fullName?: string | null;
    /** "CallTime", "Pay" or "Setlist"; anything else is ignored instead of printed. */
    kind?: string | null;
    /** `YYYY-MM-DD` in Mexico: the day the notice was sent. */
    sentOn?: string | null;
}

/** Only the three kinds of the contract count; an unknown literal is not a notice we can show. */
export function isNoticeKind(value: unknown): value is GigNoticeKind {
    return value === "CallTime" || value === "Pay" || value === "Setlist";
}

/** Visible label of the one-tap action: the same two quiet words in every slot. */
export const NOTICE_ACTION_LABEL = "Avisar que falta";

/** Accessible name of that action, unique per slot: "Avisar que falta el pago". */
export function noticeActionName(kind: GigNoticeKind): string {
    return `${NOTICE_ACTION_LABEL} ${MISSING[kind]}`;
}

/** What the slot says once it was sent today: "Avisaste hoy que falta el pago". */
export function noticeSentLabel(kind: GigNoticeKind): string {
    return `Avisaste hoy que falta ${MISSING[kind]}`;
}

/** The manager's line: "Mateo avisa que falta el pago". */
export function noticeManagerLine(fullName: unknown, kind: GigNoticeKind): string {
    const name = typeof fullName === "string" ? fullName.trim() : "";
    return `${name || FALLBACK_MUSICIAN} avisa que falta ${MISSING[kind]}`;
}

/** One slot of the card that is missing and can be reported. */
export interface NoticeSlot {
    kind: GigNoticeKind;
    /** True when the musician already told the group today: the row says so and offers nothing. */
    sent: boolean;
}

/** What the card already decided about the three slots (null means "the manager has not loaded it"). */
interface NoticeSources {
    callTimeLabel: string | null;
    payLabel: string | null;
    setlist: string | null;
}

/**
 * The slots the card can report: only the ones that are missing, in screen order, with today's
 * notices already marked so the same button is not offered twice.
 */
export function noticeSlots(gig: NoticeSources, sentToday: readonly unknown[] = []): NoticeSlot[] {
    const sent = new Set(sentToday.filter(isNoticeKind));
    const slots: NoticeSlot[] = [];
    if (!gig.callTimeLabel) slots.push({ kind: "CallTime", sent: sent.has("CallTime") });
    if (!gig.payLabel) slots.push({ kind: "Pay", sent: sent.has("Pay") });
    if (!gig.setlist) slots.push({ kind: "Setlist", sent: sent.has("Setlist") });
    return slots;
}

function noticeGigId(notice: NoticePayload): number | null {
    const value = typeof notice.gigId === "string" && notice.gigId.trim() ? Number(notice.gigId) : notice.gigId;
    return typeof value === "number" && Number.isInteger(value) ? value : null;
}

/**
 * The API list grouped by gig, keeping its order (newest first) inside each gig. A notice without a
 * gig is dropped: it belongs to no row of the agenda.
 */
export function noticesByGig(notices: readonly NoticePayload[] | null | undefined): Record<number, NoticePayload[]> {
    const grouped: Record<number, NoticePayload[]> = {};
    for (const notice of notices ?? []) {
        const gigId = noticeGigId(notice);
        if (gigId === null) continue;
        (grouped[gigId] ??= []).push(notice);
    }
    return grouped;
}
