import { formatEventDate, isIsoDate, shortDateParts } from "@/lib/format";
import type { ScheduleEventDto } from "./services/groupAvailability.service";
import { daysCoveredBy } from "./bookedDays";

/**
 * Los dos instantes que abarcan un día completo de calendario, en hora local y en ISO con zona:
 * así la API recibe el día que la persona eligió y la zona del servidor no lo corre de fecha.
 */
export function dayBounds(day: string): { start: string; end: string } | null {
    if (!isIsoDate(day)) return null;
    const [year, month, date] = day.split("-").map(Number);
    return {
        start: new Date(year, month - 1, date).toISOString(),
        end: new Date(year, month - 1, date + 1).toISOString(),
    };
}

/** "jueves 19 de noviembre de 2026": el día largo sin la coma, para poder meterlo dentro de una frase. */
export function longDayName(day: string): string | null {
    const name = formatEventDate(day);
    return name ? name.replace(/,\s*/, " ") : null;
}

/**
 * "jue 19 nov": el día corto que cabe en la etiqueta de un botón, con la abreviatura española del día y
 * del mes y sin el año. El nombre accesible del control sigue usando el día largo: esto es solo lo que
 * se lee. Null cuando el día no se puede leer, para que el botón pueda quedarse con su etiqueta genérica.
 */
export function shortDayName(day: string): string | null {
    const parts = shortDateParts(day);
    return parts ? `${parts.weekday} ${parts.day} ${parts.month}` : null;
}

/**
 * What a surface that knows the agenda can say about the confirmed gigs of one day: the gig is there,
 * it is not, or the agenda could not be read and therefore nothing can be claimed (round 10).
 */
export type DayGigFact = "confirmed" | "none" | "unknown";

/**
 * A fact, plus the state of a read still in flight. "reading" is not a fact: it is what a dialog says
 * while it cannot answer, because silence would be read as "you have no gig that day".
 */
export type DayGigNote = DayGigFact | "reading";

/*
 * The three sentences, in one place (round 11). The day form and the drag dialog are two doors to the
 * same block and used to say different things; whoever paints the note asks for the text here, so there
 * is one voice and no second copy of the words to drift.
 */
const CONFIRMED_GIG_NOTE = "Ese día ya tienes un toque confirmado. Bloquearlo no lo cancela.";
const UNKNOWN_GIG_NOTE = "No pudimos comprobar si ese día ya tienes un toque.";
const READING_GIG_NOTE = "Comprobando si ese día ya tienes un toque…";

/** The line a dialog shows for a fact; `null` when there is nothing to say (the day is free). */
export function gigNoteText(fact: DayGigNote): string | null {
    if (fact === "confirmed") return CONFIRMED_GIG_NOTE;
    if (fact === "unknown") return UNKNOWN_GIG_NOTE;
    if (fact === "reading") return READING_GIG_NOTE;
    return null;
}

/** The fact about the days one read of the agenda can speak for: any gig listed is the fact. */
function factForDays(days: readonly string[], read: { days: readonly string[]; failed: boolean }): DayGigFact {
    if (days.some((day) => read.days.includes(day))) return "confirmed";
    return read.failed ? "unknown" : "none";
}

/**
 * The fact of one day, read only from what the agenda says. "unknown" is the honest answer after a
 * failed read: silence would be read as "you have no gig that day", which is the lie round 10 found.
 * A gig already known is said even when the last read failed.
 */
export function confirmedGigFact(
    day: string,
    read: { days: readonly string[]; failed: boolean }
): DayGigFact {
    return factForDays([day], read);
}

/**
 * The same fact for an interval dragged on the calendar (round 11): dragging over 19:00–21:30 on a day
 * with a confirmed gig is the same block as the day form's, so it is the same fact and the same words.
 * A drag that crosses midnight touches both days; a gig on either one is the fact.
 */
export function rangeGigFact(
    start: string,
    end: string,
    read: { days: readonly string[]; failed: boolean }
): DayGigFact {
    return factForDays(daysCoveredBy(start, end), read);
}

/**
 * Whether the day already happened, by the app's own clock. Blocking the past is not a decision anyone
 * can act on, so the day form says so and does not offer it (round 11); a day blocked before is still
 * lifted, because that state the manager can change.
 */
export function isPastDay(day: string, today: string): boolean {
    return isIsoDate(day) && isIsoDate(today) && day < today;
}

/** What the day form says when the chosen day is behind: the fact, and where to go next. */
export const PAST_DAY_NOTE = "Este día ya pasó. Elige hoy o una fecha siguiente.";

/**
 * Bloques que reclaman el día entero: son los que el botón deshace. Un bloqueo parcial (un ensayo de
 * 10 a 12) no vuelve el día "bloqueado", así que el control sigue ofreciendo bloquearlo completo y no
 * borra lo que ya estaba marcado.
 */
export function wholeDayBlocks(events: ScheduleEventDto[], day: string): ScheduleEventDto[] {
    const bounds = dayBounds(day);
    if (!bounds) return [];
    const dayStart = Date.parse(bounds.start);
    const dayEnd = Date.parse(bounds.end);
    return events.filter((event) => {
        if (event.isAvailable) return false;
        const start = Date.parse(event.start);
        const end = Date.parse(event.end);
        return Number.isFinite(start) && Number.isFinite(end) && start <= dayStart && end >= dayEnd;
    });
}
