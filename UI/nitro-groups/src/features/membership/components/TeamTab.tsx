"use client";

import { MembershipRequestList } from "./MembershipRequestList";
import { MusicianSearch } from "./MusicianSearch";
import { TeamSection } from "./TeamSection";

/**
 * Pestaña "Equipo" del manager: primero el equipo real (nombres, rol y enlace al perfil), después
 * invitar músicos y atender las solicitudes para unirse y las invitaciones enviadas.
 */
export function TeamTab({ groupId }: { groupId: number }) {
    return (
        <div className="flex flex-col gap-10 py-6">
            <TeamSection groupId={groupId} />
            <section aria-labelledby="equipo-invitar">
                <h3 id="equipo-invitar" className="type-heading text-2xl">Invitar a un músico</h3>
                <div className="mt-4"><MusicianSearch groupId={groupId} /></div>
            </section>
            <MembershipRequestList groupId={groupId} />
        </div>
    );
}
