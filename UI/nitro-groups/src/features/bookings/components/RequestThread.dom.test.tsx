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
