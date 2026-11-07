// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CheckoutNotes } from "./CheckoutNotes";

/**
 * Ronda 9: el cliente de un evento aceptado ve cómo pagar, junto al anticipo y el saldo. Es
 * información, no una acción: no hay botón ni enlace dentro de la nota, porque la app no cobra ni
 * interviene (D1/S18). Y solo la lee el cliente de un evento aceptado.
 * Ronda 10: una sola nota autoritativa y nada de ruido de pago una vez saldado el trato.
 */
const mocks = vi.hoisted(() => ({ checkoutNotes: vi.fn() }));

vi.mock("../bookings.service", () => ({
    bookingsService: { checkoutNotes: mocks.checkoutNotes },
}));

const fixedLine = "Pagas directo al grupo; NitroGroups no cobra ni interviene.";

const groupNote = {
    title: "Cómo pagar",
    body: "Transfiere a la CLABE 0121 8000 1234 5678, BBVA.",
    managerLine: "Te atiende Pedro Vargas.",
    userDescription: fixedLine,
    updatedOn: "2026-11-05",
};

const agreedNote = {
    title: "Cómo pagar",
    body: "Acuerdas el pago con el grupo.",
    managerLine: "Te atiende Pedro Vargas.",
    userDescription: fixedLine,
    updatedOn: null,
};

function renderNotes(
    viewer: "Client" | "Group" = "Client",
    status: "Pending" | "Accepted" | "Declined" | "Cancelled" = "Accepted",
    settled = false
) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <CheckoutNotes requestId={11} viewer={viewer} status={status} settled={settled} />
        </QueryClientProvider>
    );
}

describe("Cómo pagar en el hilo del cliente", () => {
    it("shows the group's method, who attends and the day it changed", async () => {
        mocks.checkoutNotes.mockResolvedValue([groupNote]);

        renderNotes();

        expect(await screen.findByText(groupNote.body)).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Cómo pagar" })).toBeInTheDocument();
        expect(screen.getByText("Te atiende Pedro Vargas.")).toBeInTheDocument();
        expect(screen.getByText("Actualizado el 5 de noviembre")).toBeInTheDocument();
    });

    it("says one method only: no second statement the first one contradicts", async () => {
        mocks.checkoutNotes.mockResolvedValue([groupNote]);

        renderNotes();

        const body = await screen.findByText(groupNote.body);
        const block = body.closest("section")!;

        expect(within(block).getAllByRole("heading")).toHaveLength(1);
        expect(within(block).queryByText(/efectivo/i)).toBeNull();
        expect(within(block).queryByText(/Acordaste el pago/i)).toBeNull();
    });

    it("says once that NitroGroups does not charge or take part", async () => {
        mocks.checkoutNotes.mockResolvedValue([groupNote]);

        renderNotes();

        await screen.findByText(groupNote.body);
        // La línea es una sola para el bloque: repetirla bajo la nota sería ruido.
        expect(screen.getAllByText(fixedLine)).toHaveLength(1);
    });

    it("when the group wrote nothing, says the payment is agreed with the group and invents no method", async () => {
        mocks.checkoutNotes.mockResolvedValue([agreedNote]);

        renderNotes();

        const body = await screen.findByText("Acuerdas el pago con el grupo.");
        expect(screen.getByText("Te atiende Pedro Vargas.")).toBeInTheDocument();
        expect(body.closest("section")!.textContent).not.toMatch(/efectivo|transferencia|CLABE/i);
    });

    it("does not invent a date it cannot read", async () => {
        mocks.checkoutNotes.mockResolvedValue([{ ...groupNote, updatedOn: null }]);

        renderNotes();

        await screen.findByText(groupNote.body);
        expect(screen.queryByText(/Actualizado el/)).not.toBeInTheDocument();
    });

    it("is information, not an action: no button nor link inside the note", async () => {
        mocks.checkoutNotes.mockResolvedValue([groupNote]);

        renderNotes();

        const body = await screen.findByText(groupNote.body);
        const block = body.closest("section")!;

        expect(within(block).queryAllByRole("button")).toHaveLength(0);
        expect(within(block).queryAllByRole("link")).toHaveLength(0);
    });

    it("never asks for the notes as the group, nor for a request that is not accepted", () => {
        mocks.checkoutNotes.mockClear();
        renderNotes("Group");
        renderNotes("Client", "Pending");

        expect(mocks.checkoutNotes).not.toHaveBeenCalled();
    });

    it("says nothing once nothing is left to pay, and does not even ask for the notes", async () => {
        mocks.checkoutNotes.mockClear();

        const { container } = renderNotes("Client", "Accepted", true);

        // Ronda 10: bajo "Saldo recibido" la CLABE y la fecha del texto son ruido, no información.
        expect(container).toBeEmptyDOMElement();
        expect(mocks.checkoutNotes).not.toHaveBeenCalled();
    });

    it("draws nothing when the API cannot answer", async () => {
        mocks.checkoutNotes.mockRejectedValue(new Error("404"));

        const { container } = renderNotes();

        await waitFor(() => expect(mocks.checkoutNotes).toHaveBeenCalled());
        await waitFor(() => expect(container).toBeEmptyDOMElement());
    });
});
