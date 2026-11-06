"use client";

import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { bookingsService } from "@/features/bookings/bookings.service";
import Link from "next/link";
import { ROUTES } from "@/config/routes";
import { alreadyBooked } from "../alreadyBooked";

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

    const booked = alreadyBooked(requests.data, fecha);
    if (!booked) return null;

    const link = "text-acento underline-offset-4 hover:underline";
    return (
        <p className="mt-4 max-w-[70ch] text-sm text-tinta-2" role="note">
            <Link href={ROUTES.GROUPS.PUBLIC_PROFILE(booked.groupSlug)} className={link}>{booked.groupName}</Link>
            {booked.day ? ` ya toca para ti el ${booked.day}` : " ya toca para ti ese día"}, por eso no aparece en la lista.{" "}
            {booked.day && (
                <Link href={`/solicitudes/${booked.requestId}`} className={`${link} inline-flex min-h-11 items-center`}>
                    Ver mi pedido del {booked.day}
                </Link>
            )}
        </p>
    );
}
