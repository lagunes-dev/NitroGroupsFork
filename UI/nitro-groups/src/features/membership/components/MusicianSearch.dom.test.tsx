// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MusicianSearch } from "./MusicianSearch";

const mocks = vi.hoisted(() => ({ search: vi.fn(), forGroup: vi.fn(), team: vi.fn(), invite: vi.fn() }));

vi.mock("../membership.service", () => ({
    membershipService: {
        searchOpenMusicians: mocks.search,
        forGroup: mocks.forGroup,
        team: mocks.team,
        invite: mocks.invite,
    },
}));

const musician = (userId: number, fullName: string) => ({
    userId,
    fullName,
    profilePictureUrl: null,
    yearsExperience: 4,
});

function renderSearch() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <MusicianSearch groupId={1} />
        </QueryClientProvider>,
    );
}

beforeEach(() => {
    vi.resetAllMocks();
    mocks.forGroup.mockResolvedValue([]);
    mocks.team.mockResolvedValue([]);
});

describe("MusicianSearch and the group's own team (T53)", () => {
    it("does not offer an invitation to someone who is already an active member, the manager included", async () => {
        mocks.search.mockResolvedValue({ items: [musician(12, "Mónica Manager"), musician(14, "Ana Libre")], totalCount: 2, pageNumber: 1, totalPages: 1, pageSize: 10, hasPreviousPage: false, hasNextPage: false });
        // 12 es quien administra el grupo: el directorio puede listarla, el equipo ya la tiene.
        mocks.team.mockResolvedValue([
            { userId: 12, fullName: "Mónica Manager", role: "Owner", profilePictureUrl: null, joinedAt: "2026-01-01T00:00:00Z" },
        ]);

        renderSearch();

        expect(await screen.findByRole("button", { name: "Mónica Manager ya está en el equipo" })).toBeDisabled();
        expect(screen.queryByRole("button", { name: "Invitar a Mónica Manager" })).toBeNull();
        // Quien no está en el equipo se sigue pudiendo invitar.
        expect(screen.getByRole("button", { name: "Invitar a Ana Libre" })).toBeEnabled();
    });

    it("keeps the pending-row label for a musician who already has a request", async () => {
        mocks.search.mockResolvedValue({ items: [musician(20, "Beto Pendiente")], totalCount: 1, pageNumber: 1, totalPages: 1, pageSize: 10, hasPreviousPage: false, hasNextPage: false });
        mocks.forGroup.mockResolvedValue([
            {
                id: 1, groupId: 1, groupName: "Los Test", groupSlug: "los-test", musicianUserId: 20, musicianName: "Beto Pendiente",
                initiatedByUserId: 20, direction: "Request", status: "Pending", message: null, resolvedByUserId: null,
                createdAt: "2026-01-01T00:00:00Z", updatedAt: null, counterpartName: "Beto Pendiente",
            },
        ]);

        renderSearch();

        expect(await screen.findByRole("button", { name: "Pidió unirse: Beto Pendiente" })).toBeDisabled();
        expect(screen.queryByRole("button", { name: "Invitar a Beto Pendiente" })).toBeNull();
    });
});
