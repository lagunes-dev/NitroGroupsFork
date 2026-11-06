// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AlreadyBookedNote } from "./AlreadyBookedNote";
import type { EventRequest } from "@/features/bookings/types";

const mocks = vi.hoisted(() => ({ mine: vi.fn(), user: vi.fn() }));

vi.mock("@/features/bookings/bookings.service", () => ({ bookingsService: { mine: mocks.mine } }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ user: mocks.user() }) }));

const accepted = {
    id: 8,
    groupId: 1,
    groupName: "Versátil Rock y Pop",
    groupSlug: "versatil-rock-y-pop",
    eventDate: "2026-11-19",
    status: "Accepted",
} as EventRequest;

function renderNote(fecha: string | null = "2026-11-19") {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <AlreadyBookedNote fecha={fecha} />
        </QueryClientProvider>
    );
}

beforeEach(() => {
    mocks.mine.mockReset();
    mocks.user.mockReturnValue({ id: 1 });
});

describe("AlreadyBookedNote", () => {
    it("links the group to its public profile and the client to the accepted request", async () => {
        mocks.mine.mockResolvedValue([accepted]);
        renderNote();

        const group = await screen.findByRole("link", { name: "Versátil Rock y Pop" });
        expect(group).toHaveAttribute("href", "/groups/versatil-rock-y-pop");
        const request = screen.getByRole("link", { name: "Ver mi pedido del jueves, 19 de noviembre de 2026" });
        expect(request).toHaveAttribute("href", "/solicitudes/8");
        expect(screen.getByRole("note")).toHaveTextContent("ya toca para ti el jueves, 19 de noviembre de 2026, por eso no aparece en la lista.");
    });

    it("draws nothing without a signed-in client, without a date or without an accepted request that day", async () => {
        mocks.mine.mockResolvedValue([accepted]);
        mocks.user.mockReturnValue(null);
        const first = renderNote();
        expect(screen.queryByRole("note")).toBeNull();
        first.unmount();

        mocks.user.mockReturnValue({ id: 1 });
        const second = renderNote(null);
        expect(screen.queryByRole("note")).toBeNull();
        second.unmount();

        renderNote("2026-11-20");
        await waitFor(() => expect(mocks.mine).toHaveBeenCalled());
        await new Promise((r) => setTimeout(r, 20));
        expect(screen.queryByRole("note")).toBeNull();
    });

    it("draws nothing when the read fails", async () => {
        mocks.mine.mockRejectedValue(new Error("boom"));
        renderNote();
        await waitFor(() => expect(mocks.mine).toHaveBeenCalled());
        await new Promise((r) => setTimeout(r, 20));
        expect(screen.queryByRole("note")).toBeNull();
    });
});
