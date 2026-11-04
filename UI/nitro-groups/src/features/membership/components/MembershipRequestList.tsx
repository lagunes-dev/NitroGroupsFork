"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription, Button } from "@/components/ui";
import { membershipService } from "../membership.service";
import { membershipErrorMessage } from "../errors";
import { availableActions, directionLabel } from "../status";
import type { MembershipRequest } from "../types";
import { RequestCard, RequestGroup, RequestSkeleton } from "./RequestCard";

type Action = "accept" | "decline" | "cancel";

const DONE: Record<Action, string> = {
    accept: "Aceptaste la solicitud de",
    decline: "Rechazaste la solicitud de",
    cancel: "Cancelaste la invitación a",
};

/** Invitaciones enviadas y solicitudes recibidas: lo pendiente arriba, el resto como historial. */
export function MembershipRequestList({ groupId }: { groupId: number }) {
    const queryClient = useQueryClient();
    const announceRef = useRef<HTMLParagraphElement>(null);
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");

    const requests = useQuery({ queryKey: ["membership-requests", groupId], queryFn: () => membershipService.forGroup(groupId) });

    const respond = useMutation({
        mutationFn: ({ action, request }: { action: Action; request: MembershipRequest }) => membershipService[action](request.id),
        onSuccess: (_data, { action, request }) => {
            setError("");
            setNotice(`${DONE[action]} ${request.counterpartName}.`);
            // El botón pulsado desaparece de la lista: el foco pasa al aviso para no perderlo.
            announceRef.current?.focus();
        },
        onError: (e) => {
            setNotice("");
            setError(membershipErrorMessage(e, "No pudimos completar la acción. Inténtalo de nuevo."));
        },
        // También tras un error: un 404/409 casi siempre significa que la lista quedó vieja.
        onSettled: () => queryClient.invalidateQueries({ queryKey: ["membership-requests", groupId] }),
    });

    if (requests.isPending) return (
        <div aria-busy>
            <span className="sr-only" role="status">Cargando invitaciones y solicitudes…</span>
            <RequestSkeleton />
        </div>
    );
    if (requests.isError) return (
        <div role="alert" className="superficie rounded-[12px] px-6 py-8 text-center text-error">
            No pudimos cargar las invitaciones y solicitudes. Recarga la página en un momento.
        </div>
    );

    const pending = requests.data.filter((r) => r.status === "Pending");
    const rest = requests.data.filter((r) => r.status !== "Pending");
    const onAction = (action: Action, request: MembershipRequest) => respond.mutate({ action, request });

    return (
        <div className="flex flex-col gap-6">
            <p ref={announceRef} tabIndex={-1} role="status" className="text-tinta outline-none empty:hidden">{notice}</p>
            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {requests.data.length === 0 ? (
                <div className="superficie rounded-[12px] px-6 py-10 text-center">
                    <p className="mx-auto max-w-[48ch] text-tinta-2">Aún no hay invitaciones ni solicitudes. Invita a un músico desde la búsqueda o espera a que alguien pida unirse.</p>
                </div>
            ) : (
                <>
                    {pending.length > 0 ? (
                        <RequestGroup id="equipo-pendientes" title="Pendientes" count={pending.length}>
                            <Rows rows={pending} busy={respond.isPending} onAction={onAction} />
                        </RequestGroup>
                    ) : (
                        <p className="text-tinta-2">No hay invitaciones ni solicitudes pendientes.</p>
                    )}
                    {rest.length > 0 && (
                        <RequestGroup id="equipo-historial" title="Historial" count={rest.length} collapsible>
                            <Rows rows={rest} busy={respond.isPending} onAction={onAction} />
                        </RequestGroup>
                    )}
                </>
            )}
        </div>
    );
}

function Rows({ rows, busy, onAction }: {
    rows: MembershipRequest[];
    busy: boolean;
    onAction: (action: Action, request: MembershipRequest) => void;
}) {
    return (
        <ul className="flex flex-col gap-4">
            {rows.map((r) => {
                const actions = availableActions(r);
                return (
                    <RequestCard
                        key={r.id}
                        name={r.counterpartName}
                        title={r.counterpartName}
                        direction={directionLabel(r.direction)}
                        createdAt={r.createdAt}
                        status={r.status}
                        message={r.message}
                        actions={
                            actions.accept || actions.decline || actions.cancel ? (
                                <>
                                    {actions.accept && (
                                        <Button size="sm" disabled={busy} onClick={() => onAction("accept", r)} aria-label={`Aceptar solicitud de ${r.counterpartName}`}>Aceptar</Button>
                                    )}
                                    {actions.decline && (
                                        <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction("decline", r)} aria-label={`Rechazar solicitud de ${r.counterpartName}`}>Rechazar</Button>
                                    )}
                                    {actions.cancel && (
                                        <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction("cancel", r)} aria-label={`Cancelar invitación a ${r.counterpartName}`}>Cancelar invitación</Button>
                                    )}
                                </>
                            ) : null
                        }
                    />
                );
            })}
        </ul>
    );
}
