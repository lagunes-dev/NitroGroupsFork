// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GroupInbox } from "./GroupInbox";
import { dayBounds } from "@/features/groupAvailability/blockDay";
import type { EventRequest } from "../types";

const bookings = vi.hoisted(() => ({ forGroup: vi.fn() }));
const schedules = vi.hoisted(() => ({
    getGroupSchedules: vi.fn(),
    createBusySchedule: vi.fn(),
    removeBusySchedule: vi.fn(),
    removeAvailability: vi.fn(),
}));

vi.mock("../bookings.service", () => ({ bookingsService: { forGroup: bookings.forGroup } }));
vi.mock("@/features/groupAvailability/services/groupAvailability.service", () => ({ groupAvailabilityService: schedules }));

const GROUP = 7;

/** El pedido del 19 de noviembre: el día que la bandeja pone delante del manager. */
const waiting: EventRequest = {
    id: 12,
    groupId: GROUP,
    groupName: "Versátil Rock y Pop",
    groupSlug: "versatil-rock-y-pop",
    clientName: "Camila Ramos",
    eventDate: "2026-11-19",
    startTime: "21:00:00",
    durationHours: 3,
    eventType: "Boda",
    locationText: "Hacienda San Gabriel, Tlaquepaque",
    guestCount: 120,
    budget: 15000,
    currency: "MXN",
    message: "Boda con banda en vivo.",
    status: "Pending",
    isSelfBooked: false,
    createdAt: "2026-10-01T18:00:00Z",
    respondedAt: null,
    responseMessage: null,
    deposit: null,
};

function bounds(day: string) {
    const value = dayBounds(day);
    if (!value) throw new Error(`invalid day ${day}`);
    return value;
}

function renderInbox() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <GroupInbox groupId={GROUP} />
        </QueryClientProvider>
    );
}

beforeEach(() => {
    for (const fn of [...Object.values(bookings), ...Object.values(schedules)]) (fn as Mock).mockReset();
    bookings.forGroup.mockResolvedValue([waiting]);
    schedules.getGroupSchedules.mockResolvedValue([]);
    schedules.createBusySchedule.mockResolvedValue({ id: "busy_99" });
    schedules.removeBusySchedule.mockResolvedValue(undefined);
    schedules.removeAvailability.mockResolvedValue(undefined);
});

describe("S26 · la bandeja bloquea un día", () => {
    it("offers to block the day of the request that is waiting for an answer", async () => {
        renderInbox();

        // El nombre accesible dice el día del pedido, no un "Bloquear" suelto.
        const control = await screen.findByRole("button", { name: "Bloquear el día jueves 19 de noviembre de 2026" });
        expect(control).toHaveTextContent("Bloquear el día");
        expect(control).toHaveClass("min-h-11");
        expect(control.className).not.toMatch(/outline-none/);
    });

    it("blocks that day without opening the calendar, through the same call", async () => {
        const user = userEvent.setup();
        renderInbox();

        await user.click(await screen.findByRole("button", { name: /^Bloquear el día/ }));
        const dialog = screen.getByRole("dialog", { name: "Bloquear este día" });
        await user.click(within(dialog).getByRole("button", { name: "Bloquear día" }));

        const { start, end } = bounds("2026-11-19");
        expect(schedules.createBusySchedule).toHaveBeenCalledWith(GROUP, {
            title: "No disponible",
            start,
            end,
            source: "personal",
        });
    });

    it("lifts the block from the inbox with the same control", async () => {
        const user = userEvent.setup();
        const { start, end } = bounds("2026-11-19");
        schedules.getGroupSchedules.mockResolvedValue([{ id: "busy_12", title: "No disponible", start, end, isAvailable: false }]);
        renderInbox();

        await user.click(await screen.findByRole("button", { name: "Desbloquear el día jueves 19 de noviembre de 2026" }));
        const dialog = screen.getByRole("dialog", { name: "Desbloquear este día" });
        await user.click(within(dialog).getByRole("button", { name: "Desbloquear día" }));

        expect(schedules.removeBusySchedule).toHaveBeenCalledWith(GROUP, "busy_12");
    });

    it("still opens on the pending requests, with the block control above them", async () => {
        renderInbox();

        expect(await screen.findByRole("heading", { name: /Por responder/ })).toBeInTheDocument();
        expect(screen.getByText("Camila Ramos")).toBeInTheDocument();
        // El pedido sigue siendo lo primero que se lee, y el control del día no lo tapa.
        const inbox = screen.getByRole("button", { name: /^Bloquear el día/ });
        const row = screen.getByRole("link", { name: "Camila Ramos" });
        expect(inbox.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
});

describe("S26 · la bandeja no ofrece un clic muerto", () => {
    it("offers to lift the block when the day it opens on is already blocked", async () => {
        // El día del pedido pendiente ya está bloqueado: la bandeja tiene que ofrecer deshacerlo,
        // no volver a bloquear lo que ya está bloqueado.
        const { start, end } = bounds(waiting.eventDate);
        schedules.getGroupSchedules.mockResolvedValue([{ id: "busy_31", title: "No disponible", start, end, isAvailable: false }]);
        renderInbox();

        const lift = await screen.findByRole("button", { name: /^Desbloquear el día/ });
        expect(lift).toBeEnabled();
        expect(screen.queryByRole("button", { name: /^Bloquear el día/ })).toBeNull();
    });
});
