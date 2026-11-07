import Link from "next/link";
import { directoryHref, type DirectoryFilters } from "../directory";

const linkClass =
    "inline-flex h-11 min-w-28 items-center justify-center rounded-[8px] px-5 font-[family-name:var(--font-display)] text-sm font-semibold text-tinta no-underline shadow-[inset_0_0_0_1px_var(--linea-fuerte)] transition-colors duration-300 ease-[var(--ease-out)] hover:bg-fondo-2";

/** Previous / next as plain links, so a page is a URL. Renders nothing for a single page. */
export function DirectoryPagination({ filters, page, totalPages }: { filters: DirectoryFilters; page: number; totalPages: number }) {
    if (totalPages <= 1) return null;

    return (
        <nav aria-label="Páginas de resultados" className="mt-10 flex items-center justify-between gap-4">
            <p className="text-sm text-tinta-2">Página {page} de {totalPages}</p>
            <div className="flex gap-2">
                {page > 1 && <Link href={directoryHref(filters, page - 1)} rel="prev" className={linkClass}>Anterior</Link>}
                {page < totalPages && <Link href={directoryHref(filters, page + 1)} rel="next" className={linkClass}>Siguiente</Link>}
            </div>
        </nav>
    );
}
