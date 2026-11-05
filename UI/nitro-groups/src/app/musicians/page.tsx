import type { Metadata } from "next";
import Link from "next/link";
import { UsersRound } from "lucide-react";
import { DIRECTORY_HREF, directoryApiQuery, directoryHref, directorySummary, hasDirectoryFilters, parseDirectoryFilters, toDirectoryCard } from "@/features/musicians/directory";
import { DirectoryPagination } from "@/features/musicians/components/DirectoryPagination";
import { MusicianCard } from "@/features/musicians/components/MusicianCard";
import { MusicianDirectoryForm } from "@/features/musicians/components/MusicianDirectoryForm";
import type { MusicianDirectoryResponse } from "@/features/musicians/types";
import { serverGetResult } from "@/lib/serverApi";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export const metadata: Metadata = {
    title: "Músicos",
    description: "Músicos abiertos a unirse a un grupo en NitroGroups, por nombre, instrumento y ciudad.",
};

const clearLinkClass = "mt-6 inline-flex h-11 items-center text-tinta underline decoration-acento decoration-2 underline-offset-4 hover:text-acento";

/**
 * Directorio público de músicos: `/musicians`. Se lee sin sesión y los filtros viajan en la URL.
 * Solo aparecen músicos abiertos a unirse; los grupos (no los clientes) los invitan.
 */
export default async function MusiciansDirectoryPage({ searchParams }: Props) {
    const filters = parseDirectoryFilters(await searchParams);
    // No cache window: a musician who just switched the directory on or off must show up on the next load.
    const result = await serverGetResult<MusicianDirectoryResponse>(`/musicians?${directoryApiQuery(filters)}`, 0);

    return (
        <div className="page-frame pb-[var(--section-gap)] pt-10 md:pt-16">
            <h1 className="titulo">Músicos</h1>
            <p className="mt-4 max-w-[56ch] text-lg text-tinta-2">
                Músicos abiertos a unirse a un grupo. Si manejas uno, invítalos desde aquí.
            </p>

            <div className="mt-10">
                <MusicianDirectoryForm filters={filters} />
            </div>

            {!result.ok ? (
                <div role="alert" className="superficie mt-10 flex flex-col items-center gap-3 rounded-[12px] px-6 py-12 text-center">
                    <p className="text-error">No pudimos cargar el directorio. Inténtalo de nuevo en un momento.</p>
                    <Link href={directoryHref(filters, filters.page)} className={clearLinkClass} prefetch={false}>
                        Reintentar
                    </Link>
                </div>
            ) : (
                <>
                    <p role="status" aria-live="polite" className="mt-10 text-tinta-2">
                        {directorySummary(result.data.totalCount, filters)}
                    </p>

                    {result.data.items.length === 0 ? (
                        <div className="superficie mt-6 flex flex-col items-center gap-2 rounded-[12px] px-6 py-12 text-center">
                            <UsersRound aria-hidden className="size-6 text-tinta-2" />
                            <p className="max-w-[48ch] text-tinta">
                                {hasDirectoryFilters(filters)
                                    ? "Ningún músico coincide con esos filtros. Prueba con menos filtros o con otra ciudad."
                                    : "Todavía no hay músicos abiertos a unirse. Vuelve pronto."}
                            </p>
                            {hasDirectoryFilters(filters) && (
                                <Link href={DIRECTORY_HREF} className={clearLinkClass}>Quitar los filtros</Link>
                            )}
                        </div>
                    ) : (
                        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {result.data.items.map((row) => (
                                <MusicianCard key={row.userId} card={toDirectoryCard(row)} />
                            ))}
                        </ul>
                    )}

                    <DirectoryPagination filters={filters} page={result.data.pageNumber || filters.page} totalPages={result.data.totalPages} />
                </>
            )}
        </div>
    );
}
