import { describe, expect, it } from "vitest";
import { availableActions, directionLabel, normalizeDirection, normalizeStatus, statusLabel, statusTone } from "./status";

describe("normalizeStatus / normalizeDirection", () => {
    it("acepta el nombre del enum y el valor numérico", () => {
        expect(normalizeStatus("Pending")).toBe("Pending");
        expect(normalizeStatus(0)).toBe("Pending");
        expect(normalizeStatus(1)).toBe("Accepted");
        expect(normalizeStatus(2)).toBe("Declined");
        expect(normalizeStatus(3)).toBe("Cancelled");
        expect(normalizeDirection("Invitation")).toBe("Invitation");
        expect(normalizeDirection(0)).toBe("Invitation");
        expect(normalizeDirection(1)).toBe("Request");
    });
    it("un valor desconocido cae a null", () => {
        expect(normalizeStatus("Archived")).toBeNull();
        expect(normalizeStatus(9)).toBeNull();
        expect(normalizeStatus(undefined)).toBeNull();
        expect(normalizeDirection("Other")).toBeNull();
    });
});

describe("statusLabel / statusTone", () => {
    it("nombra cada estado", () => {
        expect(statusLabel("Pending")).toBe("Pendiente");
        expect(statusLabel("Accepted")).toBe("Aceptada");
        expect(statusLabel("Declined")).toBe("Rechazada");
        expect(statusLabel("Cancelled")).toBe("Cancelada");
    });
    it("un estado desconocido no rompe", () => {
        expect(statusLabel(null)).toBe("Estado desconocido");
        expect(statusTone(null)).toBe("muted");
    });
    it("solo el pendiente pide atención", () => {
        expect(statusTone("Pending")).toBe("attention");
        expect(statusTone("Accepted")).toBe("ok");
        expect(statusTone("Declined")).toBe("muted");
        expect(statusTone("Cancelled")).toBe("muted");
    });
});

describe("directionLabel", () => {
    it("distingue lo que envió el grupo de lo que pidió el músico", () => {
        expect(directionLabel("Invitation")).toBe("Invitación enviada");
        expect(directionLabel("Request")).toBe("Solicitud para unirse");
        expect(directionLabel(null)).toBe("Movimiento");
    });
});

describe("availableActions (vista del grupo)", () => {
    it("una solicitud pendiente se acepta o se rechaza, no se cancela", () => {
        expect(availableActions({ direction: "Request", status: "Pending" })).toEqual({ accept: true, decline: true, cancel: false });
    });
    it("una invitación pendiente solo se cancela", () => {
        expect(availableActions({ direction: "Invitation", status: "Pending" })).toEqual({ accept: false, decline: false, cancel: true });
    });
    it("lo resuelto o desconocido no tiene acciones", () => {
        for (const status of ["Accepted", "Declined", "Cancelled", null] as const) {
            expect(availableActions({ direction: "Request", status })).toEqual({ accept: false, decline: false, cancel: false });
            expect(availableActions({ direction: "Invitation", status })).toEqual({ accept: false, decline: false, cancel: false });
        }
        expect(availableActions({ direction: null, status: "Pending" })).toEqual({ accept: false, decline: false, cancel: false });
    });
});
