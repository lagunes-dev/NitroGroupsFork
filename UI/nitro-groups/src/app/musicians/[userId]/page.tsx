import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicMusicianProfile } from "@/features/musicians/components/PublicMusicianProfile";
import { parseMusicianId, toMusicianProfile } from "@/features/musicians/profileView";
import type { MusicianProfileResponse } from "@/features/musicians/types";
import { serverGetResult } from "@/lib/serverApi";

type Props = { params: Promise<{ userId: string }> };

/** null solo si no es músico (404); una caída de la API lanza (página de error, no 404). */
async function loadMusician(userId: number): Promise<MusicianProfileResponse | null> {
    const result = await serverGetResult<MusicianProfileResponse>(`/musicians/${userId}`, 60);
    if (result.ok) return result.data;
    if (result.status === 404) return null;
    throw new Error(`No se pudo cargar el perfil (estado ${result.status}).`);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const userId = parseMusicianId((await params).userId);
    const raw = userId === null ? null : await loadMusician(userId);
    if (!raw) return { title: "Músico no encontrado" };

    const profile = toMusicianProfile(raw);
    const name = profile.fullName || "Músico";
    const description = profile.headline ?? profile.shortBio?.slice(0, 160) ?? `${name} en NitroGroups.`;
    return {
        title: name,
        description,
        openGraph: {
            title: name,
            description,
            type: "profile",
            images: profile.photoUrl ? [profile.photoUrl] : undefined,
        },
    };
}

/**
 * Perfil público de un músico: `/musicians/{userId}`. Se abre sin sesión, se lee sin JavaScript y
 * un id que no es de un músico responde 404 con su propia página, nunca una pantalla en blanco.
 */
export default async function MusicianPublicPage({ params }: Props) {
    const userId = parseMusicianId((await params).userId);
    if (userId === null) notFound();

    const raw = await loadMusician(userId);
    if (!raw) notFound();

    return <PublicMusicianProfile profile={toMusicianProfile(raw)} />;
}
