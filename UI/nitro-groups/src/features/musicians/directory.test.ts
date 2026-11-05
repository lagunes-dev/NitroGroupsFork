import { describe, expect, it } from "vitest";
import {
    DIRECTORY_PAGE_SIZE,
    FILTER_MAX,
    directoryApiQuery,
    directoryHref,
    directorySummary,
    parseDirectoryFilters,
    toDirectoryCard,
} from "./directory";

describe("parseDirectoryFilters", () => {
    it("reads the three filters and the page from the query string", () => {
        expect(parseDirectoryFilters({ query: "Mateo", instrument: "guitarra", city: "Guadalajara", page: "3" })).toEqual({
            query: "Mateo",
            instrument: "guitarra",
            city: "Guadalajara",
            page: 3,
        });
    });

    it("treats missing, blank and whitespace values as no filter", () => {
        expect(parseDirectoryFilters({ query: "   ", city: "" })).toEqual({ query: "", instrument: "", city: "", page: 1 });
        expect(parseDirectoryFilters({})).toEqual({ query: "", instrument: "", city: "", page: 1 });
    });

    it("trims values and takes the first of a repeated parameter", () => {
        const parsed = parseDirectoryFilters({ query: ["  Ana ", "Beto"], instrument: "  bajo " });
        expect(parsed.query).toBe("Ana");
        expect(parsed.instrument).toBe("bajo");
    });

    it("caps long values", () => {
        expect(parseDirectoryFilters({ city: "x".repeat(500) }).city).toHaveLength(FILTER_MAX);
    });

    it("falls back to page 1 for anything that is not a positive integer", () => {
        for (const page of ["0", "-2", "abc", "2.5", "", "1e3"]) {
            expect(parseDirectoryFilters({ page }).page).toBe(1);
        }
    });
});

describe("directoryApiQuery", () => {
    it("always sends page and size and only the filters that apply", () => {
        const filters = parseDirectoryFilters({ instrument: "guitarra", page: "2" });
        expect(directoryApiQuery(filters)).toBe(`page=2&size=${DIRECTORY_PAGE_SIZE}&instrument=guitarra`);
    });

    it("encodes accents and spaces", () => {
        const q = new URLSearchParams(directoryApiQuery(parseDirectoryFilters({ query: "José Luis", city: "Ciudad de México" })));
        expect(q.get("query")).toBe("José Luis");
        expect(q.get("city")).toBe("Ciudad de México");
        expect(q.has("instrument")).toBe(false);
    });
});

describe("directorySummary", () => {
    const none = parseDirectoryFilters({});
    it("says the truth without filters, singular and plural", () => {
        expect(directorySummary(12, none)).toBe("12 músicos, sin filtros");
        expect(directorySummary(1, none)).toBe("1 músico, sin filtros");
    });

    it("names each filter combination", () => {
        const f = (raw: Record<string, string>) => parseDirectoryFilters(raw);
        expect(directorySummary(3, f({ instrument: "guitarra", city: "Guadalajara" }))).toBe("3 músicos para guitarra en Guadalajara");
        expect(directorySummary(1, f({ instrument: "bajo" }))).toBe("1 músico para bajo");
        expect(directorySummary(2, f({ city: "Puebla" }))).toBe("2 músicos en Puebla");
        expect(directorySummary(2, f({ query: "Mateo" }))).toBe("2 músicos con el nombre “Mateo”");
        expect(directorySummary(4, f({ query: "Ana", instrument: "voz", city: "León" }))).toBe(
            "4 músicos con el nombre “Ana” para voz en León",
        );
    });

    it("never invents a count when there are no results", () => {
        expect(directorySummary(0, none)).toBe("Todavía no hay músicos en el directorio");
        expect(directorySummary(0, parseDirectoryFilters({ instrument: "arpa", city: "Colima" }))).toBe("Ningún músico para arpa en Colima");
    });
});

describe("directoryHref", () => {
    const filters = parseDirectoryFilters({ query: "Ana", city: "Mérida" });
    it("keeps the filters and leaves page 1 implicit", () => {
        expect(directoryHref(filters, 1)).toBe("/musicians?query=Ana&city=M%C3%A9rida");
        expect(directoryHref(filters, 2)).toBe("/musicians?query=Ana&city=M%C3%A9rida&page=2");
    });

    it("is the bare directory without filters", () => {
        expect(directoryHref(parseDirectoryFilters({}), 1)).toBe("/musicians");
    });
});

describe("toDirectoryCard", () => {
    it("normalizes a row into what the card paints", () => {
        const card = toDirectoryCard({
            userId: 7,
            fullName: "  Mateo Músico ",
            headline: " Guitarrista ",
            instruments: "Guitarra, bajo, guitarra",
            city: " Guadalajara ",
            yearsExperience: 1,
            profilePictureUrl: "",
        });
        expect(card).toEqual({
            userId: 7,
            name: "Mateo Músico",
            headline: "Guitarrista",
            instruments: ["Guitarra", "bajo"],
            city: "Guadalajara",
            years: "1 año",
            photoUrl: null,
        });
    });

    it("leaves absent data absent instead of inventing it", () => {
        const card = toDirectoryCard({ userId: 8, fullName: "", instruments: ["Voz", " "], yearsExperience: 0 });
        expect(card.name).toBe("Músico");
        expect(card.headline).toBeNull();
        expect(card.city).toBeNull();
        expect(card.years).toBeNull();
        expect(card.instruments).toEqual(["Voz"]);
    });
});
