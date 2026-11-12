import type { ScheduleEventDto } from "./services/groupAvailability.service";
import { CALENDAR_DAY_START } from "./components/calendarLayout";

/** `YYYY-MM-DD` of a local instant: the same day the calendar column shows. */
const LOCAL_DAY = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" });

/** A guard against a payload whose bounds span years: a schedule never covers more than one. */
const MAX_DAYS = 366;

function localDay(instant: Date): string {
    return LOCAL_DAY.format(instant);
}

/**
 * Los días locales que cubre un bloque. El final es exclusivo —un bloque de día completo termina a las
 * 00:00 del día siguiente y no cuenta ese día—, el mismo criterio que `formatRangeLabel` usa para decir
 * "todo el día". Un límite que no se puede leer no cubre ningún día: no se inventa una fecha.
 */
export function daysCoveredBy(start: string, end: string): string[] {
    const from = new Date(start);
    const to = new Date(end);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return [];

    // El último instante que el bloque toca: un día, un rango de días, y nunca un día de más.
    const last = localDay(new Date(to.getTime() - 1));
    const first = localDay(from);
    if (last < first) return [];

    const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const days: string[] = [];
    for (let guard = 0; guard < MAX_DAYS; guard += 1) {
        const day = localDay(cursor);
        days.push(day);
        if (day >= last) break;
        cursor.setDate(cursor.getDate() + 1);
    }
    return days;
}

/**
 * Quita de la rejilla las marcas de disponibilidad que caen en un día con toque confirmado (ronda 10):
 * la semana pintaba el mismo día como "Toque confirmado" y como "0:00 Disponible", y un manager lee la
 * noche como libre. Un toque confirmado no está disponible, así que la disponibilidad se calla en ese
 * día y el marcador del toque se queda. Los bloqueos de ese día se conservan: no son disponibilidad.
 */
export function withoutAvailabilityOnBookedDays(
    events: readonly ScheduleEventDto[],
    bookedDays: ReadonlySet<string>
): ScheduleEventDto[] {
    if (bookedDays.size === 0) return [...events];
    return events.filter((event) => {
        if (!event.isAvailable) return true;
        return !daysCoveredBy(event.start, event.end).some((day) => bookedDays.has(day));
    });
}

/** `YYYY-MM-DD` del instante solo si cae exactamente a la medianoche local; `null` si no. */
function midnightDay(instant: string): string | null {
    const at = new Date(instant);
    if (Number.isNaN(at.getTime())) return null;
    if (at.getHours() !== 0 || at.getMinutes() !== 0 || at.getSeconds() !== 0) return null;
    return localDay(at);
}

const [OPENING_HOUR, OPENING_MINUTE] = CALENDAR_DAY_START.split(":").map(Number);

/**
 * Ronda 12: el día del calendario ahora sigue hasta las 02:00 del día siguiente, y un bloqueo que reclama
 * días enteros ("No disponible", "Disponible") empieza a la medianoche del suyo; con la columna extendida
 * FullCalendar lo parte y pinta sus dos primeras horas al final de la columna del día ANTERIOR. Es decir:
 * el bloqueo de mañana aparecía en el día de hoy, que es la fuga que esta ronda no puede permitir.
 *
 * El bloqueo se pinta desde la hora en que el día abre: el manager ve la columna entera, como hasta
 * ahora, y el día que se bloqueó es el único que se pinta. El dato guardado no cambia —eso lo escriben el
 * arrastre y el control del día— ni tampoco la regla que desactiva la disponibilidad de un día con toque.
 * Un bloqueo parcial de la madrugada (00:00 a 03:00) no es de este caso: ese sí vive en la noche.
 */
export function keepWholeDayBlocksInTheirColumn(events: readonly ScheduleEventDto[]): ScheduleEventDto[] {
    return events.map((event) => {
        const startDay = midnightDay(event.start);
        const endDay = midnightDay(event.end);
        if (!startDay || !endDay || endDay <= startDay) return event;

        const [year, month, date] = startDay.split("-").map(Number);
        return { ...event, start: new Date(year, month - 1, date, OPENING_HOUR, OPENING_MINUTE).toISOString() };
    });
}
