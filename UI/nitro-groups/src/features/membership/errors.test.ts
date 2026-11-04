import { describe, expect, it } from "vitest";
import { membershipErrorMessage } from "./errors";

const http = (status: number, data?: unknown) => ({ response: { status, data } });

describe("membershipErrorMessage", () => {
    it("409 usa el detalle en español de la API", () => {
        expect(membershipErrorMessage(http(409, { detail: "Este músico no está abierto a unirse a grupos." }), "x")).toBe(
            "Este músico no está abierto a unirse a grupos.",
        );
    });
    it("409 lee también { error }", () => {
        expect(membershipErrorMessage(http(409, { error: "Ya hay una solicitud pendiente." }), "x")).toBe("Ya hay una solicitud pendiente.");
    });
    it("409 sin cuerpo explica los motivos posibles", () => {
        expect(membershipErrorMessage(http(409), "x")).toMatch(/ya es miembro|pendiente|abierto/i);
    });
    it("403 y 404 tienen mensaje propio aunque no haya cuerpo", () => {
        expect(membershipErrorMessage(http(403), "x")).toBe("No tienes permiso para hacer esto en este grupo.");
        expect(membershipErrorMessage(http(404), "x")).toBe("No encontramos lo que buscabas. Puede que ya no exista; actualiza la lista.");
    });
    it("el resto usa el fallback", () => {
        expect(membershipErrorMessage(http(500), "Fallback")).toBe("Fallback");
        expect(membershipErrorMessage(new Error("red"), "Fallback")).toBe("Fallback");
    });
});
