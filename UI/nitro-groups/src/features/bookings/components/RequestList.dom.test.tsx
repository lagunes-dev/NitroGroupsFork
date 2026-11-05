// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RequestList } from "./RequestList";
import type { EventRequest } from "../types";

const accepted: EventRequest = {
    id: 11,
    groupId: 1,
    groupName: "Versátil Rock y Pop",
    groupSlug: "versatil-rock-y-pop",
    clientName: "Camila Ramos",
    eventDate: "2026-12-05",
    startTime: "20:00:00",
    durationHours: 4,
    eventType: "Boda",
    locationText: "Hacienda San Gabriel, Tlaquepaque",
    guestCount: 120,
    budget: 18000,
    currency: "MXN",
    message: "Boda con banda en vivo.",
    status: "Accepted",
    isSelfBooked: false,
    createdAt: "2026-10-01T18:00:00Z",
    respondedAt: "2026-10-02T18:00:00Z",
    responseMessage: null,
    deposit: { amount: 4000, receivedAt: "2026-11-05T18:00:00Z" },
};

describe("RequestList", () => {
    it("closes the deal for the client: deposit, balance and next step", () => {
        render(<RequestList requests={[accepted]} viewer="Client" />);
        expect(screen.getByText(/Anticipo \$4,000 · recibido el/)).toBeInTheDocument();
        expect(screen.getByText("Falta pagar $14,000")).toBeInTheDocument();
        expect(screen.getByText("Acuerda el saldo con el grupo para el día del evento.")).toBeInTheDocument();
    });

    it("says since when the client is waiting, without echoing the status chip", () => {
        render(<RequestList requests={[{ ...accepted, status: "Pending", deposit: null }]} viewer="Client" />);
        expect(screen.getByText("Solicitud enviada el jueves, 1 de octubre de 2026")).toBeInTheDocument();
        expect(screen.queryByText("El grupo todavía no respondió.")).toBeNull();
        expect(screen.queryByText(/Falta pagar/)).toBeNull();
    });

    it("keeps the money of the deal away from the group's view", () => {
        render(<RequestList requests={[accepted]} viewer="Group" />);
        expect(screen.queryByText(/Anticipo/)).toBeNull();
        expect(screen.queryByText(/Falta pagar/)).toBeNull();
        expect(screen.queryByText(/Acuerda el saldo/)).toBeNull();
        expect(screen.getByText("Camila Ramos")).toBeInTheDocument();
    });
});
