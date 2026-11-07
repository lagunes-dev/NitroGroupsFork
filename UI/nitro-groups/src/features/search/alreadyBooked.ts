import type { EventRequest } from "@/features/bookings/types";
import { formatEventDate } from "@/lib/format";

/** The pieces of the S16 note, so the component can link the group and the request. */
export interface AlreadyBooked {
    groupName: string;
    groupSlug: string;
    requestId: number;
    /** "jueves, 19 de noviembre de 2026"; null when the date cannot be written. */
    day: string | null;
}

/**
 * S16: cuando el buscador esconde un grupo porque ya tienes un toque aceptado con él ese día, la
 * pantalla lo dice en una línea. Esconderlo sin explicación se lee como que la app se equivocó.
 *
 * Devuelve null cuando no hay nada que explicar: sin fecha, sin sesión o sin toque aceptado.
 */
export function alreadyBooked(requests: EventRequest[] | null | undefined, fecha: string | null | undefined): AlreadyBooked | null {
    if (!requests || !fecha) return null;

    const booked = requests.find(
        (request) => request.status === "Accepted" && request.eventDate === fecha && Boolean(request.groupName)
    );
    if (!booked) return null;

    return { groupName: booked.groupName, groupSlug: booked.groupSlug, requestId: booked.id, day: formatEventDate(fecha) };
}
