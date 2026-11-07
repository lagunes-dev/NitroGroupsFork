// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
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

/**
 * La agenda del grupo es la única fuente de los días con toque confirmado (ronda 10): el control la
 * lee con el mismo hook que el calendario, así que acá se sustituye la escritura, no la lectura.
 */
const agenda = vi.hoisted(() => ({ forGroup: vi.fn() }));
vi.mock("@/features/gigs/gigs.service", () => ({ gigsService: { forGroup: agenda.forGroup } }));

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

/** Una fila de `GET api/groups/{id}/gigs`, recortada a lo que el control mira: el día del toque. */
function gigRow(eventDate: string) {
    return { id: 1, eventDate };
}

function renderControl(initialDay = DAY) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(
        <QueryClientProvider client={client}>
            <BlockDayControl groupId={GROUP} initialDay={initialDay} />
        </QueryClientProvider>
    );
    return { ...view, client };
}

/** El botón que bloquea o desbloquea el día, por su nombre accesible. */
const toggle = (verb: "Bloquear" | "Desbloquear" = "Bloquear", dayName = DAY_NAME) =>
    screen.findByRole("button", { name: `${verb} el día ${dayName}` });

/** El control no opera hasta leer el día y la agenda: primero se habilita y después se pulsa. */
async function openDialog(verb: "Bloquear" | "Desbloquear" = "Bloquear", dayName = DAY_NAME) {
    const control = await toggle(verb, dayName);
    await waitFor(() => expect(control).toBeEnabled());
    await userEvent.setup().click(control);
    return screen.getByRole("dialog", { name: verb === "Bloquear" ? "Bloquear este día" : "Desbloquear este día" });
}

beforeEach(() => {
    for (const fn of Object.values(service)) (fn as Mock).mockReset();
    service.getGroupSchedules.mockResolvedValue([]);
    service.createBusySchedule.mockResolvedValue({ id: "busy_99" });
    service.removeBusySchedule.mockResolvedValue(undefined);
    service.removeAvailability.mockResolvedValue(undefined);
    agenda.forGroup.mockReset();
    agenda.forGroup.mockResolvedValue([]);
});

describe("S26 · el control dice qué día bloquea", () => {
    it("names the day in its accessible name and keeps a visible label that is contained in it", async () => {
        renderControl();

        const control = await toggle();
        // "Bloquear" a secas no basta: el nombre accesible dice el día largo.
        expect(control).toHaveAccessibleName(`Bloquear el día ${DAY_NAME}`);
        // La etiqueta visible también lo dice, corto: el día ya no vive solo en el aria-label.
        expect(control).toHaveTextContent("Bloquear el jue 19 nov");
        expect(control).not.toHaveTextContent("Bloquear el día");
        // Objetivo de 44 px y sin apagar el anillo de foco global.
        expect(control).toHaveClass("min-h-11");
        expect(control.className).not.toMatch(/outline-none/);
    });

    it("keeps the generic label while the day cannot be read", async () => {
        renderControl("19/11/2026");

        const control = await screen.findByRole("button", { name: "Bloquear el día" });
        expect(control).toHaveTextContent("Bloquear el día");
        // Tampoco afirma el verbo: todavía no leyó el día.
        expect(control).toBeDisabled();
    });

    it("asks the same question as the calendar before writing anything", async () => {
        const user = userEvent.setup();
        renderControl();

        const dialog = await openDialog();
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

        const dialog = await openDialog();
        await user.click(within(dialog).getByRole("button", { name: "Bloquear día" }));

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
        const dialog = await openDialog("Bloquear", "martes 24 de noviembre de 2026");
        await user.click(within(dialog).getByRole("button", { name: "Bloquear día" }));

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
        expect(control).toHaveTextContent("Desbloquear el jue 19 nov");

        await waitFor(() => expect(control).toBeEnabled());
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
        expect(control).toHaveTextContent("Bloquear el jue 19 nov");
    });
});

describe("S26 · errores", () => {
    it("says it could not save with the calendar's own words", async () => {
        const user = userEvent.setup();
        service.createBusySchedule.mockRejectedValue(new Error("boom"));
        renderControl();

        const dialog = await openDialog();
        await user.click(within(dialog).getByRole("button", { name: "Bloquear día" }));

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
            service.getGroupSchedules.mockResolvedValue(verb === "Desbloquear" ? [wholeDayBlock(DAY)] : []);
            renderControl();

            const dialog = await openDialog(verb);
            expect(within(dialog).getByRole("button", { name: "Cancelar" })).toHaveClass("min-h-11");
            expect(within(dialog).getByRole("button", { name: action })).toHaveClass("min-h-11");
        }
    );
});

/**
 * Ronda 10: la manager bloqueó un día que ya tenía un toque confirmado y el diálogo decía lo mismo que
 * para un día vacío. El aviso se lee de la agenda del grupo, la misma que alimenta el calendario: antes
 * dependía de que la superficie que monta el control se acordara de pasársela, y la bandeja —la primera
 * que ve un manager— no lo hacía.
 */
describe("S26 · el diálogo avisa si ese día ya tiene un toque confirmado (ronda 10)", () => {
    it("states the confirmed gig on the surface that only knows the group, like the inbox", async () => {
        // La bandeja monta el control sin pasarle ningún día: la agenda es la única fuente.
        agenda.forGroup.mockResolvedValue([gigRow(DAY)]);
        renderControl();

        const dialog = await openDialog();

        expect(within(dialog).getByText(/Ese día ya tienes un toque confirmado/)).toBeInTheDocument();
        // El aviso es un dato, no una traba: el botón sigue ofreciendo bloquear y nada se escribió aún.
        expect(within(dialog).getByRole("button", { name: "Bloquear día" })).toBeEnabled();
        expect(service.createBusySchedule).not.toHaveBeenCalled();
    });

    it("says it is still checking instead of calling the day free", async () => {
        // La agenda no contestó todavía: el diálogo lo dice en vez de afirmar que el día está libre.
        agenda.forGroup.mockReturnValue(new Promise(() => {}));
        renderControl();

        const dialog = await openDialog();

        expect(within(dialog).getByText("Comprobando si ese día ya tienes un toque…")).toBeInTheDocument();
        // Y no inventa el hecho que todavía no leyó.
        expect(within(dialog).queryByText(/Ese día ya tienes un toque confirmado/)).toBeNull();
        expect(within(dialog).queryByText(/No pudimos comprobar/)).toBeNull();
    });

    it("turns the check into the fact once the agenda answers, without dropping it", async () => {
        // La agenda contesta con el diálogo ya abierto: el estado de espera se convierte en el hecho.
        let answer: (rows: { id: number; eventDate: string }[]) => void = () => {};
        agenda.forGroup.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
        renderControl();

        const dialog = await openDialog();
        expect(within(dialog).getByText("Comprobando si ese día ya tienes un toque…")).toBeInTheDocument();

        await act(async () => {
            answer([gigRow(DAY)]);
            await new Promise((resolve) => setTimeout(resolve, 100));
        });

        expect(within(dialog).getByText(/Ese día ya tienes un toque confirmado/)).toBeInTheDocument();
        expect(within(dialog).queryByText("Comprobando si ese día ya tienes un toque…")).toBeNull();
    });

    it("says the same as always on a day with no confirmed gig", async () => {
        agenda.forGroup.mockResolvedValue([gigRow("2026-11-20")]);
        renderControl();

        const dialog = await openDialog();

        expect(within(dialog).queryByText(/toque confirmado/i)).toBeNull();
        expect(
            within(dialog).getByText("Nadie podrá pedirte una fecha ese día. Puedes desbloquearlo cuando quieras.")
        ).toBeInTheDocument();
    });

    it("keeps what the manager read when the agenda changes behind the open dialog", async () => {
        agenda.forGroup.mockResolvedValue([gigRow(DAY)]);
        const { client } = renderControl();

        const dialog = await openDialog();
        expect(within(dialog).getByText(/Ese día ya tienes un toque confirmado/)).toBeInTheDocument();

        // La agenda se vacía detrás del diálogo (un refetch, otra pestaña, un guardado): lo que el
        // manager ya leyó no se cae de la vista — un aviso que aparece y desaparece es peor que ninguno.
        agenda.forGroup.mockResolvedValue([]);
        await act(async () => {
            await client.refetchQueries({ queryKey: ["group-gigs", GROUP] });
            // La caché ya cambió; un turno más para que el renglón pintado se entere.
            await new Promise((resolve) => setTimeout(resolve, 100));
        });

        expect(within(dialog).getByText(/Ese día ya tienes un toque confirmado/)).toBeInTheDocument();
    });

    it("says it could not check when the agenda could not be read", async () => {
        agenda.forGroup.mockRejectedValue(new Error("boom"));
        renderControl();

        // La consulta reintenta una vez antes de darse por vencida: primero comprueba, después lo dice.
        const dialog = await openDialog();

        // Silencio se lee como "no tienes toque": cuando no se pudo leer, lo dice.
        expect(await within(dialog).findByText("No pudimos comprobar si ese día ya tienes un toque.", {}, { timeout: 5000 })).toBeInTheDocument();
        expect(within(dialog).getByRole("button", { name: "Bloquear día" })).toBeEnabled();
    });

    it("does not repeat it when the manager is lifting a block", async () => {
        service.getGroupSchedules.mockResolvedValue([wholeDayBlock(DAY)]);
        agenda.forGroup.mockResolvedValue([gigRow(DAY)]);
        renderControl();

        const dialog = await openDialog("Desbloquear");

        // Desbloquear no choca con el toque: ese día vuelve a estar disponible y el aviso sería ruido.
        expect(within(dialog).queryByText(/toque confirmado/i)).toBeNull();
    });
});
