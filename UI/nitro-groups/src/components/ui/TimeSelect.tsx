"use client";

import * as React from "react";
import { formatTime12h, generateTimeSlots } from "@/lib/timeSlots";
import { Select, type SelectProps } from "./Select";

export interface TimeSelectProps extends Omit<SelectProps, "options" | "emptyOption"> {
    /** Earliest slot, `HH:mm` 24h (inclusive). */
    from?: string;
    /** Latest slot, `HH:mm` 24h (inclusive). */
    to?: string;
}

/** 30-minute slots shown as "6:00 p. m." and submitted as `HH:mm`. */
export function TimeSelect({ from, to, placeholder = "Selecciona una hora", ...props }: TimeSelectProps) {
    const options = React.useMemo(
        () => generateTimeSlots(from, to).map((slot) => ({ value: slot, label: formatTime12h(slot) ?? slot })),
        [from, to]
    );
    return <Select {...props} placeholder={placeholder} options={options} />;
}
