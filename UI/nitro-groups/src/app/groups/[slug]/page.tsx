import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { MusicGroup } from "@/features/groups/types/MusicGroup";
import type { PublicGroupTeamMember } from "@/features/groups/types/PublicGroupTeamMember";
import { loadGroupReviews } from "@/features/groups/lib/loadGroupReviews";
import { PublicGroupProfile } from "@/features/groups/components/PublicGroupProfile";
import { FRESH, serverGetResult } from "@/lib/serverApi";
import { isIsoDate } from "@/lib/format";
import { getNitroSession } from "@/services/session";

type Props = {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ fecha?: string }>;
};

/** null solo si el grupo no existe; una caída de la API lanza (página de error, no 404). */
async function loadGroup(slug: string): Promise<MusicGroup | null> {
    const result = await serverGetResult<MusicGroup>(`/groups/slug/${encodeURIComponent(slug)}`, FRESH);
    if (result.ok) return result.data;
    if (result.status === 404) return null;
    throw new Error(`No se pudo cargar el grupo (estado ${result.status}).`);
}

/**
 * El equipo con caras del perfil (S14). Si la API no contesta, la sección queda vacía y se explica
 * en una línea: un fallo no puede tumbar el perfil público entero.
 */
async function loadTeam(groupId: number): Promise<PublicGroupTeamMember[]> {
    const result = await serverGetResult<PublicGroupTeamMember[]>(`/groups/${groupId}/team/public`, FRESH);
    return result.ok && Array.isArray(result.data) ? result.data : [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const group = await loadGroup((await params).slug);
    if (!group) return { title: "Grupo no encontrado" };
    const genres = (group.genres ?? []).map((g) => g.name).join(", ");
    const description = group.description || `${genres} en ${group.locationText}`;
    const image = group.coverImageUrl ?? group.profilePictureUrl;
    return {
        title: group.groupName,
        description,
        openGraph: { title: group.groupName, description, images: image ? [image] : undefined },
    };
}

export default async function GroupPublicPage({ params, searchParams }: Props) {
    const [{ slug }, { fecha }] = await Promise.all([params, searchParams]);
    const [group, session] = await Promise.all([loadGroup(slug), getNitroSession()]);
    if (!group) notFound();

    const [teamMembers, reviews] = await Promise.all([loadTeam(group.id), loadGroupReviews(group.id)]);

    return (
        <PublicGroupProfile
            group={group}
            teamMembers={teamMembers}
            reviews={reviews}
            requestedDate={isIsoDate(fecha) ? fecha : undefined}
            signedIn={Boolean(session?.user)}
        />
    );
}
