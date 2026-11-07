// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BlockDayControl } from "./BlockDayControl";
import { dayBounds, longDayName } from "../blockDay";

const service = vi.hoisted(() => ({
    getGroupSchedules: vi.fn(),
    createBusySchedule: vi.fn(),
    removeBusySchedule: vi.fn(),
    removeAvailability: vi.fn(),
}));

vi.mock("../services/groupAvailability.service", () => ({ groupAvailabilityService: service }));

const GROUP = 7;
const DAY = "2026-11-19";
/** "jueves 19 de noviembre de 2026": lo que el nombre accesible del control tiene que decir. */
const DAY_NAME = "jueves 19 de noviembre de 2026";

function bounds(day: string) {
    const value = dayBounds(day);
    if (!value) throw new Error(`invalid day ${day}`);
    return value;
}

/** Un bloque de día completo, tal como lo devuelve `GET api/groups/{id}/schedules`. */
function wholeDayBlock(day: string, id = "busy_12") {
    const { start, end } = bounds(day);
    return { id, title: "No disponible", start, end, isAvailable: false };
}

function renderControl(initialDay = DAY) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <BlockDayControl groupId={GROUP} initialDay={initialDay} />
        </QueryClientProvider>
    );
}

/** El botón que bloquea o desbloquea el día, por su nombre accesible. */
const toggle = (verb: "Bloquear" | "Desbloquear" = "Bloquear", dayName = DAY_NAME) =>
    screen.findByRole("button", { name: `${verb} el día ${dayName}` });

beforeEach(() => {
    for (const fn of Object.values(service)) (fn as Mock).mockReset();
    service.getGroupSchedules.mockResolvedValue([]);
    service.createBusySchedule.mockResolvedValue({ id: "busy_99" });
    service.removeBusySchedule.mockResolvedValue(undefined);
    service.removeAvailability.mockResolvedValue(undefined);
});

describe("S26 · el control dice qué día bloquea", () => {
    it("names the day in its accessible name and keeps a visible label that is contained in it", async () => {
        renderControl();

        const control = await toggle();
        // "Bloquear" a secas no basta: el nombre accesible dice el día.
        expect(control).toHaveAccessibleName(`Bloquear el día ${DAY_NAME}`);
        expect(control).toHaveTextContent("Bloquear el día");
        // Objetivo de 44 px y sin apagar el anillo de foco global.
        expect(control).toHaveClass("min-h-11");
        expect(control.className).not.toMatch(/outline-none/);
    });

    it("asks the same question as the calendar before writing anything", async () => {
        const user = userEvent.setup();
        renderControl();

        await user.click(await toggle());

        const dialog = screen.getByRole("dialog", { name: "Bloquear este día" });
        expect(within(dialog).getByText(new RegExp(`${DAY_NAME} · todo el día`))).toBeInTheDocument();
        expect(service.createBusySchedule).not.toHaveBeenCalled();

        await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

        expect(screen.queryByRole("dialog")).toBeNull();
        expect(service.createBusySchedule).not.toHaveBeenCalled();
    });
});

describe("S26 · bloquear un día", () => {
    it("blocks the whole day with the same call the drag path makes", async () => {
        const user = userEvent.setup();
        renderControl();

        await user.click(await toggle());
        await user.click(screen.getByRole("button", { name: "Bloquear día" }));

        const { start, end } = bounds(DAY);
        expect(service.createBusySchedule).toHaveBeenCalledWith(GROUP, {
            title: "No disponible",
            start,
            end,
            source: "personal",
        });
    });

    it("blocks the day you pick with the field, not the one it opened with", async () => {
        const user = userEvent.setup();
        renderControl();

        await user.click(await screen.findByRole("combobox", { name: /Día que quieres bloquear/ }));
        const calendar = screen.getByRole("dialog", { name: /Elegir fecha/ });
        const picked = calendar.querySelector('[data-day="2026-11-24"] button');
        expect(picked).not.toBeNull();
        await user.click(picked as HTMLElement);

        // El control ya nombra el día nuevo…
        const control = await toggle("Bloquear", "martes 24 de noviembre de 2026");
        await user.click(control);
        await user.click(screen.getByRole("button", { name: "Bloquear día" }));

        // …y escribe ese día, no el de antes.
        const { start, end } = bounds("2026-11-24");
        expect(service.createBusySchedule).toHaveBeenCalledWith(GROUP, {
            title: "No disponible",
            start,
            end,
            source: "personal",
        });
    });
});

describe("S26 · el bloqueo se deshace con el mismo control", () => {
    it("says the day is blocked and lifts it when you confirm", async () => {
        const user = userEvent.setup();
        service.getGroupSchedules.mockResolvedValue([wholeDayBlock(DAY)]);
        renderControl();

        const control = await toggle("Desbloquear");
        expect(control).toHaveTextContent("Desbloquear el día");

        await user.click(control);
        const dialog = screen.getByRole("dialog", { name: "Desbloquear este día" });
        await user.click(within(dialog).getByRole("button", { name: "Desbloquear día" }));

        expect(service.removeBusySchedule).toHaveBeenCalledWith(GROUP, "busy_12");
    });

    it("does not pass a block that only covers part of the day for a blocked day", async () => {
        const { start } = bounds(DAY);
        const noon = new Date(Date.parse(start) + 4 * 60 * 60 * 1000).toISOString();
        service.getGroupSchedules.mockResolvedValue([
            { id: "busy_21", title: "Ensayo", start: noon, end: new Date(Date.parse(noon) + 2 * 60 * 60 * 1000).toISOString(), isAvailable: false },
        ]);
        renderControl();

        // El día sigue abierto: el botón vuelve a ofrecer bloquearlo entero.
        const control = await toggle("Bloquear");
        expect(control).toHaveTextContent("Bloquear el día");
    });
});

describe("S26 · errores", () => {
    it("says it could not save with the calendar's own words", async () => {
        const user = userEvent.setup();
        service.createBusySchedule.mockRejectedValue(new Error("boom"));
        renderControl();

        await user.click(await toggle());
        await user.click(screen.getByRole("button", { name: "Bloquear día" }));

        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent(
            "No pudimos guardar el último cambio del calendario. Recarga la página e inténtalo de nuevo."
        );
    });
});

describe("blockDay helpers", () => {
    it("writes the long day without the comma so it fits inside a sentence", () => {
        expect(longDayName(DAY)).toBe(DAY_NAME);
        expect(longDayName("no-es-fecha")).toBeNull();
    });
});

describe("S26 · no afirma lo que todavía no leyó", () => {
    it("keeps the button disabled while it does not know whether the day is already blocked", async () => {
        // La consulta del día nunca resuelve: el control no puede decir "Bloquear" de un día que no leyó.
        service.getGroupSchedules.mockReturnValue(new Promise(() => {}));
        renderControl();

        const button = await toggle();
        expect(button).toBeDisabled();
    });
});

describe("S26 · objetivos táctiles del diálogo", () => {
    it.each([["Bloquear", "Bloquear día"], ["Desbloquear", "Desbloquear día"]] as const)(
        "keeps 44 px on both dialog buttons when confirming '%s'",
        async (verb, action) => {
            const user = userEvent.setup();
            service.getGroupSchedules.mockResolvedValue(verb === "Desbloquear" ? [wholeDayBlock(DAY)] : []);
            renderControl();

            await user.click(await toggle(verb));
            const dialog = screen.getByRole("dialog");
            expect(within(dialog).getByRole("button", { name: "Cancelar" })).toHaveClass("min-h-11");
            expect(within(dialog).getByRole("button", { name: action })).toHaveClass("min-h-11");
        }
    );
});

