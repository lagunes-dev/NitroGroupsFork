"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription, Button } from "@/components/ui";
import { membershipService } from "../membership.service";
import { membershipErrorMessage } from "../errors";
import { availableActions, directionLabel, statusLabel, statusTone } from "../status";
import type { MembershipRequest } from "../types";

type Action = "accept" | "decline" | "cancel";

const DONE: Record<Action, string> = {
    accept: "Aceptaste la solicitud de",
    decline: "Rechazaste la solicitud de",
    cancel: "Cancelaste la invitación a",
};

const toneClass = { attention: "text-acento font-semibold", ok: "text-ok", muted: "text-tinta-2" } as const;

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });

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

    if (requests.isPending) return <p className="text-tinta-2 py-6" aria-busy>Cargando invitaciones y solicitudes…</p>;
    if (requests.isError) return <p role="alert" className="text-error py-6">No pudimos cargar las invitaciones y solicitudes. Recarga la página en un momento.</p>;

    const pending = requests.data.filter((r) => r.status === "Pending");
    const rest = requests.data.filter((r) => r.status !== "Pending");

    return (
        <div className="flex flex-col gap-8">
            <p ref={announceRef} tabIndex={-1} role="status" className="text-tinta outline-none empty:hidden">{notice}</p>
            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {requests.data.length === 0 ? (
                <p className="text-tinta-2 max-w-[56ch]">Aún no hay invitaciones ni solicitudes. Invita a un músico desde la búsqueda o espera a que alguien pida unirse.</p>
            ) : (
                <>
                    {pending.length > 0 && <Section id="equipo-pendientes" title="Pendientes" rows={pending} busy={respond.isPending} onAction={(action, request) => respond.mutate({ action, request })} />}
                    {rest.length > 0 && <Section id="equipo-historial" title="Historial" rows={rest} busy={respond.isPending} muted onAction={(action, request) => respond.mutate({ action, request })} />}
                </>
            )}
        </div>
    );
}

function Section({ id, title, rows, busy, muted, onAction }: {
    id: string;
    title: string;
    rows: MembershipRequest[];
    busy: boolean;
    muted?: boolean;
    onAction: (action: Action, request: MembershipRequest) => void;
}) {
    return (
        <section aria-labelledby={id}>
            <h4 id={id} className={`type-heading text-xl ${muted ? "text-tinta-2" : ""}`}>{title}</h4>
            <ul className="mt-2 flex flex-col">
                {rows.map((r) => {
                    const actions = availableActions(r);
                    return (
                        <li key={r.id} className="py-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3 [&+&]:shadow-[inset_0_1px_0_var(--fondo-3)]">
                            <div className="min-w-0">
                                <p className="font-semibold text-tinta">{r.counterpartName}</p>
                                <p className="text-tinta-2 text-sm">
                                    {directionLabel(r.direction)} · {formatDate(r.createdAt)}
                                </p>
                                {r.message && <p className="mt-1 text-tinta max-w-[56ch]">“{r.message}”</p>}
                                <p className={`mt-1 text-sm ${toneClass[statusTone(r.status)]}`}>{statusLabel(r.status)}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {actions.accept && (
                                    <Button size="sm" disabled={busy} onClick={() => onAction("accept", r)} aria-label={`Aceptar solicitud de ${r.counterpartName}`}>Aceptar</Button>
                                )}
                                {actions.decline && (
                                    <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction("decline", r)} aria-label={`Rechazar solicitud de ${r.counterpartName}`}>Rechazar</Button>
                                )}
                                {actions.cancel && (
                                    <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction("cancel", r)} aria-label={`Cancelar invitación a ${r.counterpartName}`}>Cancelar invitación</Button>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
