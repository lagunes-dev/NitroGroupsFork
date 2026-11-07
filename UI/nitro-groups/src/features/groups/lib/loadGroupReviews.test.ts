import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadGroupReviews } from "./loadGroupReviews";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/serverApi", () => ({ serverGetResult: mocks.get }));

const page = { summary: { average: 4, count: 1 }, items: [], totalCount: 1, pageNumber: 1, pageSize: 10, hasNextPage: false, hasPreviousPage: false };

beforeEach(() => { mocks.get.mockReset(); });

describe("loadGroupReviews", () => {
    it("reads the first page of the group", async () => {
        mocks.get.mockResolvedValue({ ok: true, data: page });
        await expect(loadGroupReviews(5)).resolves.toBe(page);
        expect(mocks.get).toHaveBeenCalledWith("/groups/5/reviews?page=1&size=10", 60);
    });

    it("degrades to null when the read fails, never throws", async () => {
        mocks.get.mockResolvedValue({ ok: false, status: 500 });
        await expect(loadGroupReviews(5)).resolves.toBeNull();
        mocks.get.mockResolvedValue({ ok: false, status: 0 });
        await expect(loadGroupReviews(5)).resolves.toBeNull();
    });

    it("degrades to null when the body is not a page", async () => {
        mocks.get.mockResolvedValue({ ok: true, data: { nope: true } });
        await expect(loadGroupReviews(5)).resolves.toBeNull();
    });
});
