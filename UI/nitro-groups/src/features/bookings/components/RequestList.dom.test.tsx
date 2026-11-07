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

describe("RequestList balance received (T48)", () => {
    const settled: EventRequest = { ...accepted, balanceReceivedAt: "2026-12-13T15:00:00Z" };

    it("says the balance arrived instead of 'Falta pagar', and the next step is the settled one", () => {
        render(<RequestList requests={[settled]} viewer="Client" />);
        expect(screen.getByText("Saldo recibido el 13 de diciembre de 2026 · $14,000")).toBeInTheDocument();
        expect(screen.getByText("No queda nada por pagar.")).toBeInTheDocument();
        expect(screen.queryByText(/Falta pagar/)).toBeNull();
        expect(screen.queryByText(/Acuerda el saldo/)).toBeNull();
    });

    it("keeps the balance as the white line of the row, like the debt it replaces", () => {
        render(<RequestList requests={[settled]} viewer="Client" />);
        expect(screen.getByText("Saldo recibido el 13 de diciembre de 2026 · $14,000")).toHaveClass("text-tinta");
        expect(screen.getByText("$18,000")).toHaveClass("text-tinta-2");
    });

    it("does not show it to the group", () => {
        render(<RequestList requests={[settled]} viewer="Group" />);
        expect(screen.queryByText(/Saldo recibido/)).toBeNull();
        expect(screen.queryByText(/No queda nada/)).toBeNull();
    });
});

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

/**
 * Ronda 10: el cliente preguntaba cómo pagar y la respuesta vivía una pantalla abajo, dentro del
 * hilo. La fila dice el método en una línea, junto al dinero del que habla, y deja de decirlo cuando
 * no queda nada por pagar: el mismo criterio que la línea del saldo, en las dos superficies.
 */
describe("RequestList cómo pagar (ronda 10)", () => {
    const method = "Transfiere a la CLABE 0121 8000 1234 5678, BBVA.";
    const withMethod: EventRequest = { ...accepted, paymentMethod: method };

    it("answers how to pay on the row itself, next to the money it belongs to", () => {
        render(<RequestList requests={[withMethod]} viewer="Client" />);

        const line = screen.getByText(method);
        const balance = screen.getByText("Falta pagar $14,000");

        // Texto, no un control: la app no cobra ni abre un flujo de pago (D1/S18).
        expect(line.tagName).toBe("P");
        expect(balance.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(screen.queryByRole("button", { name: /pagar/i })).toBeNull();
        expect(screen.queryByRole("link", { name: /pagar/i })).toBeNull();
    });

    it("says nothing once the balance is recorded as received", () => {
        render(<RequestList requests={[{ ...withMethod, balanceReceivedAt: "2026-12-13T15:00:00Z" }]} viewer="Client" />);

        expect(screen.getByText("Saldo recibido el 13 de diciembre de 2026 · $14,000")).toBeInTheDocument();
        expect(screen.queryByText(method)).toBeNull();
    });

    it("says nothing when there is nothing left over either", () => {
        render(<RequestList requests={[{ ...withMethod, budget: 4000 }]} viewer="Client" />);

        expect(screen.getByText("Sin saldo pendiente")).toBeInTheDocument();
        expect(screen.queryByText(method)).toBeNull();
    });

    it("says nothing when the group wrote nothing", () => {
        const { container } = render(<RequestList requests={[accepted]} viewer="Client" />);

        expect(container.textContent).not.toMatch(/CLABE|Transfiere/);
        expect(screen.getByText("Falta pagar $14,000")).toBeInTheDocument();
    });

    it("is never on the group's row", () => {
        render(<RequestList requests={[withMethod]} viewer="Group" />);

        expect(screen.queryByText(method)).toBeNull();
    });
});
