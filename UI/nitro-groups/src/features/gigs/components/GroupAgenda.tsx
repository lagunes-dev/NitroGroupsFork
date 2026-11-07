"use client";

import { useRef, useState } from "react";
import { Alert, AlertDescription, Badge, Button } from "@/components/ui";
import { depositLabel, receivedDate } from "@/features/bookings/deposit";
import { compareGigsByDate } from "../agenda";
import { useGroupGigNotices, useGroupGigs } from "../gigs.queries";
import { attendeePayLines } from "../gigLogistics";
import { attendanceCountLabel, attendeeSummary, declinedLabel, unansweredLabel } from "../groupAgenda";
import { noticesByGig, type NoticePayload } from "../notices";
import type { GroupGigPayload } from "../types";
import { callTimeLabel, scheduleLabel, toGigView } from "../viewModel";
import { GigEditor } from "./GigEditor";
import { NoticeLines } from "./GigNotices";

function GigRow({ row, groupId, notices }: { row: GroupGigPayload; groupId: number; notices: readonly NoticePayload[] }) {
    const view = toGigView(row);
    const summary = attendeeSummary(row.attendees);
    const deposit = depositLabel(row.deposit);
    const pays = attendeePayLines(row.attendees);
    const balanceDate = row.balanceReceivedAt ? receivedDate(row.balanceReceivedAt) : null;
    const balance = row.balanceReceivedAt ? (balanceDate ? `Saldo recibido el ${balanceDate}` : "Saldo recibido") : null;
    const [editing, setEditing] = useState(false);
    const [notice, setNotice] = useState("");
    const editButton = useRef<HTMLButtonElement>(null);
    const panelId = `toque-${view.id}-editor`;

    return (
        <li className="grid gap-x-6 gap-y-2 py-5 md:grid-cols-12 md:items-baseline [&+&]:shadow-[inset_0_1px_0_var(--fondo-3)]">
            <p className="type-heading text-lg tabular first-letter:uppercase md:col-span-4">{view.dateLabel}</p>
            <div className="md:col-span-4">
                <p className="text-tinta">{view.placeLabel}</p>
                <p className="tabular text-sm text-tinta-2">
                    {scheduleLabel(view)}
                    {callTimeLabel(row.callTime) && <span> · {callTimeLabel(row.callTime)}</span>}
                </p>
                {(deposit || balance) && (
                    <div className="mt-2 flex flex-wrap gap-2">
                        {deposit && <Badge variant="secondary">{deposit}</Badge>}
                        {balance && <Badge variant="secondary">{balance}</Badge>}
                    </div>
                )}
            </div>
            <div className="md:col-span-4">
                <p className="font-semibold text-tinta">{attendanceCountLabel(summary)}</p>
                {summary.names.length > 0 && <p className="text-sm text-tinta-2">{summary.names.join(", ")}</p>}
                {declinedLabel(summary) && <p className="text-sm text-error">{declinedLabel(summary)}</p>}
                {unansweredLabel(summary) && <p className="text-sm text-tinta-2">{unansweredLabel(summary)}</p>}
                {pays.length > 0 && <p className="text-sm text-tinta-2">Pagos: {pays.join(" · ")}</p>}
                {/* S12: lo que el músico avisó. Sin avisos no se dibuja nada. */}
                <NoticeLines notices={notices} />
            </div>

            <div className="md:col-span-12">
                <Button
                    ref={editButton}
                    type="button"
                    variant="outline"
                    className="h-11 sm:h-10"
                    aria-expanded={editing}
                    aria-controls={panelId}
                    aria-label={`Editar toque ${view.dateLabel}`}
                    onClick={() => {
                        setNotice("");
                        setEditing((open) => !open);
                    }}
                >
                    Editar toque
                </Button>
                {/* Outside the panel on purpose: the panel closes after saving and the live region must stay mounted. */}
                <p role="status" aria-live="polite" className={notice ? "mt-2 text-sm text-ok" : "sr-only"}>
                    {notice}
                </p>
            </div>

            {editing && (
                <div id={panelId} className="md:col-span-12">
                    <GigEditor
                        row={row}
                        groupId={groupId}
                        idPrefix={`toque-${view.id}`}
                        onCancel={() => {
                            setEditing(false);
                            setTimeout(() => editButton.current?.focus(), 0);
                        }}
                        onSaved={() => {
                            setEditing(false);
                            setNotice(`Guardamos los cambios del toque del ${view.dateLabel}.`);
                            setTimeout(() => editButton.current?.focus(), 0);
                        }}
                    />
                </div>
            )}
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
    // Los avisos van aparte: si la consulta falla, la agenda queda exactamente como estaba.
    const notices = useGroupGigNotices(groupId);
    const byGig = noticesByGig(notices.data);

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
                        <GigRow key={row.id} row={row} groupId={groupId} notices={byGig[Number(row.id)] ?? []} />
                    ))}
                </ul>
            )}
        </section>
    );
}
