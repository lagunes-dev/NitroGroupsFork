// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PublicGroupReviews } from "./PublicGroupReviews";
import type { GroupReviewsPage } from "../types/GroupReviews";

const mocks = vi.hoisted(() => ({ page: vi.fn() }));
vi.mock("../services/reviews.service", () => ({ reviewsService: { page: mocks.page } }));

const first: GroupReviewsPage = {
    summary: { average: 3.5, count: 12 },
    items: [
        { rating: 4, comment: "Tocaron toda la noche.\nLa pista no se vació.", createdAt: "2026-09-12T18:00:00Z", eventType: "Wedding", authorName: "Camila R." },
        { rating: 3, comment: null, createdAt: "2026-08-01T18:00:00Z", eventType: "Birthday", authorName: "Mateo L." },
    ],
    totalCount: 12,
    pageNumber: 1,
    pageSize: 2,
    hasNextPage: true,
    hasPreviousPage: false,
};

beforeEach(() => { mocks.page.mockReset(); });

describe("PublicGroupReviews", () => {
    it("shows the summary and the first page with rating, comment, date, event type and author", () => {
        render(<PublicGroupReviews groupId={5} initial={first} fallbackAverage={3.5} fallbackCount={12} />);

        expect(screen.getByRole("heading", { name: "Reseñas" })).toBeInTheDocument();
        expect(screen.getByText("3.5 de 5 · 12 reseñas")).toBeInTheDocument();

        const items = within(screen.getByRole("list", { name: "Reseñas del grupo" })).getAllByRole("listitem");
        expect(items).toHaveLength(2);
        expect(within(items[0]).getByText("4 de 5")).toBeInTheDocument();
        expect(within(items[0]).getByText(/Tocaron toda la noche\./)).toBeInTheDocument();
        expect(within(items[0]).getByText("Boda")).toBeInTheDocument();
        expect(within(items[0]).getByText("Camila R.")).toBeInTheDocument();
        expect(within(items[0]).getByText(/septiembre de 2026/)).toBeInTheDocument();
        expect(within(items[1]).getByText("Cumpleaños")).toBeInTheDocument();
    });

    it("keeps line breaks and never renders the comment as HTML", () => {
        const page = { ...first, hasNextPage: false, items: [{ ...first.items[0], comment: "<b>hola</b>\nadiós" }] };
        render(<PublicGroupReviews groupId={5} initial={page} fallbackAverage={4} fallbackCount={1} />);

        const comment = screen.getByText(/<b>hola<\/b>/);
        expect(comment.querySelector("b")).toBeNull();
        expect(comment).toHaveClass("whitespace-pre-line");
    });

    it("loads the next page in place and keeps the reviews already shown", async () => {
        mocks.page.mockResolvedValue({
            ...first,
            items: [{ rating: 5, comment: "Excelentes", createdAt: "2026-07-01T18:00:00Z", eventType: "Corporate", authorName: "Luis P." }],
            pageNumber: 2,
            hasNextPage: false,
            hasPreviousPage: true,
        });
        render(<PublicGroupReviews groupId={5} initial={first} fallbackAverage={3.5} fallbackCount={12} />);

        fireEvent.click(screen.getByRole("button", { name: "Ver más reseñas" }));

        expect(await screen.findByText("Luis P.")).toBeInTheDocument();
        expect(mocks.page).toHaveBeenCalledWith(5, 2, 2);
        expect(screen.getByText("Camila R.")).toBeInTheDocument();
        expect(screen.getByText("Mateo L.")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Ver más reseñas" })).toBeNull();
    });

    it("says so and keeps the button when loading more fails", async () => {
        mocks.page.mockImplementation(async () => { throw new Error("boom"); });
        render(<PublicGroupReviews groupId={5} initial={first} fallbackAverage={3.5} fallbackCount={12} />);

        fireEvent.click(screen.getByRole("button", { name: "Ver más reseñas" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar más reseñas. Inténtalo de nuevo.");
        await waitFor(() => expect(screen.getByRole("button", { name: "Ver más reseñas" })).toBeEnabled());
        expect(screen.getByText("Camila R.")).toBeInTheDocument();
    });

    it("explains an empty group in one line instead of a naked heading", () => {
        const empty = { ...first, summary: { average: 0, count: 0 }, items: [], totalCount: 0, hasNextPage: false };
        render(<PublicGroupReviews groupId={5} initial={empty} fallbackAverage={0} fallbackCount={0} />);

        expect(screen.getByRole("heading", { name: "Reseñas" })).toBeInTheDocument();
        expect(screen.getByText("Todavía no tiene reseñas")).toBeInTheDocument();
        expect(screen.queryByRole("list")).toBeNull();
        expect(screen.queryByRole("button")).toBeNull();
    });

    it("degrades to the aggregate the profile already knows when the read failed", () => {
        render(<PublicGroupReviews groupId={5} initial={null} fallbackAverage={3.5} fallbackCount={2} />);

        expect(screen.getByText("3.5 de 5 · 2 reseñas")).toBeInTheDocument();
        expect(screen.getByText("No pudimos cargar las reseñas ahora. Vuelve a intentarlo en un rato.")).toBeInTheDocument();
        expect(screen.queryByRole("list")).toBeNull();
    });

    it("degrades to the empty line when the read failed and there is no aggregate", () => {
        render(<PublicGroupReviews groupId={5} initial={null} fallbackAverage={0} fallbackCount={0} />);
        expect(screen.getByText("Todavía no tiene reseñas")).toBeInTheDocument();
    });

    it("uses the singular for one review", () => {
        const one = { ...first, summary: { average: 5, count: 1 }, items: [first.items[0]], totalCount: 1, hasNextPage: false };
        render(<PublicGroupReviews groupId={5} initial={one} fallbackAverage={5} fallbackCount={1} />);
        expect(screen.getByText("5.0 de 5 · 1 reseña")).toBeInTheDocument();
    });
});
