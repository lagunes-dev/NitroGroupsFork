"use client";

import { Alert, AlertDescription, Button } from "@/components/ui";
import { compareGigsByDate } from "../agenda";
import { useGroupGigs } from "../gigs.queries";
import { attendanceCountLabel, attendeeSummary, declinedLabel, unansweredLabel } from "../groupAgenda";
import type { GroupGigPayload } from "../types";
import { scheduleLabel, toGigView } from "../viewModel";

function GigRow({ row }: { row: GroupGigPayload }) {
    const view = toGigView(row);
    const summary = attendeeSummary(row.attendees);
    return (
        <li className="grid gap-x-6 gap-y-2 py-5 md:grid-cols-12 md:items-baseline [&+&]:shadow-[inset_0_1px_0_var(--fondo-3)]">
            <p className="type-heading text-lg tabular first-letter:uppercase md:col-span-4">{view.dateLabel}</p>
            <div className="md:col-span-4">
                <p className="text-tinta">{view.placeLabel}</p>
                <p className="tabular text-sm text-tinta-2">{scheduleLabel(view)}</p>
            </div>
            <div className="md:col-span-4">
                <p className="font-semibold text-tinta">{attendanceCountLabel(summary)}</p>
                {summary.names.length > 0 && <p className="text-sm text-tinta-2">{summary.names.join(", ")}</p>}
                {declinedLabel(summary) && <p className="text-sm text-error">{declinedLabel(summary)}</p>}
                {unansweredLabel(summary) && <p className="text-sm text-tinta-2">{unansweredLabel(summary)}</p>}
            </div>
        </li>
    );
}

/** Compact placeholder: the section is short, so the skeleton is two thin rows. */
function GroupGigSkeleton() {
    return (
        <ul aria-hidden className="mt-6 flex flex-col">
            {[0, 1].map((index) => (
                <li key={index} className="grid gap-4 py-5 md:grid-cols-12">
                    <div className="h-5 w-2/3 rounded bg-fondo-3 motion-safe:animate-pulse md:col-span-4" />
                    <div className="h-4 w-1/2 rounded bg-fondo-3 motion-safe:animate-pulse md:col-span-4" />
                    <div className="h-4 w-2/3 rounded bg-fondo-3 motion-safe:animate-pulse md:col-span-4" />
                </li>
            ))}
        </ul>
    );
}

/**
 * "Agenda" tab of the manager: the group's confirmed gigs, ordered by date, with how many members
 * answered and the names of those who confirmed (the API never sends an email here).
 */
export function GroupAgenda({ groupId }: { groupId: number }) {
    const gigs = useGroupGigs(groupId);

    return (
        <section aria-labelledby="agenda-grupo-titulo" className="py-10">
            <h3 id="agenda-grupo-titulo" className="type-heading text-2xl">
                Toques confirmados
            </h3>
            <p className="mt-2 max-w-[62ch] text-tinta-2">
                Las fechas que ya aceptaste, con lo que respondió tu equipo. Cada músico confirma en su propia agenda.
            </p>

            {gigs.isPending ? (
                <div aria-busy>
                    <span role="status" className="sr-only">
                        Cargando la agenda del grupo…
                    </span>
                    <GroupGigSkeleton />
                </div>
            ) : gigs.isError ? (
                <div className="mt-6">
                    <Alert variant="destructive">
                        <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            No pudimos cargar la agenda del grupo.
                            <Button variant="outline" className="h-11 sm:h-10" onClick={() => gigs.refetch()}>
                                Reintentar
                            </Button>
                        </AlertDescription>
                    </Alert>
                </div>
            ) : gigs.data.length === 0 ? (
                <p className="mt-6 text-tinta-2">
                    Todavía no hay toques confirmados. Cuando aceptes un pedido de fecha, aparece aquí con la asistencia
                    de tus músicos.
                </p>
            ) : (
                <ul className="mt-6 flex flex-col">
                    {[...gigs.data].sort(compareGigsByDate).map((row) => (
                        <GigRow key={row.id} row={row} />
                    ))}
                </ul>
            )}
        </section>
    );
}
