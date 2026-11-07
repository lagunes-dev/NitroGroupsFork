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
 * <p>Ronda 10: una sola nota autoritativa. Cuando el grupo escribió, su texto es el único método y el
 * nombre del manager va en su propia línea; cuando no escribió, la nota dice con quién se acuerda y no
 * inventa un método. Con el trato saldado —saldo registrado como recibido o nada pendiente— el bloque
 * no se dibuja ni se pide: bajo "No queda nada por pagar" una CLABE es ruido.</p>
 *
 * <p>La app <b>no cobra</b>: no hay botón ni enlace dentro de la nota, solo lo que el grupo dijo
 * (D1/S18). Si la API no contesta, el bloque no está y el hilo sigue funcionando como antes.</p>
 */
export function CheckoutNotes({
    requestId,
    viewer,
    status,
    settled,
}: {
    requestId: number;
    viewer: EventRequestParty;
    status: EventRequestStatus;
    /** true cuando no queda nada por pagar: la misma regla que la línea del saldo. */
    settled: boolean;
}) {
    const canRead = viewer === "Client" && status === "Accepted" && !settled;
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
                        {note.managerLine && <p className="mt-1 text-tinta">{note.managerLine}</p>}
                        {note.updated && <p className="mt-1 text-sm tabular text-tinta-2">{note.updated}</p>}
                    </li>
                ))}
            </ul>
            {/* Una sola vez para el bloque: la nota que dice quién cobra no se repite. */}
            {view.notice && <p className="mt-4 text-sm text-tinta-2">{view.notice}</p>}
        </section>
    );
}
