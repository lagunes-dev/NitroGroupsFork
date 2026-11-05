import Link from "next/link";
import { eventTypeLabel } from "@/lib/eventTypeLabel";
import { formatEventDate, formatPrice } from "@/lib/format";
import type { EventRequest, EventRequestParty } from "../types";
import { StatusBadge } from "./StatusBadge";

/**
 * Request list. The client sees the group and the group sees the client. Every row carries the same
 * date, the same group and place, the same price field and the status as a chip with an icon.
 */
export function RequestList({ requests, viewer }: { requests: EventRequest[]; viewer: EventRequestParty }) {
    return (
        <ul className="flex flex-col">
            {requests.map((r) => {
                const who = viewer === "Client" ? r.groupName : r.clientName;
                const price = formatPrice(r.budget, r.currency);
                const what = [eventTypeLabel(r.eventType), r.locationText].filter(Boolean).join(" · ");
                return (
                    <li key={r.id} className="relative grid gap-x-6 gap-y-2 py-6 md:grid-cols-12 md:items-baseline [&+&]:shadow-[inset_0_1px_0_var(--fondo-3)]">
                        <p className="type-heading text-xl tabular first-letter:uppercase md:col-span-3">
                            {formatEventDate(r.eventDate) ?? "Fecha por definir"}
                        </p>
                        <div className="md:col-span-4">
                            <Link href={`/solicitudes/${r.id}${viewer === "Group" ? "?como=grupo" : ""}`} className="no-underline text-tinta font-semibold hover:text-acento after:absolute after:inset-0">
                                {who}
                            </Link>
                            {what && <p className="text-tinta-2">{what}</p>}
                            {viewer === "Group" && r.isSelfBooked && <span className="block text-sm text-tinta-2">Cargada por el grupo</span>}
                        </div>
                        <p className="tabular md:col-span-2">
                            <span className={price ? "block text-tinta" : "block text-tinta-2"}>{price ?? "Sin presupuesto"}</span>
                            <span className="block text-sm text-tinta-2">{r.durationHours} h</span>
                        </p>
                        <div className="md:col-span-3 md:justify-self-end">
                            <StatusBadge status={r.status} />
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
