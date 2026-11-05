import type { SearchFilters } from "./types";

/**
 * Cómo se lee un filtro que no tiene valor. Un campo vacío nunca debe parecer un valor aplicado
 * (S3: la barra mostraba "Guadalajara" y "20000" mientras la búsqueda iba sin ciudad ni presupuesto),
 * así que cada control vacío dice, en palabras, que no filtra.
 */
export const NO_FILTER = "Sin filtro";
/** Lo mismo para el presupuesto, donde vacío significa "sin tope". */
export const NO_LIMIT = "Sin límite";

export type RawFilter = string | number | null | undefined;

/** Lo que pinta un control de filtro y si ese filtro acota de verdad los resultados. */
export interface FilterDisplay {
    /** El valor que el control muestra. "" solo significa "sin filtro". */
    value: string;
    applied: boolean;
}

/** Los cinco filtros de la URL, leídos con la misma regla. */
export interface FilterControls {
    query: FilterDisplay;
    genre: FilterDisplay;
    city: FilterDisplay;
    date: FilterDisplay;
    budget: FilterDisplay;
}

function text(raw: RawFilter): string {
    return raw === null || raw === undefined ? "" : String(raw).trim();
}

/** Un filtro de texto: vacío es "sin filtro" y el control queda vacío. */
export function textFilter(raw: RawFilter): FilterDisplay {
    const value = text(raw);
    return { value, applied: value !== "" };
}

/** El presupuesto: vacío, cero, negativo o basura es "sin filtro"; nunca se pinta como valor. */
export function budgetFilter(raw: RawFilter): FilterDisplay {
    const value = text(raw);
    const amount = Number(value);
    const applied = value !== "" && Number.isFinite(amount) && amount > 0;
    return { value: applied ? value : "", applied };
}

/** Lo que muestra cada control, derivado de los mismos filtros con los que se consulta la API. */
export function filterControls(values: SearchFilters): FilterControls {
    return {
        query: textFilter(values.q),
        genre: textFilter(values.genero),
        city: textFilter(values.ciudad),
        date: textFilter(values.fecha),
        budget: budgetFilter(values.presupuesto),
    };
}

/** Texto de ayuda de un control vacío: solo existe cuando no hay valor, así que no puede taparlo. */
export function emptyHint(filter: FilterDisplay, hint: string): string | undefined {
    return filter.applied ? undefined : hint;
}

/** Frase que dice, con palabras, que la búsqueda va sin filtros; null si alguno acota el resultado. */
export function noFiltersNote(values: SearchFilters): string | null {
    const applied = Object.values(filterControls(values)).some((control) => control.applied);
    return applied ? null : "sin filtros aplicados";
}
