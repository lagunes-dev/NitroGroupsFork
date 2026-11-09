// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RequestThread } from "./RequestThread";
import type { EventRequest } from "../types";

const mocks = vi.hoisted(() => ({
    get: vi.fn(),
    signals: vi.fn(),
    checkoutNotes: vi.fn(),
    accept: vi.fn(),
    decline: vi.fn(),
    cancel: vi.fn(),
    postMessage: vi.fn(),
}));

vi.mock("../bookings.service", () => ({
    bookingsService: {
        get: mocks.get,
        signals: mocks.signals,
        checkoutNotes: mocks.checkoutNotes,
        accept: mocks.accept,
        decline: mocks.decline,
        cancel: mocks.cancel,
        postMessage: mocks.postMessage,
    },
    apiErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

/** Las notas de "cómo pagar" no son de este archivo: por defecto no hay ninguna que dibujar. */
beforeEach(() => {
    mocks.checkoutNotes.mockReset();
    mocks.checkoutNotes.mockResolvedValue([]);
    // Cancelar sí se llama en esta ronda: sin reiniciarlo, el conteo de un test se lee en el siguiente.
    mocks.cancel.mockReset();
});

const request: EventRequest = {
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
    status: "Pending",
    isSelfBooked: false,
    createdAt: "2026-10-01T18:00:00Z",
    respondedAt: null,
    responseMessage: null,
    messages: [
        {
            id: 1,
            senderUserId: 200,
            senderParty: "Client",
            senderName: "Camila R.",
            body: "Buscamos banda para la entrada y el vals.",
            createdAt: "2026-10-01T18:00:00Z",
        },
    ],
};

function renderThread(viewer: "Group" | "Client") {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <RequestThread requestId={11} viewer={viewer} />
        </QueryClientProvider>
    );
}

describe("RequestThread signals", () => {
    it("gives the group the two signals above the conversation", async () => {
        mocks.get.mockResolvedValue(request);
        mocks.signals.mockResolvedValue({
            dateClash: { clashes: true, withGig: { id: 77, eventType: "Boda", locationText: "Hacienda San Gabriel" } },
            budget: { offered: 9000, baseRate: 12000, status: "Below" },
        });

        renderThread("Group");

        expect(
            await screen.findByText("Ese día ya tienes un toque: Boda en Hacienda San Gabriel")
        ).toBeInTheDocument();
        expect(screen.getByText("Está por debajo de tu tarifa base.")).toBeInTheDocument();
        expect(mocks.signals).toHaveBeenCalledWith(1, 11);
    });

    it("keeps the signals away from the client's thread", async () => {
        mocks.get.mockResolvedValue(request);
        mocks.signals.mockReset();
        mocks.signals.mockResolvedValue({});

        renderThread("Client");

        expect(await screen.findByText("Versátil Rock y Pop")).toBeInTheDocument();
        expect(screen.queryByText(/Ese día/)).toBeNull();
        expect(mocks.signals).not.toHaveBeenCalled();
    });

    it("still shows the whole thread when the signals fail", async () => {
        mocks.get.mockResolvedValue(request);
        mocks.signals.mockRejectedValue(new Error("boom"));

        renderThread("Group");

        expect(await screen.findByText("Buscamos banda para la entrada y el vals.")).toBeInTheDocument();
        expect(screen.queryByText(/Ese día/)).toBeNull();
    });
});

describe("RequestThread deal", () => {
    const accepted: EventRequest = {
        ...request,
        status: "Accepted",
        budget: 18000,
        deposit: { amount: 4000, receivedAt: "2026-11-05T18:00:00Z" },
    };

    it("gives the client's accepted thread a balance block before the spec list", async () => {
        mocks.get.mockResolvedValue(accepted);
        renderThread("Client");

        const balance = await screen.findByText("Saldo: falta pagar $14,000");
        // Layout cannot be measured in jsdom: the size class and the DOM order are the decision.
        expect(balance).toHaveClass("text-2xl");
        // Ronda 10: un plazo dice el año; "5 de diciembre" solo era ambiguo junto a una fecha con año.
        expect(screen.getByText("para el 5 de diciembre de 2026")).toBeInTheDocument();
        expect(screen.getByText("Próximo paso")).toBeInTheDocument();
        expect(screen.getByText("Paga $14,000.")).toBeInTheDocument();

        const block = balance.closest("section") as HTMLElement;
        const specs = document.querySelector("dl") as HTMLElement;
        expect(block.compareDocumentPosition(specs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(block).toContainElement(screen.getByText("Próximo paso"));
    });

    it("does not repeat the balance as a row of the spec list", async () => {
        mocks.get.mockResolvedValue(accepted);
        renderThread("Client");

        await screen.findByText("Saldo: falta pagar $14,000");
        expect(screen.queryByText("Saldo")).toBeNull();
        expect(document.querySelector("dl")).not.toHaveTextContent(/falta pagar/i);
    });

    it("draws no balance block while the deposit is pending or for the group", async () => {
        mocks.get.mockResolvedValue({ ...accepted, deposit: { amount: 4000, receivedAt: null } });
        const { unmount } = renderThread("Client");
        expect(await screen.findByText("Paga $4,000 de anticipo.")).toBeInTheDocument();
        expect(screen.queryByText(/falta pagar/i)).toBeNull();
        unmount();

        mocks.get.mockResolvedValue(accepted);
        mocks.signals.mockRejectedValue(new Error("boom"));
        renderThread("Group");
        expect(await screen.findByText("Buscamos banda para la entrada y el vals.")).toBeInTheDocument();
        expect(screen.queryByText(/falta pagar/i)).toBeNull();
        expect(screen.queryByText("Próximo paso")).toBeNull();
    });

    /**
     * Ronda 11 (la clienta): el 19 de diciembre el detalle mostraba "Falta pagar" y el encabezado
     * "Próximo paso"; el 4 de diciembre —el anticipo que vence en tres días— no mostraba ninguno de los
     * dos. El paso se dibuja donde hay un paso que decir, tenga o no tenga bloque de saldo al lado.
     */
    it("shows the next step with its heading on the event whose deposit is still pending", async () => {
        mocks.get.mockResolvedValue({
            ...accepted,
            eventDate: "2026-12-04",
            eventType: "Corporate",
            deposit: { amount: 4000, receivedAt: null, dueDate: "2026-11-10" },
        });

        renderThread("Client");

        // Los datos que ya estaban al lado, sin cambios.
        expect(await screen.findByText("$4,000 · pendiente · para el 10 de noviembre de 2026")).toBeInTheDocument();
        // Y el paso, con su encabezado, diciendo lo que de verdad falta.
        expect(screen.getByText("Próximo paso")).toBeInTheDocument();
        expect(screen.getByText("Paga $4,000 de anticipo antes del 10 de noviembre de 2026.")).toBeInTheDocument();
        expect(screen.queryByText(/falta pagar/i)).toBeNull();
    });

    it("keeps the heading next to the balance of the event that still owes money", async () => {
        mocks.get.mockResolvedValue({ ...accepted, eventDate: "2026-12-19", balanceDueDate: "2026-11-15" });

        renderThread("Client");

        await screen.findByText("Saldo: falta pagar $14,000 · para el 15 de noviembre de 2026");
        expect(screen.getByText("Próximo paso")).toBeInTheDocument();
        expect(screen.getByText("Paga $14,000 antes del 15 de noviembre de 2026.")).toBeInTheDocument();
    });

    it("calls an empty budget what the list calls it, never zero pesos", async () => {
        mocks.get.mockResolvedValue({ ...accepted, budget: 0, deposit: null });
        renderThread("Client");

        expect(await screen.findByText("Sin presupuesto")).toBeInTheDocument();
        expect(screen.queryByText("$0")).toBeNull();
    });
});

describe("RequestThread cómo pagar (ronda 9)", () => {
    const accepted: EventRequest = {
        ...request,
        status: "Accepted",
        budget: 18000,
        deposit: { amount: 4000, receivedAt: "2026-11-05T18:00:00Z" },
    };

    // Ronda 10: una sola nota. El texto del grupo es el único método y el manager va en su línea.
    const groupNote = {
        title: "Cómo pagar",
        body: "Transfiere a la CLABE 0121 8000 1234 5678, BBVA.",
        managerLine: "Te atiende Pedro Vargas.",
        userDescription: "Pagas directo al grupo; NitroGroups no cobra ni interviene.",
        updatedOn: "2026-11-05",
    };

    it("gives the client how to pay, right after the balance and the deposit", async () => {
        mocks.get.mockResolvedValue(accepted);
        mocks.checkoutNotes.mockResolvedValue([groupNote]);

        renderThread("Client");

        const note = await screen.findByText(groupNote.body);
        expect(screen.getByText("Actualizado el 5 de noviembre")).toBeInTheDocument();
        expect(mocks.checkoutNotes).toHaveBeenCalledWith(11);

        // El saldo manda, y cómo pagar viene justo después: es la misma pregunta con la otra mitad.
        const balance = within(screen.getByRole("region", { name: "Saldo y próximo paso" })).getByText("Saldo: falta pagar $14,000");
        expect(balance.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("keeps the thread usable when the notes cannot be read", async () => {
        mocks.get.mockResolvedValue(accepted);
        mocks.checkoutNotes.mockRejectedValue(new Error("boom"));

        renderThread("Client");

        expect(await screen.findByText("Buscamos banda para la entrada y el vals.")).toBeInTheDocument();
        expect(screen.queryByText(/Actualizado el/)).toBeNull();
    });

    it("never shows them to the group: the manager inbox is not where the client pays", async () => {
        mocks.get.mockResolvedValue(accepted);
        mocks.signals.mockResolvedValue({});
        mocks.checkoutNotes.mockClear();

        renderThread("Group");

        await screen.findByRole("heading", { name: "Camila Ramos" });
        expect(mocks.checkoutNotes).not.toHaveBeenCalled();
        expect(screen.queryByText(groupNote.body)).toBeNull();
    });

    // Ronda 10: en el aniversario ya pagado el cliente seguía leyendo "Cómo pagar" y una CLABE bajo
    // un encabezado que decía "No queda nada por pagar". El bloque se calla, como la línea del saldo.
    it("says nothing on an event the group already recorded as paid", async () => {
        mocks.get.mockResolvedValue({ ...accepted, balanceReceivedAt: "2026-12-13T15:00:00Z" });
        mocks.checkoutNotes.mockClear();

        renderThread("Client");

        await screen.findByText(/Saldo recibido el 13 de diciembre de 2026/);
        expect(screen.getByText("No queda nada por pagar.")).toBeInTheDocument();
        expect(screen.queryByText("Cómo pagar")).toBeNull();
        expect(mocks.checkoutNotes).not.toHaveBeenCalled();
    });

    it("says nothing when the deposit already covered the whole budget", async () => {
        mocks.get.mockResolvedValue({ ...accepted, budget: 4000 });
        mocks.checkoutNotes.mockClear();

        renderThread("Client");

        // Sin nada pendiente el próximo paso ya lo dice: no hay bloque de saldo ni nota de pago.
        await screen.findByText("No queda nada por pagar.");
        expect(screen.queryByText("Cómo pagar")).toBeNull();
        expect(screen.queryByText(/falta pagar/i)).toBeNull();
        expect(mocks.checkoutNotes).not.toHaveBeenCalled();
    });
});

describe("RequestThread cancel on a past event (T52)", () => {
    const past: EventRequest = { ...request, status: "Accepted", eventDate: "2020-10-24", respondedAt: "2020-09-01T18:00:00Z" };

    it("does not offer to cancel an accepted event whose date already passed, and keeps the message and the review", async () => {
        mocks.get.mockResolvedValue({ ...past, canReview: true, review: null });
        mocks.signals.mockResolvedValue({});

        renderThread("Client");

        await screen.findByRole("heading", { name: "Versátil Rock y Pop" });
        expect(screen.queryByRole("button", { name: "Cancelar solicitud" })).toBeNull();
        // Lo que sí sigue: hablar con el grupo y escribir la reseña del evento que ya pasó.
        expect(screen.getByLabelText("Escribir un mensaje")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Enviar mensaje" })).toBeInTheDocument();
        expect(screen.getByRole("radiogroup", { name: "Tu calificación" })).toBeInTheDocument();
    });

    it("does not offer it to the group either", async () => {
        mocks.get.mockResolvedValue(past);
        mocks.signals.mockResolvedValue({});

        renderThread("Group");

        await screen.findByRole("heading", { name: "Camila Ramos" });
        expect(screen.queryByRole("button", { name: "Cancelar solicitud" })).toBeNull();
    });

    it("still cancels a future accepted event exactly as today", async () => {
        mocks.get.mockResolvedValue({ ...request, status: "Accepted", eventDate: "2099-12-05", respondedAt: "2099-10-02T18:00:00Z" });
        mocks.signals.mockResolvedValue({});

        renderThread("Client");

        expect(await screen.findByRole("button", { name: "Cancelar solicitud" })).toBeInTheDocument();
    });
});

describe("RequestThread cancel and the money already paid (rondas 12 y 13)", () => {
    const future: EventRequest = { ...request, status: "Accepted", eventDate: "2099-12-05", respondedAt: "2099-10-02T18:00:00Z" };

    /**
     * Ronda 12 (la clienta): canceló un evento donde ya había pagado $3,000 de anticipo y el diálogo
     * solo avisaba que el grupo se enteraría. La plata ya pagada no se cancela con el pedido (D1).
     * Ronda 13: ese diálogo tampoco era de la app —era el `confirm()` del navegador—, así que ahora es
     * el mismo diálogo de "bloquear" y "mover", con la frase de la plata en su propio renglón.
     */
    it("asks in the app's own dialog, with the sentence about the money already paid", async () => {
        const nativeConfirm = vi.spyOn(window, "confirm");
        mocks.get.mockResolvedValue({ ...future, deposit: { amount: 3000, receivedAt: "2099-01-05T18:00:00Z" } });
        mocks.signals.mockResolvedValue({});

        renderThread("Client");
        await userEvent.click(await screen.findByRole("button", { name: "Cancelar solicitud" }));

        const dialog = screen.getByRole("dialog", { name: "Cancelar esta solicitud" });
        expect(within(dialog).getByText("El grupo recibirá un aviso.")).toBeInTheDocument();
        expect(
            within(dialog).getByText("Lo que ya pagaste lo arreglas con el grupo: la app no cobra ni devuelve nada.")
        ).toBeInTheDocument();
        // El navegador ya no pregunta nada: la pregunta es de la app.
        expect(nativeConfirm).not.toHaveBeenCalled();
        expect(mocks.cancel).not.toHaveBeenCalled();
        nativeConfirm.mockRestore();
    });

    it("keeps today's words when no money was recorded, without talking about money", async () => {
        mocks.get.mockResolvedValue(future);
        mocks.signals.mockResolvedValue({});

        renderThread("Client");
        await userEvent.click(await screen.findByRole("button", { name: "Cancelar solicitud" }));

        const dialog = screen.getByRole("dialog", { name: "Cancelar esta solicitud" });
        expect(within(dialog).getByText("El grupo recibirá un aviso.")).toBeInTheDocument();
        expect(within(dialog).queryByText(/ya pagaste/)).toBeNull();
    });

    it("cancels the request only when she confirms", async () => {
        mocks.get.mockResolvedValue(future);
        mocks.signals.mockResolvedValue({});
        mocks.cancel.mockResolvedValue({ ...future, status: "Cancelled" });

        renderThread("Client");
        await userEvent.click(await screen.findByRole("button", { name: "Cancelar solicitud" }));
        await userEvent.click(screen.getByRole("button", { name: "Cancelar la solicitud" }));

        expect(mocks.cancel).toHaveBeenCalledTimes(1);
    });

    it("leaves the request alone and returns the focus where it came from when she backs out", async () => {
        mocks.get.mockResolvedValue(future);
        mocks.signals.mockResolvedValue({});

        renderThread("Client");
        const trigger = await screen.findByRole("button", { name: "Cancelar solicitud" });
        await userEvent.click(trigger);
        await userEvent.click(screen.getByRole("button", { name: "Volver" }));

        expect(mocks.cancel).not.toHaveBeenCalled();
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(trigger).toHaveFocus();
    });
});

describe("RequestThread: a disabled action says why (ronda 13, tarea 4)", () => {
    it("says what is missing while 'Enviar mensaje' is off", async () => {
        mocks.get.mockResolvedValue(request);
        mocks.signals.mockResolvedValue({});

        renderThread("Client");

        expect(await screen.findByRole("button", { name: "Enviar mensaje" })).toBeDisabled();
        expect(screen.getByText("Escribe tu mensaje.")).toBeInTheDocument();

        await userEvent.type(screen.getByLabelText("Escribir un mensaje"), "Hola");

        expect(screen.queryByText("Escribe tu mensaje.")).toBeNull();
        expect(screen.getByRole("button", { name: "Enviar mensaje" })).toBeEnabled();
    });
});

describe("RequestThread search context", () => {
    it("takes the date of a closed request to the search, so nobody retypes it", async () => {
        mocks.get.mockResolvedValue({ ...request, status: "Declined", respondedAt: "2026-10-02T18:00:00Z" });
        renderThread("Client");

        const link = await screen.findByRole("link", { name: /Ver otros grupos libres el/ });
        // The rejecting group travels too, so the search does not offer it as free again (T41).
        expect(link).toHaveAttribute("href", `/groups?fecha=2026-12-05&excluir=${request.groupId}`);
    });
});

describe("RequestThread balance received (T48)", () => {
    const accepted: EventRequest = {
        ...request,
        status: "Accepted",
        deposit: { amount: 4000, receivedAt: "2026-11-05T18:00:00Z" },
    };

    it("replaces the debt with the fact in the client's balance block", async () => {
        mocks.get.mockResolvedValue({ ...accepted, balanceReceivedAt: "2026-12-13T15:00:00Z" });

        renderThread("Client");

        const block = await screen.findByRole("region", { name: "Saldo y próximo paso" });
        expect(block).toHaveTextContent("Saldo recibido el 13 de diciembre de 2026 · $14,000");
        expect(block).toHaveTextContent("No queda nada por pagar.");
        expect(block).not.toHaveTextContent(/falta pagar|Acuerda el saldo/i);
    });

    it("keeps the debt block until the balance is recorded", async () => {
        mocks.get.mockResolvedValue(accepted);

        renderThread("Client");

        const block = await screen.findByRole("region", { name: "Saldo y próximo paso" });
        expect(block).toHaveTextContent("Saldo: falta pagar $14,000");
    });

    it("does not show the group's view any balance", async () => {
        mocks.get.mockResolvedValue({ ...accepted, balanceReceivedAt: "2026-12-13T15:00:00Z" });
        mocks.signals.mockResolvedValue({});

        renderThread("Group");

        await screen.findByRole("region", { name: "Conversación" });
        expect(screen.queryByText(/Saldo recibido/)).toBeNull();
        expect(screen.queryByRole("region", { name: "Saldo y próximo paso" })).toBeNull();
    });
});
