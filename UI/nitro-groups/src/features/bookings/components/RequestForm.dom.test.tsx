// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RequestForm } from "./RequestForm";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));

// El módulo real se conserva para que `apiErrorMessage` sea el de la app: la clienta tiene que leer
// el 409 donde lee los demás errores de envío.
vi.mock("../bookings.service", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../bookings.service")>();
    return { ...actual, bookingsService: { ...actual.bookingsService, create: mocks.create } };
});

const MESSAGE = "Buscamos mariachi para la entrada y el vals.";

function renderForm(props: Partial<ComponentProps<typeof RequestForm>> = {}) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <RequestForm
                groupId={1}
                groupName="Versátil Rock y Pop"
                minimumHours={2}
                basePrice={12000}
                currency="MXN"
                defaultDate="2099-12-05"
                {...props}
            />
        </QueryClientProvider>
    );
}

beforeEach(() => {
    mocks.create.mockReset();
    mocks.create.mockResolvedValue({ id: 42 });
});

describe("RequestForm: the budget far below the group's price (ronda 13, tarea 2)", () => {
    it("says the two figures out loud and still lets her send the request", async () => {
        renderForm();

        await userEvent.type(screen.getByLabelText(/Presupuesto/), "1000");

        expect(screen.getByText("Ofreces $1,000 y el grupo suele cobrar desde $12,000.")).toBeInTheDocument();

        await userEvent.type(screen.getByLabelText(/Mensaje para/), MESSAGE);
        await userEvent.type(screen.getByLabelText(/Lugar/), "Salón Los Arcos, Zapopan");
        const send = screen.getByRole("button", { name: "Enviar solicitud" });
        expect(send).toBeEnabled();
        await userEvent.click(send);

        expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ budget: 1000, groupId: 1 }), expect.anything());
    });

    it("says nothing at or above the base price", async () => {
        renderForm();

        await userEvent.type(screen.getByLabelText(/Presupuesto/), "12000");
        expect(screen.queryByText(/suele cobrar desde/)).toBeNull();

        await userEvent.clear(screen.getByLabelText(/Presupuesto/));
        await userEvent.type(screen.getByLabelText(/Presupuesto/), "15000");
        expect(screen.queryByText(/suele cobrar desde/)).toBeNull();
    });

    it("says nothing when the group has no price loaded", async () => {
        renderForm({ basePrice: null });

        await userEvent.type(screen.getByLabelText(/Presupuesto/), "1000");

        expect(screen.queryByText(/suele cobrar desde/)).toBeNull();
    });
});

describe("RequestForm: never cut what the client wrote without saying so (ronda 13, tarea 3)", () => {
    it("stops the message at its limit and says it in words next to the counter", async () => {
        renderForm();
        const message = screen.getByLabelText(/Mensaje para/);

        await userEvent.click(message);
        await userEvent.paste("x".repeat(2500));

        expect((message as HTMLTextAreaElement).value).toHaveLength(2000);
        expect(
            screen.getByText("2000 de 2000 · Pegaste más texto del que cabe: el campo se quedó con los primeros 2000 caracteres.")
        ).toBeInTheDocument();
    });

    it("applies the same rule to the place of the event", async () => {
        renderForm();
        const place = screen.getByLabelText(/Lugar/);

        await userEvent.click(place);
        await userEvent.paste("y".repeat(260));

        expect((place as HTMLInputElement).value).toHaveLength(200);
        expect(
            screen.getByText("Pegaste más texto del que cabe: el campo se quedó con los primeros 200 caracteres.")
        ).toBeInTheDocument();
    });
});

describe("RequestForm: a disabled action says why (ronda 13, tarea 4)", () => {
    it("says the date is missing, with the app's own sentence for that field", () => {
        renderForm({ defaultDate: undefined });

        expect(screen.getByRole("button", { name: "Enviar solicitud" })).toBeDisabled();
        expect(screen.getByText("Elige la fecha del evento.")).toBeInTheDocument();
    });

    it("says the message is still short, with the same rule the form validates", async () => {
        renderForm();

        expect(screen.getByRole("button", { name: "Enviar solicitud" })).toBeDisabled();
        expect(screen.getByText("Escribe al menos 10 caracteres.")).toBeInTheDocument();

        await userEvent.type(screen.getByLabelText(/Mensaje para/), MESSAGE);
        expect(screen.queryByText("Escribe al menos 10 caracteres.")).toBeNull();
        expect(screen.getByRole("button", { name: "Enviar solicitud" })).toBeEnabled();
    });
});

describe("RequestForm: the API's answer lands where the other submit errors land (ronda 13, tarea 1)", () => {
    it("shows the 409 that says she already asked this group for that date", async () => {
        mocks.create.mockRejectedValue({
            response: { data: { detail: "Ya tienes una solicitud con este grupo para esa fecha." } },
        });
        renderForm();

        await userEvent.type(screen.getByLabelText(/Lugar/), "Salón Los Arcos, Zapopan");
        await userEvent.type(screen.getByLabelText(/Mensaje para/), MESSAGE);
        await userEvent.click(screen.getByRole("button", { name: "Enviar solicitud" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Ya tienes una solicitud con este grupo para esa fecha.");
    });

    it("shows the 409 that says the day is already confirmed with this group", async () => {
        mocks.create.mockRejectedValue({ response: { data: { detail: "Ya tienes ese día confirmado con este grupo." } } });
        renderForm();

        await userEvent.type(screen.getByLabelText(/Lugar/), "Salón Los Arcos, Zapopan");
        await userEvent.type(screen.getByLabelText(/Mensaje para/), MESSAGE);
        await userEvent.click(screen.getByRole("button", { name: "Enviar solicitud" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Ya tienes ese día confirmado con este grupo.");
    });
});

describe("RequestForm: what it already did, kept", () => {
    it("sends every field of the request as it did before this round", async () => {
        renderForm();

        await userEvent.type(screen.getByLabelText(/Lugar/), "Salón Los Arcos, Zapopan");
        await userEvent.type(screen.getByLabelText(/Invitados/), "150");
        await userEvent.type(screen.getByLabelText(/Presupuesto/), "25000");
        await userEvent.type(screen.getByLabelText(/Mensaje para/), MESSAGE);
        await userEvent.click(screen.getByRole("button", { name: "Enviar solicitud" }));

        expect(mocks.create).toHaveBeenCalledWith(
            {
                groupId: 1,
                eventDate: "2099-12-05",
                startTime: null,
                durationHours: 2,
                eventType: "Boda",
                locationText: "Salón Los Arcos, Zapopan",
                guestCount: 150,
                budget: 25000,
                message: MESSAGE,
            },
            // El segundo argumento es el contexto de la mutación de TanStack Query, no parte del pedido.
            expect.anything()
        );
        expect(await screen.findByText("Solicitud enviada")).toBeInTheDocument();
    });
});
