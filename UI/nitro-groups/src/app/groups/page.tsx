import type { Metadata } from "next";
import Link from "next/link";
import { ROUTES } from "@/config/routes";
import { serverGet } from "@/lib/serverApi";
import { formatEventDate, formatPrice } from "@/lib/format";
import { buildApiQuery, pageHref, parseFilters, toUrlFilters, type ParsedFilters } from "@/features/search/searchParams";
import { noFiltersNote } from "@/features/search/filters";
import { SearchForm } from "@/features/search/components/SearchForm";
import { GroupResult } from "@/features/search/components/GroupResult";
import type { GenreOption, GroupSearchItem, PagedResult, SearchFilters } from "@/features/search/types";

const PAGE_SIZE = 12;

type Props = { searchParams: Promise<SearchFilters> };

function headline(f: ParsedFilters, genreName?: string) {
    const what = genreName ?? "Grupos en vivo";
    return f.ciudad ? `${what} en ${f.ciudad}` : `${what} para tu evento`;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
    const f = await searchParams;
    return { title: f.ciudad ? `Grupos en ${f.ciudad}` : "Explorar grupos" };
}

export default async function SearchPage({ searchParams }: Props) {
    const filters = parseFilters(await searchParams);
    const page = filters.page;
    const budget = filters.budget ?? 0;
    const api = buildApiQuery(filters, PAGE_SIZE);

    const [genres, results] = await Promise.all([
        serverGet<GenreOption[]>("/genres", 3600),
        serverGet<PagedResult<GroupSearchItem>>(`/groups/search?${api}`, 30),
    ]);

    const genreName = genres?.find((g) => g.slug === filters.genero)?.name;
    const items = results?.items ?? [];
    // Los filtros reales de la URL: si ninguno acota la búsqueda, el resumen lo dice con palabras.
    const controlValues = toUrlFilters(filters);
    const summary = [
        results ? `${results.totalCount} ${results.totalCount === 1 ? "grupo" : "grupos"}` : null,
        filters.fecha ? `libres el ${formatEventDate(filters.fecha)}` : null, // fecha ya validada
        budget > 0 ? `hasta ${formatPrice(budget)}` : null,
        noFiltersNote(controlValues),
    ].filter(Boolean).join(", ");

    return (
        <div className="page-frame pt-10 md:pt-16 pb-[var(--section-gap)]">
            <h1 className="titulo max-w-[16ch]">{headline(filters, genreName)}</h1>

            <div className="mt-10 md:mt-14">
                <SearchForm genres={genres ?? []} values={controlValues} showBudget id="resultados" submitLabel="Actualizar" />
            </div>

            {results === null ? (
                <p role="alert" className="mt-16 text-lg text-error">
                    No pudimos cargar los grupos. Revisa tu conexión y vuelve a intentarlo en un momento.
                </p>
            ) : (
                <>
                    <p className="mt-12 text-tinta-2" aria-live="polite">{summary}</p>

                    {items.length === 0 ? (
                        <div className="mt-10 max-w-[60ch]">
                            <h2 className="type-heading text-3xl">Ningún grupo coincide con todo lo que pediste</h2>
                            <p className="mt-4 text-tinta">
                                Prueba sin fecha o con otra ciudad: muchos grupos viajan a eventos fuera de su ciudad.
                            </p>
                            <Link href={ROUTES.GROUPS.SEARCH} className="mt-6 inline-block text-tinta underline decoration-acento decoration-2">
                                Ver todos los grupos
                            </Link>
                        </div>
                    ) : (
                        <ol className="mt-10 flex flex-col gap-16 md:gap-24" aria-label="Resultados">
                            {items.map((g, i) => (
                                <li key={g.id}>
                                    <GroupResult group={g} date={filters.fecha} priority={i === 0} />
                                </li>
                            ))}
                        </ol>
                    )}

                    {results.totalPages > 1 && (
                        <nav aria-label="Páginas de resultados" className="mt-20 flex items-center justify-between gap-6 text-lg">
                            {results.hasPreviousPage ? (
                                <Link href={pageHref(filters, page - 1)} className="text-tinta underline decoration-acento decoration-2">Anteriores</Link>
                            ) : <span />}
                            <span className="text-tinta-2 tabular">Página {page} de {results.totalPages}</span>
                            {results.hasNextPage ? (
                                <Link href={pageHref(filters, page + 1)} className="text-tinta underline decoration-acento decoration-2">Siguientes</Link>
                            ) : <span />}
                        </nav>
                    )}
                </>
            )}
        </div>
    );
}
