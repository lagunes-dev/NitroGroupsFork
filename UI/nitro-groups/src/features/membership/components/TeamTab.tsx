"use client";

import { MembershipRequestList } from "./MembershipRequestList";
import { MusicianSearch } from "./MusicianSearch";

/**
 * Pestaña "Equipo" del manager: invitar músicos y atender las solicitudes para unirse y ver las invitaciones enviadas.
 * (La lista de miembros con nombres no está: `GET api/groups/{id}/members` solo devuelve ids.)
 */
export function TeamTab({ groupId }: { groupId: number }) {
    return (
        <div className="flex flex-col gap-10 py-6">
            <section aria-labelledby="equipo-invitar">
                <h3 id="equipo-invitar" className="type-heading text-2xl">Invitar a un músico</h3>
                <div className="mt-4"><MusicianSearch groupId={groupId} /></div>
            </section>
            <MembershipRequestList groupId={groupId} />
        </div>
    );
}
