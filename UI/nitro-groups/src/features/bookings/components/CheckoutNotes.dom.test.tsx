// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CheckoutNotes } from "./CheckoutNotes";
import type { EventRequest } from "../types";

/**
 * Ronda 9: el cliente de un evento aceptado ve cómo pagar, junto al anticipo y el saldo. Es
 * información, no una acción: no hay botón ni enlace dentro de la nota, porque la app no cobra ni
 * interviene (D1/S18). Y solo la lee el cliente de un evento aceptado.
 * Ronda 10: una sola nota autoritativa y nada de ruido de pago una vez saldado el trato.
 * Ronda 12: el bloque se basta solo — dice cuánto y para cuándo, y lo copiado alcanza para pagar.
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

const concept = "Concepto: pedido 11 · Boda, 5 de diciembre de 2026";

/** El pedido del que sale el bloque: aceptado, con el anticipo ya recibido y $14,000 de saldo. */
function deal(overrides: Partial<EventRequest> = {}): EventRequest {
    return {
        id: 11,
        groupId: 1,
        groupName: "Versátil Rock y Pop",
        groupSlug: "versatil-rock-y-pop",
        clientName: "Camila Ramos",
        eventDate: "2026-12-05",
        startTime: "20:00:00",
        durationHours: 4,
        eventType: "Wedding",
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
        ...overrides,
    };
}

function renderNotes(viewer: "Client" | "Group" = "Client", overrides: Partial<EventRequest> = {}) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <CheckoutNotes request={deal(overrides)} viewer={viewer} />
        </QueryClientProvider>
    );
}

/** Un portapapeles de mentira: el de jsdom no escribe nada y no se puede leer. */
function stubClipboard(writeText: (text: string) => Promise<void>) {
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
}

beforeEach(() => {
    mocks.checkoutNotes.mockReset();
    // Sin portapapeles por defecto: cada prueba de copia pone el suyo.
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
});

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

    it("is information, not an action: the only control is the copy action", async () => {
        mocks.checkoutNotes.mockResolvedValue([groupNote]);

        renderNotes();

        const body = await screen.findByText(groupNote.body);
        const block = body.closest("section")!;

        // Ronda 11: se puede copiar el texto, no pagar. Ningún número se vuelve un enlace.
        expect(within(block).queryAllByRole("link")).toHaveLength(0);
        expect(within(block).queryByRole("button", { name: /pagar|transferir/i })).toBeNull();
    });

    it("carries the app's own reference line: which request and which event this payment is", async () => {
        mocks.checkoutNotes.mockResolvedValue([groupNote]);

        renderNotes();

        const body = await screen.findByText(groupNote.body);
        const block = body.closest("section")!;

        // La línea sale del pedido, no del texto del grupo, que se sigue leyendo tal cual.
        expect(within(block).getByText(concept)).toBeInTheDocument();
        expect(within(block).getByText(groupNote.body)).toBeInTheDocument();
    });

    it("says the reference line only when the note is drawn", async () => {
        mocks.checkoutNotes.mockResolvedValue([]);

        const { container } = renderNotes();

        await waitFor(() => expect(mocks.checkoutNotes).toHaveBeenCalled());
        expect(container.textContent).not.toMatch(/Concepto: pedido/);
    });

    it("offers one control only, the copy action: nothing that pays and no link on any number", async () => {
        mocks.checkoutNotes.mockResolvedValue([groupNote]);

        renderNotes();

        const body = await screen.findByText(groupNote.body);
        const block = body.closest("section")!;
        const controls = within(block).getAllByRole("button");

        expect(controls).toHaveLength(1);
        expect(controls[0]).toHaveAccessibleName("Copiar los datos de pago");
        // 44 px y alcanzable con el teclado: es un botón, no un div con onClick.
        expect(controls[0]).toHaveClass("min-h-11");
        expect(controls[0]).toHaveAttribute("type", "button");
        expect(within(block).queryAllByRole("link")).toHaveLength(0);
    });

    /**
     * Ronda 12 (la clienta): midió la acción de copiar en y=1437 y el banner con el saldo en y=288,
     * ya fuera de pantalla. El bloque tiene que decir cuánto y para cuándo, desde el pedido.
     */
    it("states what is due now and by when, from the request and never from the group's text", async () => {
        mocks.checkoutNotes.mockResolvedValue([groupNote]);

        renderNotes("Client", { budget: 13000, balanceDueDate: "2026-11-15" });

        const money = await screen.findByText("Saldo: falta pagar $9,000 · para el 15 de noviembre de 2026");
        // La línea de dinero no dice con qué se paga: eso es lo que escribe el grupo, y la app no lo inventa.
        expect(money).not.toHaveTextContent(/efectivo|transferencia|CLABE|tarjeta|cuenta/i);
        // El texto del grupo no la dicta: sigue tal cual y por separado.
        expect(screen.getByText(groupNote.body)).toBeInTheDocument();
    });

    it("states the deposit while it has not landed", async () => {
        mocks.checkoutNotes.mockResolvedValue([groupNote]);

        renderNotes("Client", { deposit: { amount: 3000, receivedAt: null, dueDate: "2026-11-15" } });

        expect(await screen.findByText("Anticipo $3,000 · pendiente · para el 15 de noviembre de 2026")).toBeInTheDocument();
        expect(screen.queryByText(/falta pagar/i)).toBeNull();
    });

    it("says only the half it knows, and never invents an amount", async () => {
        mocks.checkoutNotes.mockResolvedValue([groupNote]);

        renderNotes("Client", { budget: null });

        const body = await screen.findByText(groupNote.body);
        const block = body.closest("section")!;
        expect(within(block).queryByText(/falta pagar|Anticipo \$/i)).toBeNull();
        // El resto del bloque sigue: cómo pagar no depende de que la app sepa la cifra.
        expect(within(block).getByText(concept)).toBeInTheDocument();
    });

    it("copies the money line and the concept before the group's words", async () => {
        const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
        stubClipboard(writeText);
        mocks.checkoutNotes.mockResolvedValue([groupNote]);

        renderNotes("Client", { budget: 13000, balanceDueDate: "2026-11-15" });
        await userEvent.click(await screen.findByRole("button", { name: "Copiar los datos de pago" }));

        expect(writeText).toHaveBeenCalledWith(
            [
                "Saldo: falta pagar $9,000 · para el 15 de noviembre de 2026",
                concept,
                groupNote.body,
                groupNote.managerLine,
            ].join("\n")
        );
    });

    it("copies the whole payment text and says honestly that it did", async () => {
        const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
        stubClipboard(writeText);
        mocks.checkoutNotes.mockResolvedValue([groupNote]);

        renderNotes();
        await userEvent.click(await screen.findByRole("button", { name: "Copiar los datos de pago" }));

        expect(writeText).toHaveBeenCalledWith(`Saldo: falta pagar $14,000\n${concept}\n${groupNote.body}\n${groupNote.managerLine}`);
        expect(await screen.findByRole("status")).toHaveTextContent("Texto de pago copiado. Pégalo en tu banco.");
    });

    it("copies from the keyboard, like any other button", async () => {
        const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
        stubClipboard(writeText);
        mocks.checkoutNotes.mockResolvedValue([groupNote]);

        renderNotes();
        await screen.findByRole("button", { name: "Copiar los datos de pago" });

        // El único control del bloque se alcanza con Tab y responde a Enter.
        await userEvent.tab();
        expect(screen.getByRole("button", { name: "Copiar los datos de pago" })).toHaveFocus();
        await userEvent.keyboard("{Enter}");

        expect(writeText).toHaveBeenCalledTimes(1);
        expect(await screen.findByRole("status")).toHaveTextContent("Texto de pago copiado");
    });

    it("does not claim it copied anything when the clipboard refuses", async () => {
        const writeText = vi.fn<(text: string) => Promise<void>>().mockRejectedValue(new Error("denied"));
        stubClipboard(writeText);
        mocks.checkoutNotes.mockResolvedValue([groupNote]);

        renderNotes();
        await userEvent.click(await screen.findByRole("button", { name: "Copiar los datos de pago" }));

        const message = await screen.findByRole("status");
        expect(message).toHaveTextContent("No se pudo copiar. Selecciona el texto y cópialo a mano.");
        expect(message).not.toHaveTextContent(/copiado/i);
    });

    it("still tells how to pay when there is no clipboard at all", async () => {
        mocks.checkoutNotes.mockResolvedValue([groupNote]);

        renderNotes();
        await userEvent.click(await screen.findByRole("button", { name: "Copiar los datos de pago" }));

        expect(await screen.findByRole("status")).toHaveTextContent("No se pudo copiar.");
        expect(screen.getByText(groupNote.body)).toBeInTheDocument();
    });

    it("never asks for the notes as the group, nor for a request that is not accepted", () => {
        mocks.checkoutNotes.mockClear();
        renderNotes("Group");
        renderNotes("Client", { status: "Pending" });

        expect(mocks.checkoutNotes).not.toHaveBeenCalled();
    });

    it("says nothing once nothing is left to pay, and does not even ask for the notes", async () => {
        mocks.checkoutNotes.mockClear();

        const { container } = renderNotes("Client", { balanceReceivedAt: "2026-12-13T15:00:00Z" });

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
