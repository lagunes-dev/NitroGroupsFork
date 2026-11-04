"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription, Button } from "@/components/ui";
import { ROUTES } from "@/config/routes";
import { membershipService } from "../membership.service";
import { membershipErrorMessage } from "../errors";
import { musicianActions, splitMyRequests } from "../inbox";
import { directionLabel, statusLabel, statusTone } from "../status";
import type { MembershipRequest } from "../types";

type Action = "accept" | "decline" | "cancel";

const QUERY_KEY = ["my-membership-requests"];

const DONE: Record<Action, (group: string) => string> = {
    accept: (group) => `Aceptaste la invitación: ahora formas parte de ${group}.`,
    decline: (group) => `Rechazaste la invitación de ${group}.`,
    cancel: (group) => `Cancelaste tu solicitud para unirte a ${group}.`,
};

const toneClass = { attention: "text-acento font-semibold", ok: "text-ok", muted: "text-tinta-2" } as const;

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });

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

    if (requests.isPending) return <p className="text-tinta-2 py-6" aria-busy>Cargando tus invitaciones…</p>;
    if (requests.isError) return <p role="alert" className="text-error py-6">No pudimos cargar tus invitaciones. Recarga la página en un momento.</p>;

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
                <p className="text-tinta-2 max-w-[56ch]">
                    Aún no tienes invitaciones ni solicitudes. Cuando un grupo te invite, la verás aquí; también puedes pedir unirte desde el perfil de un grupo.
                </p>
            ) : (
                <>
                    <Section id="inv-recibidas" title="Invitaciones recibidas" empty="No tienes invitaciones pendientes." rows={received} busy={respond.isPending} onAction={onAction} />
                    <Section id="inv-enviadas" title="Solicitudes enviadas" empty="No tienes solicitudes pendientes." rows={sent} busy={respond.isPending} onAction={onAction} />
                    {history.length > 0 && <Section id="inv-historial" title="Historial" rows={history} busy={respond.isPending} muted onAction={onAction} />}
                </>
            )}
        </div>
    );
}

function Section({ id, title, rows, empty, busy, muted, onAction }: {
    id: string;
    title: string;
    rows: MembershipRequest[];
    empty?: string;
    busy: boolean;
    muted?: boolean;
    onAction: (action: Action, request: MembershipRequest) => void;
}) {
    return (
        <section aria-labelledby={id}>
            <h3 id={id} className={`type-heading text-xl ${muted ? "text-tinta-2" : ""}`}>{title}</h3>
            {rows.length === 0 ? (
                <p className="mt-2 text-tinta-2">{empty}</p>
            ) : (
                <ul className="mt-2 flex flex-col">
                    {rows.map((r) => {
                        const actions = musicianActions(r);
                        return (
                            <li key={r.id} className="py-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3 [&+&]:shadow-[inset_0_1px_0_var(--fondo-3)]">
                                <div className="min-w-0">
                                    <p className="font-semibold text-tinta">
                                        {r.groupSlug ? (
                                            <Link href={ROUTES.GROUPS.PUBLIC_PROFILE(r.groupSlug)} className="underline decoration-acento decoration-2 underline-offset-4">{r.counterpartName}</Link>
                                        ) : r.counterpartName}
                                    </p>
                                    <p className="text-tinta-2 text-sm">
                                        {r.direction === "Invitation" ? "Te invitó a unirte" : directionLabel(r.direction)} · {formatDate(r.createdAt)}
                                    </p>
                                    {r.message && <p className="mt-1 text-tinta max-w-[56ch]">“{r.message}”</p>}
                                    <p className={`mt-1 text-sm ${toneClass[statusTone(r.status)]}`}>{statusLabel(r.status)}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {actions.accept && (
                                        <Button size="sm" disabled={busy} onClick={() => onAction("accept", r)} aria-label={`Aceptar invitación de ${r.counterpartName}`}>Aceptar</Button>
                                    )}
                                    {actions.decline && (
                                        <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction("decline", r)} aria-label={`Rechazar invitación de ${r.counterpartName}`}>Rechazar</Button>
                                    )}
                                    {actions.cancel && (
                                        <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction("cancel", r)} aria-label={`Cancelar solicitud a ${r.counterpartName}`}>Cancelar solicitud</Button>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
