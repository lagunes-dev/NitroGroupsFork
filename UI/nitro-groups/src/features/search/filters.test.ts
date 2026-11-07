import { describe, expect, it } from "vitest";
import { budgetFilter, emptyHint, filterControls, NO_FILTER, NO_LIMIT, noFiltersNote, textFilter } from "./filters";
import { parseFilters, toUrlFilters } from "./searchParams";

describe("textFilter", () => {
    it("an empty filter renders an empty control, never a value", () => {
        for (const raw of [undefined, null, "", "   ", "  \n "]) {
            expect(textFilter(raw)).toEqual({ value: "", applied: false });
        }
    });
    it("a real filter renders the very text it will search with", () => {
        expect(textFilter(" Guadalajara ")).toEqual({ value: "Guadalajara", applied: true });
        expect(textFilter("Monterrey")).toEqual({ value: "Monterrey", applied: true });
    });
});

describe("budgetFilter", () => {
    it("is no filter when the URL carries nothing, zero or junk", () => {
        for (const raw of [undefined, null, "", "   ", "0", "-100", "abc"]) {
            expect(budgetFilter(raw)).toEqual({ value: "", applied: false });
        }
    });
    it("renders the amount the API will cap", () => {
        expect(budgetFilter("20000")).toEqual({ value: "20000", applied: true });
        expect(budgetFilter(15000)).toEqual({ value: "15000", applied: true });
        expect(budgetFilter(" 20000 ")).toEqual({ value: "20000", applied: true });
    });
});

describe("filterControls", () => {
    it("an empty URL leaves every control reading as no filter", () => {
        expect(filterControls({})).toEqual({
            query: { value: "", applied: false },
            genre: { value: "", applied: false },
            city: { value: "", applied: false },
            date: { value: "", applied: false },
            budget: { value: "", applied: false },
        });
    });
    it("renders exactly the values the URL carries", () => {
        const controls = filterControls({ genero: "mariachi", ciudad: "Guadalajara", fecha: "2026-12-12", presupuesto: "20000" });
        expect(controls.genre).toEqual({ value: "mariachi", applied: true });
        expect(controls.city).toEqual({ value: "Guadalajara", applied: true });
        expect(controls.date).toEqual({ value: "2026-12-12", applied: true });
        expect(controls.budget).toEqual({ value: "20000", applied: true });
    });
    it("what the controls show is what the API searches", () => {
        const controls = filterControls(toUrlFilters(parseFilters({ ciudad: "Guadalajara", presupuesto: "20000" })));
        expect(controls.city.value).toBe("Guadalajara");
        expect(controls.budget.value).toBe("20000");
        expect(controls.genre.value).toBe("");
        expect(controls.date.value).toBe("");
    });
    it("a blank or invalid filter in the URL renders as no filter, never as an applied value", () => {
        const controls = filterControls(toUrlFilters(parseFilters({ ciudad: "  ", presupuesto: "", fecha: "2026-02-30" })));
        expect(controls.city).toEqual({ value: "", applied: false });
        expect(controls.budget).toEqual({ value: "", applied: false });
        expect(controls.date).toEqual({ value: "", applied: false });
    });
});

describe("emptyHint", () => {
    it("marks an empty control as no filter and never covers a real value", () => {
        expect(emptyHint({ value: "", applied: false }, NO_FILTER)).toBe("Sin filtro");
        expect(emptyHint({ value: "", applied: false }, NO_LIMIT)).toBe("Sin límite");
        expect(emptyHint({ value: "Guadalajara", applied: true }, NO_FILTER)).toBeUndefined();
    });
});

describe("noFiltersNote", () => {
    it("says the search runs without filters only when nothing narrows it", () => {
        expect(noFiltersNote({})).toBe("sin filtros aplicados");
        expect(noFiltersNote({ ciudad: "  ", presupuesto: "0" })).toBe("sin filtros aplicados");
    });
    it("is silent as soon as one filter narrows the search", () => {
        expect(noFiltersNote({ ciudad: "Guadalajara" })).toBeNull();
        expect(noFiltersNote({ genero: "mariachi" })).toBeNull();
        expect(noFiltersNote({ fecha: "2026-12-12" })).toBeNull();
        expect(noFiltersNote({ presupuesto: "20000" })).toBeNull();
        expect(noFiltersNote({ q: "mariachi" })).toBeNull();
    });
});
