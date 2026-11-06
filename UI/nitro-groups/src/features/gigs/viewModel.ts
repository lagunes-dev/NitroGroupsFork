import { formatEventDate, formatPrice, isIsoDate } from "@/lib/format";
import { ROUTES } from "@/config/routes";
import { receivedDate } from "@/features/bookings/deposit";
import { attendanceAppearance, type AttendanceAppearance } from "./attendance";
import { noticeSlots, unpaidNoticeSlot, type NoticeSlot } from "./notices";
import type { GigAnswer, GigPayload } from "./types";

const DATE_FALLBACK = "Fecha por definir";
/** The same words inside a sentence, where Spanish writes them in lower case. */
const DATE_PENDING = "fecha por definir";
const PLACE_FALLBACK = "Lugar por definir";
const SCHEDULE_FALLBACK = "Horario por definir";
const GROUP_FALLBACK = "Grupo sin nombre";
/** What the card says when the manager has not loaded a slot yet: it names the state, never a fact. */
export const CALL_TIME_PENDING = "Llegada sin definir";
export const SETLIST_PENDING = "Setlist sin cargar";
export const PAY_PENDING = "Tu pago sin definir";

/** A gig whose date is behind us: it asks for nothing and says what it is. */
export const PAST_GIG_LINE = "Este toque ya pasó";
/** Before the first answer: the tap saves it, and it can be changed. The app sends nothing else. */
export const ANSWER_SAVES_LINE = "Tu respuesta se guarda al tocar y puedes cambiarla.";
/** What a declined future gig says next, in one line: nothing else is owed. */
export const DECLINED_NEXT_STEP = "El grupo ya lo sabe · la fecha queda libre";
/** What a confirmed future gig says next: the app records the answer, it sends nothing else. */
export const CONFIRMED_NEXT_STEP = "El grupo ya cuenta contigo · puedes cambiar tu respuesta cuando quieras";

/** The group of a gig, ready to link. `href` is null when there is no slug to link to. */
export interface GigGroupView {
    id: number | null;
    name: string;
    slug: string;
    href: string | null;
}

/** One gig as the card shows it: every label is decided here, so the component only paints. */
export interface GigView {
    id: number;
    group: GigGroupView;
    /** `YYYY-MM-DD`, or "" when the date cannot be read. */
    eventDate: string;
    /** "sábado 15 de noviembre", or "Fecha por definir". */
    dateLabel: string;
    placeLabel: string;
    /** "20:00", or null when the API did not send a start time. */
    timeLabel: string | null;
    /** "3 h", or null when the API did not send a usable duration. */
    durationLabel: string | null;
    /** "Dueño" / "Manager" when the caller manages that group; null for a plain member or an unknown role. */
    roleLabel: string | null;
    attendance: AttendanceAppearance;
    /** "Llegada 17:30", or null when the manager has not set a call time. */
    callTimeLabel: string | null;
    /** The setlist as typed (line breaks kept), or null when empty. */
    setlist: string | null;
    /** "Tu pago: $2,000", or null when no amount was set for the caller. */
    payLabel: string | null;
    /** "pagado el 13 de diciembre de 2026" or "pendiente"; null whenever `payLabel` is null. */
    paidLabel: string | null;
    /**
     * What the musician can report: the slots that are missing, then "Llego tarde" and "No encuentro
     * el lugar", with the ones already reported today marked. The card hides all of them for a
     * declined or past gig.
     */
    notices: NoticeSlot[];
    /**
     * The only notice a past gig may offer (S21): the caller has a pay row the manager has not marked
     * as paid. Null when there is nothing pending, so the past card offers nothing at all.
     */
    unpaidNotice: NoticeSlot | null;
}

const HOURS = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });
const TIME = /^(\d{1,2}):(\d{2})/;

function asNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return null;
}

function asText(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

/** "sábado 15 de noviembre": the weekday is what a musician checks before answering. */
export function gigDateLabel(eventDate: string): string {
    const formatted = formatEventDate(eventDate);
    return formatted ? formatted.replace(",", "") : DATE_FALLBACK;
}

/** "20:00" out of "20:00:00"; null when the value is not a time we can read. */
export function gigTimeLabel(value: unknown): string | null {
    const match = TIME.exec(asText(value));
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

/** "3 h" / "2.5 h"; null when the duration is missing or not a positive number. */
export function gigDurationLabel(value: unknown): string | null {
    const hours = asNumber(value);
    if (hours === null || hours <= 0) return null;
    return `${HOURS.format(hours)} h`;
}

/** Only the roles that change what the panel offers get a label; "Member" is the silent default. */
function gigRoleLabel(value: unknown): string | null {
    const role = asText(value);
    if (role === "Owner") return "Dueño";
    if (role === "Manager") return "Manager";
    return null;
}

/** "Llegada 17:30"; null when the call time is missing or unreadable. */
export function callTimeLabel(value: unknown): string | null {
    const time = gigTimeLabel(value);
    return time ? `Llegada ${time}` : null;
}

/** "Tu pago: $2,000"; null when there is no amount. A zero is an amount, a negative or non-numeric value is not. */
export function myPayLabel(value: unknown): string | null {
    const amount = asNumber(value);
    if (amount === null || amount < 0) return null;
    return `Tu pago: ${formatPrice(amount)}`;
}

/**
 * "pagado el 13 de diciembre de 2026" or "pendiente", next to "Tu pago". Null when there is no pay to
 * talk about: a gig with no pay loaded keeps its "Tu pago sin definir" and nothing else.
 */
export function myPaidLabel(pay: unknown, paidAt: unknown): string | null {
    if (myPayLabel(pay) === null) return null;
    if (typeof paidAt !== "string" || !paidAt.trim()) return "pendiente";
    const date = receivedDate(paidAt);
    return date ? `pagado el ${date}` : "pagado";
}

/**
 * One row of the contract turned into view data. Missing or wrong values fall back, never throw.
 * `sentNotices` are the kinds the caller already reported today (`GET api/me/gig-notices/today`):
 * they stop the card from offering the same notice twice.
 */
export function toGigView(row: GigPayload, sentNotices: readonly unknown[] = []): GigView {
    const slug = asText(row.groupSlug);
    const rawDate = asText(row.eventDate);
    const callTime = callTimeLabel(row.callTime);
    const payLabel = myPayLabel(row.myPay);
    const setlist = asText(row.setlist) || null;
    return {
        id: asNumber(row.id) ?? 0,
        group: {
            id: asNumber(row.groupId),
            name: asText(row.groupName) || GROUP_FALLBACK,
            slug,
            href: slug ? ROUTES.GROUPS.PUBLIC_PROFILE(slug) : null,
        },
        eventDate: isIsoDate(rawDate) ? rawDate : "",
        dateLabel: gigDateLabel(rawDate),
        placeLabel: asText(row.locationText) || PLACE_FALLBACK,
        timeLabel: gigTimeLabel(row.startTime),
        durationLabel: gigDurationLabel(row.durationHours),
        roleLabel: gigRoleLabel(row.role),
        attendance: attendanceAppearance(row.attendance),
        callTimeLabel: callTime,
        setlist,
        payLabel,
        paidLabel: myPaidLabel(row.myPay, row.myPayPaidAt),
        notices: noticeSlots({ callTimeLabel: callTime, payLabel, setlist }, sentNotices),
        unpaidNotice: unpaidNoticeSlot({ loaded: payLabel !== null, paid: asText(row.myPayPaidAt) !== "" }, sentNotices),
    };
}

/** "20:00 · 3 h", whichever halves arrived, or "Horario por definir". */
export function scheduleLabel(gig: Pick<GigView, "timeLabel" | "durationLabel">): string {
    return [gig.timeLabel, gig.durationLabel].filter(Boolean).join(" · ") || SCHEDULE_FALLBACK;
}

/** "el sábado 15 de noviembre", or "la fecha por definir" when the date is still missing. */
function whenPhrase(dateLabel: string): string {
    return dateLabel === DATE_FALLBACK ? `la ${DATE_PENDING}` : `el ${dateLabel}`;
}

/** Accessible name of the confirm button: the group and the date, so two rows never sound alike. */
export function confirmButtonName(gig: Pick<GigView, "dateLabel" | "group">): string {
    return `Confirmar ${whenPhrase(gig.dateLabel)} · ${gig.group.name}`;
}

/** Accessible name of the decline button, in the same shape as the confirm one. */
export function declineButtonName(gig: Pick<GigView, "dateLabel" | "group">): string {
    return `Avisar que no puedo ${whenPhrase(gig.dateLabel)} · ${gig.group.name}`;
}

/** What the live region says once an answer is saved: "Confirmaste el sábado 15 de noviembre · Grupo". */
export function answerNotice(status: GigAnswer, dateLabel: string, groupName: string): string {
    const done = status === "Confirmed" ? "Confirmaste" : "Avisaste que no puedes";
    return `${done} ${whenPhrase(dateLabel)} · ${groupName}`;
}
