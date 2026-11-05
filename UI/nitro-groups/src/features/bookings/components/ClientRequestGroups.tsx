import type { EventRequest } from "../types";
import { groupClientRequests } from "../order";
import { RequestList } from "./RequestList";
import { StatusBadge } from "./StatusBadge";

/**
 * "Mis pedidos" grouped by status with a count per group: the client sees what is pending and what
 * has been answered without reading every row. Inside a group the closest event comes first.
 */
export function ClientRequestGroups({ requests, today }: { requests: EventRequest[]; today: string }) {
    const groups = groupClientRequests(requests, today);

    return (
        <div className="flex flex-col gap-12">
            {groups.map((group, index) => (
                <section key={group.status} aria-labelledby={`estado-${index}`}>
                    <h2 id={`estado-${index}`} className="flex items-center gap-3">
                        <StatusBadge status={group.status} className="text-base" />
                        <span className="text-base font-normal text-tinta-2 tabular">({group.requests.length})</span>
                    </h2>
                    <RequestList requests={group.requests} viewer="Client" />
                </section>
            ))}
        </div>
    );
}
