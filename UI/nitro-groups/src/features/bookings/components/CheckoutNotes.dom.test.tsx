// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CheckoutNotes } from "./CheckoutNotes";

/**
 * Ronda 9: el cliente de un evento aceptado ve cómo pagar, junto al anticipo y el saldo. Es
 * información, no una acción: no hay botón ni enlace dentro de la nota, porque la app no cobra ni
 * interviene (D1/S18). Y solo la lee el cliente de un evento aceptado.
 */
const mocks = vi.hoisted(() => ({ checkoutNotes: vi.fn() }));

vi.mock("../bookings.service", () => ({
    bookingsService: { checkoutNotes: mocks.checkoutNotes },
}));

const fixedLine = "Pagas directo al grupo; NitroGroups no cobra ni interviene.";

const agreement = {
    title: "Cómo pagar",
    body: "Acordaste el pago en efectivo con el grupo. Te atiende Pedro Vargas.",
    userDescription: fixedLine,
    updatedOn: null,
};

const groupNote = {
    title: "Instrucciones del grupo",
    body: "Transfiere a la CLABE 0121 8000 1234 5678, BBVA.",
    userDescription: fixedLine,
    updatedOn: "2026-11-05",
};

function renderNotes(
    viewer: "Client" | "Group" = "Client",
    status: "Pending" | "Accepted" | "Declined" | "Cancelled" = "Accepted"
) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <CheckoutNotes requestId={11} viewer={viewer} status={status} />
        </QueryClientProvider>
    );
}

describe("Cómo pagar en el hilo del cliente", () => {
    it("shows the agreement and the group's text with the day it changed", async () => {
        mocks.checkoutNotes.mockResolvedValue([agreement, groupNote]);

        renderNotes();

        expect(await screen.findByText("Acordaste el pago en efectivo con el grupo. Te atiende Pedro Vargas.")).toBeInTheDocument();
        expect(screen.getByText("Transfiere a la CLABE 0121 8000 1234 5678, BBVA.")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Cómo pagar" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Instrucciones del grupo" })).toBeInTheDocument();
        expect(screen.getByText("Actualizado el 5 de noviembre")).toBeInTheDocument();
    });

    it("says once that NitroGroups does not charge or take part", async () => {
        mocks.checkoutNotes.mockResolvedValue([agreement, groupNote]);

        renderNotes();

        await screen.findByText(agreement.body);
        // La línea es una sola para el bloque: repetirla bajo las dos notas sería ruido.
        expect(screen.getAllByText(fixedLine)).toHaveLength(1);
    });

    it("shows only the agreement when the group wrote nothing", async () => {
        mocks.checkoutNotes.mockResolvedValue([agreement]);

        renderNotes();

        expect(await screen.findByText(agreement.body)).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Instrucciones del grupo" })).not.toBeInTheDocument();
        expect(screen.getByText(fixedLine)).toBeInTheDocument();
    });

    it("does not invent a date it cannot read", async () => {
        mocks.checkoutNotes.mockResolvedValue([{ ...groupNote, updatedOn: null }, agreement]);

        renderNotes();

        await screen.findByText(groupNote.body);
        expect(screen.queryByText(/Actualizado el/)).not.toBeInTheDocument();
    });

    it("is information, not an action: no button nor link inside the note", async () => {
        mocks.checkoutNotes.mockResolvedValue([agreement, groupNote]);

        renderNotes();

        const body = await screen.findByText(agreement.body);
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

    it("draws nothing when the API cannot answer", async () => {
        mocks.checkoutNotes.mockRejectedValue(new Error("404"));

        const { container } = renderNotes();

        await waitFor(() => expect(mocks.checkoutNotes).toHaveBeenCalled());
        await waitFor(() => expect(container).toBeEmptyDOMElement());
    });
});
