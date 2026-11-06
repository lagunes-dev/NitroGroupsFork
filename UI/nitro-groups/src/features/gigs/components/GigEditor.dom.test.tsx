// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GigEditor } from "./GigEditor";
import type { GroupGigPayload } from "../types";

const mocks = vi.hoisted(() => ({ saveDetails: vi.fn(), savePay: vi.fn() }));
vi.mock("../gigs.service", () => ({ gigsService: { saveDetails: mocks.saveDetails, savePay: mocks.savePay } }));

const row: GroupGigPayload = {
    id: 7,
    groupId: 1,
    eventDate: "2026-12-12",
    deposit: { amount: 4000, receivedAt: "2026-11-05T18:00:00Z" },
    attendees: [
        { userId: 5, fullName: "Mateo Ruiz", status: "Confirmed", pay: 2000 },
        { userId: 6, fullName: "Ana Leal", status: "Confirmed", pay: 1500, paidAt: "2026-12-13T16:00:00Z" },
        { userId: 7, fullName: "Luis Peña", status: "Confirmed", pay: null },
    ],
};

function renderEditor(gig: GroupGigPayload = row, onSaved = vi.fn()) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
        <QueryClientProvider client={client}>
            <GigEditor row={gig} groupId={1} idPrefix="toque-7" onSaved={onSaved} onCancel={vi.fn()} />
        </QueryClientProvider>
    );
    return onSaved;
}

describe("GigEditor money as data (T48)", () => {
    it("offers 'Saldo recibido' next to the deposit, with its state in words", async () => {
        renderEditor();
        const balance = screen.getByRole("checkbox", { name: /Saldo recibido/ });
        expect(balance).not.toBeChecked();
        expect(screen.getByText("Saldo pendiente")).toBeInTheDocument();

        await userEvent.click(balance);
        expect(balance).toBeChecked();
        expect(screen.getByText("Se registrará al guardar")).toBeInTheDocument();
    });

    it("shows the date once the balance is recorded", () => {
        renderEditor({ ...row, balanceReceivedAt: "2026-12-13T15:00:00Z" });
        expect(screen.getByRole("checkbox", { name: /Saldo recibido/ })).toBeChecked();
        expect(screen.getByText("Saldo recibido el 13 de diciembre de 2026")).toBeInTheDocument();
    });

    it("offers 'Pagado' per musician, with the date when recorded and pending when not", () => {
        renderEditor();
        expect(screen.getByRole("checkbox", { name: "Pagado a Mateo Ruiz" })).not.toBeChecked();
        expect(screen.getByRole("checkbox", { name: "Pagado a Ana Leal" })).toBeChecked();
        expect(screen.getByText("Pagado el 13 de diciembre de 2026")).toBeInTheDocument();
        expect(screen.getAllByText("Pendiente de pago")).toHaveLength(1);
    });

    it("does not offer 'Pagado' to a musician with no pay defined", () => {
        renderEditor();
        expect(screen.queryByRole("checkbox", { name: "Pagado a Luis Peña" })).toBeNull();
        expect(screen.getByText("Sin pago definido")).toBeInTheDocument();
    });

    it("works with the keyboard and keeps a 44px target", async () => {
        renderEditor();
        const paid = screen.getByRole("checkbox", { name: "Pagado a Mateo Ruiz" });
        paid.focus();
        await userEvent.keyboard(" ");
        expect(paid).toBeChecked();
        // jsdom measures no pixels: the min-h-11 class on the label is the decision (44px).
        expect(paid.closest("label")).toHaveClass("min-h-11");
        expect(screen.getByRole("checkbox", { name: /Saldo recibido/ }).closest("label")).toHaveClass("min-h-11");
    });

    it("saves the balance with the details and each paid state with the pay", async () => {
        mocks.saveDetails.mockResolvedValue({});
        mocks.savePay.mockResolvedValue({});
        const onSaved = renderEditor();

        await userEvent.click(screen.getByRole("checkbox", { name: /Saldo recibido/ }));
        await userEvent.click(screen.getByRole("checkbox", { name: "Pagado a Mateo Ruiz" }));
        await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

        await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
        expect(mocks.saveDetails).toHaveBeenCalledWith(1, 7, expect.objectContaining({ balanceReceived: true, depositReceived: true }));
        expect(mocks.savePay).toHaveBeenCalledWith(1, 7, {
            payments: [
                { userId: 5, amount: 2000, paid: true },
                { userId: 6, amount: 1500, paid: true },
            ],
        });
    });

    it("clears a recorded payment when the manager unchecks it", async () => {
        mocks.saveDetails.mockResolvedValue({});
        mocks.savePay.mockResolvedValue({});
        renderEditor();

        await userEvent.click(screen.getByRole("checkbox", { name: "Pagado a Ana Leal" }));
        expect(screen.getByText("Se quitará al guardar")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

        await vi.waitFor(() => expect(mocks.savePay).toHaveBeenCalled());
        expect(mocks.savePay.mock.calls.at(-1)?.[2].payments).toContainEqual({ userId: 6, amount: 1500, paid: false });
    });

    it("says clearly when the save fails and offers a retry", async () => {
        mocks.saveDetails.mockRejectedValue(new Error("boom"));
        const onSaved = renderEditor();

        await userEvent.click(screen.getByRole("checkbox", { name: /Saldo recibido/ }));
        await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos guardar los cambios del toque.");
        expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
        expect(onSaved).not.toHaveBeenCalled();
    });
});

describe("Fechas límite del anticipo y del saldo (T61, S24)", () => {
    const withDeadlines: GroupGigPayload = {
        ...row,
        deposit: { amount: 4000, receivedAt: null, dueDate: "2026-11-15" },
        balanceDueDate: "2026-12-12",
    };

    it("offers the two deadlines next to the deposit and the balance, with the saved day", () => {
        renderEditor(withDeadlines);
        expect(screen.getByRole("combobox", { name: "Fecha límite del anticipo" })).toHaveTextContent("dom 15 nov 2026");
        expect(screen.getByRole("combobox", { name: "Fecha límite del saldo" })).toHaveTextContent("sáb 12 dic 2026");
    });

    it("starts both empty when the manager never loaded one", () => {
        renderEditor();
        expect(screen.getByRole("combobox", { name: "Fecha límite del anticipo" })).toHaveTextContent("Selecciona una fecha");
        expect(screen.getByRole("combobox", { name: "Fecha límite del saldo" })).toHaveTextContent("Selecciona una fecha");
    });

    it("saves both deadlines with the details", async () => {
        mocks.saveDetails.mockResolvedValue({});
        mocks.savePay.mockResolvedValue({});
        const onSaved = renderEditor(withDeadlines);

        await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

        await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
        expect(mocks.saveDetails).toHaveBeenCalledWith(
            1,
            7,
            expect.objectContaining({ depositDueDate: "2026-11-15", balanceDueDate: "2026-12-12" })
        );
    });

    it("lets the manager pick a day and clear one", async () => {
        const user = userEvent.setup();
        mocks.saveDetails.mockResolvedValue({});
        mocks.savePay.mockResolvedValue({});
        const onSaved = renderEditor(withDeadlines);

        await user.click(screen.getByRole("combobox", { name: "Fecha límite del anticipo" }));
        const calendar = screen.getByRole("dialog", { name: /Elegir fecha/ });
        await user.click(calendar.querySelector('[data-day="2026-11-24"] button') as HTMLElement);
        expect(screen.getByRole("combobox", { name: "Fecha límite del anticipo" })).toHaveTextContent("mar 24 nov 2026");

        await user.click(screen.getByRole("combobox", { name: "Fecha límite del saldo" }));
        await user.click(within(screen.getByRole("dialog", { name: /Elegir fecha/ })).getByRole("button", { name: "Borrar fecha" }));

        await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

        await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
        expect(mocks.saveDetails).toHaveBeenCalledWith(
            1,
            7,
            expect.objectContaining({ depositDueDate: "2026-11-24", balanceDueDate: null })
        );
    });
});

/** The cuadre as the manager reads it: each label with the figure next to it. */
function settlementLines(): Record<string, string> {
    const terms = screen.getAllByRole("term");
    const values = screen.getAllByRole("definition");
    return Object.fromEntries(terms.map((term, index) => [term.textContent ?? "", values[index]?.textContent ?? ""]));
}

describe("Cuadre del toque (T60, S23)", () => {
    const deal: GroupGigPayload = { ...row, budget: 15000, currency: "MXN" };

    it("shows the cachet total the client offered", () => {
        renderEditor(deal);
        expect(screen.getByRole("heading", { name: "Cuadre del toque" })).toBeInTheDocument();
        expect(settlementLines()["Cachet total"]).toBe("$15,000");
    });

    it("adds up every musician with a pay amount, whatever they answered", () => {
        // Mateo $2,000 + Ana $1,500 + Luis without a pay: the sum is what the editor already lists.
        renderEditor({ ...deal, attendees: [...(row.attendees ?? []), { userId: 8, fullName: "Eva Sol", status: "Declined", pay: 500 }] });
        expect(settlementLines()["Debes a tus músicos"]).toBe("$4,000");
    });

    it("states the difference between the cachet and what he owes", () => {
        renderEditor(deal);
        expect(settlementLines()["Diferencia"]).toBe("$11,500");
    });

    it("states a negative difference as a fact, never as an error", () => {
        // A cachet below the debt is said the same way: same row, no alert and no failure colour (D1/D2).
        renderEditor({ ...deal, budget: 2000 });
        expect(settlementLines()["Diferencia"]).toBe("-$1,500");
        expect(screen.getAllByRole("definition").at(-1)).not.toHaveClass("text-error");
        expect(screen.queryByRole("alert")).toBeNull();
    });

    it("says 'Sin presupuesto' when the client left it empty and does not invent a difference", () => {
        renderEditor({ ...row, budget: null, currency: "MXN" });
        const lines = settlementLines();
        expect(lines["Cachet total"]).toBe("Sin presupuesto");
        expect(lines["Debes a tus músicos"]).toBe("$3,500");
        expect(lines["Diferencia"]).toBe("No se puede calcular");
    });

    it("counts in the currency the request carries", () => {
        renderEditor({ ...deal, currency: "USD" });
        expect(settlementLines()["Cachet total"]).toMatch(/^USD\s15,000$/u);
        expect(settlementLines()["Diferencia"]).toMatch(/^USD\s11,500$/u);
    });

    it("stacks in one column and may wrap, so it fits a 390px screen", () => {
        renderEditor(deal);
        const list = screen.getAllByRole("term")[0].closest("dl");
        expect(list).toHaveClass("flex-col");
        // jsdom measures no pixels: the wrapping row is the decision, the browser proves the result.
        for (const term of screen.getAllByRole("term")) expect(term.parentElement).toHaveClass("flex-wrap");
    });
});
