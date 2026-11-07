// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MyAgenda } from "./MyAgenda";

const { useMyGigs, useMyGigNoticesToday } = vi.hoisted(() => ({ useMyGigs: vi.fn(), useMyGigNoticesToday: vi.fn() }));

// The reads are mocked; the rest of the module (cache keys) is the real one so the mutations keep working.
vi.mock("../gigs.queries", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../gigs.queries")>();
    return { ...actual, useMyGigs, useMyGigNoticesToday };
});
vi.mock("../gigs.service", () => ({ gigsService: { answer: vi.fn(), notify: vi.fn() } }));

/** A day away from the boundary, so the test does not hinge on the hour the suite runs. */
const inDays = (days: number) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
};

const row = {
    id: 41,
    groupId: 1,
    groupName: "Versátil Rock y Pop",
    groupSlug: "versatil-rock-y-pop",
    startTime: "20:00:00",
    durationHours: 3,
    eventType: "Boda",
    locationText: "Hacienda San Gabriel, Tlaquepaque",
    role: "Member",
    attendance: "Confirmed",
};

function renderAgenda() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <MyAgenda />
        </QueryClientProvider>
    );
}

describe("MyAgenda", () => {
    it("does not ask for an answer on a gig whose date already passed", () => {
        useMyGigs.mockReturnValue({ data: [{ ...row, eventDate: inDays(-30) }], isPending: false, isError: false });
        useMyGigNoticesToday.mockReturnValue({ data: [] });

        renderAgenda();

        expect(screen.getByText("Este toque ya pasó")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /^Confirmar/ })).toBeNull();
        expect(screen.queryByRole("button", { name: /^Avisar que no puedo/ })).toBeNull();
        expect(screen.queryByRole("button", { name: /^Avisar que falta/ })).toBeNull();
    });

    it("still asks for an answer on a gig that is ahead", () => {
        useMyGigs.mockReturnValue({ data: [{ ...row, eventDate: inDays(30), attendance: null }], isPending: false, isError: false });
        useMyGigNoticesToday.mockReturnValue({ data: [] });

        renderAgenda();

        expect(screen.getByRole("button", { name: /^Confirmar/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^Avisar que no puedo/ })).toBeInTheDocument();
        expect(screen.queryByText("Este toque ya pasó")).toBeNull();
    });
});
