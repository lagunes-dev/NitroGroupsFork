import { describe, expect, it } from "vitest";
import { joinRequestErrorMessage, membershipErrorMessage } from "./errors";

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

describe("joinRequestErrorMessage", () => {
    it("409 prefers the API detail", () => {
        expect(joinRequestErrorMessage(http(409, { detail: "Ya tienes una solicitud pendiente para este grupo." }), "x")).toBe(
            "Ya tienes una solicitud pendiente para este grupo.",
        );
    });
    it("409 without a body lists the possible reasons", () => {
        expect(joinRequestErrorMessage(http(409), "x")).toBe("Ya eres miembro de este grupo, ya tienes una solicitud pendiente o el grupo no está activo.");
    });
    it("403 says only musician accounts can ask to join", () => {
        expect(joinRequestErrorMessage(http(403), "x")).toBe("Solo las cuentas de músico pueden pedir unirse a un grupo.");
    });
    it("404 says the group is no longer available", () => {
        expect(joinRequestErrorMessage(http(404), "x")).toBe("Este grupo ya no está disponible.");
    });
    it("400 and the rest use the API text or the fallback", () => {
        expect(joinRequestErrorMessage(http(400, { detail: "El mensaje es demasiado largo." }), "x")).toBe("El mensaje es demasiado largo.");
        expect(joinRequestErrorMessage(http(500), "Fallback")).toBe("Fallback");
    });
});
