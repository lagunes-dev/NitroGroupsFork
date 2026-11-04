"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { ProgressSteps } from "@/components/ui/ProgressSteps";
import { cn } from "@/lib/utils";

/**
 * Piezas compartidas por los dos flujos de onboarding. Siguen DESIGN.md: superficies separadas
 * por tono (fondo → fondo-2 → fondo-3), esquinas rectas, sin sombras ni bordes en reposo,
 * etiqueta visible sobre cada campo y límites atados con aria-describedby.
 */

interface Step {
    id: string;
    label: string;
}

/** Marco de página: título cartel, pasos, formulario a la izquierda y nota de "qué sigue" a la derecha. */
export function OnboardingFrame({
    title,
    intro,
    steps,
    currentStep,
    aside,
    children,
}: {
    title: string;
    intro: string;
    steps: Step[];
    currentStep: number;
    aside: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="page-frame py-16 md:py-24 grid md:grid-cols-12 gap-x-8 gap-y-10">
            <header className="md:col-span-7 w-full max-w-2xl space-y-3">
                <h1 className="titulo">{title}</h1>
                <p className="text-tinta-2 max-w-[52ch]">{intro}</p>
            </header>
            <div className="md:col-span-7 md:row-start-2 w-full max-w-2xl space-y-10">
                <ProgressSteps steps={steps} currentStep={currentStep} />
                {children}
            </div>
            {/* Row 2, column 2: its top edge is the stepper's top edge. */}
            <aside aria-label="Qué sigue" className="md:col-span-4 md:col-start-9 md:row-start-2">
                <div className="text-tinta-2 max-md:bg-fondo-2 rounded-xl max-md:p-5 md:border-l md:border-linea md:pl-6 md:text-base md:leading-relaxed md:max-w-[34ch]">
                    {aside}
                </div>
            </aside>
        </div>
    );
}

/** Encabezado de cada paso. Recibe el foco al cambiar de paso para que el lector de pantalla lo anuncie. */
export function StepHeading({
    title,
    focusOnMount,
    children,
}: {
    title: string;
    focusOnMount: boolean;
    children?: ReactNode;
}) {
    const ref = useRef<HTMLHeadingElement>(null);
    useEffect(() => {
        if (focusOnMount) ref.current?.focus();
    }, [focusOnMount]);

    return (
        <div className="space-y-2">
            <h2 ref={ref} tabIndex={-1} className="titulo break-words outline-none">
                {title}
            </h2>
            {children && <p className="text-tinta-2 max-w-[60ch]">{children}</p>}
        </div>
    );
}

/** Área de texto con contador; el límite se lee junto al campo. */
export function TextareaField({
    label,
    value,
    onChange,
    max,
    placeholder,
    hint,
    rows = 5,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    max: number;
    placeholder?: string;
    hint?: string;
    rows?: number;
}) {
    const id = useId();
    const left = max - value.length;
    return (
        <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-4">
                <label htmlFor={id} className="text-sm font-medium">{label}</label>
                <span id={`${id}-limit`} className={cn("text-sm tabular", left <= 40 ? "text-acento" : "text-tinta-2")}>
                    {value.length} de {max}
                </span>
            </div>
            <textarea
                id={id}
                rows={rows}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                maxLength={max}
                placeholder={placeholder}
                aria-describedby={hint ? `${id}-limit ${id}-hint` : `${id}-limit`}
                className="block w-full bg-fondo-2 rounded-xl px-4 py-3 text-base text-tinta placeholder:text-tinta-2/70 resize-y outline-none focus-visible:outline-2 focus-visible:outline-acento focus-visible:-outline-offset-2"
            />
            {hint && <p id={`${id}-hint`} className="text-sm text-tinta-2">{hint}</p>}
        </div>
    );
}

/** Deslizador con su valor grande a la derecha y el rango permitido escrito. */
export function RangeField({
    label,
    value,
    onChange,
    min,
    max,
    step = 1,
    format,
    hint,
}: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    step?: number;
    format: (value: number) => string;
    hint: string;
}) {
    const id = useId();
    return (
        <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-4">
                <label htmlFor={id} className="text-sm font-medium">{label}</label>
                <output htmlFor={id} className="type-heading text-[1.75rem] tabular" aria-hidden>
                    {format(value)}
                </output>
            </div>
            <input
                id={id}
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseInt(e.target.value, 10))}
                aria-valuetext={format(value)}
                aria-describedby={`${id}-hint`}
                className="block w-full h-11 cursor-pointer accent-acento"
            />
            <p id={`${id}-hint`} className="text-sm text-tinta-2">{hint}</p>
        </div>
    );
}

/** Interruptor sí/no con su explicación al lado. */
export function SwitchField({
    label,
    description,
    checked,
    onChange,
}: {
    label: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    const id = useId();
    return (
        <div className="flex items-start justify-between gap-6 bg-fondo-2 rounded-xl p-5">
            <div className="space-y-1">
                <p id={`${id}-label`} className="font-semibold">{label}</p>
                <p id={`${id}-desc`} className="text-sm text-tinta-2">{description}</p>
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-labelledby={`${id}-label`}
                aria-describedby={`${id}-desc`}
                onClick={() => onChange(!checked)}
                className={cn(
                    "relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento",
                    checked ? "bg-acento" : "bg-fondo-3"
                )}
            >
                <span
                    aria-hidden
                    className={cn(
                        "absolute top-1 left-1 size-5 rounded-full transition-transform duration-150",
                        checked ? "translate-x-5 bg-fondo" : "translate-x-0 bg-tinta-2"
                    )}
                />
                <span className="sr-only">{checked ? "Sí" : "No"}</span>
            </button>
        </div>
    );
}

export interface Choice<V extends string> {
    value: V;
    label: string;
    description?: string;
}

/** Opciones excluyentes como radios nativos: teclado con flechas y anuncio correcto gratis. */
export function ChoiceGroup<V extends string>({
    legend,
    name,
    options,
    value,
    onChange,
    layout = "stack",
}: {
    legend: string;
    name: string;
    options: Choice<V>[];
    value: V;
    onChange: (value: V) => void;
    layout?: "stack" | "inline";
}) {
    return (
        <fieldset className="space-y-2">
            <legend className="text-sm font-medium mb-2">{legend}</legend>
            <div className={cn(layout === "inline" ? "flex flex-wrap gap-2" : "grid gap-2")}>
                {options.map((option) => {
                    const selected = option.value === value;
                    return (
                        <label
                            key={option.value}
                            className={cn(
                                "relative flex cursor-pointer gap-4 transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-acento",
                                layout === "inline" ? "px-5 h-11 items-center font-semibold" : "p-5 items-start",
                                selected ? "bg-fondo-3" : "bg-fondo-2 hover:bg-fondo-3"
                            )}
                        >
                            <input
                                type="radio"
                                name={name}
                                value={option.value}
                                checked={selected}
                                onChange={() => onChange(option.value)}
                                className="sr-only"
                            />
                            {layout === "stack" && (
                                <span
                                    aria-hidden
                                    className={cn(
                                        "mt-1 size-4 shrink-0 grid place-items-center",
                                        selected ? "bg-acento" : "bg-tinta-2"
                                    )}
                                >
                                    <span className={cn(selected ? "size-1.5 bg-fondo" : "size-3 bg-fondo-2")} />
                                </span>
                            )}
                            <span className="space-y-1">
                                <span className={cn("block", layout === "stack" && "font-semibold", selected && layout === "inline" && "text-acento")}>
                                    {option.label}
                                </span>
                                {option.description && (
                                    <span className="block text-sm text-tinta-2">{option.description}</span>
                                )}
                            </span>
                        </label>
                    );
                })}
            </div>
        </fieldset>
    );
}

/** Resumen antes de crear: pares etiqueta/valor sobre un escalón de tono. */
export function ReviewList({ items }: { items: { label: string; value: ReactNode }[] }) {
    return (
        <dl className="bg-fondo-2 rounded-xl p-5 md:p-6 grid gap-4 sm:grid-cols-[minmax(10rem,auto)_1fr] sm:gap-x-8">
            {items.map((item) => (
                <div key={item.label} className="contents">
                    <dt className="text-sm text-tinta-2 sm:pt-0.5">{item.label}</dt>
                    <dd className="text-tinta break-words -mt-3 sm:mt-0">{item.value}</dd>
                </div>
            ))}
        </dl>
    );
}

/** Error de envío: dice qué pasó y cómo seguir. */
export function FormError({ message }: { message: string }) {
    if (!message) return null;
    return (
        <p role="alert" className="bg-fondo-2 rounded-xl px-5 py-4 text-error">
            {message}
        </p>
    );
}

/** Fila de navegación entre pasos: atrás a la izquierda, acción principal a la derecha. */
export function StepActions({ children }: { children: ReactNode }) {
    return <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center">{children}</div>;
}

/** Pantalla de espera mientras se lee la sesión. */
export function OnboardingLoading({ label }: { label: string }) {
    return (
        <div className="page-frame min-h-[60vh] grid content-center py-16" role="status" aria-live="polite">
            <p className="type-heading text-[2rem] text-tinta-2">{label}</p>
        </div>
    );
}

/** Llegada: el nombre en cartel y las siguientes acciones. */
export function ArrivalView({
    lead,
    name,
    children,
    actions,
}: {
    lead: string;
    name: string;
    children: ReactNode;
    actions: ReactNode;
}) {
    const ref = useRef<HTMLHeadingElement>(null);
    useEffect(() => {
        // La llegada empieza arriba: el cartel es lo primero que se ve.
        window.scrollTo(0, 0);
        ref.current?.focus({ preventScroll: true });
    }, []);

    return (
        <div className="page-frame py-16 md:py-28 grid md:grid-cols-12 gap-x-8 gap-y-10">
            <div className="md:col-span-10 space-y-8">
                <h1
                    ref={ref}
                    tabIndex={-1}
                    className="titulo aparece break-words outline-none"
                >
                    {name}
                </h1>
                <p className="type-heading text-[1.5rem] md:text-[2rem] text-acento max-w-[44ch] text-balance">{lead}</p>
                <div className="text-tinta-2 max-w-[56ch] space-y-3 text-[1.0625rem]">{children}</div>
                <div className="flex flex-col gap-3 sm:flex-row pt-2">{actions}</div>
            </div>
        </div>
    );
}
