// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import GroupCalendar, { type GroupCalendarMode } from "./GroupCalendar";
import { dayBounds, longDayName, shortDayName } from "../blockDay";
import { todayInMexico } from "@/lib/format";

const { getGroupSchedules, createBusySchedule } = vi.hoisted(() => ({
    getGroupSchedules: vi.fn(),
    createBusySchedule: vi.fn(),
}));
vi.mock("../services/groupAvailability.service", () => ({
    groupAvailabilityService: {
        getGroupSchedules,
        createBusySchedule,
        updateAvailability: vi.fn(),
        updateBusySchedule: vi.fn(),
        removeAvailability: vi.fn(),
        removeBusySchedule: vi.fn(),
    },
}));

/** Lunes de la semana de `date`: el locale español abre la semana en lunes. */
function weekStart(date: Date): Date {
    const monday = new Date(date);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return monday;
}

function addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

/** "2026-11-09", en hora local: es como el calendario escribe el día de cada columna. */
function isoDay(date: Date): string {
    return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

const today = new Date();
const firstWeek = weekStart(today);

function renderCalendar(confirmedGigDays: string[] = [], mode: GroupCalendarMode = "private") {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(
        <QueryClientProvider client={client}>
            <GroupCalendar groupId={1} mode={mode} confirmedGigDays={confirmedGigDays} />
        </QueryClientProvider>
    );
    const title = () => view.container.querySelector(".fc-toolbar-title")?.textContent ?? "";
    /** El primer día que el calendario está mostrando. */
    const firstVisibleDay = () => view.container.querySelector("[data-date]")?.getAttribute("data-date") ?? null;
    const next = () => screen.getByRole("button", { name: "Semana siguiente" });
    return { ...view, title, firstVisibleDay, next };
}

beforeEach(() => {
    getGroupSchedules.mockReset();
    getGroupSchedules.mockResolvedValue([]);
    createBusySchedule.mockReset();
    createBusySchedule.mockResolvedValue({ id: "busy_99" });
});

describe("GroupCalendar keeps what it already did", () => {
    it("announces the first load while there is still no calendar", () => {
        getGroupSchedules.mockReturnValue(new Promise(() => {}));
        renderCalendar([isoDay(today)]);

        expect(screen.getByRole("status")).toHaveTextContent("Cargando calendario…");
        expect(screen.queryByRole("button", { name: "Semana siguiente" })).toBeNull();
    });

    it("still draws the blocks the API sends on their day", async () => {
        getGroupSchedules.mockResolvedValue([
            {
                id: "busy_12",
                title: "Ensayo",
                start: `${isoDay(today)}T10:00:00`,
                end: `${isoDay(today)}T12:00:00`,
            },
        ]);
        const calendar = renderCalendar();

        const blocks = await waitFor(() => {
            const chips = Array.from(calendar.container.querySelectorAll(".fc-event"));
            expect(chips.length).toBeGreaterThan(0);
            return chips;
        });
        const practise = blocks.find((chip) => chip.textContent?.includes("Ensayo"));
        expect(practise).toBeDefined();
        expect(practise?.closest("[data-date]")?.getAttribute("data-date")).toBe(isoDay(today));
    });
});

describe("GroupCalendar navigation", () => {
    it("advances one week on every press of next, three times in a row", async () => {
        const user = userEvent.setup();
        const calendar = renderCalendar();

        await waitFor(() => expect(calendar.firstVisibleDay()).toBe(isoDay(firstWeek)));
        const titles = [calendar.title()];

        for (const weeks of [1, 2, 3]) {
            await user.click(calendar.next());
            // Se avanza a la semana que sigue, no se vuelve a la de antes.
            await waitFor(() => expect(calendar.firstVisibleDay()).toBe(isoDay(addDays(firstWeek, 7 * weeks))), {
                timeout: 3000,
            });
            titles.push(calendar.title());
        }

        // Cuatro semanas distintas: el calendario nunca rebota entre dos.
        expect(new Set(titles).size).toBe(4);

        // Y de vuelta, una semana por pulsación, hasta donde empezó.
        for (const weeks of [2, 1, 0]) {
            await user.click(screen.getByRole("button", { name: "Semana antes" }));
            await waitFor(() => expect(calendar.firstVisibleDay()).toBe(isoDay(addDays(firstWeek, 7 * weeks))), {
                timeout: 3000,
            });
        }
        expect(calendar.title()).toBe(titles[0]);
    });

    it("switches to the month view and says so in the toggle's own state", async () => {
        const user = userEvent.setup();
        const calendar = renderCalendar();

        await waitFor(() => expect(calendar.firstVisibleDay()).not.toBeNull());
        const monthButton = screen.getByRole("button", { name: "Mes" });
        const weekButton = screen.getByRole("button", { name: "Semana" });
        expect(weekButton).toHaveAttribute("aria-pressed", "true");
        expect(monthButton).toHaveAttribute("aria-pressed", "false");
        const weekTitle = calendar.title();

        await user.click(monthButton);

        // La vista elegida queda elegida: su botón lo dice y el de la semana deja de estarlo.
        await waitFor(() => expect(screen.getByRole("button", { name: "Mes" })).toHaveAttribute("aria-pressed", "true"), {
            timeout: 3000,
        });
        expect(screen.getByRole("button", { name: "Semana" })).toHaveAttribute("aria-pressed", "false");
        // El título dice el mes, que es lo que la vista nueva está mostrando.
        expect(calendar.title()).toBe(new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(today));
        expect(calendar.title()).not.toBe(weekTitle);
        expect(calendar.container.querySelector(".fc-daygrid-day")).not.toBeNull();
    });

    it("marks the confirmed gig on its own day when that week is on screen", async () => {
        const user = userEvent.setup();
        // Dos semanas adelante: una fecha que hoy no está a la vista y hay que ir a buscar.
        const gigDay = addDays(firstWeek, 17);
        const calendar = renderCalendar([isoDay(gigDay)]);

        await waitFor(() => expect(calendar.firstVisibleDay()).toBe(isoDay(firstWeek)));
        expect(calendar.container.querySelectorAll(".fc-event")).toHaveLength(0);

        await user.click(calendar.next());
        await user.click(calendar.next());
        await waitFor(() => expect(calendar.firstVisibleDay()).toBe(isoDay(addDays(firstWeek, 14))), { timeout: 3000 });

        const chips = Array.from(calendar.container.querySelectorAll(".fc-event"));
        const marker = chips.find((chip) => chip.textContent?.trim() === "Toque confirmado");
        expect(marker).toBeDefined();
        // El marcador cae en la columna del día del toque, no en cualquier parte de la semana.
        expect(marker?.closest("[data-date]")?.getAttribute("data-date")).toBe(isoDay(gigDay));
    });

    it("shows the loading state once, and never swaps the calendar out while it fetches a new week", async () => {
        const user = userEvent.setup();
        const calendar = renderCalendar();

        await waitFor(() => expect(calendar.firstVisibleDay()).toBe(isoDay(firstWeek)));
        await user.click(calendar.next());
        // Con el calendario desmontado se perdía la semana: el aviso de carga no vuelve tras navegar.
        expect(screen.queryByText("Cargando calendario…")).toBeNull();
        await waitFor(() => expect(calendar.firstVisibleDay()).toBe(isoDay(addDays(firstWeek, 7))), { timeout: 3000 });
        expect(screen.queryByText("Cargando calendario…")).toBeNull();
    });
});

/** S26: un día se bloquea desde la agenda, no solo arrastrando sobre la rejilla. */
describe("GroupCalendar blocks a day from the agenda", () => {
    const today = todayInMexico();

    it("offers a control that names the day and blocks it from the keyboard, without dragging", async () => {
        const user = userEvent.setup();
        renderCalendar();

        const control = await screen.findByRole("button", { name: `Bloquear el día ${longDayName(today)}` });
        // La etiqueta visible nombra el mismo día, corto (ronda 9); el nombre accesible sigue siendo el largo.
        expect(control).toHaveTextContent(`Bloquear el ${shortDayName(today) ?? ""}`);
        expect(control).not.toHaveTextContent("Bloquear el día");
        expect(control).toHaveClass("min-h-11");
        // El control no ofrece nada hasta leer el día: primero se habilita y recién ahí se opera.
        await waitFor(() => expect(control).toBeEnabled());

        // Un botón en el orden de tabulación: se opera con Enter, que es lo que un arrastre no permite.
        control.focus();
        await user.keyboard("{Enter}");
        const dialog = await screen.findByRole("dialog", { name: "Bloquear este día" });
        await user.click(within(dialog).getByRole("button", { name: "Bloquear día" }));

        const bounds = dayBounds(today);
        expect(createBusySchedule).toHaveBeenCalledWith(1, {
            title: "No disponible",
            start: bounds?.start,
            end: bounds?.end,
            source: "personal",
        });
    });

    it("does not offer it on the public calendar the client sees", async () => {
        const calendar = renderCalendar([], "public");

        await waitFor(() => expect(calendar.firstVisibleDay()).not.toBeNull());
        expect(screen.queryByRole("button", { name: /Bloquear el día/ })).toBeNull();
    });

    it("tells the day-block control which days already have a confirmed gig (ronda 10)", async () => {
        const user = userEvent.setup();
        // El calendario ya recibe esos días; el control que bloquea tiene que verlos igual.
        renderCalendar([today]);

        const control = await screen.findByRole("button", { name: `Bloquear el día ${longDayName(today)}` });
        await waitFor(() => expect(control).toBeEnabled());
        await user.click(control);

        const dialog = await screen.findByRole("dialog", { name: "Bloquear este día" });
        expect(within(dialog).getByText(/Ese día ya tienes un toque confirmado/)).toBeInTheDocument();
    });
});

/**
 * Ronda 9: a 390 px la celda del día medía 42 px y los botones Hoy/Mes/Semana/Día 43 px. El calendario
 * es de FullCalendar y su hoja se inyecta en runtime, así que el tamaño se sube con utilidades que
 * apuntan a sus clases; jsdom no mide píxeles, así que acá se fija la decisión, no la medida.
 */
describe("GroupCalendar · 44 px en los controles de decisión", () => {
    it("raises the day cells and the toolbar buttons to at least 44 px", async () => {
        const calendar = renderCalendar();

        await waitFor(() => expect(calendar.firstVisibleDay()).not.toBeNull());
        const wrapper = calendar.container.querySelector(".ng-calendario");
        expect(wrapper).not.toBeNull();
        // El `!` no es adorno: la hoja de FullCalendar entra sin capa y su `min-height: 100%` gana
        // contra `@layer utilities` (la misma trampa del anillo de foco, T50/L50).
        expect(wrapper).toHaveClass("[&_.fc-daygrid-day-frame]:min-h-11!");
        expect(wrapper).toHaveClass("[&_.fc-button]:min-h-11");
        // Los dos controles existen de verdad dentro del contenedor que los agranda.
        expect(calendar.container.querySelector(".fc-daygrid-day-frame")).not.toBeNull();
        expect(screen.getAllByRole("button", { name: /Mes|Semana|Día|Hoy/ }).length).toBeGreaterThan(0);
    });
});
