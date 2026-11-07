"use client";

import { useQuery } from "@tanstack/react-query";
import { bookingsService } from "../bookings.service";
import { toCheckoutNotesView } from "../checkoutNotes";
import type { EventRequestParty, EventRequestStatus } from "../types";

/** El texto del grupo cambia poco; una respuesta por minuto evita pedir lo mismo al abrir el hilo. */
const NOTES_STALE_MS = 60_000;

/**
 * Ronda 9: cómo pagar, junto al anticipo y el saldo, donde el cliente ya mira la plata. Solo lo lee
 * el cliente de un evento aceptado; el grupo no lo ve y un pedido pendiente todavía no tiene trato.
 *
 * <p>La app <b>no cobra</b>: no hay botón ni enlace dentro de la nota, solo lo que el grupo dijo
 * (D1/S18). Si la API no contesta, el bloque no está y el hilo sigue funcionando como antes.</p>
 */
export function CheckoutNotes({
    requestId,
    viewer,
    status,
}: {
    requestId: number;
    viewer: EventRequestParty;
    status: EventRequestStatus;
}) {
    const canRead = viewer === "Client" && status === "Accepted";
    const notes = useQuery({
        queryKey: ["checkout-notes", requestId],
        queryFn: () => bookingsService.checkoutNotes(requestId),
        enabled: canRead,
        retry: false,
        staleTime: NOTES_STALE_MS,
    });

    if (!canRead || !notes.isSuccess) return null;

    const view = toCheckoutNotesView(notes.data);
    if (view === null) return null;

    return (
        <section aria-label="Cómo pagar" className="md:col-span-12 rounded-xl bg-fondo-2 p-5">
            <ul className="flex flex-col gap-5">
                {view.notes.map((note) => (
                    <li key={note.title}>
                        <h3 className="type-heading text-lg text-tinta">{note.title}</h3>
                        {/* El texto del grupo se respeta tal cual, con sus saltos de línea. */}
                        <p className="mt-2 whitespace-pre-line leading-relaxed text-tinta">{note.body}</p>
                        {note.updated && <p className="mt-1 text-sm tabular text-tinta-2">{note.updated}</p>}
                    </li>
                ))}
            </ul>
            {/* Una sola vez para el bloque: la nota que dice quién cobra no se repite. */}
            {view.notice && <p className="mt-4 text-sm text-tinta-2">{view.notice}</p>}
        </section>
    );
}
