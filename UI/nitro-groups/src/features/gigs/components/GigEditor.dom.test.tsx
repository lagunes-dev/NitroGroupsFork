// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
