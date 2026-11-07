"use client";

import { useId } from "react";
import { Button } from "@/components/ui/Button";
import { useConfirmedGigDayRead } from "@/features/gigs/gigs.queries";
import { gigNoteText, rangeGigFact } from "../blockDay";
import { formatRangeLabel } from "./formatRange";

interface BlockSlotDialogProps {
    groupId: number;
    /** The dragged interval, exactly as the calendar handed it over. */
    start: string;
    end: string;
    isSaving: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}

/**
 * The dialog the drag path opens over the week grid.
 *
 * Ronda 11: dragging over a day with a confirmed gig said nothing, while the same day through the day
 * form said "Ese día ya tienes un toque confirmado. Bloquearlo no lo cancela." One rule, two doors. The
 * dialog reads the agenda with the same hook the day form reads it with, and asks `rangeGigFact` what can
 * be said about the hours the manager dragged, so there is no second copy of the rule or of the words.
 *
 * It states the fact; it does not forbid. A manager may have a reason to block that night anyway, so the
 * action stays available and nothing is validated here.
 */
export function BlockSlotDialog({ groupId, start, end, isSaving, onCancel, onConfirm }: BlockSlotDialogProps) {
    const titleId = useId();
    const rangeId = useId();
    const gigNoteId = useId();
    const gigDays = useConfirmedGigDayRead(groupId);

    const read = { days: gigDays.days, failed: gigDays.failed };
    const fact = gigDays.isReading ? "reading" : rangeGigFact(start, end, read);
    const gigNote = gigNoteText(fact);

    return (
        <div
            className="fixed inset-0 z-50 grid place-items-center bg-fondo/85 p-4"
            role="presentation"
            onClick={onCancel}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={gigNote ? `${rangeId} ${gigNoteId}` : rangeId}
                className="w-full max-w-md bg-fondo-2 p-6 text-tinta shadow-[0_24px_64px_-16px_var(--fondo)]"
                onClick={(event) => event.stopPropagation()}
            >
                <h3 id={titleId} className="type-heading text-2xl">
                    Bloquear este horario
                </h3>
                <p id={rangeId} className="mt-4 bg-fondo px-4 py-3 font-medium tabular">
                    {formatRangeLabel(start, end)}
                </p>
                <p className="mt-3 text-sm text-tinta-2">
                    Nadie podrá pedirte una fecha en ese horario. Puedes quitar el bloque cuando quieras.
                </p>
                {gigNote && (
                    <p id={gigNoteId} aria-live="polite" className="mt-3 text-sm text-tinta">
                        {gigNote}
                    </p>
                )}
                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="ghost" className="min-h-11" onClick={onCancel} disabled={isSaving}>
                        Cancelar
                    </Button>
                    <Button type="button" className="min-h-11" onClick={onConfirm} disabled={isSaving} autoFocus>
                        {isSaving ? "Bloqueando…" : "Bloquear horario"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
