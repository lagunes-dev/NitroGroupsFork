import { isIsoDate } from "./format";
import { formatTime12h, generateTimeSlots } from "./timeSlots";

export interface RequestFieldValues {
    eventDate: string;
    durationHours: number;
    eventType: string;
    locationText: string;
}

export type RequestFieldErrors = Partial<Record<keyof RequestFieldValues, string>>;

export interface OptionItem {
    value: string;
    label: string;
}

/** Visual order of the fields in the form: focus goes to the first invalid one in this order. */
const FIELD_ORDER: (keyof RequestFieldValues)[] = ["eventDate", "durationHours", "eventType", "locationText"];

const MAX_HOURS = 12;

/** Rules for the fields the browser cannot validate (custom date and select controls). `today` is `YYYY-MM-DD` in Mexico. */
export function validateRequestFields(values: RequestFieldValues, today: string, minHours: number): RequestFieldErrors {
    const errors: RequestFieldErrors = {};
    if (!isIsoDate(values.eventDate)) errors.eventDate = "Elige la fecha del evento.";
    else if (values.eventDate < today) errors.eventDate = "Elige una fecha desde hoy.";

    const hours = values.durationHours;
    if (!Number.isInteger(hours) || hours < minHours || hours > MAX_HOURS) {
        errors.durationHours = `Elige entre ${minHours} y ${MAX_HOURS} horas.`;
    }
    if (!values.eventType) errors.eventType = "Elige qué celebras.";
    if (!values.locationText.trim()) errors.locationText = "Escribe dónde será el evento.";
    return errors;
}

export function firstInvalidField(errors: RequestFieldErrors): keyof RequestFieldValues | undefined {
    return FIELD_ORDER.find((field) => errors[field]);
}

export function durationOptions(minHours: number): OptionItem[] {
    return Array.from({ length: MAX_HOURS + 1 - minHours }, (_, i) => minHours + i).map((h) => ({
        value: String(h),
        label: `${h} ${h === 1 ? "hora" : "horas"}`,
    }));
}

export function eventTypeOptions(types: readonly string[]): OptionItem[] {
    return types.map((type) => ({ value: type, label: type }));
}

/** Half-hour slots for the optional start time: value `HH:mm`, label in 12 hours. */
export function startTimeOptions(): OptionItem[] {
    return generateTimeSlots().map((slot) => ({ value: slot, label: formatTime12h(slot) ?? slot }));
}
