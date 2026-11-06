// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RequestThread } from "./RequestThread";
import type { EventRequest } from "../types";

const mocks = vi.hoisted(() => ({ get: vi.fn(), review: vi.fn(), signals: vi.fn() }));

vi.mock("../bookings.service", () => ({
    bookingsService: {
        get: mocks.get,
        review: mocks.review,
        signals: mocks.signals,
        accept: vi.fn(),
        decline: vi.fn(),
        cancel: vi.fn(),
        postMessage: vi.fn(),
    },
    apiErrorMessage: (error: unknown, fallback: string) =>
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? fallback,
}));

const accepted: EventRequest = {
    id: 11,
    groupId: 1,
    groupName: "Versátil Rock y Pop",
    groupSlug: "versatil-rock-y-pop",
    clientName: "Camila Ramos",
    eventDate: "2026-05-05",
    startTime: "20:00:00",
    durationHours: 4,
    eventType: "Boda",
    locationText: "Hacienda San Gabriel",
    guestCount: 120,
    budget: 18000,
    currency: "MXN",
    message: "Boda con banda en vivo.",
    status: "Accepted",
    isSelfBooked: false,
    createdAt: "2026-01-01T18:00:00Z",
    respondedAt: "2026-01-02T18:00:00Z",
    responseMessage: null,
    messages: [],
    canReview: true,
    review: null,
};

function renderThread(viewer: "Group" | "Client", client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
    return { client, ...render(<QueryClientProvider client={client}><RequestThread requestId={11} viewer={viewer} /></QueryClientProvider>) };
}

const apiError = (status: number, detail: string) => Object.assign(new Error("x"), { response: { status, data: { detail } } });

beforeEach(() => {
    mocks.get.mockReset();
    mocks.review.mockReset();
    mocks.signals.mockReset();
    mocks.signals.mockResolvedValue({});
    mocks.get.mockResolvedValue(accepted);
});

describe("review form in the client's thread", () => {
    it("shows a radio group of five ratings, an optional comment with a counter and a submit button", async () => {
        renderThread("Client");

        const group = await screen.findByRole("radiogroup", { name: "Tu calificación" });
        expect(within5(group)).toHaveLength(5);
        expect(screen.getByLabelText("Comentario (opcional)")).toBeInTheDocument();
        expect(screen.getByText("0/1000")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Enviar reseña" })).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText("Comentario (opcional)"), { target: { value: "Muy bien" } });
        expect(screen.getByText("8/1000")).toBeInTheDocument();
    });

    it("asks for a rating before sending and posts nothing", async () => {
        renderThread("Client");
        fireEvent.click(await screen.findByRole("button", { name: "Enviar reseña" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Elige una calificación de 1 a 5.");
        expect(mocks.review).not.toHaveBeenCalled();
    });

    it("refuses a comment over 1000 characters without posting", async () => {
        renderThread("Client");
        fireEvent.click(await screen.findByRole("radio", { name: "5 de 5" }));
        fireEvent.change(screen.getByLabelText("Comentario (opcional)"), { target: { value: "x".repeat(1001) } });
        fireEvent.click(screen.getByRole("button", { name: "Enviar reseña" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("El comentario admite hasta 1000 caracteres.");
        expect(mocks.review).not.toHaveBeenCalled();
    });

    it("sends a comment of exactly 1000 characters and marks nothing as wrong", async () => {
        renderThread("Client");
        const field = await screen.findByLabelText("Comentario (opcional)");
        fireEvent.click(await screen.findByRole("radio", { name: "5 de 5" }));
        fireEvent.change(field, { target: { value: "x".repeat(1000) } });

        expect(screen.getByText("1000/1000")).toBeInTheDocument();
        expect(field).not.toHaveAttribute("aria-invalid");
        expect(screen.queryByRole("alert")).toBeNull();
        expect(screen.getByRole("button", { name: "Enviar reseña" })).toBeEnabled();
    });

    it("stops the client past 1000 characters, says why and never cuts the text", async () => {
        renderThread("Client");
        const field = (await screen.findByLabelText("Comentario (opcional)")) as HTMLTextAreaElement;
        fireEvent.click(await screen.findByRole("radio", { name: "5 de 5" }));

        fireEvent.change(field, { target: { value: "x".repeat(1100) } });

        expect(field.value).toHaveLength(1100); // el texto del cliente se conserva, no se recorta
        expect(field).toHaveAttribute("aria-invalid", "true");
        expect(field).toHaveAttribute("aria-describedby", "review-counter review-comment-error");
        expect(screen.getByText("1100/1000")).toHaveClass("text-error");
        const message = screen.getByRole("alert");
        expect(message).toHaveTextContent("El comentario admite hasta 1000 caracteres.");
        expect(message).toHaveAttribute("id", "review-comment-error");
        expect(screen.getByRole("button", { name: "Enviar reseña" })).toBeDisabled();

        fireEvent.click(screen.getByRole("button", { name: "Enviar reseña" }));
        expect(mocks.review).not.toHaveBeenCalled();
    });

    it("lets the client send again once the comment fits", async () => {
        renderThread("Client");
        const field = await screen.findByLabelText("Comentario (opcional)");
        fireEvent.click(await screen.findByRole("radio", { name: "5 de 5" }));
        fireEvent.change(field, { target: { value: "x".repeat(1100) } });
        expect(screen.getByRole("button", { name: "Enviar reseña" })).toBeDisabled();

        fireEvent.change(field, { target: { value: "x".repeat(999) } });

        expect(field).not.toHaveAttribute("aria-invalid");
        expect(screen.queryByRole("alert")).toBeNull();
        expect(screen.getByRole("button", { name: "Enviar reseña" })).toBeEnabled();
    });

    it("keeps the keyboard ring on every control of the form", async () => {
        renderThread("Client");
        const group = await screen.findByRole("radiogroup", { name: "Tu calificación" });
        const controls = [screen.getByLabelText("Comentario (opcional)"), ...Array.from(within5(group))];

        // `outline-none` sets `--tw-outline-style: none`, the very variable every `outline-*` utility
        // reads back, so a control that carries it paints no ring at all (T50). The ring is declared
        // once in globals.css; no control of this form may opt out of it by accident.
        for (const control of controls) {
            expect(control).not.toHaveClass("outline-none");
            expect(control.className).not.toMatch(/outline-(transparent|0)/);
        }
    });

    it.each([
        [409, "Todavía no puedes reseñar este evento."],
        [400, "La calificación debe estar entre 1 y 5."],
        [404, "No encontramos este evento."],
    ])("shows the message the API returns on %i and keeps the form", async (status, detail) => {
        mocks.review.mockRejectedValue(apiError(status, detail));
        renderThread("Client");

        fireEvent.click(await screen.findByRole("radio", { name: "4 de 5" }));
        fireEvent.click(screen.getByRole("button", { name: "Enviar reseña" }));

        expect(await screen.findByRole("alert")).toHaveTextContent(detail);
        expect(screen.getByRole("button", { name: "Enviar reseña" })).toBeEnabled();
    });

    it("disables itself while sending and posts the rating and the trimmed comment", async () => {
        let resolve: (v: unknown) => void = () => {};
        mocks.review.mockReturnValue(new Promise((r) => { resolve = r; }));
        renderThread("Client");

        fireEvent.click(await screen.findByRole("radio", { name: "4 de 5" }));
        fireEvent.change(screen.getByLabelText("Comentario (opcional)"), { target: { value: "  Muy bien  " } });
        fireEvent.click(screen.getByRole("button", { name: "Enviar reseña" }));

        expect(await screen.findByRole("button", { name: "Enviando…" })).toBeDisabled();
        expect(mocks.review).toHaveBeenCalledWith(11, { rating: 4, comment: "Muy bien" });
        resolve({ rating: 4, comment: "Muy bien", createdAt: "2026-05-06T10:00:00Z" });
    });

    it("omits an empty comment from the body", async () => {
        mocks.review.mockResolvedValue({ rating: 5, comment: null, createdAt: "2026-05-06T10:00:00Z" });
        renderThread("Client");
        fireEvent.click(await screen.findByRole("radio", { name: "5 de 5" }));
        fireEvent.click(screen.getByRole("button", { name: "Enviar reseña" }));

        await waitFor(() => expect(mocks.review).toHaveBeenCalledWith(11, { rating: 5 }));
    });

    it("replaces the form with the saved review and refreshes the client's lists", async () => {
        const saved = { rating: 4, comment: "Muy bien", createdAt: "2026-05-06T10:00:00Z" };
        mocks.review.mockImplementation(async () => {
            // From now on the API answers with the review it stored.
            mocks.get.mockResolvedValue({ ...accepted, canReview: false, review: saved });
            return saved;
        });
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const invalidate = vi.spyOn(client, "invalidateQueries");
        renderThread("Client", client);

        fireEvent.click(await screen.findByRole("radio", { name: "4 de 5" }));
        fireEvent.change(screen.getByLabelText("Comentario (opcional)"), { target: { value: "Muy bien" } });
        fireEvent.click(screen.getByRole("button", { name: "Enviar reseña" }));

        expect(await screen.findByText("Tu reseña")).toBeInTheDocument();
        expect(screen.getByText("Muy bien")).toBeInTheDocument();
        expect(screen.getByText("4 de 5")).toBeInTheDocument();
        expect(screen.queryByRole("radiogroup")).toBeNull();
        expect(screen.queryByRole("button", { name: "Enviar reseña" })).toBeNull();
        const keys = invalidate.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey));
        expect(keys).toEqual(expect.arrayContaining([
            JSON.stringify(["event-request", 11]),
            JSON.stringify(["event-requests", "mine"]),
            JSON.stringify(["my-event-requests"]),
        ]));
    });

    it("shows an existing review read-only and never the form", async () => {
        mocks.get.mockResolvedValue({ ...accepted, canReview: false, review: { rating: 5, comment: "Impecables", createdAt: "2026-05-06T10:00:00Z" } });
        renderThread("Client");

        expect(await screen.findByText("Tu reseña")).toBeInTheDocument();
        expect(screen.getByText("Impecables")).toBeInTheDocument();
        expect(screen.getByText("5 de 5")).toBeInTheDocument();
        expect(screen.queryByRole("radiogroup")).toBeNull();
        expect(screen.queryByRole("button", { name: "Enviar reseña" })).toBeNull();
    });

    it("shows neither form nor review when the request cannot be reviewed", async () => {
        mocks.get.mockResolvedValue({ ...accepted, canReview: false, review: null });
        renderThread("Client");

        await screen.findByText("Versátil Rock y Pop");
        expect(screen.queryByRole("radiogroup")).toBeNull();
        expect(screen.queryByText("Tu reseña")).toBeNull();
    });

    it("never gives the group's view of the same request the form or the review", async () => {
        mocks.get.mockResolvedValue({ ...accepted, review: null, canReview: true });
        const { unmount } = renderThread("Group");
        await screen.findByRole("heading", { name: "Camila Ramos" });
        expect(screen.queryByRole("radiogroup")).toBeNull();
        expect(screen.queryByRole("button", { name: "Enviar reseña" })).toBeNull();
        unmount();

        mocks.get.mockResolvedValue({ ...accepted, canReview: false, review: { rating: 5, comment: "x", createdAt: "2026-05-06T10:00:00Z" } });
        renderThread("Group");
        await screen.findByRole("heading", { name: "Camila Ramos" });
        expect(screen.queryByText("Tu reseña")).toBeNull();
    });
});

function within5(group: HTMLElement) {
    return group.querySelectorAll('input[type="radio"]');
}
