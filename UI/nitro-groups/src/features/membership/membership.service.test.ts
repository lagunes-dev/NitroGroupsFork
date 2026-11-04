import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ apiClient: { get, post } }));

import { membershipService } from "./membership.service";

beforeEach(() => {
    get.mockReset();
    post.mockReset();
});

const row = { id: 7, groupId: 3, musicianUserId: 9, musicianName: "Ana", counterpartName: "Ana", direction: 1, status: 0, message: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: null };

describe("membershipService", () => {
    it("busca músicos abiertos con los parámetros ya normalizados", async () => {
        get.mockResolvedValue({ data: { items: [], pageNumber: 1, pageSize: 10, totalCount: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false } });
        await membershipService.searchOpenMusicians("  ana ", 2, 10);
        expect(get).toHaveBeenCalledWith("/musicians/open-to-join", { params: { query: "ana", page: 2, size: 10 } });
    });

    it("invita con musicianUserId y mensaje opcional", async () => {
        post.mockResolvedValue({ data: row });
        await membershipService.invite(3, 9, "Ven a tocar");
        expect(post).toHaveBeenCalledWith("/groups/3/membership-invitations", { musicianUserId: 9, message: "Ven a tocar" });
        await membershipService.invite(3, 9, "   ");
        expect(post).toHaveBeenLastCalledWith("/groups/3/membership-invitations", { musicianUserId: 9, message: undefined });
    });

    it("lista las del grupo con filtros opcionales y normaliza los enums numéricos", async () => {
        get.mockResolvedValue({ data: [row, { ...row, id: 8, direction: "Invitation", status: "Accepted" }] });
        const result = await membershipService.forGroup(3, { direction: "Request" });
        expect(get).toHaveBeenCalledWith("/groups/3/membership-requests", { params: { direction: "Request" } });
        expect(result.map((r) => [r.direction, r.status])).toEqual([["Request", "Pending"], ["Invitation", "Accepted"]]);
        await membershipService.forGroup(3);
        expect(get).toHaveBeenLastCalledWith("/groups/3/membership-requests", { params: undefined });
    });

    it.each(["accept", "decline", "cancel"] as const)("%s hace POST a la ruta correspondiente", async (action) => {
        post.mockResolvedValue({ data: row });
        await membershipService[action](7);
        expect(post).toHaveBeenCalledWith(`/membership-requests/7/${action}`);
    });
});
