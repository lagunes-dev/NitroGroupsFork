import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ROUTES } from "@/config/routes";
import { FRESH, serverGet } from "@/lib/serverApi";
import { priceLabel, shortDateParts, todayInMexico, upcomingPartyDates } from "@/lib/format";
import { SearchForm } from "@/features/search/components/SearchForm";
import { profileHref } from "@/features/search/searchParams";
import { Ondas } from "@/features/home/Ondas";
import { GroupCard } from "@/features/home/GroupCard";
import { Pasos } from "@/features/home/Pasos";
import type { GenreOption, GroupSearchItem, PagedResult } from "@/features/search/types";

export default async function Home() {
    const today = todayInMexico();
    // El próximo sábado (o el día de fiesta más cercano) es la fecha que muestra la portada.
    const party = upcomingPartyDates(today, 3);
    const saturday = party.find((d) => new Date(`${d}T12:00:00Z`).getUTCDay() === 6) ?? party[0];
    const [genres, free] = await Promise.all([
        serverGet<GenreOption[]>("/genres", 3600),
        serverGet<PagedResult<GroupSearchItem>>(`/groups/search?${new URLSearchParams({ date: saturday, size: "6" })}`, FRESH),
    ]);
    const available = free?.items ?? [];
    const featured = available[0];
    const parts = shortDateParts(saturday);
    const dayLabel = parts ? `${parts.weekday} ${parts.day} de ${parts.month}` : saturday;

    return (
        <>
            {/* Primera pantalla: el titular a la izquierda sobre ondas de sonido, la búsqueda en vidrio. */}
            <section className="relative isolate overflow-hidden" aria-labelledby="titulo">
                <div className="absolute inset-0 -z-10" aria-hidden>
                    <div className="resplandor resplandor-vivo w-[60vw] aspect-square -right-[12vw] -top-[18vw]" />
                    <Ondas className="absolute right-[-6%] top-[8%] h-[88%] w-[110%] md:w-[78%]" />
                    <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-fondo" />
                </div>

                <div className="page-frame relative pt-[clamp(5rem,16vh,10rem)] pb-[clamp(2.5rem,6vh,4rem)]">
                    <h1 id="titulo" className="aparece titulo max-w-[16ch]">
                        Música en vivo para tu fecha
                    </h1>
                    <p className="aparece mt-5 max-w-[46ch] text-tinta-2" style={{ ["--d" as string]: "150ms" }}>
                        Mariachi, banda, cumbia y trío para bodas, XV años y fiestas de empresa. Ves quién está libre y
                        cuánto cuesta antes de escribirle a nadie.
                    </p>

                    <div className="aparece mt-10" style={{ ["--d" as string]: "300ms" }}>
                        <SearchForm genres={genres ?? []} id="portada" variant="glass" />
                    </div>

                    {featured && (
                        <Link
                            href={profileHref(featured.slug, saturday)}
                            className="aparece group mt-10 lg:mt-0 lg:absolute lg:right-[var(--gutter)] lg:top-[clamp(5rem,16vh,10rem)] block w-full lg:w-80 vidrio rounded-xl p-4 no-underline"
                            style={{ ["--d" as string]: "450ms" }}
                        >
                            <span className="flex items-center gap-2 text-[0.8125rem] text-tinta-2">
                                <span className="size-1.5 rounded-full bg-ok" aria-hidden />
                                Libre el {dayLabel}
                            </span>
                            <span className="mt-3 block font-[family-name:var(--font-display)] font-semibold text-[1rem]">{featured.groupName}</span>
                            <span className="mt-1 block text-base text-tinta-2">{[featured.genres[0], featured.locationText].filter(Boolean).join(" en ")}</span>
                            <span className="mt-5 flex items-end justify-between">
                                <span>
                                    <span className="block text-[0.8125rem] text-tinta-2">Precio</span>
                                    <span className="block tabular text-[1.125rem]">{priceLabel(featured)}</span>
                                </span>
                                <ArrowRight className="size-5 text-tinta-2 transition-transform group-hover:translate-x-1 group-hover:text-acento" aria-hidden />
                            </span>
                        </Link>
                    )}
                </div>
            </section>

            {/* Disponibles: la misma búsqueda pública, con grupos reales y clicables. */}
            {available.length > 0 && (
                <section className="page-frame mt-[clamp(2rem,5vw,3.5rem)]" aria-labelledby="disponibles">
                    <div data-reveal className="columna">
                        <h2 id="disponibles" className="titulo">Libres este fin de semana</h2>
                        <p className="mt-4 text-tinta-2">
                            Grupos que tienen el {dayLabel} sin compromiso. Toca uno para ver su música, sus fotos y pedirle la fecha.
                        </p>
                    </div>
                    <div data-reveal className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {available.slice(0, 3).map((g) => (
                            <GroupCard key={g.id} group={g} date={saturday} />
                        ))}
                    </div>
                    <p data-reveal className="mt-10 columna">
                        <Link href={`${ROUTES.GROUPS.SEARCH}?fecha=${saturday}`} className="inline-flex items-center gap-2 text-tinta no-underline hover:text-acento transition-colors">
                            Ver todos los grupos libres ese día <ArrowRight className="size-4" aria-hidden />
                        </Link>
                    </p>
                </section>
            )}

            {/* La promesa, dicha una vez y en calma. */}
            <section className="page-frame mt-[var(--section-gap)]" aria-label="Por qué NitroGroups">
                <p data-reveal className="columna">
                    <span className="block font-[family-name:var(--font-display)] font-semibold text-[clamp(1.375rem,2.2vw,1.875rem)] leading-[1.4] text-tinta">
                        Sin llamadas de ida y vuelta. Eliges la fecha, ves el precio y le escribes al grupo. Todo queda por escrito.
                    </span>
                </p>
            </section>

            {/* Cómo funciona: lista que se despliega y el fragmento de la app al lado. */}
            <section className="page-frame mt-[var(--section-gap)]" aria-labelledby="como">
                <div data-reveal className="columna">
                    <h2 id="como" className="titulo">Así se contrata un grupo</h2>
                    <p className="mt-4 text-tinta-2">Cuatro pasos, todos en la misma pantalla y por escrito.</p>
                </div>
                <div data-reveal className="mt-12">
                    <Pasos />
                </div>
            </section>

            {/* Géneros: una línea tranquila de enlaces. */}
            {genres && genres.length > 0 && (
                <section className="page-frame mt-[var(--section-gap)]" aria-labelledby="generos">
                    <div data-reveal className="columna">
                        <h2 id="generos" className="titulo">La música de toda la fiesta</h2>
                        <p className="mt-4 text-tinta-2">Del mariachi en la iglesia a la cumbia de la madrugada.</p>
                    </div>
                    <ul data-reveal className="mt-10 flex flex-wrap justify-center gap-2 columna">
                        {genres.map((g) => (
                            <li key={g.slug}>
                                <Link
                                    href={`${ROUTES.GROUPS.SEARCH}?genero=${g.slug}`}
                                    className="inline-flex rounded-lg superficie px-4 py-2 text-base text-tinta-2 no-underline transition-colors hover:text-tinta hover:border-[var(--linea-fuerte)]"
                                >
                                    {g.name}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* Cierre: centrado, una sola acción para cada lado. */}
            <section className="page-frame mt-[var(--section-gap)]" aria-labelledby="cierre">
                <div className="relative isolate overflow-hidden superficie rounded-xl px-6 py-[clamp(4rem,9vw,6.5rem)]">
                    <div className="resplandor resplandor-vivo -z-10 w-[55%] aspect-square left-1/2 -translate-x-1/2 -bottom-[45%]" aria-hidden />
                    <div data-reveal className="columna">
                        <h2 id="cierre" className="titulo">Encuentra quién toca en tu fecha</h2>
                        <p className="mt-4 text-tinta-2">Y si tienes un grupo, publícalo y recibe solicitudes con todo lo que necesitas para responder.</p>
                        <div className="mt-9 flex flex-wrap justify-center gap-3">
                            <Link href={ROUTES.GROUPS.SEARCH} className="inline-flex h-11 items-center gap-2 rounded-lg bg-acento px-6 text-acento-ink font-[family-name:var(--font-display)] font-semibold text-sm no-underline transition-[background-color,transform] hover:bg-acento-press active:scale-[0.98]">
                                Buscar grupos
                            </Link>
                            <Link href={ROUTES.AUTH.SIGNUP_MUSICIAN} className="inline-flex h-11 items-center gap-2 rounded-lg px-6 text-tinta font-[family-name:var(--font-display)] font-semibold text-sm no-underline shadow-[inset_0_0_0_1px_var(--linea-fuerte)] transition-colors hover:bg-white/[0.04]">
                                Publicar mi grupo
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}
