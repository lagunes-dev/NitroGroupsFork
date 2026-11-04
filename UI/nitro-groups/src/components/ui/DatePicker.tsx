"use client";

// Radix Trigger adds aria-expanded and aria-controls to the combobox button through asChild; the linter cannot see them.
/* eslint-disable jsx-a11y/role-has-required-aria-props */

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { CalendarDays } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { es } from "react-day-picker/locale";
import { clampIsoDate, formatFriendlyDate, parseIsoDate, toIsoDate } from "@/lib/dateField";
import { cn } from "@/lib/utils";
import { fieldClass, floatingPanelClass } from "./field";
import { describedBy, FieldShell } from "./FieldShell";

export interface DatePickerProps {
    id?: string;
    /** Submitted as a hidden input holding `YYYY-MM-DD`. */
    name?: string;
    form?: string;
    /** Controlled value, `YYYY-MM-DD` ("" when empty). */
    value?: string;
    defaultValue?: string;
    /** Receives `YYYY-MM-DD`, or "" when the date is cleared. */
    onChange?: (value: string) => void;
    /** Earliest selectable day, `YYYY-MM-DD`. */
    min?: string;
    /** Latest selectable day, `YYYY-MM-DD`. */
    max?: string;
    required?: boolean;
    disabled?: boolean;
    placeholder?: string;
    label?: string;
    error?: string;
    helperText?: string;
    className?: string;
    "aria-label"?: string;
}

/** A field-looking button that opens a Spanish (es-MX), Monday-first calendar and submits like a form control. */
export function DatePicker({
    id,
    name,
    form,
    value,
    defaultValue,
    onChange,
    min,
    max,
    required,
    disabled,
    placeholder = "Selecciona una fecha",
    label,
    error,
    helperText,
    className,
    "aria-label": ariaLabel,
}: DatePickerProps) {
    const generatedId = React.useId();
    const triggerId = id ?? generatedId;
    const [open, setOpen] = React.useState(false);
    const [inner, setInner] = React.useState(defaultValue ?? "");
    const current = value ?? inner;

    const selected = parseIsoDate(current) ?? undefined;
    const minDate = parseIsoDate(min) ?? undefined;
    const maxDate = parseIsoDate(max) ?? undefined;
    const friendly = formatFriendlyDate(current);

    const commit = (next: string) => {
        setInner(next);
        onChange?.(next);
        setOpen(false);
    };

    return (
        <FieldShell id={triggerId} label={label} error={error} helperText={helperText}>
            <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
                <PopoverPrimitive.Trigger asChild>
                    <button
                        id={triggerId}
                        type="button"
                        role="combobox"
                        disabled={disabled}
                        aria-label={ariaLabel}
                        aria-required={required || undefined}
                        aria-invalid={!!error}
                        aria-describedby={describedBy(triggerId, error, helperText)}
                        className={cn(fieldClass, "flex items-center justify-between gap-3 text-left", className)}
                    >
                        <span className={cn("min-w-0 flex-1 truncate", !friendly && "text-tinta-2")}>
                            {friendly ?? placeholder}
                        </span>
                        <CalendarDays size={18} aria-hidden className="shrink-0 text-tinta-2" />
                    </button>
                </PopoverPrimitive.Trigger>
                <PopoverPrimitive.Portal>
                    <PopoverPrimitive.Content
                        role="dialog"
                        aria-label={label ? `Elegir fecha: ${label}` : "Elegir fecha"}
                        align="start"
                        sideOffset={6}
                        collisionPadding={12}
                        onOpenAutoFocus={(event) => event.preventDefault()}
                        className={cn(floatingPanelClass, "max-w-[calc(100vw-1.5rem)] p-3")}
                    >
                        <DayPicker
                            mode="single"
                            locale={es}
                            weekStartsOn={1}
                            className="rdp-noche"
                            selected={selected}
                            defaultMonth={selected ?? parseIsoDate(clampIsoDate(toIsoDate(new Date()), min, max)) ?? undefined}
                            startMonth={minDate}
                            endMonth={maxDate}
                            disabled={[...(minDate ? [{ before: minDate }] : []), ...(maxDate ? [{ after: maxDate }] : [])]}
                            onSelect={(day) => day && commit(toIsoDate(day))}
                            autoFocus
                        />
                        {!required && current && (
                            <button
                                type="button"
                                onClick={() => commit("")}
                                className="mt-1 min-h-11 w-full rounded-[8px] px-3 text-sm text-tinta-2 transition-colors hover:bg-fondo-3 hover:text-tinta"
                            >
                                Borrar fecha
                            </button>
                        )}
                    </PopoverPrimitive.Content>
                </PopoverPrimitive.Portal>
            </PopoverPrimitive.Root>
            {name && <input type="hidden" name={name} form={form} value={current} disabled={disabled} />}
        </FieldShell>
    );
}
