import { formatEventDate, isIsoDate } from "@/lib/format";
import type { ScheduleEventDto } from "./services/groupAvailability.service";

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
