"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldClass, fieldIconPadding } from "./field";
import { describedBy, FieldShell } from "./FieldShell";

export interface InputProps
    extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    success?: boolean;
    icon?: React.ReactNode;
    helperText?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, label, error, success, icon, helperText, id, required, ...props }, ref) => {
        const generatedId = React.useId();
        const inputId = id ?? generatedId;
        const hasError = !!error;
        const hasSuccess = success && !hasError;
        const isPasswordType = type === "password";
        const [showPassword, setShowPassword] = React.useState(false);

        const currentType = isPasswordType && showPassword ? "text" : type;

        return (
            <FieldShell id={inputId} label={label} error={error} helperText={helperText}>
                <div className="relative">
                    {icon && (
                        <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-tinta-2 [&_svg]:size-[18px]">
                            {icon}
                        </div>
                    )}
                    <input
                        id={inputId}
                        type={currentType}
                        required={required}
                        className={cn(
                            fieldClass,
                            "file:border-0 file:bg-transparent file:font-medium",
                            icon && fieldIconPadding,
                            isPasswordType && "pr-12",
                            hasSuccess && "shadow-[inset_0_-2px_0_var(--ok)]",
                            className
                        )}
                        ref={ref}
                        aria-invalid={hasError}
                        aria-describedby={describedBy(inputId, error, helperText)}
                        {...props}
                    />
                    {isPasswordType && (
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-[8px] text-tinta-2 transition-colors hover:text-tinta"
                            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                            aria-pressed={showPassword}
                        >
                            {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
                        </button>
                    )}
                </div>
            </FieldShell>
        );
    }
);

Input.displayName = "Input";

export { Input };
