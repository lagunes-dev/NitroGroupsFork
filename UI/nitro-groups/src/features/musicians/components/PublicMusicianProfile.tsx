import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, ExternalLink, Play } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Photo } from "@/components/ui/Photo";
import { ROUTES } from "@/config/routes";
import type { MusicianProfileGroup, MusicianProfileView } from "../profileView";

const ctaClass =
    "inline-flex h-12 items-center gap-2 rounded-[8px] bg-acento px-6 font-[family-name:var(--font-display)] font-semibold text-acento-ink no-underline transition-colors duration-300 ease-[var(--ease-out)] hover:bg-acento-press";

function yearsText(years: number): string {
    return years === 1 ? "1 año" : `${years} años`;
}

function Fact({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0">
            <dt className="text-sm text-tinta-2">{label}</dt>
            <dd className="mt-1 type-heading text-xl text-tinta md:text-2xl">{value}</dd>
        </div>
    );
}

/** Una fila de "Toca en": enlaza al grupo cuando hay slug, y si no, al menos deja leer el nombre. */
function GroupRow({ group }: { group: MusicianProfileGroup }) {
    const body = (
        <>
            <span className="min-w-0 flex-1 font-semibold text-tinta group-hover:text-acento">{group.groupName}</span>
            <Badge variant="secondary">{group.roleLabel}</Badge>
            {group.slug && <ChevronRight aria-hidden className="size-4 shrink-0 text-tinta-2" />}
        </>
    );
    const rowClass = "flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 py-3";

    return (
        <li className="border-t border-linea last:border-b">
            {group.slug ? (
                <Link
                    href={ROUTES.GROUPS.PUBLIC_PROFILE(group.slug)}
                    className={`group ${rowClass} no-underline transition-colors duration-300 ease-[var(--ease-out)]`}
                >
                    {body}
                </Link>
            ) : (
                <div className={rowClass}>{body}</div>
            )}
        </li>
    );
}

/**
 * Perfil público de un músico. Server Component: se lee sin sesión y sin JavaScript, y comparte
 * la misma jerarquía que el perfil de un grupo — foto, nombre, titular, datos en una tira, relato,
 * video, grupos y una acción clara.
 */
export function PublicMusicianProfile({ profile, inviteAction }: { profile: MusicianProfileView; inviteAction?: ReactNode }) {
    // Nombre vacío: nunca se inventa uno, pero la página necesita un título legible.
    const name = profile.fullName || "Músico";

    const facts = [
        profile.instruments.length > 0 && { label: "Instrumentos", value: profile.instruments.join(", ") },
        // La API manda un entero y no distingue «sin dato» de 0, así que 0 no se presume: mismo
        // criterio que el perfil de un grupo, donde los años en cero tampoco se muestran.
        profile.city && { label: "Ciudad", value: profile.city },
        profile.yearsExperience !== null && profile.yearsExperience > 0 && {
            label: "Experiencia",
            value: yearsText(profile.yearsExperience),
        },
        { label: "Disponibilidad", value: profile.isOpenToJoin ? "Disponible para unirse" : "No disponible por ahora" },
    ].filter(Boolean) as { label: string; value: string }[];

    return (
        <article className="pb-[var(--section-gap)]">
            <header className="page-frame pt-10 md:pt-16">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
                    <Photo
                        src={profile.photoUrl}
                        alt={`Foto de ${name}`}
                        fallbackTitle={name}
                        priority
                        className="size-24 shrink-0 self-start rounded-full sm:size-32"
                    />
                    <div className="min-w-0">
                        <h1 className="titulo">{name}</h1>
                        {profile.headline && <p className="mt-3 max-w-[52ch] text-lg text-tinta-2">{profile.headline}</p>}
                    </div>
                </div>

                <dl className="mt-10 grid grid-cols-1 gap-x-8 gap-y-6 border-t border-linea pt-8 sm:grid-cols-2 md:mt-14 lg:grid-cols-4">
                    {facts.map((fact) => (
                        <Fact key={fact.label} {...fact} />
                    ))}
                </dl>
            </header>

            {profile.shortBio && (
                <section className="page-frame mt-[var(--section-gap)]" aria-labelledby="sobre-mi">
                    <h2 id="sobre-mi" className="titulo">Sobre mí</h2>
                    <div className="mt-6 flex max-w-[64ch] flex-col gap-5 text-lg leading-relaxed text-tinta">
                        {profile.shortBio.split(/\n{2,}/).map((paragraph, i) => <p key={i}>{paragraph}</p>)}
                    </div>
                </section>
            )}

            {profile.videoUrl && (
                <section className="page-frame mt-[var(--section-gap)]" aria-labelledby="video">
                    <h2 id="video" className="titulo">En video</h2>
                    <p className="mt-4 max-w-[52ch] text-lg text-tinta">Una grabación dice más que la biografía.</p>
                    {/* Nunca se incrusta el reproductor de terceros: el enlace se abre fuera. */}
                    <a
                        href={profile.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`${ctaClass} mt-8`}
                    >
                        <Play aria-hidden className="size-4" />
                        Ver video
                        <span className="sr-only">(se abre en una pestaña nueva)</span>
                    </a>
                    <p className="mt-3 text-sm text-tinta-2">
                        <ExternalLink aria-hidden className="mr-1.5 inline size-4 align-[-2px]" />
                        Se abre en otra pestaña, en el sitio donde está alojado el video.
                    </p>
                </section>
            )}

            <section className="page-frame mt-[var(--section-gap)]" aria-labelledby="toca-en">
                <h2 id="toca-en" className="titulo">Toca en</h2>
                {profile.groups.length === 0 ? (
                    <p className="mt-6 max-w-[52ch] text-lg text-tinta-2">Todavía no toca en ningún grupo de NitroGroups.</p>
                ) : (
                    <ul className="mt-8 flex flex-col">
                        {profile.groups.map((group) => <GroupRow key={group.groupId} group={group} />)}
                    </ul>
                )}
            </section>

            <section className="page-frame mt-[var(--section-gap)]" aria-labelledby="invitar">
                <div className="superficie rounded-[12px] p-6 md:p-8">
                    <h2 id="invitar" className="type-heading text-2xl">¿Buscas un músico para tu grupo?</h2>
                    {profile.isOpenToJoin ? (
                        <>
                            <p className="mt-3 max-w-[52ch] text-tinta-2">
                                {name} está abierto a unirse a un grupo. Si manejas uno, entra con tu cuenta y envía la invitación
                                desde aquí; {name} la verá en su panel.
                            </p>
                            {inviteAction && <div className="mt-6 empty:hidden">{inviteAction}</div>}
                        </>
                    ) : (
                        <p className="mt-3 max-w-[52ch] text-tinta-2">
                            Por ahora {name} no está abierto a unirse a un grupo, así que no recibe invitaciones. Su perfil
                            sigue siendo público.
                        </p>
                    )}
                </div>
            </section>
        </article>
    );
}
