import * as React from "react";
import { cn } from "@/lib/utils";
import { fieldClass } from "./field";
import { describedBy, FieldShell } from "./FieldShell";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
    helperText?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, label, error, helperText, id, required, ...props }, ref) => {
        const generatedId = React.useId();
        const textareaId = id ?? generatedId;

        return (
            <FieldShell id={textareaId} label={label} error={error} helperText={helperText}>
                <textarea
                    id={textareaId}
                    ref={ref}
                    required={required}
                    aria-invalid={!!error}
                    aria-describedby={describedBy(textareaId, error, helperText)}
                    className={cn(fieldClass, "h-auto min-h-28 resize-y py-3 leading-relaxed", className)}
                    {...props}
                />
            </FieldShell>
        );
    }
);

Textarea.displayName = "Textarea";

export { Textarea };
