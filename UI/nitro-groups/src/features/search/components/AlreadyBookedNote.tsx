"use client";

import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { bookingsService } from "@/features/bookings/bookings.service";
import { alreadyBookedLabel } from "../alreadyBooked";

/**
 * S16: la búsqueda por fecha esconde a los grupos con los que ya tienes un toque aceptado ese día.
 * Esta línea explica el hueco en vez de dejar que parezca un error. Sin sesión, sin fecha o sin
 * toque aceptado no dibuja nada; si la consulta falla, tampoco: es una aclaración, no el trabajo.
 */
export function AlreadyBookedNote({ fecha }: { fecha?: string | null }) {
    const { user } = useCurrentUser();
    const requests = useQuery({
        queryKey: ["my-event-requests"],
        queryFn: () => bookingsService.mine(),
        enabled: Boolean(user) && Boolean(fecha),
        retry: false,
        staleTime: 60_000,
    });

    if (!user || !fecha || !requests.isSuccess) return null;

    const label = alreadyBookedLabel(requests.data, fecha);
    if (!label) return null;

    return (
        <p className="mt-4 max-w-[70ch] text-sm text-tinta-2" role="note">
            {label}
        </p>
    );
}
