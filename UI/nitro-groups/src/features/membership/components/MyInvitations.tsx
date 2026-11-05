"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription, Button } from "@/components/ui";
import { ROUTES } from "@/config/routes";
import { membershipService } from "../membership.service";
import { membershipErrorMessage } from "../errors";
import { musicianActions, splitMyRequests } from "../inbox";
import { directionLabel } from "../status";
import type { MembershipRequest } from "../types";
import { RequestCard, RequestGroup, RequestSkeleton } from "./RequestCard";

type Action = "accept" | "decline" | "cancel";

const QUERY_KEY = ["my-membership-requests"];

const DONE: Record<Action, (group: string) => string> = {
    accept: (group) => `Aceptaste la invitación: ahora formas parte de ${group}.`,
    decline: (group) => `Rechazaste la invitación de ${group}.`,
    cancel: (group) => `Cancelaste tu solicitud para unirte a ${group}.`,
};

/** Bandeja del músico: invitaciones que recibió y solicitudes que envió; lo resuelto, como historial. */
export function MyInvitations() {
    const queryClient = useQueryClient();
    const announceRef = useRef<HTMLParagraphElement>(null);
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");

    const requests = useQuery({ queryKey: QUERY_KEY, queryFn: () => membershipService.mine() });

    const respond = useMutation({
        mutationFn: ({ action, request }: { action: Action; request: MembershipRequest }) => membershipService[action](request.id),
        onSuccess: (_data, { action, request }) => {
            setError("");
            setNotice(DONE[action](request.counterpartName));
            // El botón pulsado desaparece de la lista: el foco pasa al aviso para no perderlo.
            announceRef.current?.focus();
            // Al aceptar cambian los grupos del músico: el panel los vuelve a leer.
            if (action === "accept") queryClient.invalidateQueries({ queryKey: ["music-group"] });
        },
        onError: (e) => {
            setNotice("");
            setError(membershipErrorMessage(e, "No pudimos completar la acción. Inténtalo de nuevo."));
        },
        // También tras un error: un 404/409 casi siempre significa que la lista quedó vieja.
        onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    });

    if (requests.isPending) return (
        <div aria-busy className="py-6">
            <span className="sr-only" role="status">Cargando tus invitaciones…</span>
            <RequestSkeleton />
        </div>
    );
    if (requests.isError) return (
        <div className="py-6">
            <div role="alert" className="superficie rounded-[12px] px-6 py-8 text-center text-error">
                No pudimos cargar tus invitaciones. Recarga la página en un momento.
            </div>
        </div>
    );

    const { received, sent, history } = splitMyRequests(requests.data);
    const onAction = (action: Action, request: MembershipRequest) => respond.mutate({ action, request });

    return (
        <div className="flex flex-col gap-10 py-6">
            <p ref={announceRef} tabIndex={-1} role="status" className="text-tinta outline-none empty:hidden">{notice}</p>
            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {requests.data.length === 0 ? (
                <div className="superficie flex flex-col items-center gap-4 rounded-[12px] px-6 py-10 text-center">
                    <p className="max-w-[48ch] text-tinta-2">
                        Aún no tienes invitaciones ni solicitudes. Cuando un grupo te invite, la verás aquí; también puedes pedir unirte desde el perfil de un grupo.
                    </p>
                    <Button asChild><Link href={ROUTES.GROUPS.SEARCH}>Buscar grupos para unirme</Link></Button>
                </div>
            ) : (
                <>
                    <RequestGroup id="inv-recibidas" title="Te invitaron" count={received.length} as="h3">
                        {received.length === 0 ? <p className="text-tinta-2">No tienes invitaciones pendientes.</p> : <Rows rows={received} busy={respond.isPending} onAction={onAction} />}
                    </RequestGroup>
                    <RequestGroup id="inv-enviadas" title="Tus solicitudes para unirte" count={sent.length} as="h3">
                        {sent.length === 0 ? (
                            <div className="flex flex-col items-start gap-4">
                                <p className="text-tinta-2">No tienes solicitudes pendientes.</p>
                                <Button asChild variant="outline"><Link href={ROUTES.GROUPS.SEARCH}>Buscar grupos para unirme</Link></Button>
                            </div>
                        ) : <Rows rows={sent} busy={respond.isPending} onAction={onAction} />}
                    </RequestGroup>
                    {history.length > 0 && (
                        <RequestGroup id="inv-historial" title="Historial" count={history.length} collapsible as="h3">
                            <Rows rows={history} busy={respond.isPending} onAction={onAction} />
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
                const actions = musicianActions(r);
                return (
                    <RequestCard
                        key={r.id}
                        name={r.counterpartName}
                        title={
                            r.groupSlug ? (
                                <Link href={ROUTES.GROUPS.PUBLIC_PROFILE(r.groupSlug)} className="underline decoration-acento decoration-2 underline-offset-4">{r.counterpartName}</Link>
                            ) : r.counterpartName
                        }
                        direction={r.direction === "Invitation" ? "Te invitó a unirte" : directionLabel(r.direction)}
                        createdAt={r.createdAt}
                        status={r.status}
                        message={r.message}
                        actions={
                            actions.accept || actions.decline || actions.cancel ? (
                                <>
                                    {actions.accept && (
                                        <Button size="sm" disabled={busy} onClick={() => onAction("accept", r)} aria-label={`Aceptar invitación de ${r.counterpartName}`}>Aceptar</Button>
                                    )}
                                    {actions.decline && (
                                        <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction("decline", r)} aria-label={`Rechazar invitación de ${r.counterpartName}`}>Rechazar</Button>
                                    )}
                                    {actions.cancel && (
                                        <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction("cancel", r)} aria-label={`Cancelar solicitud a ${r.counterpartName}`}>Cancelar solicitud</Button>
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
