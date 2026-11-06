// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RequestThread } from "./RequestThread";
import type { EventRequest } from "../types";

const mocks = vi.hoisted(() => ({
    get: vi.fn(),
    signals: vi.fn(),
    accept: vi.fn(),
    decline: vi.fn(),
    cancel: vi.fn(),
    postMessage: vi.fn(),
}));

vi.mock("../bookings.service", () => ({
    bookingsService: {
        get: mocks.get,
        signals: mocks.signals,
        accept: mocks.accept,
        decline: mocks.decline,
        cancel: mocks.cancel,
        postMessage: mocks.postMessage,
    },
    apiErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

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

        const balance = await screen.findByText("Falta pagar $14,000");
        // Layout cannot be measured in jsdom: the size class and the DOM order are the decision.
        expect(balance).toHaveClass("text-2xl");
        expect(screen.getByText("para el 5 de diciembre")).toBeInTheDocument();
        expect(screen.getByText("Próximo paso")).toBeInTheDocument();
        expect(screen.getByText("Acuerda el saldo con el grupo para el día del evento.")).toBeInTheDocument();

        const block = balance.closest("section") as HTMLElement;
        const specs = document.querySelector("dl") as HTMLElement;
        expect(block.compareDocumentPosition(specs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(block).toContainElement(screen.getByText("Próximo paso"));
    });

    it("does not repeat the balance as a row of the spec list", async () => {
        mocks.get.mockResolvedValue(accepted);
        renderThread("Client");

        await screen.findByText("Falta pagar $14,000");
        expect(screen.queryByText("Saldo")).toBeNull();
        expect(document.querySelector("dl")).not.toHaveTextContent("Falta pagar");
    });

    it("draws no balance block while the deposit is pending or for the group", async () => {
        mocks.get.mockResolvedValue({ ...accepted, deposit: { amount: 4000, receivedAt: null } });
        const { unmount } = renderThread("Client");
        expect(await screen.findByText("Acuerda el anticipo con el grupo para cerrar la fecha.")).toBeInTheDocument();
        expect(screen.queryByText("Próximo paso")).toBeNull();
        unmount();

        mocks.get.mockResolvedValue(accepted);
        mocks.signals.mockRejectedValue(new Error("boom"));
        renderThread("Group");
        expect(await screen.findByText("Buscamos banda para la entrada y el vals.")).toBeInTheDocument();
        expect(screen.queryByText(/Falta pagar/)).toBeNull();
        expect(screen.queryByText("Próximo paso")).toBeNull();
    });

    it("calls an empty budget what the list calls it, never zero pesos", async () => {
        mocks.get.mockResolvedValue({ ...accepted, budget: 0, deposit: null });
        renderThread("Client");

        expect(await screen.findByText("Sin presupuesto")).toBeInTheDocument();
        expect(screen.queryByText("$0")).toBeNull();
    });
});

describe("RequestThread search context", () => {
    it("takes the date of a closed request to the search, so nobody retypes it", async () => {
        mocks.get.mockResolvedValue({ ...request, status: "Declined", respondedAt: "2026-10-02T18:00:00Z" });
        renderThread("Client");

        const link = await screen.findByRole("link", { name: /Ver otros grupos libres el/ });
        expect(link).toHaveAttribute("href", "/groups?fecha=2026-12-05");
    });
});
