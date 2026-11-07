/** Links of the musician profile feature. Pure string helpers, so the routes stay in one place. */

/** Public, shareable profile of a musician: `/musicians/{userId}`. */
export function musicianProfileHref(userId: number): string {
    return `/musicians/${userId}`;
}

/**
 * True only for absolute http(s) links. A bare `youtu.be/abc` is not a link yet, and anything
 * else (`javascript:`, `data:`, `ftp:`) must never reach an `href`.
 */
export function isHttpUrl(value: string): boolean {
    const candidate = value.trim();
    if (!candidate) return false;
    try {
        const url = new URL(candidate);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}
