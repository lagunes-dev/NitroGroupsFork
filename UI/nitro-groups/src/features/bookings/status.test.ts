import { describe, expect, it } from "vitest";
import { Ban, Check, CircleHelp, Clock, X } from "lucide-react";
import { availableActions, shortTime, statusAppearance, statusLabel } from "./status";

describe("availableActions", () => {
    const today = "2026-11-06";

    it("el grupo responde solo solicitudes pendientes", () => {
        expect(availableActions({ status: "Pending", eventDate: "2026-12-05" }, "Group", today)).toMatchObject({ accept: true, decline: true, cancel: false });
        expect(availableActions({ status: "Accepted", eventDate: "2026-12-05" }, "Group", today)).toMatchObject({ accept: false, decline: false, cancel: true });
    });
    it("el cliente cancela pendientes o aceptadas, nunca acepta", () => {
        expect(availableActions({ status: "Pending", eventDate: "2026-12-05" }, "Client", today)).toMatchObject({ accept: false, cancel: true });
        expect(availableActions({ status: "Accepted", eventDate: "2026-12-05" }, "Client", today)).toMatchObject({ cancel: true });
        expect(availableActions({ status: "Declined", eventDate: "2026-12-05" }, "Client", today)).toMatchObject({ cancel: false, message: false });
    });
    it("no se escribe en solicitudes cerradas", () => {
        expect(availableActions({ status: "Cancelled", eventDate: "2026-12-05" }, "Group", today).message).toBe(false);
    });
});

describe("un evento aceptado que ya pasó", () => {
    const today = "2026-11-06";

    it("no se cancela, ni para el cliente ni para el grupo, pero la conversación sigue abierta", () => {
        const past = { status: "Accepted" as const, eventDate: "2026-10-24" };
        expect(availableActions(past, "Client", today)).toMatchObject({ cancel: false, message: true });
        expect(availableActions(past, "Group", today)).toMatchObject({ cancel: false, message: true });
    });

    it("cuenta el día de México: el evento de hoy todavía se cancela, el de ayer no", () => {
        expect(availableActions({ status: "Accepted", eventDate: today }, "Client", today).cancel).toBe(true);
        expect(availableActions({ status: "Accepted", eventDate: "2026-11-05" }, "Client", today).cancel).toBe(false);
    });

    it("un pendiente ya pasado conserva lo que hacía", () => {
        expect(availableActions({ status: "Pending", eventDate: "2026-10-24" }, "Client", today).cancel).toBe(true);
    });

    it("no se da por pasado lo que no se puede leer", () => {
        expect(availableActions({ status: "Accepted", eventDate: "" }, "Client", today).cancel).toBe(true);
        expect(availableActions({ status: "Accepted", eventDate: "2026-10-24" }, "Client", "").cancel).toBe(true);
    });
});

describe("pedir otra fecha", () => {
    it("solo el cliente, y solo con la solicitud cerrada", () => {
        const today = "2026-11-06";
        expect(availableActions({ status: "Declined", eventDate: "2026-12-05" }, "Client", today).requestAgain).toBe(true);
        expect(availableActions({ status: "Cancelled", eventDate: "2026-12-05" }, "Client", today).requestAgain).toBe(true);
        expect(availableActions({ status: "Pending", eventDate: "2026-12-05" }, "Client", today).requestAgain).toBe(false);
        expect(availableActions({ status: "Declined", eventDate: "2026-12-05" }, "Group", today).requestAgain).toBe(false);
    });
});

describe("statusLabel", () => {
    it("nombra el pendiente según quién mira", () => {
        expect(statusLabel("Pending", "Client")).toBe("Esperando respuesta del grupo");
        expect(statusLabel("Pending", "Group")).toBe("Por responder");
    });
});

describe("statusAppearance", () => {
    it("gives each status its own word, tone and icon", () => {
        expect(statusAppearance("Pending")).toMatchObject({ text: "Pendiente", variant: "default", className: "text-acento", icon: Clock });
        expect(statusAppearance("Accepted")).toMatchObject({ text: "Aceptada", variant: "ok", icon: Check });
        expect(statusAppearance("Declined")).toMatchObject({ text: "Rechazada", variant: "destructive", icon: X });
        expect(statusAppearance("Cancelled")).toMatchObject({ text: "Cancelada", variant: "secondary", icon: Ban });
    });

    it("prints four different words", () => {
        const words = ["Pending", "Accepted", "Declined", "Cancelled"].map((status) => statusAppearance(status).text);
        expect(new Set(words).size).toBe(4);
    });

    it("keeps a value it does not know, without a tone that claims it is fine", () => {
        expect(statusAppearance("Expired")).toMatchObject({ text: "Expired", variant: "secondary", icon: CircleHelp });
    });

    it("has a word for a missing status", () => {
        expect(statusAppearance("")).toMatchObject({ text: "Sin estado", variant: "secondary" });
    });
});

describe("shortTime", () => {
    it("recorta los segundos", () => {
        expect(shortTime("20:00:00")).toBe("20:00");
        expect(shortTime(null)).toBeNull();
    });
});
