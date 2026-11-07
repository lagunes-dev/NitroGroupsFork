import type { ScheduleEventDto } from "./services/groupAvailability.service";

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
