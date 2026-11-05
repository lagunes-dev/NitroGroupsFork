// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RequestSignals } from "./RequestSignals";

const { signals } = vi.hoisted(() => ({ signals: vi.fn() }));
vi.mock("../bookings.service", () => ({ bookingsService: { signals } }));

function renderBlock(viewer: "Group" | "Client" = "Group") {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <RequestSignals groupId={1} requestId={11} viewer={viewer} currency="MXN" />
        </QueryClientProvider>
    );
}

describe("RequestSignals", () => {
    it("tells the manager that the day already has another gig, and who it is", async () => {
        signals.mockResolvedValue({
            dateClash: { clashes: true, withGig: { id: 77, eventType: "Boda", locationText: "Hacienda San Gabriel" } },
            budget: { offered: 18000, baseRate: 12000, status: "Above" },
        });
        renderBlock();

        expect(
            await screen.findByText("Ese día ya tienes un toque: Boda en Hacienda San Gabriel")
        ).toBeInTheDocument();
        expect(screen.getByText("Ofrece $18,000 · tu tarifa base es $12,000")).toBeInTheDocument();
        expect(screen.getByText("Está por encima de tu tarifa base.")).toBeInTheDocument();
        expect(signals).toHaveBeenCalledWith(1, 11);
    });

    it("says the day is free and that the budget cannot be compared when data is missing", async () => {
        signals.mockResolvedValue({
            dateClash: { clashes: false, withGig: null },
            budget: { offered: null, baseRate: 12000, status: "Unknown" },
        });
        renderBlock();

        expect(await screen.findByText("Ese día no tienes otro toque.")).toBeInTheDocument();
        expect(screen.getByText("El cliente no indicó presupuesto · tu tarifa base es $12,000")).toBeInTheDocument();
        expect(
            screen.getByText("No podemos compararlos: falta el monto ofrecido o tu tarifa base.")
        ).toBeInTheDocument();
    });

    it("is only for the group: the client's view never asks for it nor shows it", async () => {
        signals.mockClear();
        signals.mockResolvedValue({});
        const { container } = renderBlock("Client");

        expect(container).toBeEmptyDOMElement();
        expect(signals).not.toHaveBeenCalled();
    });

    it("stays out of the way when the signals cannot be read: the thread is the work", async () => {
        signals.mockRejectedValue(new Error("boom"));
        const { container } = renderBlock();

        await vi.waitFor(() => expect(signals).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });
});
