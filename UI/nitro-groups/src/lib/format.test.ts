import { describe, expect, it } from "vitest";
import { formatEventDate, formatPrice, priceLabel, shortDateParts, todayInMexico, upcomingPartyDates } from "./format";

describe("formatPrice", () => {
    it("formatea pesos sin centavos", () => {
        expect(formatPrice(18000)).toBe("$18,000");
    });
    it("devuelve null sin precio", () => {
        expect(formatPrice(null)).toBeNull();
    });
});

describe("priceLabel (misma regla en portada y búsqueda)", () => {
    it("prefiere el precio base", () => {
        expect(priceLabel({ basePrice: 18000, hourlyRate: 3000, currency: "MXN" })).toBe("Desde $18,000");
    });
    it("usa la tarifa por hora si no hay precio base", () => {
        expect(priceLabel({ basePrice: null, hourlyRate: 3000, currency: "MXN" })).toBe("$3,000 por hora");
    });
    it("sin precios, se cotiza", () => {
        expect(priceLabel({ basePrice: null, hourlyRate: null, currency: "MXN" })).toBe("Precio a cotizar");
    });
});

describe("formatEventDate", () => {
    it("escribe la fecha en español", () => {
        expect(formatEventDate("2026-12-12")).toBe("sábado, 12 de diciembre de 2026");
    });
    it("no rompe con una fecha inválida", () => {
        expect(formatEventDate("abc")).toBeNull();
    });
});

describe("todayInMexico", () => {
    it("a las 20:00 en México sigue siendo el mismo día (no el de UTC)", () => {
        // 2026-12-12 20:00 en CDMX = 2026-12-13 02:00 UTC
        expect(todayInMexico(new Date("2026-12-13T02:00:00Z"))).toBe("2026-12-12");
    });
});

describe("upcomingPartyDates", () => {
    it("devuelve viernes, sábado y domingo a partir de hoy, incluyendo hoy", () => {
        // 2026-11-03 es martes.
        expect(upcomingPartyDates("2026-11-03", 4)).toEqual(["2026-11-06", "2026-11-07", "2026-11-08", "2026-11-13"]);
        // Si hoy es sábado, hoy cuenta.
        expect(upcomingPartyDates("2026-11-07", 2)).toEqual(["2026-11-07", "2026-11-08"]);
    });

    it("no inventa fechas con una entrada inválida", () => {
        expect(upcomingPartyDates("2026-02-30", 3)).toEqual([]);
    });
});

describe("shortDateParts", () => {
    it("parte la fecha en día de la semana, día y mes cortos", () => {
        expect(shortDateParts("2026-11-07")).toEqual({ weekday: "sáb", day: "7", month: "nov" });
        expect(shortDateParts("nope")).toBeNull();
    });
});
