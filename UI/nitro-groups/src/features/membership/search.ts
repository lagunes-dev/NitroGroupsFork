export const MIN_QUERY_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 48; // el tope de la API

/** Recorta y colapsa espacios para que "  ana  " y "ana" sean la misma búsqueda. */
export function normalizeQuery(raw: string): string {
    return raw.trim().replace(/\s+/g, " ");
}

/** Parámetros de `GET api/musicians/open-to-join`: el query vacío se omite. */
export function openMusiciansParams(rawQuery: string, page: number, size: number) {
    const query = normalizeQuery(rawQuery);
    return {
        ...(query ? { query } : {}),
        page: Math.max(1, Math.floor(page) || 1),
        size: Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(size) || MIN_QUERY_PAGE_SIZE)),
    };
}

/** Retrasa `fn` hasta que pasen `ms` sin nuevas llamadas. */
export function debounced<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const call = (...args: A) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
    call.cancel = () => clearTimeout(timer);
    return call;
}
