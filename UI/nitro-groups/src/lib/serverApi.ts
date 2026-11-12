import { resolveBackendApiBaseUrl } from "./backendBaseUrl";

// Solo para Server Components: usa la URL interna del backend.

/**
 * Sin ventana de caché: lo que el usuario acaba de escribir (una reseña, el teléfono del grupo, su
 * descripción) tiene que verse en la página pública en la carga siguiente. La ronda 13 midió una reseña
 * guardada a las 07:08 que a las 07:23 seguía sin aparecer: la entrada de `revalidate: 60` se escribió
 * a las 06:49 y no se refrescó en ninguna de las cargas posteriores. Los perfiles de músico ya leían con
 * 0 desde `e96f997`; los de grupo se habían quedado atrás. Estas páginas ya son dinámicas (leen la sesión
 * de la cookie), así que 0 solo cuesta una lectura rápida al API. Úsalo para todo dato que alguien edita.
 */
export const FRESH = 0;

/**
 * GET a la API desde un Server Component. Devuelve null si la API no responde o
 * responde con error: las páginas públicas degradan con gracia en lugar de romperse.
 */
export async function serverGet<T>(path: string, revalidateSeconds = 60): Promise<T | null> {
    try {
        const response = await fetch(`${resolveBackendApiBaseUrl()}${path}`, {
            next: { revalidate: revalidateSeconds },
        });
        if (!response.ok) return null;
        return (await response.json()) as T;
    } catch {
        return null;
    }
}

export type ServerResult<T> = { ok: true; data: T } | { ok: false; status: number };

/** Como serverGet, pero conserva el estado: 404 no es lo mismo que una API caída (status 0). */
export async function serverGetResult<T>(path: string, revalidateSeconds = 60): Promise<ServerResult<T>> {
    try {
        const response = await fetch(`${resolveBackendApiBaseUrl()}${path}`, { next: { revalidate: revalidateSeconds } });
        if (!response.ok) return { ok: false, status: response.status };
        return { ok: true, data: (await response.json()) as T };
    } catch {
        return { ok: false, status: 0 };
    }
}
