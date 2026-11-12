import type { EventInput } from "@fullcalendar/core";
import type { ScheduleEventDto } from "./services/groupAvailability.service";
import { blockKindOf } from "./blockMove";
import { daysCoveredBy } from "./bookedDays";
import { CALENDAR_DAY_START } from "./components/calendarLayout";

/** Id prefix of the all-day chip; `blockKindOf` does not know it, so no drag or move path can claim it. */
export const AVAILABILITY_CHIP_PREFIX = "availchip_";

const [OPENING_HOUR, OPENING_MINUTE] = CALENDAR_DAY_START.split(":").map(Number);

const HOUR = new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

function dayStart(day: string): Date {
    const [year, month, date] = day.split("-").map(Number);
    return new Date(year, month - 1, date);
}

/**
 * Round 13: an availability mark is drawn as a background tint so a drag over it selects hours, but
 * FullCalendar never fires `eventClick` for a background event. This is the second, foreground
 * representation of the same mark: one chip per marked day in the all-day lane (where the "Toque
 * confirmado" chip already takes taps), carrying the id the removal needs. It is never editable.
 */
export function availabilityChips(events: readonly ScheduleEventDto[]): EventInput[] {
    const chips: EventInput[] = [];
    for (const event of events) {
        if (blockKindOf(event.id) !== "avail") continue;

        const markStart = new Date(event.start);
        const markEnd = new Date(event.end);
        for (const day of daysCoveredBy(event.start, event.end)) {
            const midnight = dayStart(day);
            const nextMidnight = new Date(midnight.getFullYear(), midnight.getMonth(), midnight.getDate() + 1);
            const from = markStart > midnight ? markStart : midnight;
            const to = markEnd < nextMidnight ? markEnd : nextMidnight;
            const opening = new Date(midnight.getFullYear(), midnight.getMonth(), midnight.getDate(), OPENING_HOUR, OPENING_MINUTE);
            const wholeDay = from <= opening && to >= nextMidnight;

            chips.push({
                id: `${AVAILABILITY_CHIP_PREFIX}${event.id}_${day}`,
                title: wholeDay ? event.title : `${event.title} ${HOUR.format(from)} a ${HOUR.format(to)}`,
                start: day,
                allDay: true,
                editable: false,
                startEditable: false,
                durationEditable: false,
                backgroundColor: "var(--fondo-2)",
                borderColor: "var(--ok)",
                textColor: "var(--tinta)",
                classNames: ["ng-available-chip"],
                extendedProps: { removes: { id: event.id, title: event.title } },
            });
        }
    }
    return chips;
}
