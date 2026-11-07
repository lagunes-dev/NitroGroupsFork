const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

/** "$18,000": precios redondos, sin centavos. */
export function formatPrice(value: number | null | undefined, currency = "MXN"): string | null {
    if (value == null) return null;
    if (currency === "MXN") return mxn.format(value);
    return new Intl.NumberFormat("es-MX", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

/** Una sola regla de precio para portada, búsqueda y perfil. */
export function priceLabel(g: { basePrice: number | null; hourlyRate: number | null; currency: string }): string {
    const base = formatPrice(g.basePrice, g.currency);
    if (base) return `Desde ${base}`;
    const hourly = formatPrice(g.hourlyRate, g.currency);
    if (hourly) return `${hourly} por hora`;
    return "Precio a cotizar";
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** true si es una fecha real en formato YYYY-MM-DD (rechaza "2026-02-30"). */
export function isIsoDate(value: string | undefined | null): value is string {
    const m = value ? ISO_DATE.exec(value) : null;
    if (!m) return false;
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const date = new Date(Date.UTC(y, mo - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

const longDate = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** "sábado, 12 de diciembre de 2026" a partir de "2026-12-12"; null si la fecha no es válida. Un evento se planea con meses de anticipación: el año no es decorativo. */
export function formatEventDate(isoDate: string): string | null {
    if (!isIsoDate(isoDate)) return null;
    const [y, m, d] = isoDate.split("-").map(Number);
    return longDate.format(new Date(Date.UTC(y, m - 1, d)));
}

const mexicoDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" });

/** Hoy en México como YYYY-MM-DD (la API interpreta las fechas de evento en esa zona). */
export function todayInMexico(now: Date = new Date()): string {
    return mexicoDay.format(now);
}

/** Próximos viernes, sábados y domingos (días de fiesta) a partir de hoy, como YYYY-MM-DD. */
export function upcomingPartyDates(today: string, count: number): string[] {
    if (!isIsoDate(today)) return [];
    const [y, m, d] = today.split("-").map(Number);
    const cursor = new Date(Date.UTC(y, m - 1, d));
    const out: string[] = [];
    while (out.length < count) {
        const day = cursor.getUTCDay();
        if (day === 5 || day === 6 || day === 0) out.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return out;
}

const dayParts = new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** Partes cortas de una fecha para el cartel: { weekday: "sáb", day: "14", month: "mar" }. */
export function shortDateParts(isoDate: string): { weekday: string; day: string; month: string } | null {
    if (!isIsoDate(isoDate)) return null;
    const [y, m, d] = isoDate.split("-").map(Number);
    const parts = dayParts.formatToParts(new Date(Date.UTC(y, m - 1, d)));
    const get = (t: string) => (parts.find((p) => p.type === t)?.value ?? "").replace(".", "");
    return { weekday: get("weekday"), day: get("day"), month: get("month") };
}
