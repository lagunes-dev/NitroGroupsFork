"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ROUTES } from "@/config/routes";
import { bookingsService } from "@/features/bookings/bookings.service";
import { RequestList } from "@/features/bookings/components/RequestList";

export default function ClientDashboardPage() {
    const requests = useQuery({ queryKey: ["event-requests", "mine"], queryFn: bookingsService.mine });

    return (
        <div className="page-frame pt-12 md:pt-16">
            <div className="flex flex-wrap items-end justify-between gap-6">
                <h1 className="titulo">Mis pedidos</h1>
                <Link href={ROUTES.GROUPS.SEARCH} className="h-12 inline-flex items-center px-6 bg-acento text-acento-ink rounded-lg font-semibold no-underline hover:bg-acento-press">
                    Buscar otro grupo
                </Link>
            </div>

            <div className="mt-12">
                {requests.isPending && <p className="text-tinta-2" aria-busy>Cargando tus solicitudes…</p>}
                {requests.isError && (
                    <p role="alert" className="text-error">No pudimos cargar tus solicitudes. Recarga la página en un momento.</p>
                )}
                {requests.data?.length === 0 && (
                    <div className="max-w-[56ch]">
                        <p className="type-heading text-3xl">Todavía no pediste ninguna fecha</p>
                        <p className="mt-3 text-lg text-tinta">
                            Busca un grupo por música, ciudad y fecha, y envíale tu solicitud desde su perfil. Aquí vas a ver sus respuestas.
                        </p>
                    </div>
                )}
                {requests.data && requests.data.length > 0 && <RequestList requests={requests.data} viewer="Client" />}
            </div>
        </div>
    );
}
