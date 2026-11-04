const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const pad = (n: number, size = 2) => String(n).padStart(size, "0");

/** Local date from a `YYYY-MM-DD` string. Built from y/m/d parts: `new Date("YYYY-MM-DD")` is UTC and drifts a day in Mexico. */
export function parseIsoDate(value: string | null | undefined): Date | null {
    const match = value ? ISO_DATE.exec(value) : null;
    if (!match) return null;
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const date = new Date(year, month - 1, day);
    const intact = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
    return intact ? date : null;
}

/** `YYYY-MM-DD` from the local calendar day of `date`. */
export function toIsoDate(date: Date): string {
    return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "sáb 7 nov 2026" (es-MX), or null when the value is not a valid ISO date. */
export function formatFriendlyDate(value: string | null | undefined): string | null {
    const date = parseIsoDate(value);
    if (!date) return null;
    return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** ISO strings compare chronologically as plain strings. */
export function clampIsoDate(value: string, min?: string, max?: string): string {
    if (min && value < min) return min;
    if (max && value > max) return max;
    return value;
}

export function isIsoDateDisabled(value: string, min?: string, max?: string): boolean {
    return clampIsoDate(value, min, max) !== value;
}
