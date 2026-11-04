"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui";
import { ROUTES } from "@/config/routes";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { fieldClass } from "@/features/groups/components/GroupProfile/Common";
import { membershipService } from "../membership.service";
import { joinRequestErrorMessage } from "../errors";
import { JOIN_MESSAGE_MAX, joinOffer, prepareJoinMessage } from "../join";

interface RequestToJoinProps {
    groupId: number;
    groupName: string;
    slug: string;
    active: boolean;
    ownerUserId: number;
    signedIn: boolean;
}

/**
 * "Pedir unirse" on the public group profile. It renders nothing unless it can work: a musician
 * who is not yet a member of an active group, or a login link for anonymous visitors.
 */
export function RequestToJoin({ groupId, groupName, slug, active, ownerUserId, signedIn }: RequestToJoinProps) {
    const id = useId();
    const doneRef = useRef<HTMLDivElement>(null);
    const [message, setMessage] = useState("");
    const [invalid, setInvalid] = useState("");

    const { user } = useCurrentUser();
    // Public list of member ids. If it cannot be read we show the form and let the API answer 409.
    const members = useQuery({
        queryKey: ["group-members", groupId],
        queryFn: () => membershipService.groupMembers(groupId),
        enabled: signedIn,
        retry: false,
    });

    const send = useMutation({
        mutationFn: (text: string | undefined) => membershipService.requestToJoin(groupId, text),
        onSuccess: () => setTimeout(() => doneRef.current?.focus(), 0),
    });

    const offer = joinOffer({
        signedIn,
        user: user ? { id: user.id, userType: user.userType } : null,
        group: { active, ownerUserId },
        // While the list loads we wait instead of flashing a form the viewer may not be allowed to use.
        members: members.data ?? null,
    });
    if (offer === "hidden" || (offer === "form" && members.isPending)) return null;

    const returnTo = `${ROUTES.GROUPS.PUBLIC_PROFILE(slug)}#unirse`;

    return (
        <section id="unirse" className="page-frame mt-[var(--section-gap)] scroll-mt-24" aria-labelledby="unirse-titulo">
            <h2 id="unirse-titulo" className="titulo">Pedir unirse</h2>
            {offer === "login" ? (
                <>
                    <p className="mt-4 mb-10 max-w-[52ch] text-lg text-tinta">
                        ¿Tocas en una banda como {groupName}? Entra con tu cuenta de músico para pedir unirte.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <Button asChild size="lg"><Link href={`${ROUTES.AUTH.LOGIN}?returnTo=${encodeURIComponent(returnTo)}`}>Entrar para pedir unirme</Link></Button>
                        <Button asChild size="lg" variant="outline"><Link href={ROUTES.AUTH.SIGNUP_MUSICIAN}>Crear cuenta de músico</Link></Button>
                    </div>
                </>
            ) : send.isSuccess ? (
                <div ref={doneRef} tabIndex={-1} role="status" className="mt-4 max-w-[56ch] outline-none">
                    <p className="type-heading text-[2rem]">Solicitud enviada</p>
                    <p className="mt-3 text-lg text-tinta">
                        {groupName} recibió tu solicitud. Te avisamos por email cuando la responda; también la verás en la pestaña Invitaciones de tu panel.
                    </p>
                    <Link href={ROUTES.DASHBOARD.MUSICIAN} className="mt-6 inline-block text-tinta underline decoration-acento decoration-2 underline-offset-4">
                        Ir a mi panel
                    </Link>
                </div>
            ) : (
                <form
                    className="mt-4 max-w-2xl"
                    aria-describedby={send.isError || invalid ? `${id}-error` : undefined}
                    onSubmit={(e) => {
                        e.preventDefault();
                        const prepared = prepareJoinMessage(message);
                        if (!prepared.ok) return setInvalid(prepared.error);
                        setInvalid("");
                        send.mutate(prepared.message);
                    }}
                >
                    <p className="mb-8 max-w-[52ch] text-lg text-tinta">
                        Los managers de {groupName} reciben tu solicitud y te responden. Puedes añadir un mensaje breve.
                    </p>
                    <label htmlFor={`${id}-mensaje`} className="block text-sm font-medium text-tinta-2 mb-2">
                        Mensaje <span className="text-tinta-2/70">(opcional)</span>
                    </label>
                    <textarea
                        id={`${id}-mensaje`}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={4}
                        aria-describedby={`${id}-ayuda`}
                        placeholder="Toco la batería y me encantaría sumarme."
                        className={`${fieldClass} h-auto rounded-xl py-3 resize-y leading-relaxed`}
                    />
                    <p id={`${id}-ayuda`} className="mt-2 text-sm text-tinta-2 tabular">{message.trim().length} de {JOIN_MESSAGE_MAX}</p>
                    {(send.isError || invalid) && (
                        <p id={`${id}-error`} role="alert" className="mt-4 text-error">
                            {invalid || joinRequestErrorMessage(send.error, "No pudimos enviar la solicitud. Inténtalo de nuevo.")}
                        </p>
                    )}
                    <Button type="submit" size="lg" className="mt-6" disabled={send.isPending}>
                        {send.isPending ? "Enviando…" : "Pedir unirme"}
                    </Button>
                </form>
            )}
        </section>
    );
}
