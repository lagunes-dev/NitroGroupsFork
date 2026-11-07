import { describe, expect, it, vi } from "vitest";
import { MIN_QUERY_PAGE_SIZE, debounced, normalizeQuery, openMusiciansParams } from "./search";

describe("normalizeQuery", () => {
    it("recorta y colapsa espacios", () => {
        expect(normalizeQuery("  ana   pérez ")).toBe("ana pérez");
        expect(normalizeQuery("   ")).toBe("");
    });
});

describe("openMusiciansParams", () => {
    it("omite el query vacío", () => {
        expect(openMusiciansParams("   ", 1, 10)).toEqual({ page: 1, size: 10 });
    });
    it("incluye el query recortado, la página y el tamaño", () => {
        expect(openMusiciansParams("  ana ", 2, 12)).toEqual({ query: "ana", page: 2, size: 12 });
    });
    it("corrige página y tamaño inválidos", () => {
        expect(openMusiciansParams("", 0, 0)).toEqual({ page: 1, size: MIN_QUERY_PAGE_SIZE });
        expect(openMusiciansParams("", 1.7, 500)).toEqual({ page: 1, size: 48 });
    });
});

describe("debounced", () => {
    it("solo dispara la última llamada tras la pausa", () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const d = debounced(fn, 300);
        d("a");
        d("ab");
        vi.advanceTimersByTime(299);
        expect(fn).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith("ab");
        d("x");
        d.cancel();
        vi.advanceTimersByTime(1000);
        expect(fn).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });
});
