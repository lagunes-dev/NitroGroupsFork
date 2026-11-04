import * as React from "react";
import { cn } from "@/lib/utils";

export interface FieldShellProps {
    /** Id of the control the label points at; also seeds the error and helper ids. */
    id: string;
    label?: string;
    error?: string;
    helperText?: string;
    className?: string;
    children: React.ReactNode;
}

export const fieldErrorId = (id: string) => `${id}-error`;
export const fieldHelperId = (id: string) => `${id}-helper`;

/** `aria-describedby` for a control wrapped in a FieldShell. */
export function describedBy(id: string, error?: string, helperText?: string) {
    if (error) return fieldErrorId(id);
    return helperText ? fieldHelperId(id) : undefined;
}

/** Label above, control, then error (never colour alone: it has text) or helper text, on one 8px rhythm. */
export function FieldShell({ id, label, error, helperText, className, children }: FieldShellProps) {
    return (
        <div className={cn("flex w-full min-w-0 flex-col gap-2", className)}>
            {label && (
                <label htmlFor={id} className="block text-sm font-medium leading-5 text-tinta">
                    {label}
                </label>
            )}
            {children}
            {error && (
                <p id={fieldErrorId(id)} role="alert" className="text-sm leading-5 text-error">
                    {error}
                </p>
            )}
            {helperText && !error && (
                <p id={fieldHelperId(id)} className="text-sm leading-5 text-tinta-2">
                    {helperText}
                </p>
            )}
        </div>
    );
}
