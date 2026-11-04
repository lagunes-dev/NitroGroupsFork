import type { FieldProps } from "./types";

/** Shared with `components/ui`: the one field spec (DESIGN.md → Shapes). */
export { fieldClass } from "@/components/ui/field";

export const hintId = (htmlFor: string) => `${htmlFor}-hint`;

export function Field({ label, htmlFor, required, hint, children }: FieldProps) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-sm font-medium text-tinta">
          {label}
          {required && <span className="text-tinta-2"> (obligatorio)</span>}
        </label>
        {hint && (
          <span id={hintId(htmlFor)} className="text-sm text-tinta-2">
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
