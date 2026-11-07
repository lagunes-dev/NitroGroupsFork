const TIME_24H = /^([01]\d|2[0-3]):([0-5]\d)$/;
const STEP_MINUTES = 30;
const DAY_MINUTES = 24 * 60;

export interface ClockTime {
    hours: number;
    minutes: number;
}

/** Parses a strict 24-hour `HH:mm` string. */
export function parseTime(value: string | null | undefined): ClockTime | null {
    const match = value ? TIME_24H.exec(value) : null;
    return match ? { hours: Number(match[1]), minutes: Number(match[2]) } : null;
}

export const isValidTime = (value: string | null | undefined): boolean => parseTime(value) !== null;

/** "18:00" → "6:00 p. m." (Mexican 12-hour style). */
export function formatTime12h(value: string | null | undefined): string | null {
    const time = parseTime(value);
    if (!time) return null;
    const hour12 = time.hours % 12 === 0 ? 12 : time.hours % 12;
    return `${hour12}:${String(time.minutes).padStart(2, "0")} ${time.hours < 12 ? "a. m." : "p. m."}`;
}

const toMinutes = (value: string | undefined): number | null => {
    const time = parseTime(value);
    return time ? time.hours * 60 + time.minutes : null;
};

/** `HH:mm` slots every 30 minutes, bounds inclusive; an off-grid `from` rounds up and `to` rounds down. */
export function generateTimeSlots(from?: string, to?: string): string[] {
    const start = toMinutes(from) ?? 0;
    const end = toMinutes(to) ?? DAY_MINUTES - STEP_MINUTES;
    const slots: string[] = [];
    for (let m = Math.ceil(start / STEP_MINUTES) * STEP_MINUTES; m <= end && m < DAY_MINUTES; m += STEP_MINUTES) {
        slots.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
    }
    return slots;
}
