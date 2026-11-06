/**
 * The preset notice the musician sends the group when a gig is missing its call time, its pay or
 * its setlist (odd/tasks/ola-3-descubrimiento-y-logistica.md, S12). It is a request for
 * information, not a complaint: every sentence says "falta", never "no hiciste".
 *
 * The three kinds are the whole vocabulary. There is no free text anywhere in this path, so the
 * copy lives here and only here.
 */
export type GigNoticeKind = "CallTime" | "Pay" | "Setlist" | "Late" | "CannotFindVenue";

/**
 * The five kinds, in the order the card shows them: the missing slots first, then the two day-of
 * notices "Llego tarde" and "No encuentro el lugar" (S17).
 */
export const NOTICE_KINDS: readonly GigNoticeKind[] = ["CallTime", "Pay", "Setlist", "Late", "CannotFindVenue"];

/** The kinds that report something missing from the gig. The other two are always on offer. */
type MissingKind = "CallTime" | "Pay" | "Setlist";

/** The article each missing slot takes, so every sentence reads naturally in Spanish. */
const MISSING: Record<MissingKind, string> = {
    CallTime: "la llegada",
    Pay: "el pago",
    Setlist: "el setlist",
};

/** True for the notices that say something is missing from the gig; false for "Late" / "CannotFindVenue". */
export function isMissingNotice(kind: GigNoticeKind): kind is MissingKind {
    return kind in MISSING;
}

/** The two day-of notices: the verb phrase for the musician ("llego tarde") and for the manager's line. */
const DAY_OF: Record<"Late" | "CannotFindVenue", { action: string; sent: string; manager: string }> = {
    Late: { action: "llego tarde", sent: "llegas tarde", manager: "llega tarde" },
    CannotFindVenue: { action: "no encuentro el lugar", sent: "no encuentras el lugar", manager: "no encuentra el lugar" },
};

const FALLBACK_MUSICIAN = "Un músico del grupo";

/** A notice as the API sends it. Every field optional: a partial row must never break the list. */
export interface NoticePayload {
    id?: number | string | null;
    gigId?: number | string | null;
    userId?: number | string | null;
    fullName?: string | null;
    /** "CallTime", "Pay", "Setlist", "Late" or "CannotFindVenue"; anything else is ignored instead of printed. */
    kind?: string | null;
    /** `YYYY-MM-DD` in Mexico: the day the notice was sent. */
    sentOn?: string | null;
}

/** Only the five kinds of the contract count; an unknown literal is not a notice we can show. */
export function isNoticeKind(value: unknown): value is GigNoticeKind {
    return typeof value === "string" && (NOTICE_KINDS as readonly string[]).includes(value);
}

/** Visible label of the one-tap action: the same two quiet words in every slot. */
export const NOTICE_ACTION_LABEL = "Avisar que falta";

/**
 * Accessible name of the block that holds the notices of one gig: the actions live in their own
 * stack under the text, and that stack needs a name a screen reader can announce.
 */
export const NOTICE_LIST_LABEL = "Avisarle al grupo lo que falta";

/** The same block when it only holds the day-of notices: nothing is "missing", so it does not say so. */
export const NOTICE_LIST_LABEL_DAY_OF = "Avisarle al grupo";

/** Heading of the block: the honest one for the slots it actually holds. */
export function noticeListLabel(kinds: readonly GigNoticeKind[]): string {
    return kinds.some(isMissingNotice) ? NOTICE_LIST_LABEL : NOTICE_LIST_LABEL_DAY_OF;
}

/** Visible and accessible name of that action, unique per slot: "Avisar que falta el pago". */
export function noticeActionName(kind: GigNoticeKind): string {
    return isMissingNotice(kind) ? `${NOTICE_ACTION_LABEL} ${MISSING[kind]}` : `Avisar que ${DAY_OF[kind].action}`;
}

/** What the slot says once it was sent today: "Avisaste hoy que falta el pago". */
export function noticeSentLabel(kind: GigNoticeKind): string {
    return isMissingNotice(kind) ? `Avisaste hoy que falta ${MISSING[kind]}` : `Avisaste hoy que ${DAY_OF[kind].sent}`;
}

/** The manager's line: "Mateo avisa que falta el pago", "Mateo avisa que llega tarde". */
export function noticeManagerLine(fullName: unknown, kind: GigNoticeKind): string {
    const name = typeof fullName === "string" ? fullName.trim() : "";
    const what = isMissingNotice(kind) ? `falta ${MISSING[kind]}` : DAY_OF[kind].manager;
    return `${name || FALLBACK_MUSICIAN} avisa que ${what}`;
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
 * The slots the card can report: the ones that are missing, in screen order, then the two day-of
 * notices, which are always on offer (the card hides all of them for a declined or past gig). Today's
 * notices come already marked so the same button is not offered twice.
 */
export function noticeSlots(gig: NoticeSources, sentToday: readonly unknown[] = []): NoticeSlot[] {
    const sent = new Set(sentToday.filter(isNoticeKind));
    const slots: NoticeSlot[] = [];
    if (!gig.callTimeLabel) slots.push({ kind: "CallTime", sent: sent.has("CallTime") });
    if (!gig.payLabel) slots.push({ kind: "Pay", sent: sent.has("Pay") });
    if (!gig.setlist) slots.push({ kind: "Setlist", sent: sent.has("Setlist") });
    slots.push({ kind: "Late", sent: sent.has("Late") }, { kind: "CannotFindVenue", sent: sent.has("CannotFindVenue") });
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
