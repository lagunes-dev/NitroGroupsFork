import { formatEventDate, isIsoDate } from "@/lib/format";
import { ROUTES } from "@/config/routes";
import { attendanceAppearance, type AttendanceAppearance } from "./attendance";
import type { GigAnswer, GigPayload } from "./types";

const DATE_FALLBACK = "Fecha por definir";
/** The same words inside a sentence, where Spanish writes them in lower case. */
const DATE_PENDING = "fecha por definir";
const PLACE_FALLBACK = "Lugar por definir";
const SCHEDULE_FALLBACK = "Horario por definir";
const GROUP_FALLBACK = "Grupo sin nombre";

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

/** One row of the contract turned into view data. Missing or wrong values fall back, never throw. */
export function toGigView(row: GigPayload): GigView {
    const slug = asText(row.groupSlug);
    const rawDate = asText(row.eventDate);
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
