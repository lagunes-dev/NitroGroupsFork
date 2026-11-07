"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ROUTES } from "@/config/routes";
import { eventTypeLabel } from "@/lib/eventTypeLabel";
import { formatEventDate } from "@/lib/format";
import { dateSearchHref } from "@/features/search/searchParams";
import { apiErrorMessage, bookingsService } from "../bookings.service";
import { balanceBlock, budgetLabel, clientDepositLabel, nextStepLabel, sentLabel } from "../deposit";
import { availableActions, shortTime, statusLabel } from "../status";
import { threadItems, type ThreadItem } from "../thread";
import type { EventRequest, EventRequestParty } from "../types";
import { ReviewForm } from "./ReviewForm";
import { SavedReview } from "./SavedReview";
import { RequestSignals } from "./RequestSignals";
import { StatusBadge } from "./StatusBadge";

const timeFmt = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" });

/** Time of one message; null when the API brings no readable timestamp. */
function sentAt(value: string | null): string | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : timeFmt.format(date);
}

/** Every part of the conversation keeps its side: the group on the right, the client on the left. */
function itemClass(item: ThreadItem): string {
    if (item.kind === "request") return "rounded-xl bg-fondo-2 p-5";
    return item.senderParty === "Group" ? "bg-fondo-3 p-5 md:ml-12" : "rounded-xl bg-fondo-2 p-5 md:mr-12";
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
    if (!value) return null;
    return (
        <div>
            <dt className="text-sm text-tinta-2">{label}</dt>
            <dd className="mt-1 text-lg tabular">{value}</dd>
        </div>
    );
}

/**
 * Una solicitud y su conversación. La parte que mira se deduce de la API: si el usuario
 * administra el grupo, es "Group"; si no, es el cliente (la API ya negó a cualquier otro).
 */
export function RequestThread({ requestId, viewer }: { requestId: number; viewer: EventRequestParty }) {
    const queryClient = useQueryClient();
    const [reply, setReply] = useState("");
    const query = useQuery({ queryKey: ["event-request", requestId], queryFn: () => bookingsService.get(requestId) });
    const refresh = (data?: EventRequest) => {
        if (data) queryClient.setQueryData(["event-request", requestId], (old: EventRequest | undefined) => ({ ...old, ...data, messages: data.messages ?? old?.messages }));
        void queryClient.invalidateQueries({ queryKey: ["event-request", requestId] });
    };

    const accept = useMutation({ mutationFn: () => bookingsService.accept(requestId), onSuccess: refresh });
    const decline = useMutation({ mutationFn: () => bookingsService.decline(requestId), onSuccess: refresh });
    const cancel = useMutation({ mutationFn: () => bookingsService.cancel(requestId), onSuccess: refresh });
    const send = useMutation({
        mutationFn: () => bookingsService.postMessage(requestId, reply.trim()),
        onSuccess: () => { setReply(""); refresh(); },
    });

    if (query.isPending) return <p className="text-tinta-2" aria-busy>Cargando la solicitud…</p>;
    if (query.isError) {
        return (
            <div role="alert">
                <p className="type-heading text-2xl">No encontramos esta solicitud</p>
                <p className="mt-2 text-tinta">Puede que el enlace sea de otra cuenta. Revisa tus solicitudes desde tu panel.</p>
            </div>
        );
    }

    const r = query.data;
    const actions = availableActions(r, viewer);
    const failed = [accept, decline, cancel, send].find((m) => m.isError);
    const busy = [accept, decline, cancel, send].some((m) => m.isPending);
    const deal = balanceBlock(r, viewer);
    const title = viewer === "Client" ? r.groupName : r.clientName;

    return (
        <article className="grid md:grid-cols-12 gap-x-8 gap-y-12">
            <header className="md:col-span-12">
                <StatusBadge status={r.status} />
                {viewer === "Client" && r.status === "Pending" && <p className="mt-2 text-tinta-2">{statusLabel(r.status, viewer)}</p>}
                <h1 className="mt-2 titulo">
                    {viewer === "Client" ? (
                        <Link href={ROUTES.GROUPS.PUBLIC_PROFILE(r.groupSlug)} className="no-underline hover:text-acento">{title}</Link>
                    ) : title}
                </h1>
                <p className="mt-3 text-xl text-tinta first-letter:uppercase">{formatEventDate(r.eventDate)}</p>
                {viewer === "Group" && r.isSelfBooked && (
                    <p className="mt-2 text-sm text-tinta-2">Cargada por el grupo: no cuenta en las reservas públicas.</p>
                )}
            </header>

            {/* D6: only the group sees the signals; the client's thread is untouched. */}
            {viewer === "Group" && (
                <div className="md:col-span-12">
                    <RequestSignals
                        groupId={r.groupId}
                        requestId={r.id}
                        viewer={viewer}
                        currency={r.currency}
                        startTime={r.startTime}
                        durationHours={r.durationHours}
                    />
                </div>
            )}

            {/* S8: lo que el cliente debe y lo que sigue, antes de la ficha: es lo que viene a buscar. */}
            {deal && (
                <section className="md:col-span-12 rounded-xl bg-fondo-2 p-5" aria-label="Saldo y próximo paso">
                    <p className="text-2xl font-semibold tabular text-tinta">{deal.balance}</p>
                    {deal.purpose && <p className="mt-1 text-tinta-2">{deal.purpose}</p>}
                    <p className="mt-4 text-sm text-tinta-2">Próximo paso</p>
                    <p className="mt-1 text-tinta">{deal.nextStep}</p>
                </section>
            )}

            <dl className="md:col-span-4 grid grid-cols-2 md:grid-cols-1 gap-6 content-start">
                <Detail label="Evento" value={eventTypeLabel(r.eventType)} />
                <Detail label="Lugar" value={r.locationText} />
                <Detail label="Hora de inicio" value={shortTime(r.startTime)} />
                <Detail label="Duración" value={`${r.durationHours} ${r.durationHours === 1 ? "hora" : "horas"}`} />
                <Detail label="Invitados" value={r.guestCount ? String(r.guestCount) : null} />
                <Detail label="Solicitud enviada" value={sentLabel(r)?.replace(/^Solicitud enviada el /, "") ?? null} />
                <Detail label="Presupuesto" value={budgetLabel(r)} />
                <Detail label="Anticipo" value={clientDepositLabel(r, viewer)?.replace(/^Anticipo /, "") ?? null} />
            </dl>

            {/* Sin saldo que decir no hay bloque: el próximo paso sigue como párrafo suelto. */}
            {!deal && nextStepLabel(r, viewer) && (
                <p className="md:col-span-12 text-tinta">{nextStepLabel(r, viewer)}</p>
            )}

            <section className="md:col-span-8 flex flex-col gap-8" aria-label="Conversación">
                <ol className="flex flex-col gap-6">
                    {threadItems(r).map((item) => {
                        const sent = sentAt(item.createdAt);
                        return (
                            <li key={item.key} className={itemClass(item)}>
                                <p className="text-sm text-tinta-2 flex flex-wrap gap-x-3">
                                    <span>{item.senderName}</span>
                                    {sent && <span className="tabular">{sent}</span>}
                                </p>
                                <p className="mt-2 whitespace-pre-line leading-relaxed">{item.body}</p>
                            </li>
                        );
                    })}
                </ol>

                {actions.message && (
                    <form onSubmit={(e) => { e.preventDefault(); if (reply.trim()) send.mutate(); }} className="flex flex-col gap-3">
                        <label htmlFor="respuesta" className="text-sm font-medium text-tinta-2">Escribir un mensaje</label>
                        <textarea id="respuesta" value={reply} onChange={(e) => setReply(e.target.value)} rows={3} maxLength={2000}
                            className="w-full bg-fondo-2 rounded-xl px-4 py-3 text-tinta focus-visible:-outline-offset-2 resize-y" />
                        <button type="submit" disabled={!reply.trim() || busy} className="self-start h-12 px-6 bg-fondo-3 text-tinta font-semibold hover:bg-fondo-2 rounded-xl disabled:opacity-45">
                            {send.isPending ? "Enviando…" : "Enviar mensaje"}
                        </button>
                    </form>
                )}

                {/* D7: only the client's own view; the group never sees the form nor the review here. */}
                {viewer === "Client" && (r.review ? <SavedReview review={r.review} /> : r.canReview ? <ReviewForm requestId={r.id} /> : null)}

                {actions.requestAgain && (
                    <div className="bg-fondo-2 rounded-xl p-5">
                        <p className="text-tinta">Esta solicitud está cerrada. Si quieres otra fecha con {r.groupName}, envíale una solicitud nueva.</p>
                        <div className="mt-4 flex flex-wrap items-center gap-4">
                            <Link href={`${ROUTES.GROUPS.PUBLIC_PROFILE(r.groupSlug)}#solicitar`} className="inline-flex h-12 items-center px-6 bg-acento text-acento-ink rounded-lg font-semibold no-underline hover:bg-acento-press">
                                Pedir otra fecha
                            </Link>
                            {/* La fecha viaja con el enlace: buscar reemplazo no debería obligar a reescribirla. */}
                            {formatEventDate(r.eventDate) && (
                                <Link
                                    href={dateSearchHref(r.eventDate, r.groupId)}
                                    className="inline-flex min-h-11 items-center text-acento underline-offset-4 hover:underline"
                                >
                                    Ver otros grupos libres el {formatEventDate(r.eventDate)}
                                </Link>
                            )}
                        </div>
                    </div>
                )}

                {failed && <p role="alert" className="text-error">{apiErrorMessage(failed.error, "No se pudo completar la acción. Inténtalo de nuevo.")}</p>}

                {(actions.accept || actions.decline || actions.cancel) && (
                    <div className="flex flex-wrap gap-3 pt-2">
                        {actions.accept && (
                            <button type="button" disabled={busy} onClick={() => accept.mutate()} className="h-14 px-7 bg-acento text-acento-ink rounded-lg font-semibold hover:bg-acento-press disabled:opacity-45">
                                Aceptar la fecha
                            </button>
                        )}
                        {actions.decline && (
                            <button type="button" disabled={busy} onClick={() => decline.mutate()} className="h-14 px-7 bg-fondo-2 rounded-xl text-tinta font-semibold hover:bg-fondo-3 disabled:opacity-45">
                                Rechazar
                            </button>
                        )}
                        {actions.cancel && (
                            <button type="button" disabled={busy}
                                onClick={() => { if (window.confirm("¿Cancelar esta solicitud? El grupo recibirá un aviso.")) cancel.mutate(); }}
                                className="h-14 px-7 bg-transparent text-tinta underline decoration-error decoration-2 underline-offset-4 disabled:opacity-45">
                                Cancelar solicitud
                            </button>
                        )}
                    </div>
                )}
            </section>
        </article>
    );
}
