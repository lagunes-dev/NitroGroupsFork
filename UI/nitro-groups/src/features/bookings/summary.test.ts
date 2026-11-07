import { describe, expect, it } from "vitest";
import { pendingRequestsLine } from "./summary";

describe("pendingRequestsLine", () => {
    it("says how many of the requests still wait for an answer", () => {
        expect(pendingRequestsLine(2, 5)).toBe("2 de tus 5 pedidos esperan respuesta.");
        expect(pendingRequestsLine(1, 5)).toBe("1 de tus 5 pedidos espera respuesta.");
    });

    it("speaks about a single request as one", () => {
        expect(pendingRequestsLine(1, 1)).toBe("Tu pedido espera respuesta.");
        expect(pendingRequestsLine(0, 1)).toBe("Tu pedido no espera respuesta.");
    });

    it("says none when every request is answered", () => {
        expect(pendingRequestsLine(0, 3)).toBe("Ninguno de tus 3 pedidos espera respuesta.");
    });

    it("handles an empty list and impossible counts", () => {
        expect(pendingRequestsLine(0, 0)).toBe("Todavía no tienes pedidos de fecha.");
        expect(pendingRequestsLine(-1, -3)).toBe("Todavía no tienes pedidos de fecha.");
    });
});
