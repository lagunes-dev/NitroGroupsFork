"use client";

import { useEffect, useId, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { isIsoDate } from "@/lib/format";
import { longDayName } from "../blockDay";
import { useDayBlock } from "../hooks/useDayBlock";

type PendingChange = "block" | "unblock";

interface BlockDayControlProps {
    groupId: number;
    /** El día con el que abre: hoy, o el día del pedido que el manager está leyendo. */
    initialDay: string;
    className?: string;
}

/**
 * S26: bloquear un día entero sin arrastrar sobre la rejilla. El mismo control deshace el bloqueo,
 * porque el arrastre ya permite quitar un bloque, y escribe con el mismo servicio que él.
 */
export function BlockDayControl({ groupId, initialDay, className }: BlockDayControlProps) {
    const headingId = useId();
    const dialogTitleId = useId();
    const dialogDetailId = useId();
    const [day, setDay] = useState(initialDay);
    const [pending, setPending] = useState<PendingChange | null>(null);
    const { isBlocked, isChecking, isSaving, failed, block, unblock } = useDayBlock({ groupId, day });

    const dayName = longDayName(day);
    const hasDay = isIsoDate(day) && dayName !== null;
    const verb = isBlocked ? "Desbloquear" : "Bloquear";
    const unblocking = pending === "unblock";
    const dialogTitle = unblocking ? "Desbloquear este día" : "Bloquear este día";
    const dialogAction = unblocking ? "Desbloquear día" : "Bloquear día";
    const dialogActionBusy = unblocking ? "Desbloqueando…" : "Bloqueando…";

    useEffect(() => {
        if (!pending) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setPending(null);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [pending]);

    const confirm = () => {
        if (pending === "unblock") unblock.mutate();
        else block.mutate();
        setPending(null);
    };

    return (
        <section aria-labelledby={headingId} className={className}>
            <h3 id={headingId} className="type-heading text-xl text-tinta">
                Bloquear un día
            </h3>
            <p className="mt-2 max-w-[56ch] text-tinta-2">
                Elige el día y bloquéalo aquí, sin arrastrar sobre el calendario. El mismo botón lo deshace.
            </p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="sm:w-64">
                    <DatePicker label="Día que quieres bloquear" value={day} onChange={setDay} />
                </div>
                <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 w-full sm:w-auto"
                    /* El nombre accesible dice el día: "Bloquear" a secas no dice qué se bloquea. */
                    aria-label={hasDay ? `${verb} el día ${dayName}` : "Bloquear el día"}
                    /* Tampoco cuando todavía no leyó el día: el verbo sería una afirmación sin dato. */
                    disabled={!hasDay || isChecking}
                    onClick={() => setPending(isBlocked ? "unblock" : "block")}
                >
                    {isBlocked ? "Desbloquear el día" : "Bloquear el día"}
                </Button>
            </div>

            {failed && (
                <Alert variant="destructive" className="mt-4">
                    <AlertDescription>
                        No pudimos guardar el último cambio del calendario. Recarga la página e inténtalo de nuevo.
                    </AlertDescription>
                </Alert>
            )}

            {pending && (
                <div
                    className="fixed inset-0 z-50 grid place-items-center bg-fondo/85 p-4"
                    role="presentation"
                    onClick={() => setPending(null)}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={dialogTitleId}
                        aria-describedby={dialogDetailId}
                        className="w-full max-w-md bg-fondo-2 p-6 text-tinta shadow-[0_24px_64px_-16px_var(--fondo)]"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h3 id={dialogTitleId} className="type-heading text-2xl">
                            {dialogTitle}
                        </h3>
                        <p id={dialogDetailId} className="mt-4 bg-fondo px-4 py-3 font-medium tabular">
                            {dayName} · todo el día
                        </p>
                        <p className="mt-3 text-sm text-tinta-2">
                            {unblocking
                                ? "Ese día vuelve a contar como disponible."
                                : "Nadie podrá pedirte una fecha ese día. Puedes desbloquearlo cuando quieras."}
                        </p>
                        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button type="button" variant="ghost" onClick={() => setPending(null)} disabled={isSaving}>
                                Cancelar
                            </Button>
                            <Button type="button" onClick={confirm} disabled={isSaving} autoFocus>
                                {isSaving ? dialogActionBusy : dialogAction}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
