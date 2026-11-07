"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldClass, floatingPanelClass } from "./field";
import { describedBy, FieldShell } from "./FieldShell";

export interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}

export interface SelectProps {
    options: SelectOption[];
    id?: string;
    name?: string;
    form?: string;
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    placeholder?: string;
    /** Adds a first row that selects "" (for example "Cualquiera"); Radix itself cannot select an empty value. */
    emptyOption?: string;
    required?: boolean;
    disabled?: boolean;
    label?: string;
    error?: string;
    helperText?: string;
    className?: string;
    "aria-label"?: string;
}

// Radix reserves "" for "nothing selected", so the optional empty row travels under this token.
const EMPTY_TOKEN = "__vacio__";

const itemClass =
    "relative flex min-h-11 w-full cursor-default select-none items-center rounded-[8px] py-2 pl-3 pr-9 text-base leading-snug text-tinta data-[highlighted]:bg-fondo-3 data-[highlighted]:shadow-[inset_2px_0_0_var(--acento)] data-[state=checked]:font-medium data-[disabled]:pointer-events-none data-[disabled]:opacity-45 sm:min-h-10";

const scrollButtonClass = "flex h-8 cursor-default items-center justify-center text-tinta-2";

/** Styled Radix Select that works as a plain form control (name, defaultValue, required, onValueChange). */
export function Select({
    options,
    id,
    name,
    form,
    value,
    defaultValue,
    onValueChange,
    placeholder,
    emptyOption,
    required,
    disabled,
    label,
    error,
    helperText,
    className,
    "aria-label": ariaLabel,
}: SelectProps) {
    const generatedId = React.useId();
    const triggerId = id ?? generatedId;
    const [inner, setInner] = React.useState(defaultValue ?? "");
    const current = value ?? inner;

    const handleChange = (next: string) => {
        const resolved = next === EMPTY_TOKEN ? "" : next;
        setInner(resolved);
        onValueChange?.(resolved);
    };

    const radixValue = current === "" ? (emptyOption ? EMPTY_TOKEN : "") : current;
    // With an empty row the token must never reach the form, so a plain hidden input submits instead of Radix's own select.
    const useOwnInput = !!emptyOption && !!name;

    return (
        <FieldShell id={triggerId} label={label} error={error} helperText={helperText}>
            <SelectPrimitive.Root
                value={radixValue}
                onValueChange={handleChange}
                name={useOwnInput ? undefined : name}
                form={form}
                required={required}
                disabled={disabled}
            >
                <SelectPrimitive.Trigger
                    id={triggerId}
                    aria-label={ariaLabel}
                    aria-invalid={!!error}
                    aria-describedby={describedBy(triggerId, error, helperText)}
                    className={cn(
                        fieldClass,
                        "group flex items-center justify-between gap-3 text-left data-[placeholder]:text-tinta-2",
                        className
                    )}
                >
                    <span className="min-w-0 flex-1 truncate">
                        <SelectPrimitive.Value placeholder={placeholder} />
                    </span>
                    <SelectPrimitive.Icon asChild>
                        <ChevronDown
                            size={18}
                            aria-hidden
                            className="shrink-0 text-tinta-2 transition-transform duration-300 ease-[var(--ease-out)] motion-reduce:transition-none group-data-[state=open]:rotate-180"
                        />
                    </SelectPrimitive.Icon>
                </SelectPrimitive.Trigger>
                <SelectPrimitive.Portal>
                    <SelectPrimitive.Content
                        position="popper"
                        sideOffset={6}
                        collisionPadding={12}
                        className={cn(
                            floatingPanelClass,
                            "w-[var(--radix-select-trigger-width)] min-w-[8rem] max-h-[min(20rem,var(--radix-select-content-available-height))] overflow-hidden"
                        )}
                    >
                        <SelectPrimitive.ScrollUpButton className={scrollButtonClass}>
                            <ChevronUp size={16} aria-hidden />
                        </SelectPrimitive.ScrollUpButton>
                        <SelectPrimitive.Viewport className="p-1">
                            {emptyOption && <SelectItem value={EMPTY_TOKEN}>{emptyOption}</SelectItem>}
                            {options.map((option) => (
                                <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectPrimitive.Viewport>
                        <SelectPrimitive.ScrollDownButton className={scrollButtonClass}>
                            <ChevronDown size={16} aria-hidden />
                        </SelectPrimitive.ScrollDownButton>
                    </SelectPrimitive.Content>
                </SelectPrimitive.Portal>
            </SelectPrimitive.Root>
            {useOwnInput && <input type="hidden" name={name} form={form} value={current} disabled={disabled} />}
        </FieldShell>
    );
}

function SelectItem({ value, disabled, children }: { value: string; disabled?: boolean; children: React.ReactNode }) {
    return (
        <SelectPrimitive.Item value={value} disabled={disabled} className={itemClass}>
            <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
            <SelectPrimitive.ItemIndicator className="absolute right-3 grid place-items-center text-acento">
                <Check size={16} aria-hidden />
            </SelectPrimitive.ItemIndicator>
        </SelectPrimitive.Item>
    );
}
