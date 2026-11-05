"use client";

import Link from "next/link";
import { ROUTES } from "@/config/routes";
import { useCurrentUser } from "@/hooks/useCurrentUser";

/**
 * El perfil cerrado se lee en dos voces (S13): a un tercero se le cuenta el estado, y el propio
 * músico lo lee en segunda persona con la salida a mano. La página es un Server Component, así que
 * quién mira se decide acá, en el cliente.
 */
export function MusicianClosedNotice({ name, musicianUserId }: { name: string; musicianUserId: number }) {
    const { user } = useCurrentUser();
    const isOwner = user?.id === musicianUserId;

    if (isOwner) {
        return (
            <p className="mt-3 max-w-[52ch] text-tinta-2">
                No estás recibiendo invitaciones de grupos. Tu perfil sigue siendo público.{" "}
                <Link href={ROUTES.DASHBOARD.MUSICIAN} className="text-acento underline-offset-4 hover:underline">
                    Cambiar mi disponibilidad
                </Link>
            </p>
        );
    }

    return (
        <p className="mt-3 max-w-[52ch] text-tinta-2">
            Por ahora {name} no está recibiendo invitaciones de grupos. Su perfil sigue siendo público, así que puedes
            conocer su trabajo y ver en qué grupos toca.
        </p>
    );
}
