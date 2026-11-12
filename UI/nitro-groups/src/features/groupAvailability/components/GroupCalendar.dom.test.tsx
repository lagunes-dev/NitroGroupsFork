// @vitest-environment jsdom
import { beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import GroupCalendar, { type GroupCalendarMode } from "./GroupCalendar";
import { dayBounds, longDayName, shortDayName } from "../blockDay";
import { todayInMexico } from "@/lib/format";

const { getGroupSchedules, createBusySchedule, updateAvailability, updateBusySchedule, removeAvailability, removeBusySchedule } =
    vi.hoisted(() => ({
        getGroupSchedules: vi.fn(),
        createBusySchedule: vi.fn(),
        updateAvailability: vi.fn(),
        updateBusySchedule: vi.fn(),
        removeAvailability: vi.fn(),
        removeBusySchedule: vi.fn(),
    }));
vi.mock("../services/groupAvailability.service", () => ({
    groupAvailabilityService: {
        getGroupSchedules,
        createBusySchedule,
        updateAvailability,
        updateBusySchedule,
        removeAvailability,
        removeBusySchedule,
    },
}));

/** La agenda del grupo alimenta los días con toque confirmado: acá se sustituye su lectura. */
const agenda = vi.hoisted(() => ({ forGroup: vi.fn() }));
vi.mock("@/features/gigs/gigs.service", () => ({ gigsService: { forGroup: agenda.forGroup } }));

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

/** "2026-11-09 19:00", en hora local: como la API entrega un bloque. */
function at(date: Date, hour: number, minute = 0): string {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute).toISOString();
}

/**
 * jsdom has no layout, so FullCalendar never gets slot coordinates and draws no background event. Each
 * element reports a box that grows with its place in the document, enough for the week grid to
 * measure its slots and place the mark.
 */
function giveEveryElementABox() {
    let n = 0;
    const boxes = new WeakMap<Element, DOMRect>();
    for (const prop of ["offsetHeight", "offsetWidth", "clientWidth", "clientHeight"]) {
        const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop) ?? Object.getOwnPropertyDescriptor(Element.prototype, prop);
        Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, get: () => 100 });
        onTestFinished(() => {
            if (original) Object.defineProperty(HTMLElement.prototype, prop, original);
            else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[prop];
        });
    }
    const spy = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
        if (!boxes.has(this)) {
            n += 1;
            boxes.set(this, { x: 0, y: n * 20, left: 0, top: n * 20, right: 100, bottom: n * 20 + 20, width: 100, height: 20, toJSON: () => ({}) });
        }
        return boxes.get(this) as DOMRect;
    });
    onTestFinished(() => spy.mockRestore());
}

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
    updateAvailability.mockReset();
    updateBusySchedule.mockReset();
    removeAvailability.mockReset();
    removeBusySchedule.mockReset();
    agenda.forGroup.mockReset();
    agenda.forGroup.mockResolvedValue([]);
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
        // El calendario y el control leen la misma agenda: el día marcado es el día avisado.
        agenda.forGroup.mockResolvedValue([{ id: 5, eventDate: today }]);
        renderCalendar([today]);

        const control = await screen.findByRole("button", { name: `Bloquear el día ${longDayName(today)}` });
        await waitFor(() => expect(control).toBeEnabled());
        await user.click(control);

        const dialog = await screen.findByRole("dialog", { name: "Bloquear este día" });
        expect(within(dialog).getByText(/Ese día ya tienes un toque confirmado/)).toBeInTheDocument();
    });
});

/**
 * Ronda 10: la semana del 30 nov al 6 dic pintaba el 4 dic como "Toque confirmado" y además como
 * "0:00 Disponible". Un manager lee la noche como libre, así que la disponibilidad se calla en un día
 * que ya tiene toque, y el marcador del toque no se toca.
 */
describe("GroupCalendar · un día con toque confirmado no se pinta como disponible (ronda 10)", () => {
    /** Una fila de `GET api/groups/{id}/schedules` que marca un día entero como disponible. */
    function availableDay(day: string) {
        const start = new Date(`${day}T00:00:00`);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        return { id: "avail_3", title: "Disponible", start: start.toISOString(), end: end.toISOString(), isAvailable: true };
    }

    it("leaves the day to the confirmed gig instead of painting it as available", async () => {
        const gigDay = isoDay(today);
        getGroupSchedules.mockResolvedValue([availableDay(gigDay)]);
        const calendar = renderCalendar([gigDay]);

        const chips = await waitFor(() => {
            const found = Array.from(calendar.container.querySelectorAll(".fc-event"));
            expect(found.length).toBeGreaterThan(0);
            return found;
        });

        // El toque confirmado sigue ahí: es el dato que explica por qué el día no está libre.
        expect(chips.some((chip) => chip.textContent?.trim() === "Toque confirmado")).toBe(true);
        // Y la disponibilidad de ese día no se pinta: una noche con toque no está disponible.
        expect(chips.filter((chip) => chip.textContent?.includes("Disponible"))).toHaveLength(0);
    });

    it("still paints the availability of the days around it", async () => {
        // The mark is a background event (ronda 13): FullCalendar only draws one once the grid has a layout.
        giveEveryElementABox();
        const tomorrow = addDays(today, 1);
        getGroupSchedules.mockResolvedValue([availableDay(isoDay(tomorrow))]);
        const calendar = renderCalendar([isoDay(today)]);

        const marker = await waitFor(() => {
            const found = Array.from(calendar.container.querySelectorAll(".fc-event")).find((chip) =>
                chip.textContent?.includes("Disponible")
            );
            expect(found).toBeDefined();
            return found as HTMLElement;
        });

        expect(marker.closest("[data-date]")?.getAttribute("data-date")).toBe(isoDay(tomorrow));
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

/**
 * Ronda 11: a 390 px las siete columnas de la semana medían 41–42 px y una ficha partía su palabra
 * ("Disponible" pedía 72 px en 33). La rejilla ya no se encoge por debajo del ancho que necesita su ficha
 * más larga: se desplaza dentro de su propio contenedor, así que el desborde nunca llega a la página.
 * jsdom no mide píxeles: acá se fija la decisión (ancho mínimo y contenedor que scrollea) y la medida se
 * cierra en el navegador, que es donde el número cambia.
 */
describe("GroupCalendar · a 390 px la semana no recorta sus fichas (ronda 11)", () => {
    it("keeps the grid as wide as its longest chip needs, scrolling inside its own container", async () => {
        getGroupSchedules.mockResolvedValue([]);
        const calendar = renderCalendar();

        await waitFor(() => expect(calendar.firstVisibleDay()).not.toBeNull());
        const scroller = calendar.container.querySelector(".ng-semana-scroll");
        const grid = calendar.container.querySelector(".ng-semana-rejilla");
        expect(scroller).not.toBeNull();
        expect(grid).not.toBeNull();

        // El desborde lo contiene este contenedor: el calendario está adentro, no la página.
        expect(scroller).toHaveClass("overflow-x-auto");
        expect(scroller).toContainElement(calendar.container.querySelector(".fc"));
        expect(grid).toContainElement(calendar.container.querySelector(".fc"));

        // Siete columnas de ~121 px (la ficha más larga, "Toque confirmado", mide ~111 px) más el eje de
        // horas (~48 px): por debajo de 56rem la columna vuelve a cortar la palabra.
        const minWidth = Number(/min-w-\[(\d+(?:\.\d+)?)rem\]/.exec(grid?.className ?? "")?.[1]);
        expect(Number.isFinite(minWidth)).toBe(true);
        expect(minWidth).toBeGreaterThanOrEqual(56);
    });

    it("says the week can be swiped, only where the grid really scrolls", async () => {
        const calendar = renderCalendar();

        await waitFor(() => expect(calendar.firstVisibleDay()).not.toBeNull());
        const hint = screen.getByText("Desliza el calendario para ver la semana completa.");
        // Debajo de `lg` la rejilla mide más que la pantalla: ahí se dice; en escritorio no hay nada que decir.
        expect(hint).toHaveClass("lg:hidden");
    });
});

/**
 * Ronda 12: "Dec 4 19:00–21:30 is painted in nothing; the only trace is a 27 px all-day chip. A
 * rehearsal is painted 17:00→20:00. So I can drag right on top of my own gig's hours and only learn
 * about it from the confirmation dialog." El toque confirmado se pinta en la rejilla por sus horas
 * reales, sin parecer un bloque que el manager pueda arrastrar, y la ficha de día completo se queda.
 */
describe("ronda 12 · el toque confirmado se pinta por sus horas reales", () => {
    const GIG = { id: 9, eventDate: isoDay(today), startTime: "19:00:00", durationHours: 2.5 };

    it("paints the confirmed gig in its own column, with the hours it really has", async () => {
        agenda.forGroup.mockResolvedValue([GIG]);
        const calendar = renderCalendar();

        const block = await waitFor(() => {
            const found = calendar.container.querySelector(".ng-gig-block");
            expect(found).not.toBeNull();
            return found as HTMLElement;
        });

        // Cae en la columna del día del toque, no en cualquier parte de la semana.
        expect(block.closest("[data-date]")?.getAttribute("data-date")).toBe(isoDay(today));
        // Y dice sus horas: 19:00 a 21:30, las del toque, no un chip sin hora.
        expect(block.textContent).toContain("Toque confirmado");
        expect(block.textContent).toContain("19:00");
        expect(block.textContent).toContain("21:30");
    });

    it("does not look like a block the manager can drag, because it is not hers to edit here", async () => {
        agenda.forGroup.mockResolvedValue([GIG]);
        const calendar = renderCalendar();

        const block = await waitFor(() => {
            const found = calendar.container.querySelector(".ng-gig-block");
            expect(found).not.toBeNull();
            return found as HTMLElement;
        });

        // Borde discontinuo: se lee como un dato del calendario, no como un bloque propio.
        expect(block.className).toContain("border-dashed");
        // Y de verdad no se puede mover: FullCalendar marca así lo que se arrastra.
        expect(block.className).not.toContain("fc-event-draggable");
    });

    it("keeps the all-day chip, once, for the same gig", async () => {
        agenda.forGroup.mockResolvedValue([GIG]);
        // El día llega por prop y además por la agenda: una ficha, no dos.
        const calendar = renderCalendar([isoDay(today)]);

        const chips = await waitFor(() => {
            const found = Array.from(calendar.container.querySelectorAll(".fc-event"));
            expect(found.length).toBeGreaterThan(0);
            return found;
        });

        const dayChips = chips.filter((chip) => chip.textContent?.trim() === "Toque confirmado");
        expect(dayChips).toHaveLength(1);
        expect(chips.some((chip) => chip.classList.contains("ng-gig-block"))).toBe(true);
    });

    it("does not paint hours for a gig the manager never timed", async () => {
        agenda.forGroup.mockResolvedValue([{ ...GIG, startTime: null }]);
        const calendar = renderCalendar([isoDay(today)]);

        await waitFor(() => expect(calendar.firstVisibleDay()).not.toBeNull());
        await waitFor(() =>
            expect(Array.from(calendar.container.querySelectorAll(".fc-event")).some((chip) =>
                chip.textContent?.includes("Toque confirmado")
            )).toBe(true)
        );
        // Sin hora de inicio no se inventa una altura: el dato honesto sigue siendo la ficha del día.
        expect(calendar.container.querySelector(".ng-gig-block")).toBeNull();
    });
});

/**
 * Ronda 12: "Week and Día view render exactly 08:00 … 22:30 (30 slots, no vertical scroll) — drag at
 * 22:00 gives '22:00 a 22:30', the last one. A gig ending 23:00/01:00 cannot be blocked." El día se
 * extiende hasta la madrugada, sin perder el arranque de las 08:00.
 */
describe("ronda 12 · la noche después de las 22:30 también se puede bloquear", () => {
    /** Los horarios que la rejilla dibuja, en orden: es la evidencia de dónde termina el día. */
    function slotTimes(container: HTMLElement): string[] {
        return Array.from(container.querySelectorAll(".fc-timegrid-slot-label")).map(
            (cell) => cell.getAttribute("data-time") ?? ""
        );
    }

    it("starts at 08:00 and keeps going past midnight, so a late-night block has a place", async () => {
        const calendar = renderCalendar();

        await waitFor(() => expect(calendar.firstVisibleDay()).not.toBeNull());
        const times = slotTimes(calendar.container);

        // El arranque no se mueve: la alineación de las 08:00 se conserva.
        expect(times[0]).toBe("08:00:00");
        // 08:00 a 02:00 del día siguiente, en medias horas: 36 filas, no las 30 que llegaban a 22:30.
        expect(times).toHaveLength(36);
        expect(times).toContain("23:00:00");
        expect(times[times.length - 1]).toBe("01:30:00");
    });
});

/**
 * Ronda 12: la regla del pasado se aplica a las puertas nuevas, y no se lleva por delante lo que ya se
 * podía hacer: un bloque que ya quedó en el pasado se sigue pudiendo quitar, porque ese estado sí se
 * puede cambiar.
 */
describe("ronda 12 · un bloque pasado se sigue pudiendo quitar", () => {
    it("lifts a block that already happened when the manager taps it", async () => {
        const user = userEvent.setup();
        // El miércoles de la semana pasada: siempre detrás de hoy, mire cuando mire el reloj.
        const lastWeek = addDays(firstWeek, -3);
        getGroupSchedules.mockResolvedValue([
            { id: "busy_7", title: "Ensayo", start: at(lastWeek, 19), end: at(lastWeek, 21) },
        ]);
        const calendar = renderCalendar();

        await waitFor(() => expect(calendar.firstVisibleDay()).toBe(isoDay(firstWeek)));
        await user.click(screen.getByRole("button", { name: "Semana antes" }));
        await waitFor(() => expect(calendar.firstVisibleDay()).toBe(isoDay(addDays(firstWeek, -7))), { timeout: 3000 });

        const chip = await waitFor(() => {
            const found = Array.from(calendar.container.querySelectorAll(".fc-event")).find((event) =>
                event.textContent?.includes("Ensayo")
            );
            expect(found).toBeDefined();
            return found as HTMLElement;
        });
        await user.click(chip);

        expect(await screen.findByRole("dialog", { name: "Quitar «Ensayo»" })).toBeInTheDocument();
    });
});

/**
 * Ronda 13: "On a day already marked, dragging over the hours moves the mark instead of blocking hours."
 * Blocking hours is the common action and moving a mark the rare one, so the mark is painted as a
 * background event: FullCalendar lets a drag start on it (`isValidDateDownEl` skips `.fc-bg-event`) and
 * never makes it draggable, while it keeps the `.fc-event` class that `eventClick` listens to. jsdom
 * cannot drive a real drag, so these pin the DOM facts FullCalendar's own drag logic reads.
 */
describe("ronda 13 · arrastrar sobre un día marcado como disponible bloquea horas", () => {
    const AVAILABLE = { id: "avail_3", title: "Disponible", start: at(today, 8), end: at(addDays(today, 1), 0), isAvailable: true };
    const BUSY = { id: "busy_12", title: "Ensayo", start: at(today, 17), end: at(today, 20) };

    function foregroundChips(container: HTMLElement, text: string): HTMLElement[] {
        return Array.from(container.querySelectorAll<HTMLElement>(".fc-event:not(.fc-bg-event)")).filter((chip) =>
            chip.textContent?.includes(text)
        );
    }

    async function chipNamed(container: HTMLElement, text: string, selector = ".fc-event"): Promise<HTMLElement> {
        return waitFor(() => {
            const found = Array.from(container.querySelectorAll<HTMLElement>(selector)).find((chip) =>
                chip.textContent?.includes(text)
            );
            expect(found).toBeDefined();
            return found as HTMLElement;
        });
    }

    async function weekWithMark() {
        giveEveryElementABox();
        getGroupSchedules.mockResolvedValue([AVAILABLE]);
        const calendar = renderCalendar();
        return calendar;
    }

    it("paints the availability mark as a background event, so a drag can start on it", async () => {
        const calendar = await weekWithMark();

        const mark = await chipNamed(calendar.container, "Disponible", ".fc-bg-event");

        // FullCalendar only starts a hour selection on a pointer-down that is not inside `.fc-event:not(.fc-bg-event)`.
        expect(mark).toHaveClass("fc-bg-event");
        expect(mark.closest(".fc-event:not(.fc-bg-event)")).toBeNull();
    });

    it("never offers the availability mark as draggable, so it cannot be moved by drag", async () => {
        const calendar = await weekWithMark();

        const mark = await chipNamed(calendar.container, "Disponible", ".fc-bg-event");

        expect(mark).not.toHaveClass("fc-event-draggable");
        expect(mark).not.toHaveClass("fc-event-resizable");
    });

    // The first attempt had a test here named "still offers to remove the availability mark when it is
    // tapped". It was removed: jsdom fires the click on the element itself, while FullCalendar never
    // delivers `eventClick` for a background event, so it passed while a finger could not remove the mark.
    // What it can prove now is the foreground chip below; the tap itself is only provable in a browser.

    it("offers one removable all-day chip per marked day, as a foreground event nobody can drag", async () => {
        const calendar = await weekWithMark();

        const chip = await chipNamed(calendar.container, "Disponible", ".fc-daygrid-event, .fc-timegrid-event:not(.fc-bg-event)");

        expect(chip.closest(".fc-timegrid-allday, .fc-daygrid-body")).not.toBeNull();
        expect(chip).not.toHaveClass("fc-bg-event");
        expect(chip).not.toHaveClass("fc-event-draggable");
        expect(chip).not.toHaveClass("fc-event-resizable");
        expect(foregroundChips(calendar.container, "Disponible")).toHaveLength(1);
    });

    it("does not duplicate the chip when the week is left and re-entered", async () => {
        const user = userEvent.setup();
        const calendar = await weekWithMark();
        await chipNamed(calendar.container, "Disponible", ".fc-daygrid-event");

        await user.click(calendar.next());
        await user.click(screen.getByRole("button", { name: "Semana antes" }));

        await waitFor(() => expect(foregroundChips(calendar.container, "Disponible")).toHaveLength(1));
    });

    it("routes a tap on the chip to the removal confirmation, and confirming removes the mark once", async () => {
        const user = userEvent.setup();
        removeAvailability.mockResolvedValue(undefined);
        const calendar = await weekWithMark();

        await user.click(await chipNamed(calendar.container, "Disponible", ".fc-daygrid-event"));
        expect(await screen.findByRole("dialog", { name: "Quitar «Disponible»" })).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Quitar del calendario" }));

        await waitFor(() => expect(removeAvailability).toHaveBeenCalledTimes(1));
        expect(removeAvailability).toHaveBeenCalledWith(1, "avail_3");
    });

    it("keeps 44 px on both answers of the removal dialog", async () => {
        // Medido a mano: "Quitar del calendario" salía de 40 px, bajo el mínimo que ya sostienen los
        // diálogos de bloquear y de mover. Una decisión sobre la agenda no se toma con un blanco chico.
        const user = userEvent.setup();
        const calendar = await weekWithMark();

        await user.click(await chipNamed(calendar.container, "Disponible", ".fc-daygrid-event"));
        const dialog = await screen.findByRole("dialog", { name: "Quitar «Disponible»" });

        for (const name of ["Cancelar", "Quitar del calendario"]) {
            const button = within(dialog).getByRole("button", { name });
            expect(button).toHaveClass("min-h-11");
            expect(button.className).not.toMatch(/outline-none/);
        }
    });

    it("keeps a busy block draggable, so moving it still asks first", async () => {
        getGroupSchedules.mockResolvedValue([BUSY]);
        const calendar = renderCalendar();

        const busy = await chipNamed(calendar.container, "Ensayo");

        expect(busy).toHaveClass("fc-event-draggable");
        expect(busy).not.toHaveClass("fc-bg-event");
    });

    it("still offers to remove a busy block when it is tapped", async () => {
        const user = userEvent.setup();
        getGroupSchedules.mockResolvedValue([BUSY]);
        const calendar = renderCalendar();

        await user.click(await chipNamed(calendar.container, "Ensayo"));

        expect(await screen.findByRole("dialog", { name: "Quitar «Ensayo»" })).toBeInTheDocument();
    });
});
