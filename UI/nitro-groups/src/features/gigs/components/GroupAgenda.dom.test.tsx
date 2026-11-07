// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GroupAgenda } from "./GroupAgenda";
import type { GroupGigPayload } from "../types";

const { useGroupGigs, useGroupGigNotices } = vi.hoisted(() => ({ useGroupGigs: vi.fn(), useGroupGigNotices: vi.fn() }));

// Las lecturas se sustituyen; el resto del módulo (claves de caché) es el real.
vi.mock("../gigs.queries", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../gigs.queries")>();
    return { ...actual, useGroupGigs, useGroupGigNotices };
});
// El editor no es lo que este archivo mide: el renglón del manager sí.
vi.mock("./GigEditor", () => ({ GigEditor: () => <div>Editor del toque</div> }));

/** Un toque con cachet, anticipo recibido y una fecha límite del saldo (S24): lo que el manager lee. */
const gig: GroupGigPayload = {
    id: 9,
    groupId: 1,
    eventDate: "2026-11-19",
    startTime: "20:00:00",
    durationHours: 3,
    eventType: "Boda",
    locationText: "Hacienda San Gabriel, Tlaquepaque",
    budget: 14000,
    currency: "MXN",
    deposit: { amount: 7800, receivedAt: "2026-11-04T18:00:00Z" },
    balanceDueDate: "2026-11-15",
    balanceReceivedAt: null,
    attendees: [{ userId: 5, fullName: "Mateo", status: "Confirmed", pay: 2000 }],
};

function renderAgenda(row: GroupGigPayload = gig) {
    useGroupGigs.mockReturnValue({ data: [row], isPending: false, isError: false });
    useGroupGigNotices.mockReturnValue({ data: [] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <GroupAgenda groupId={1} />
        </QueryClientProvider>
    );
}

/** El renglón ya decía el anticipo; ahora también dice el saldo, y sin repetir el mismo dato. */
describe("GroupAgenda · el renglón del manager dice el saldo del cliente", () => {
    it("states what is still owed with the deadline the group loaded", () => {
        renderAgenda();

        expect(screen.getByText("Falta pagar $6,200 · para el 15 de noviembre de 2026")).toBeInTheDocument();
        // Lo que ya decía sigue ahí: el anticipo, con su fecha.
        expect(screen.getByText("Anticipo $7,800 · recibido el 4 de noviembre de 2026")).toBeInTheDocument();
    });

    it("states the cachet total the manager agreed (ronda 11)", () => {
        // Without the cachet in the row, the manager had to open the editor to judge the anticipo.
        renderAgenda();

        expect(screen.getByText("Cachet total $14,000")).toBeInTheDocument();
    });

    it("states 'Sin presupuesto' instead of a cachet nobody agreed", () => {
        renderAgenda({ ...gig, budget: null });

        expect(screen.getByText("Sin presupuesto")).toBeInTheDocument();
        expect(screen.queryByText(/Cachet total/)).toBeNull();
    });

    it("states what is still owed without a deadline when there is none", () => {
        renderAgenda({ ...gig, balanceDueDate: null });

        expect(screen.getByText("Falta pagar $6,200")).toBeInTheDocument();
        expect(screen.queryByText(/para el 15 de noviembre/)).toBeNull();
    });

    it("draws no balance line when nothing is owed", () => {
        renderAgenda({ ...gig, deposit: { amount: 14000, receivedAt: "2026-11-04T18:00:00Z" } });

        expect(screen.queryByText(/Falta pagar/)).toBeNull();
        expect(screen.queryByText(/Sin saldo pendiente/)).toBeNull();
        // El anticipo se sigue leyendo: es el dato que explica por qué no queda saldo.
        expect(screen.getByText("Anticipo $14,000 · recibido el 4 de noviembre de 2026")).toBeInTheDocument();
    });

    it("keeps the recorded arrival when the group marked the balance as received", () => {
        renderAgenda({ ...gig, balanceReceivedAt: "2026-12-13T18:00:00Z" });

        expect(screen.getByText("Saldo recibido el 13 de diciembre de 2026 · $6,200")).toBeInTheDocument();
        expect(screen.queryByText(/Falta pagar/)).toBeNull();
    });

    it("states the balance amount while the deposit has not landed (ronda 11)", () => {
        // The manager loaded the cachet and the anticipo: the agreed balance is said even before the
        // deposit lands, and the deposit state ("pendiente") makes clear none of it is money received.
        renderAgenda({ ...gig, deposit: { amount: 4000, receivedAt: null }, balanceDueDate: "2026-11-15" });

        expect(screen.getByText("Saldo $10,000 · pendiente · para el 15 de noviembre de 2026")).toBeInTheDocument();
        expect(screen.getByText("Anticipo $4,000 · pendiente")).toBeInTheDocument();
        expect(screen.getByText("Cachet total $14,000")).toBeInTheDocument();
        expect(screen.queryByText(/Falta pagar/)).toBeNull();
    });

    it("says whether each musician was paid, without an editorial silence (ronda 11)", () => {
        // A figure with no state reads as paid; the editor said "Pendiente de pago" for Miguel and the row was silent.
        renderAgenda({
            ...gig,
            attendees: [
                { userId: 5, fullName: "Mateo Músico", status: "Confirmed", pay: 1500, paidAt: "2026-10-26T16:00:00Z" },
                { userId: 6, fullName: "Miguel Miembro", status: "Confirmed", pay: 1500, paidAt: null },
            ],
        });

        expect(screen.getByText("Pagos: Mateo Músico $1,500 pagado · Miguel Miembro $1,500 pendiente de pago")).toBeInTheDocument();
    });
});
