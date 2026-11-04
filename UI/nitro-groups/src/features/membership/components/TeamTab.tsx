"use client";

import { MembershipRequestList } from "./MembershipRequestList";
import { MusicianSearch } from "./MusicianSearch";

/**
 * Pestaña "Equipo" del manager: invitar músicos y atender invitaciones y solicitudes.
 * (La lista de miembros con nombres no está: `GET api/groups/{id}/members` solo devuelve ids.)
 */
export function TeamTab({ groupId }: { groupId: number }) {
    return (
        <div className="flex flex-col gap-14 py-6">
            <section aria-labelledby="equipo-invitar">
                <h3 id="equipo-invitar" className="type-heading text-2xl">Invitar a un músico</h3>
                <div className="mt-4"><MusicianSearch groupId={groupId} /></div>
            </section>
            <section aria-labelledby="equipo-solicitudes">
                <h3 id="equipo-solicitudes" className="type-heading text-2xl">Invitaciones y solicitudes</h3>
                <div className="mt-4"><MembershipRequestList groupId={groupId} /></div>
            </section>
        </div>
    );
}
