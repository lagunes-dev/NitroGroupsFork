"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription, Button } from "@/components/ui";
import { membershipService } from "../membership.service";
import { membershipErrorMessage } from "../errors";
import { splitGroupRequests } from "../inbox";
import { availableActions, directionLabel } from "../status";
import { teamQueryKey } from "../team";
import type { MembershipRequest } from "../types";
import { RequestCard, RequestGroup, RequestSkeleton } from "./RequestCard";
import { focusMusicianSearch } from "./searchFocus";

type Action = "accept" | "decline" | "cancel";

const DONE: Record<Action, string> = {
    accept: "Aceptaste la solicitud de",
    decline: "Rechazaste la solicitud de",
    cancel: "Cancelaste la invitación a",
};

/** Solicitudes para unirse recibidas (primero, esperan respuesta) e invitaciones enviadas: lo pendiente arriba, el resto como historial. */
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
        onSettled: (_data, _error, { action }) => {
            // Aceptar suma un miembro: el equipo que se ve arriba en la pestaña quedó viejo.
            if (action === "accept") queryClient.invalidateQueries({ queryKey: teamQueryKey(groupId) });
            return queryClient.invalidateQueries({ queryKey: ["membership-requests", groupId] });
        },
    });

    if (requests.isPending) return (
        <div aria-busy>
            <span className="sr-only" role="status">Cargando solicitudes e invitaciones…</span>
            <RequestSkeleton />
        </div>
    );
    if (requests.isError) return (
        <div role="alert" className="superficie rounded-[12px] px-6 py-8 text-center text-error">
            No pudimos cargar las solicitudes e invitaciones. Recarga la página en un momento.
        </div>
    );

    const { incoming, invitations } = splitGroupRequests(requests.data);
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
                <div className="superficie flex flex-col items-center gap-4 rounded-[12px] px-6 py-10 text-center">
                    <p className="max-w-[48ch] text-tinta-2">Aún no hay solicitudes ni invitaciones. Invita a un músico o espera a que alguien pida unirse.</p>
                    <Button variant="outline" onClick={focusMusicianSearch}>Busca músicos arriba para invitarlos</Button>
                </div>
            ) : (
                <>
                    <Side
                        id="equipo-quieren"
                        title="Quieren unirse"
                        historyTitle="Historial de solicitudes"
                        empty="Nadie ha pedido unirse por ahora."
                        side={incoming}
                        busy={respond.isPending}
                        onAction={onAction}
                    />
                    <Side
                        id="equipo-enviadas"
                        title="Invitaciones enviadas"
                        historyTitle="Historial de invitaciones"
                        empty="No tienes invitaciones pendientes."
                        side={invitations}
                        busy={respond.isPending}
                        onAction={onAction}
                    />
                </>
            )}
        </div>
    );
}

type Rowset = ReturnType<typeof splitGroupRequests>["incoming"];

function Side({ id, title, historyTitle, empty, side, busy, onAction }: {
    id: string;
    title: string;
    historyTitle: string;
    empty: string;
    side: Rowset;
    busy: boolean;
    onAction: (action: Action, request: MembershipRequest) => void;
}) {
    return (
        <RequestGroup id={id} title={title} count={side.pending.length} as="h3">
            <div className="flex flex-col gap-6">
                {side.pending.length > 0 ? <Rows rows={side.pending} busy={busy} onAction={onAction} /> : <p className="text-tinta-2">{empty}</p>}
                {side.history.length > 0 && (
                    <RequestGroup id={`${id}-historial`} title={historyTitle} count={side.history.length} collapsible>
                        <Rows rows={side.history} busy={busy} onAction={onAction} />
                    </RequestGroup>
                )}
            </div>
        </RequestGroup>
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
