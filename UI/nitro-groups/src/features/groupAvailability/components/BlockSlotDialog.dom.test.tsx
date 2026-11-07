// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BlockSlotDialog } from "./BlockSlotDialog";

/**
 * La agenda del grupo es la única fuente de los días con toque confirmado: el diálogo del arrastre la
 * lee con el mismo hook que el formulario del día, así que acá se sustituye la lectura, no la regla.
 */
const agenda = vi.hoisted(() => ({ forGroup: vi.fn() }));
vi.mock("@/features/gigs/gigs.service", () => ({ gigsService: { forGroup: agenda.forGroup } }));

const GROUP = 7;
/** El arrastre del informe de la ronda 11: viernes 4 de diciembre, de 19:00 a 21:30, en hora local. */
const START = new Date(2026, 11, 4, 19, 0).toISOString();
const END = new Date(2026, 11, 4, 21, 30).toISOString();
const GIG_DAY = "2026-12-04";

/** La frase exacta del formulario del día: la misma regla, la misma voz. */
const GIG_NOTE = "Ese día ya tienes un toque confirmado. Bloquearlo no lo cancela.";
const CHECKING = "Comprobando si ese día ya tienes un toque…";
const UNKNOWN = "No pudimos comprobar si ese día ya tienes un toque.";

/** Una fila de `GET api/groups/{id}/gigs`, recortada a lo que el diálogo mira: el día del toque. */
function gigRow(eventDate: string) {
    return { id: 1, eventDate };
}

function renderDialog() {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
        <QueryClientProvider client={client}>
            <BlockSlotDialog
                groupId={GROUP}
                start={START}
                end={END}
                isSaving={false}
                onCancel={onCancel}
                onConfirm={onConfirm}
            />
        </QueryClientProvider>
    );
    return { onConfirm, onCancel };
}

beforeEach(() => {
    agenda.forGroup.mockReset();
    agenda.forGroup.mockResolvedValue([]);
});

/**
 * Ronda 11: el manager bloqueó arrastrando sobre un día con un toque confirmado y el diálogo no dijo
 * nada, mientras el mismo día por el formulario sí lo decía. Una regla, dos puertas, la misma frase.
 */
describe("ronda 11 · el diálogo del arrastre dice si ese día ya tiene un toque confirmado", () => {
    it("states the confirmed gig in the day form's own words, and still lets the manager block", async () => {
        agenda.forGroup.mockResolvedValue([gigRow(GIG_DAY)]);
        const { onConfirm } = renderDialog();

        const dialog = await screen.findByRole("dialog", { name: "Bloquear este horario" });
        expect(await within(dialog).findByText(GIG_NOTE)).toBeInTheDocument();
        // El aviso es un hecho, no una traba: el botón sigue ofreciendo bloquear y no se escribió nada.
        expect(within(dialog).getByRole("button", { name: "Bloquear horario" })).toBeEnabled();
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it("says it is still checking instead of calling that day free", async () => {
        // La agenda no contestó: el diálogo lo dice en vez de afirmar que el día está libre.
        agenda.forGroup.mockReturnValue(new Promise(() => {}));
        renderDialog();

        const dialog = await screen.findByRole("dialog", { name: "Bloquear este horario" });
        expect(within(dialog).getByText(CHECKING)).toBeInTheDocument();
        expect(within(dialog).queryByText(/toque confirmado/i)).toBeNull();
        expect(within(dialog).queryByText(UNKNOWN)).toBeNull();
    });

    it("says nothing extra when the dragged hours fall on a free day", async () => {
        agenda.forGroup.mockResolvedValue([gigRow("2026-12-05")]);
        renderDialog();

        const dialog = await screen.findByRole("dialog", { name: "Bloquear este horario" });
        // Primero comprueba; cuando la agenda contesta sin toque, la frase se va y no queda un renglón vacío.
        await waitFor(() => expect(within(dialog).queryByText(CHECKING)).toBeNull());
        expect(within(dialog).queryByText(/toque confirmado/i)).toBeNull();
        expect(
            within(dialog).getByText("Nadie podrá pedirte una fecha en ese horario. Puedes quitar el bloque cuando quieras.")
        ).toBeInTheDocument();
    });

    it("says it could not check when the agenda could not be read", async () => {
        agenda.forGroup.mockRejectedValue(new Error("boom"));
        renderDialog();

        const dialog = await screen.findByRole("dialog", { name: "Bloquear este horario" });
        // Silencio se lee como "no tienes toque": cuando no se pudo leer, lo dice.
        expect(await within(dialog).findByText(UNKNOWN, {}, { timeout: 5000 })).toBeInTheDocument();
    });

    it("still names the dragged range and asks before writing anything", async () => {
        const user = userEvent.setup();
        const { onConfirm, onCancel } = renderDialog();

        const dialog = await screen.findByRole("dialog", { name: "Bloquear este horario" });
        expect(within(dialog).getByText("viernes 4 de diciembre, 19:00 a 21:30")).toBeInTheDocument();
        expect(onConfirm).not.toHaveBeenCalled();

        await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
        expect(onCancel).toHaveBeenCalled();
        expect(onConfirm).not.toHaveBeenCalled();

        await user.click(within(dialog).getByRole("button", { name: "Bloquear horario" }));
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("keeps 44 px on both buttons and does not turn the focus ring off", async () => {
        renderDialog();

        const dialog = await screen.findByRole("dialog", { name: "Bloquear este horario" });
        const cancel = within(dialog).getByRole("button", { name: "Cancelar" });
        const confirm = within(dialog).getByRole("button", { name: "Bloquear horario" });
        expect(cancel).toHaveClass("min-h-11");
        expect(confirm).toHaveClass("min-h-11");
        expect(cancel.className).not.toMatch(/outline-none/);
        expect(confirm.className).not.toMatch(/outline-none/);
    });
});
