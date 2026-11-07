/**
 * Rules of the public musician directory (`/musicians`). Pure functions, no React and no network:
 * the page and its form only paint what these return, and every rule is tested in node.
 */

import { splitInstruments } from "./profileView";
import type { MusicianDirectoryItemResponse } from "./types";

export const DIRECTORY_HREF = "/musicians";
export const DIRECTORY_PAGE_SIZE = 12;
/** Longest filter text we forward; the API columns are shorter than this. */
export const FILTER_MAX = 80;

export interface DirectoryFilters {
    /** Empty string means "no filter", never a value. */
    query: string;
    instrument: string;
    city: string;
    page: number;
}

type RawParam = string | string[] | undefined;

function param(raw: RawParam): string {
    const first = Array.isArray(raw) ? raw[0] : raw;
    return (first ?? "").trim().slice(0, FILTER_MAX).trim();
}

/** The URL is untrusted: anything that is not a usable value becomes "no filter" / page 1. */
export function parseDirectoryFilters(raw: Record<string, RawParam>): DirectoryFilters {
    const page = param(raw.page);
    return {
        query: param(raw.query),
        instrument: param(raw.instrument),
        city: param(raw.city),
        page: /^[1-9]\d{0,5}$/.test(page) ? Number(page) : 1,
    };
}

function filterParams(filters: DirectoryFilters): URLSearchParams {
    const params = new URLSearchParams();
    if (filters.query) params.set("query", filters.query);
    if (filters.instrument) params.set("instrument", filters.instrument);
    if (filters.city) params.set("city", filters.city);
    return params;
}

/** Query string of `GET api/musicians`. */
export function directoryApiQuery(filters: DirectoryFilters): string {
    const params = new URLSearchParams({ page: String(filters.page), size: String(DIRECTORY_PAGE_SIZE) });
    for (const [key, value] of filterParams(filters)) params.set(key, value);
    return params.toString();
}

/** Public URL of a directory page, carrying the filters. Page 1 stays implicit. */
export function directoryHref(filters: DirectoryFilters, page: number): string {
    const params = filterParams(filters);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return query ? `${DIRECTORY_HREF}?${query}` : DIRECTORY_HREF;
}

export function hasDirectoryFilters(filters: DirectoryFilters): boolean {
    return Boolean(filters.query || filters.instrument || filters.city);
}

/** The result line: what was asked, in words, with the real count. */
export function directorySummary(total: number, filters: DirectoryFilters): string {
    if (!hasDirectoryFilters(filters)) {
        if (total === 0) return "Todavía no hay músicos en el directorio";
        return `${total} ${total === 1 ? "músico" : "músicos"}, sin filtros`;
    }
    const parts = [total === 0 ? "Ningún músico" : `${total} ${total === 1 ? "músico" : "músicos"}`];
    if (filters.query) parts.push(`con el nombre “${filters.query}”`);
    if (filters.instrument) parts.push(`para ${filters.instrument}`);
    if (filters.city) parts.push(`en ${filters.city}`);
    return parts.join(" ");
}

/** A directory row, ready to paint. Nothing is invented: absent data stays null. */
export interface DirectoryCard {
    userId: number;
    name: string;
    headline: string | null;
    instruments: string[];
    city: string | null;
    years: string | null;
    photoUrl: string | null;
}

const text = (value: string | null | undefined): string | null => (value ?? "").trim() || null;

export function toDirectoryCard(row: MusicianDirectoryItemResponse): DirectoryCard {
    const instruments = Array.isArray(row.instruments) ? splitInstruments(row.instruments.join(",")) : splitInstruments(row.instruments);
    const years = typeof row.yearsExperience === "number" && row.yearsExperience > 0 ? Math.trunc(row.yearsExperience) : 0;
    return {
        userId: row.userId,
        name: text(row.fullName) ?? "Músico",
        headline: text(row.headline),
        instruments,
        city: text(row.city),
        // Zero is "no dato", same criterion as the public profile.
        years: years > 0 ? `${years} ${years === 1 ? "año" : "años"}` : null,
        photoUrl: text(row.profilePictureUrl),
    };
}
