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

    it("makes the balance the only white figure of the row and the original budget a muted 15px", () => {
        render(<RequestList requests={[accepted]} viewer="Client" />);
        // jsdom measures no pixels: the colour and size classes are the decision.
        expect(screen.getByText("Falta pagar $14,000")).toHaveClass("text-tinta");
        const price = screen.getByText("$18,000");
        expect(price).toHaveClass("text-tinta-2", "text-[15px]");
        expect(price).not.toHaveClass("text-tinta");
    });

    it("keeps the price white when there is no balance to compete with it", () => {
        render(<RequestList requests={[{ ...accepted, deposit: null }]} viewer="Client" />);
        expect(screen.getByText("$18,000")).toHaveClass("text-tinta");
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

/** El pedido del 19 de noviembre, el día en que el grupo ya toca: la API manda el choque en la fila. */
const clashing: EventRequest = {
    ...accepted,
    id: 12,
    eventDate: "2026-11-19",
    startTime: "21:00:00",
    durationHours: 3,
    status: "Pending",
    budget: 15000,
    respondedAt: null,
    deposit: null,
    dateClash: {
        clashes: true,
        withGig: {
            id: 77,
            eventType: "Boda",
            locationText: "Hacienda San Gabriel, Tlaquepaque",
            startTime: "20:00",
            durationHours: 3,
        },
    },
};

describe("RequestList clash of dates", () => {
    it("warns the group about the clash on the row itself, in the thread's own words", () => {
        render(<RequestList requests={[clashing]} viewer="Group" />);

        const clash = screen.getByText(
            "Ese día ya tienes un toque: Boda 20:00–23:00 en Hacienda San Gabriel, Tlaquepaque · se pisan 2 h · tu pedido es 21:00–00:00, el otro toque acaba 23:00"
        );
        // Un solo renglón de texto, no un bloque: la fila sigue siendo una fila.
        expect(clash.tagName).toBe("P");
        expect(clash).toHaveTextContent(/^Ese día ya tienes un toque: /);
    });

    it("does not change what the client sees: the client's list carries no clash", () => {
        const { container } = render(<RequestList requests={[clashing]} viewer="Client" />);
        expect(screen.queryByText(/Ese día ya tienes/)).toBeNull();
        expect(screen.queryByText(/se pisan/)).toBeNull();
        expect(container.textContent).not.toMatch(/Ese día/);
    });

    it("says nothing on a row without a clash, instead of the thread's we-cannot-know line", () => {
        const { container } = render(<RequestList requests={[{ ...accepted, status: "Pending", deposit: null }]} viewer="Group" />);
        expect(container.textContent).not.toMatch(/Ese día/);
        expect(screen.queryByText(/No podemos saber/)).toBeNull();
    });
});

describe("RequestList review cue", () => {
    it("tells the client a finished request can be reviewed and links to its thread", () => {
        render(<RequestList requests={[{ ...accepted, canReview: true, review: null }]} viewer="Client" />);
        const cue = screen.getByRole("link", { name: "Puedes dejar tu reseña" });
        expect(cue).toHaveAttribute("href", "/solicitudes/11");
    });

    it("shows no cue when the request cannot be reviewed or the group is looking", () => {
        const { unmount } = render(<RequestList requests={[{ ...accepted, canReview: false }]} viewer="Client" />);
        expect(screen.queryByText("Puedes dejar tu reseña")).toBeNull();
        unmount();
        render(<RequestList requests={[{ ...accepted, canReview: true }]} viewer="Group" />);
        expect(screen.queryByText("Puedes dejar tu reseña")).toBeNull();
    });
});
