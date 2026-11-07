"use client";

import { useId } from "react";
import { Button } from "@/components/ui/Button";
import { todayInMexico } from "@/lib/format";
import { PAST_DAY_NOTE, pastRangeRefusal } from "../blockDay";
import { formatRangeLabel } from "./formatRange";

interface MoveBlockDialogProps {
    /** The block's own title ("Ensayo", "No disponible"), so the question names what it moves. */
    title: string;
    /** Where the block is right now. */
    from: { start: string; end: string };
    /** Where the manager dropped it. */
    to: { start: string; end: string };
    isSaving: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}

/**
 * The question a drag asks (round 12).
 *
 * The manager reported: "Moving a block writes instantly, no confirm, no undo". So the drag no longer
 * writes: it reverts the grid and opens this, in the same shape and the same voice as `BlockSlotDialog`
 * — the other dialog of the same calendar. It says what moves, where it is and where it would go, because
 * a question that only says "move?" cannot be answered with confidence.
 *
 * A destination that already passed is refused with the day form's own sentence and the action is turned
 * off: that decision nobody can carry out. Moving a block that is already in the past stays possible, as
 * long as its destination is not behind today.
 */
export function MoveBlockDialog({ title, from, to, isSaving, onCancel, onConfirm }: MoveBlockDialogProps) {
    const titleId = useId();
    const detailId = useId();
    const pastNoteId = useId();

    const pastNote = pastRangeRefusal(to.start, to.end, todayInMexico());

    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-fondo/85 p-4" role="presentation" onClick={onCancel}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={pastNote ? `${detailId} ${pastNoteId}` : detailId}
                className="w-full max-w-md bg-fondo-2 p-6 text-tinta shadow-[0_24px_64px_-16px_var(--fondo)]"
                onClick={(event) => event.stopPropagation()}
            >
                <h3 id={titleId} className="type-heading text-2xl">
                    Mover este bloque
                </h3>
                <div id={detailId} className="mt-4 flex flex-col gap-1 bg-fondo px-4 py-3">
                    <p className="font-medium">{title}</p>
                    <p className="tabular text-sm text-tinta-2">Ahora: {formatRangeLabel(from.start, from.end)}</p>
                    <p className="tabular text-sm">Después: {formatRangeLabel(to.start, to.end)}</p>
                </div>
                <p className="mt-3 text-sm text-tinta-2">El bloque no se mueve hasta que lo confirmes.</p>
                {pastNote && (
                    <p id={pastNoteId} aria-live="polite" className="mt-3 text-sm text-tinta">
                        {PAST_DAY_NOTE}
                    </p>
                )}
                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="ghost" className="min-h-11" onClick={onCancel} disabled={isSaving}>
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        className="min-h-11"
                        onClick={onConfirm}
                        disabled={isSaving || pastNote !== null}
                        /* La razón de que esté apagado se lee como su descripción, no como un texto suelto. */
                        aria-describedby={pastNote ? pastNoteId : undefined}
                        autoFocus
                    >
                        {isSaving ? "Moviendo…" : "Mover bloque"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
