"use client";

import { useEffect, useId, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { useConfirmedGigDayRead } from "@/features/gigs/gigs.queries";
import { isIsoDate } from "@/lib/format";
import { confirmedGigFact, longDayName, shortDayName, type DayGigFact } from "../blockDay";
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
 *
 * Ronda 10: los días con toque confirmado salen de la agenda del grupo, que el control lee por su
 * cuenta. Antes llegaban por prop y solo la pestaña del calendario se acordaba de pasarlos, así que el
 * mismo diálogo decía dos cosas distintas según dónde se abriera. Tampoco basta con leerlos una vez: el
 * diálogo muestra un estado propio —todavía comprobando, el toque, ninguno o no se pudo comprobar— y el
 * hecho se fija en cuanto se conoce, así que no se cae mientras el manager lo está leyendo.
 */
export function BlockDayControl({ groupId, initialDay, className }: BlockDayControlProps) {
    const headingId = useId();
    const dialogTitleId = useId();
    const dialogDetailId = useId();
    const gigNoteId = useId();
    const [day, setDay] = useState(initialDay);
    const [pending, setPending] = useState<PendingChange | null>(null);
    /* El hecho que el diálogo abierto muestra. `null` = la agenda todavía no contestó. */
    const [gigFact, setGigFact] = useState<DayGigFact | null>(null);
    const { isBlocked, isChecking, isSaving, failed, block, unblock } = useDayBlock({ groupId, day });
    const gigDays = useConfirmedGigDayRead(groupId);

    const dayName = longDayName(day);
    const shortName = shortDayName(day);
    const hasDay = isIsoDate(day) && dayName !== null;
    const verb = isBlocked ? "Desbloquear" : "Bloquear";
    /* Ronda 9: la etiqueta visible nombra el día, corto. Antes el día vivía solo en el aria-label, y un
       botón que dice "Bloquear el día" no dice cuál. Sin día legible sigue la etiqueta genérica. */
    const visibleLabel = hasDay && shortName ? `${verb} el ${shortName}` : `${verb} el día`;
    const unblocking = pending === "unblock";
    const dialogTitle = unblocking ? "Desbloquear este día" : "Bloquear este día";
    const dialogAction = unblocking ? "Desbloquear día" : "Bloquear día";
    const dialogActionBusy = unblocking ? "Desbloqueando…" : "Bloqueando…";
    /*
     * El hecho, no una traba: el manager puede tener un motivo para bloquear igual un día con toque. Y
     * solo al bloquear, porque desbloquear abre el día y ahí la coincidencia no dice nada.
     */
    const read = { days: gigDays.days, failed: gigDays.failed };
    const gigNote = unblocking ? "none" : (gigFact ?? (gigDays.isReading ? "reading" : confirmedGigFact(day, read)));
    const showGigNote = gigNote !== "none";

    useEffect(() => {
        if (!pending) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setPending(null);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [pending]);

    /*
     * Cuando la agenda contesta con el diálogo ya abierto, el hecho se fija una sola vez: de ahí en
     * adelante ya no cambia, ni aunque la consulta se vuelva a hacer (ronda 10). Es un ajuste de estado
     * durante el render, no un efecto: React lo soporta para derivar estado de lo que acaba de llegar, y
     * el efecto equivalente está prohibido por `react-hooks/set-state-in-effect`. La condición lo corta
     * en la primera pasada, así que no hay bucle.
     */
    if (pending && gigFact === null && !gigDays.isReading) {
        setGigFact(confirmedGigFact(day, { days: gigDays.days, failed: gigDays.failed }));
    }

    /** Abre el diálogo con el hecho ya leído cuando la agenda ya contestó. */
    const openDialog = () => {
        setGigFact(gigDays.isReading ? null : confirmedGigFact(day, read));
        setPending(isBlocked ? "unblock" : "block");
    };

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
                    /*
                     * Tampoco cuando todavía no leyó el día: el verbo sería una afirmación sin dato. Los
                     * toques confirmados no traban el bloqueo —son un hecho, no una prohibición—, así que
                     * la agenda se cuenta dentro del diálogo y no deshabilitando el control.
                     */
                    disabled={!hasDay || isChecking}
                    onClick={openDialog}
                >
                    {visibleLabel}
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
                        aria-describedby={showGigNote ? `${dialogDetailId} ${gigNoteId}` : dialogDetailId}
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
                        {showGigNote && (
                            <p id={gigNoteId} aria-live="polite" className="mt-3 text-sm text-tinta">
                                {gigNote === "confirmed"
                                    ? "Ese día ya tienes un toque confirmado. Bloquearlo no lo cancela."
                                    : gigNote === "unknown"
                                      ? "No pudimos comprobar si ese día ya tienes un toque."
                                      : "Comprobando si ese día ya tienes un toque…"}
                            </p>
                        )}
                        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button type="button" variant="ghost" className="min-h-11" onClick={() => setPending(null)} disabled={isSaving}>
                                Cancelar
                            </Button>
                            <Button type="button" className="min-h-11" onClick={confirm} disabled={isSaving} autoFocus>
                                {isSaving ? dialogActionBusy : dialogAction}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
