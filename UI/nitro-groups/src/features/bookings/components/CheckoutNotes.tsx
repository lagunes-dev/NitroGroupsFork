"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { bookingsService } from "../bookings.service";
import { conceptLine, paymentClipboardText, toCheckoutNotesView } from "../checkoutNotes";
import { nothingLeftToPay, paymentDueLabel } from "../deposit";
import type { EventRequest, EventRequestParty } from "../types";

/** El texto del grupo cambia poco; una respuesta por minuto evita pedir lo mismo al abrir el hilo. */
const NOTES_STALE_MS = 60_000;

/** Lo que se dijo después de pedir el texto: nunca se afirma que se copió si no se copió. */
type CopyState = "idle" | "copied" | "failed";

const COPY_LABEL = "Copiar los datos de pago";

function copyMessage(state: CopyState): string {
    if (state === "copied") return "Texto de pago copiado. Pégalo en tu banco.";
    if (state === "failed") return "No se pudo copiar. Selecciona el texto y cópialo a mano.";
    return "";
}

/**
 * Ronda 9: cómo pagar, junto al anticipo y el saldo, donde el cliente ya mira la plata. Solo lo lee
 * el cliente de un evento aceptado; el grupo no lo ve y un pedido pendiente todavía no tiene trato.
 *
 * <p>Ronda 10: una sola nota autoritativa. Cuando el grupo escribió, su texto es el único método y el
 * nombre del manager va en su propia línea; cuando no escribió, la nota dice con quién se acuerda y no
 * inventa un método. Con el trato saldado —saldo registrado como recibido o nada pendiente— el bloque
 * no se dibuja ni se pide: bajo "No queda nada por pagar" una CLABE es ruido.</p>
 *
 * <p>Ronda 11: la nota lleva una línea de concepto que arma la app desde el pedido (el texto del grupo
 * se sigue leyendo tal cual), y una sola acción que copia el texto completo. La app <b>no cobra</b>:
 * no hay botón ni enlace que pague, y ningún número del texto se vuelve un enlace, porque la app no
 * sabe qué número es la cuenta y cuál el teléfono (D1/S18).</p>
 *
 * <p>Ronda 12 (la clienta): el bloque se basta solo. El monto y el plazo vivían en un banner que quedaba
 * fuera de pantalla cuando ella llegaba a la acción de copiar, así que el bloque abre con la línea de
 * dinero del pedido —lo que falta en esta etapa del trato y para cuándo— armada por la app y nunca
 * leída del texto del grupo. Es información, no un método: el único control sigue siendo copiar.</p>
 */
export function CheckoutNotes({ request, viewer }: { request: EventRequest; viewer: EventRequestParty }) {
    const canRead = viewer === "Client" && request.status === "Accepted" && !nothingLeftToPay(request);
    const [copy, setCopy] = useState<CopyState>("idle");
    const notes = useQuery({
        queryKey: ["checkout-notes", request.id],
        queryFn: () => bookingsService.checkoutNotes(request.id),
        enabled: canRead,
        retry: false,
        staleTime: NOTES_STALE_MS,
    });

    if (!canRead || !notes.isSuccess) return null;

    const view = toCheckoutNotesView(notes.data);
    if (view === null) return null;

    const concept = conceptLine(request);
    const due = paymentDueLabel(request);
    const clipboardText = paymentClipboardText(view, concept, due);

    /** Copia el texto tal cual. Sin portapapeles —o si lo niega— se dice, no se finge. */
    const copyPaymentText = async () => {
        try {
            if (!navigator.clipboard) throw new Error("clipboard-unavailable");
            await navigator.clipboard.writeText(clipboardText);
            setCopy("copied");
        } catch {
            setCopy("failed");
        }
    };

    return (
        <section aria-label="Cómo pagar" className="md:col-span-12 rounded-xl bg-fondo-2 p-5">
            <ul className="flex flex-col gap-5">
                {view.notes.map((note) => (
                    <li key={note.title}>
                        <h3 className="type-heading text-lg text-tinta">{note.title}</h3>
                        {/* Ronda 12: cuánto y para cuándo, primero y sin método: el bloque se lee solo. */}
                        {due && <p className="mt-2 text-lg font-semibold tabular text-tinta">{due}</p>}
                        {/* El texto del grupo se respeta tal cual, con sus saltos de línea. */}
                        <p className="mt-2 whitespace-pre-line leading-relaxed text-tinta">{note.body}</p>
                        {/* Ronda 11: información, no control: qué pedido y qué evento es esta transferencia. */}
                        {concept && <p className="mt-1 text-tinta">{concept}</p>}
                        {note.managerLine && <p className="mt-1 text-tinta">{note.managerLine}</p>}
                        {note.updated && <p className="mt-1 text-sm tabular text-tinta-2">{note.updated}</p>}
                    </li>
                ))}
            </ul>
            {/* La única acción del bloque: copiar, nunca pagar. 44 px y alcanzable con el teclado. */}
            <div className="mt-5">
                <button
                    type="button"
                    onClick={copyPaymentText}
                    className="inline-flex min-h-11 items-center rounded-xl bg-fondo-3 px-4 font-semibold text-tinta hover:bg-fondo-2"
                >
                    {COPY_LABEL}
                </button>
                <p role="status" aria-live="polite" className="mt-2 text-sm text-tinta-2">
                    {copyMessage(copy)}
                </p>
            </div>
            {/* Una sola vez para el bloque: la nota que dice quién cobra no se repite. */}
            {view.notice && <p className="mt-4 text-sm text-tinta-2">{view.notice}</p>}
        </section>
    );
}
