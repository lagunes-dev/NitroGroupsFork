/**
 * The one field spec (DESIGN.md → Shapes): 48px tall, 8px radius, 16px side padding, a fondo-2 fill with a
 * hairline edge, an acento outline on keyboard focus. Input, Textarea, Select, DatePicker and the exported
 * `fieldClass` all start from it, so no field in the app can drift from the others.
 */
export const fieldClass =
    "block h-12 w-full min-w-0 rounded-[8px] bg-fondo-2 px-4 text-base text-tinta shadow-[inset_0_0_0_1px_var(--linea)] outline-none transition-[box-shadow] duration-300 ease-[var(--ease-out)] motion-reduce:transition-none placeholder:text-tinta-2 hover:shadow-[inset_0_0_0_1px_var(--linea-fuerte)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-acento disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:shadow-[inset_0_0_0_1px_var(--error),inset_0_-2px_0_var(--error)]";

/** Left padding of a field whose leading icon sits inside the padding box (16px edge + 18px icon + 10px gap). */
export const fieldIconPadding = "pl-11";

/** Floating panel shared by Select and DatePicker: a solid `.superficie` step, never glass, above the sticky navigation. */
export const floatingPanelClass =
    "superficie z-[100] rounded-[12px] text-tinta outline-none motion-safe:data-[state=open]:animate-[panel-in_0.18s_var(--ease-out)]";
