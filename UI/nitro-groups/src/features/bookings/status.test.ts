import { describe, expect, it } from "vitest";
import { Ban, Check, CircleHelp, Clock, X } from "lucide-react";
import { availableActions, shortTime, statusAppearance, statusLabel } from "./status";

describe("availableActions", () => {
    it("el grupo responde solo solicitudes pendientes", () => {
        expect(availableActions({ status: "Pending" }, "Group")).toMatchObject({ accept: true, decline: true, cancel: false });
        expect(availableActions({ status: "Accepted" }, "Group")).toMatchObject({ accept: false, decline: false, cancel: true });
    });
    it("el cliente cancela pendientes o aceptadas, nunca acepta", () => {
        expect(availableActions({ status: "Pending" }, "Client")).toMatchObject({ accept: false, cancel: true });
        expect(availableActions({ status: "Accepted" }, "Client")).toMatchObject({ cancel: true });
        expect(availableActions({ status: "Declined" }, "Client")).toMatchObject({ cancel: false, message: false });
    });
    it("no se escribe en solicitudes cerradas", () => {
        expect(availableActions({ status: "Cancelled" }, "Group").message).toBe(false);
    });
});

describe("pedir otra fecha", () => {
    it("solo el cliente, y solo con la solicitud cerrada", () => {
        expect(availableActions({ status: "Declined" }, "Client").requestAgain).toBe(true);
        expect(availableActions({ status: "Cancelled" }, "Client").requestAgain).toBe(true);
        expect(availableActions({ status: "Pending" }, "Client").requestAgain).toBe(false);
        expect(availableActions({ status: "Declined" }, "Group").requestAgain).toBe(false);
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
