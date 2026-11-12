"use client";

import { useEffect, useId } from "react";
import { Button } from "@/components/ui/Button";
import { cancelDialogCopy } from "../deposit";

interface CancelRequestDialogProps {
    /** La solicitud tal como la API la entrega: el diálogo decide si hay plata que nombrar. */
    request: { deposit?: unknown; balanceReceivedAt?: string | null };
    isSaving: boolean;
    /** La respuesta de la API cuando el guardado falla; se lee dentro del diálogo, donde está el botón. */
    error?: string | null;
    onCancel: () => void;
    onConfirm: () => void;
}

/**
 * La pregunta de "Cancelar solicitud", con la forma y la voz de los otros diálogos de la app
 * (`BlockSlotDialog`, `MoveBlockDialog`): el mismo velo, el mismo ancho, el mismo par de botones.
 *
 * Ronda 13 (la clienta): el diálogo era el `confirm()` del navegador —otra tipografía, otro idioma visual,
 * imposible de leer a 390 px— y su frase final hablaba de "este evento" para una solicitud que nunca llegó
 * a serlo. Ahora es de la app, dice qué pasa con el grupo y, si ya hay plata registrada, con la plata.
 * No promete reembolsos: la app no cobra ni devuelve (D1).
 *
 * El foco vuelve a donde estaba al cerrarse; de eso se ocupa el hilo, que es quien guarda el botón.
 */
export function CancelRequestDialog({ request, isSaving, error, onCancel, onConfirm }: CancelRequestDialogProps) {
    const titleId = useId();
    const bodyId = useId();
    const moneyId = useId();
    const errorId = useId();
    const copy = cancelDialogCopy(request);
    const describedBy = [bodyId, copy.money ? moneyId : null, error ? errorId : null].filter(Boolean).join(" ");

    // Escape cierra la pregunta sin decidir nada: es la salida de siempre, y el hilo devuelve el foco.
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !isSaving) onCancel();
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [isSaving, onCancel]);

    return (
        <div
            className="fixed inset-0 z-50 grid place-items-center bg-fondo/85 p-4"
            role="presentation"
            onClick={() => {
                if (!isSaving) onCancel();
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={describedBy}
                className="w-full max-w-md bg-fondo-2 p-6 text-tinta shadow-[0_24px_64px_-16px_var(--fondo)]"
                onClick={(event) => event.stopPropagation()}
            >
                <h2 id={titleId} className="type-heading text-2xl">
                    {copy.title}
                </h2>
                <p id={bodyId} className="mt-3 text-tinta">
                    {copy.body}
                </p>
                {copy.money && (
                    <p id={moneyId} className="mt-2 text-sm text-tinta-2">
                        {copy.money}
                    </p>
                )}
                {error && (
                    <p id={errorId} role="alert" className="mt-3 text-error">
                        {error}
                    </p>
                )}
                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="ghost" className="min-h-11" onClick={onCancel} disabled={isSaving}>
                        Volver
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        className="min-h-11"
                        onClick={onConfirm}
                        disabled={isSaving}
                        autoFocus
                    >
                        {isSaving ? "Cancelando…" : "Cancelar la solicitud"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
