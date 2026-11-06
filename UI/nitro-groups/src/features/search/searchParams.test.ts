import { describe, expect, it } from "vitest";
import { buildApiQuery, dateSearchHref, leaveOutGroup, parseFilters, pageHref, profileHref } from "./searchParams";

describe("parseFilters", () => {
    it("descarta una fecha que no es YYYY-MM-DD", () => {
        expect(parseFilters({ fecha: "abc" }).fecha).toBeUndefined();
        expect(parseFilters({ fecha: "2026-02-30" }).fecha).toBeUndefined();
        expect(parseFilters({ fecha: "2026-12-12" }).fecha).toBe("2026-12-12");
    });
    it("acota la página y el presupuesto", () => {
        const f = parseFilters({ pagina: "-3", presupuesto: "-100" });
        expect(f.page).toBe(1);
        expect(f.budget).toBeUndefined();
        expect(parseFilters({ pagina: "abc" }).page).toBe(1);
        expect(parseFilters({ presupuesto: "15000" }).budget).toBe(15000);
    });
    it("recorta espacios y quita valores vacíos", () => {
        const f = parseFilters({ ciudad: "  Guadalajara ", genero: "" });
        expect(f.ciudad).toBe("Guadalajara");
        expect(f.genero).toBeUndefined();
    });
});

describe("buildApiQuery", () => {
    it("traduce los filtros de la URL a los de la API", () => {
        const q = buildApiQuery(parseFilters({ genero: "mariachi", ciudad: "Guadalajara", fecha: "2026-12-12", presupuesto: "15000", pagina: "2" }), 12);
        expect(Object.fromEntries(new URLSearchParams(q))).toEqual({
            page: "2", size: "12", genre: "mariachi", city: "Guadalajara", date: "2026-12-12", maxPrice: "15000",
        });
    });
});

describe("pageHref", () => {
    it("conserva los filtros y cambia solo la página", () => {
        const href = pageHref(parseFilters({ genero: "mariachi", ciudad: "León" }), 3);
        expect(href).toBe("/groups?genero=mariachi&ciudad=Le%C3%B3n&pagina=3");
    });
});

describe("profileHref", () => {
    it("codifica la fecha y no deja inyectar parámetros", () => {
        expect(profileHref("vargas", "2026-12-12")).toBe("/groups/vargas?fecha=2026-12-12");
        expect(profileHref("vargas", "x&admin=1")).toBe("/groups/vargas");
    });
});

describe("excluir (the group that already said no)", () => {
    it("accepts only a positive integer id and never sends it to the API", () => {
        expect(parseFilters({ excluir: "7" }).excluir).toBe(7);
        for (const bad of ["0", "-3", "abc", "1.5", "", "7;drop"]) expect(parseFilters({ excluir: bad }).excluir).toBeUndefined();
        expect(parseFilters({}).excluir).toBeUndefined();
        expect(buildApiQuery(parseFilters({ fecha: "2026-12-12", excluir: "7" }), 12)).toBe(buildApiQuery(parseFilters({ fecha: "2026-12-12" }), 12));
    });
    it("travels with the page links, and leaves them as they were without it", () => {
        expect(pageHref(parseFilters({ fecha: "2026-12-12", excluir: "7" }), 2)).toBe("/groups?fecha=2026-12-12&pagina=2&excluir=7");
        expect(pageHref(parseFilters({ fecha: "2026-12-12" }), 2)).toBe("/groups?fecha=2026-12-12&pagina=2");
    });
    it("builds the replacement-search link with the date and the rejecting group", () => {
        expect(dateSearchHref("2026-12-05", 7)).toBe("/groups?fecha=2026-12-05&excluir=7");
        expect(dateSearchHref("2026-12-05")).toBe("/groups?fecha=2026-12-05");
    });
});

describe("leaveOutGroup", () => {
    const page = (ids: number[], totalCount: number) => ({ items: ids.map((id) => ({ id })), totalCount });
    it("drops the group and takes one off the count when it was on the page", () => {
        expect(leaveOutGroup(page([1, 7, 9], 20), 7)).toEqual({ items: [{ id: 1 }, { id: 9 }], totalCount: 19, exact: true });
    });
    it("keeps the count as an upper bound when the group is not on this page", () => {
        expect(leaveOutGroup(page([1, 9], 20), 7)).toEqual({ items: [{ id: 1 }, { id: 9 }], totalCount: 20, exact: false });
    });
    it("changes nothing without an excluded group", () => {
        expect(leaveOutGroup(page([1, 7], 2), undefined)).toEqual({ items: [{ id: 1 }, { id: 7 }], totalCount: 2, exact: true });
    });
});
