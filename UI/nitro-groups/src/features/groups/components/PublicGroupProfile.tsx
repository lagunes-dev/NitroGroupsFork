import Link from "next/link";
import { BadgeCheck, Star } from "lucide-react";
import { Photo } from "@/components/ui/Photo";
import { ROUTES } from "@/config/routes";
import { formatEventDate, priceLabel } from "@/lib/format";
import type { MusicGroup } from "../types/MusicGroup";
import type { GroupMediaResponse } from "@/features/groupMedia/types/GroupMedia";
import { RequestForm } from "@/features/bookings/components/RequestForm";
import { JoinShortcut } from "@/features/membership/components/JoinShortcut";
import { RequestToJoin } from "@/features/membership/components/RequestToJoin";

const kind = (m: GroupMediaResponse) => m.type.toLowerCase();

function byOrder(a: GroupMediaResponse, b: GroupMediaResponse) {
    return Number(b.isPrimary) - Number(a.isPrimary) || a.displayOrder - b.displayOrder;
}

function Fact({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt className="text-sm text-tinta-2">{label}</dt>
            <dd className="mt-1 type-heading text-[1.75rem] tabular">{value}</dd>
        </div>
    );
}

/**
 * Perfil público de un grupo. La primera foto manda; el nombre en voz de cartel; la acción
 * principal es pedir una fecha. Server Component: no necesita JavaScript para leerse.
 */
export function PublicGroupProfile({ group, requestedDate, signedIn = false }: { group: MusicGroup; requestedDate?: string; signedIn?: boolean }) {
    const media = [...(group.media ?? [])].sort(byOrder);
    const photos = media.filter((m) => kind(m) === "photo");
    const videos = media.filter((m) => kind(m) === "video");
    const audios = media.filter((m) => kind(m) === "audio");
    const cover = group.coverImageUrl ?? photos[0]?.url ?? group.profilePictureUrl;
    const gallery = photos.filter((p) => p.url !== cover);
    const genres = (group.genres ?? []).map((g) => g.name);
    const price = priceLabel({ basePrice: group.basePrice ?? null, hourlyRate: group.hourlyRate ?? null, currency: group.currency || "MXN" });
    const dateText = requestedDate ? formatEventDate(requestedDate) : null;
    const requestHref = `#solicitar`;

    const facts = [
        group.numMembers > 0 && { label: "Integrantes", value: String(group.numMembers) },
        group.yearsExperience > 0 && { label: "Experiencia", value: `${group.yearsExperience} ${group.yearsExperience === 1 ? "año" : "años"}` },
        group.minimumDurationHours > 0 && { label: "Contratación mínima", value: `${group.minimumDurationHours} h` },
        group.serviceRadiusKm > 0 && { label: "Viaja hasta", value: `${group.serviceRadiusKm} km` },
    ].filter(Boolean) as { label: string; value: string }[];

    return (
        <article>
            {/* Sin foto no hay hero: el nombre abre la página en lugar de un bloque vacío. */}
            {cover && (
                <Photo
                    src={cover}
                    alt={`${group.groupName} en vivo`}
                    fallbackTitle={group.groupName}
                    priority
                    className="w-full aspect-[16/10] md:aspect-[21/9] max-h-[78vh]"
                />
            )}

            <header className="page-frame mt-10 md:mt-16 grid md:grid-cols-12 gap-x-8 gap-y-8 items-end">
                <h1 className="md:col-span-12 titulo max-w-[20ch]">{group.groupName}</h1>
                <div className="md:col-span-8">
                    <p className="mt-4 text-lg text-tinta-2">
                        {[genres.slice(0, 3).join(", "), group.locationText].filter(Boolean).join(" en ")}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-tinta-2">
                        {group.totalReviews > 0 && (
                            <span className="inline-flex items-center gap-1.5 tabular">
                                <Star className="size-4 fill-acento text-acento" aria-hidden />
                                {group.averageRating.toFixed(1)} <span className="sr-only">de 5,</span>({group.totalReviews} reseñas)
                            </span>
                        )}
                        {group.isVerified && (
                            <span className="inline-flex items-center gap-1.5">
                                <BadgeCheck className="size-4 text-acento" aria-hidden /> Verificado por NitroGroups
                            </span>
                        )}
                    </div>
                </div>
                <div className="md:col-span-4 md:justify-self-end flex flex-col gap-3 md:items-end">
                    <p className="text-2xl font-semibold tabular">{price}</p>
                    {!group.isAcceptingBookings && (
                        <p className="text-tinta-2 max-w-[28ch] md:text-right">Este grupo no está tomando nuevas fechas por ahora.</p>
                    )}
                    <div className="flex flex-wrap gap-3 md:justify-end">
                        {group.isAcceptingBookings && (
                            <Link href={requestHref} className="inline-flex h-14 items-center justify-center px-7 bg-acento text-acento-ink rounded-lg font-semibold no-underline hover:bg-acento-press transition-colors">
                                {dateText ? `Pedir el ${dateText}` : "Pedir una fecha"}
                            </Link>
                        )}
                        <JoinShortcut groupId={group.id} active={group.active} ownerUserId={group.ownerUserId} signedIn={signedIn} />
                    </div>
                </div>
            </header>

            {facts.length > 0 && (
                <dl className="page-frame mt-14 grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-8">
                    {facts.map((f) => <Fact key={f.label} {...f} />)}
                </dl>
            )}

            {(group.description || group.biography) && (
                <section className="page-frame mt-[var(--section-gap)] grid md:grid-cols-12 gap-x-8 gap-y-8" aria-labelledby="sobre">
                    <h2 id="sobre" className="titulo md:col-span-4">Sobre el grupo</h2>
                    <div className="md:col-span-7 md:col-start-6 flex flex-col gap-5 text-lg leading-relaxed max-w-[64ch]">
                        {group.description && <p className="text-xl text-tinta">{group.description}</p>}
                        {group.biography?.split(/\n{2,}/).map((para, i) => <p key={i} className="text-tinta">{para}</p>)}
                    </div>
                </section>
            )}

            {(gallery.length > 0 || videos.length > 0 || audios.length > 0) && (
                <section className="page-frame mt-[var(--section-gap)]" aria-labelledby="galeria">
                    <h2 id="galeria" className="titulo">En vivo</h2>

                    {videos.length > 0 && (
                        <div className="mt-10 grid gap-8">
                            {videos.map((v) => (
                                <figure key={v.id}>
                                    <video controls preload="metadata" poster={v.thumbnailUrl} className="w-full aspect-video bg-fondo-2">
                                        <source src={v.url} />
                                    </video>
                                    {v.title && <figcaption className="mt-3 text-tinta-2">{v.title}</figcaption>}
                                </figure>
                            ))}
                        </div>
                    )}

                    {gallery.length > 0 && (
                        <div className="mt-10 grid grid-cols-2 md:grid-cols-12 gap-3 md:gap-4">
                            {gallery.map((p, i) => (
                                <Photo
                                    key={p.id}
                                    src={p.url}
                                    alt={p.title || `${group.groupName}, foto ${i + 1}`}
                                    fallbackTitle={group.groupName}
                                    className={
                                        i % 5 === 0
                                            ? "col-span-2 md:col-span-8 aspect-[3/2]"
                                            : i % 5 === 1
                                                ? "col-span-2 md:col-span-4 aspect-[3/2] md:aspect-auto md:h-full"
                                                : "col-span-1 md:col-span-4 aspect-square"
                                    }
                                />
                            ))}
                        </div>
                    )}

                    {audios.length > 0 && (
                        <ul className="mt-12 flex flex-col gap-6 max-w-3xl">
                            {audios.map((a) => (
                                <li key={a.id}>
                                    <p className="type-heading text-xl">{a.title || "Grabación en vivo"}</p>
                                    <audio controls preload="none" src={a.url} className="mt-3 w-full" />
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}

            {group.isAcceptingBookings && (
                <section id="solicitar" className="page-frame mt-[var(--section-gap)] scroll-mt-24" aria-labelledby="solicitar-titulo">
                    <h2 id="solicitar-titulo" className="titulo">Pedir una fecha</h2>
                    <p className="mt-4 mb-10 max-w-[52ch] text-lg text-tinta">
                        Cuéntale a {group.groupName} qué celebras, el día y cuántas horas necesitas. Te responde por escrito.
                    </p>
                    {signedIn ? (
                        <RequestForm groupId={group.id} groupName={group.groupName} minimumHours={group.minimumDurationHours} defaultDate={requestedDate} />
                    ) : (
                        <Link
                            href={`${ROUTES.AUTH.LOGIN}?returnTo=${encodeURIComponent(`${ROUTES.GROUPS.PUBLIC_PROFILE(group.slug)}${requestedDate ? `?fecha=${requestedDate}` : ""}#solicitar`)}`}
                            className="inline-flex h-14 items-center px-7 bg-acento text-acento-ink rounded-lg font-semibold no-underline hover:bg-acento-press transition-colors"
                        >
                            Entrar para enviar la solicitud
                        </Link>
                    )}
                </section>
            )}

            <RequestToJoin
                groupId={group.id}
                groupName={group.groupName}
                slug={group.slug}
                active={group.active}
                ownerUserId={group.ownerUserId}
                signedIn={signedIn}
            />
        </article>
    );
}
