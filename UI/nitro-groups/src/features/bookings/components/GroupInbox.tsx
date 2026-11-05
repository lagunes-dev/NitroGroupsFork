import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { bookingsService } from "../bookings.service";
import { compareByCreatedAtAsc } from "../order";
import { pendingRequestsLine } from "../summary";
import { RequestList } from "./RequestList";

/**
 * Group inbox: on top what waits for an answer — the request that has waited longest first —
 * and below the history, collapsed, each part with its own count.
 */
export function GroupInbox({ groupId }: { groupId: number }) {
    const requests = useQuery({ queryKey: ["event-requests", "group", groupId], queryFn: () => bookingsService.forGroup(groupId) });

    const all = requests.data ?? [];
    const pending = all.filter((r) => r.status === "Pending").sort(compareByCreatedAtAsc);
    const rest = all.filter((r) => r.status !== "Pending");

    return (
        <div className="flex flex-col gap-12 py-6">
            {/* The count shows up when the inbox arrives: it is read aloud at that point. */}
            <p role="status" aria-live="polite" className="sr-only">
                {requests.isSuccess ? pendingRequestsLine(pending.length, all.length) : ""}
            </p>

            {requests.isPending && <p className="text-tinta-2" aria-busy>Cargando pedidos de fecha…</p>}
            {requests.isError && <p role="alert" className="text-error">No pudimos cargar los pedidos de fecha. Recarga la página en un momento.</p>}

            {requests.isSuccess && all.length === 0 && (
                <div className="max-w-[56ch]">
                    <p className="type-heading text-2xl">Aún no tienes pedidos de fecha</p>
                    <p className="mt-2 text-tinta">Cuando un cliente te pida una fecha, el pedido aparece aquí y te avisamos por email.</p>
                </div>
            )}

            {requests.isSuccess && all.length > 0 && (
                <>
                    <section aria-labelledby="por-responder">
                        <h3 id="por-responder" className="type-heading text-2xl">
                            Por responder <span className="tabular text-tinta-2">({pending.length})</span>
                        </h3>
                        {pending.length > 0 ? (
                            <RequestList requests={pending} viewer="Group" />
                        ) : (
                            <p className="mt-4 max-w-[56ch] text-tinta-2">Nada por responder: ningún pedido espera tu respuesta.</p>
                        )}
                    </section>

                    {rest.length > 0 && (
                        <details className="group">
                            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-[8px] py-1 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento [&::-webkit-details-marker]:hidden">
                                <h3 className="type-heading text-2xl text-tinta-2">
                                    Historial <span className="tabular">({rest.length})</span>
                                </h3>
                                <ChevronRight aria-hidden className="size-5 shrink-0 text-tinta-2 transition-transform group-open:rotate-90 motion-reduce:transition-none" />
                            </summary>
                            <div className="mt-4">
                                <RequestList requests={rest} viewer="Group" />
                            </div>
                        </details>
                    )}
                </>
            )}
        </div>
    );
}
