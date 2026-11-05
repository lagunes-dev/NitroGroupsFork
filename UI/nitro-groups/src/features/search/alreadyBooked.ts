import type { EventRequest } from "@/features/bookings/types";
import { formatEventDate } from "@/lib/format";

/**
 * S16: cuando el buscador esconde un grupo porque ya tienes un toque aceptado con él ese día, la
 * pantalla lo dice en una línea. Esconderlo sin explicación se lee como que la app se equivocó.
 *
 * Devuelve null cuando no hay nada que explicar: sin fecha, sin sesión o sin toque aceptado.
 */
export function alreadyBookedLabel(requests: EventRequest[] | null | undefined, fecha: string | null | undefined): string | null {
    if (!requests || !fecha) return null;

    const booked = requests.find(
        (request) => request.status === "Accepted" && request.eventDate === fecha && Boolean(request.groupName)
    );
    if (!booked) return null;

    const day = formatEventDate(fecha);
    return day
        ? `${booked.groupName} ya toca para ti el ${day}, por eso no aparece en la lista.`
        : `${booked.groupName} ya toca para ti ese día, por eso no aparece en la lista.`;
}
