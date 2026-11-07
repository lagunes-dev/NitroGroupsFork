"use client";

import { useQuery } from "@tanstack/react-query";
import { bookingsService } from "../bookings.service";
import { RequestList } from "./RequestList";

/** Bandeja del grupo: primero lo que espera respuesta, después el resto. */
export function GroupInbox({ groupId }: { groupId: number }) {
    const requests = useQuery({ queryKey: ["event-requests", "group", groupId], queryFn: () => bookingsService.forGroup(groupId) });

    if (requests.isPending) return <p className="text-tinta-2 py-10" aria-busy>Cargando pedidos de fecha…</p>;
    if (requests.isError) return <p role="alert" className="text-error py-10">No pudimos cargar los pedidos de fecha. Recarga la página en un momento.</p>;

    const pending = requests.data.filter((r) => r.status === "Pending");
    const rest = requests.data.filter((r) => r.status !== "Pending");

    if (requests.data.length === 0) {
        return (
            <div className="py-10 max-w-[56ch]">
                <p className="type-heading text-2xl">Aún no tienes pedidos de fecha</p>
                <p className="mt-2 text-tinta">Cuando un cliente te pida una fecha, el pedido aparece aquí y te avisamos por email.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-12 py-6">
            {pending.length > 0 && (
                <section aria-labelledby="por-responder">
                    <h3 id="por-responder" className="type-heading text-2xl">Por responder</h3>
                    <RequestList requests={pending} viewer="Group" />
                </section>
            )}
            {rest.length > 0 && (
                <section aria-labelledby="historial">
                    <h3 id="historial" className="type-heading text-2xl text-tinta-2">Historial</h3>
                    <RequestList requests={rest} viewer="Group" />
                </section>
            )}
        </div>
    );
}
