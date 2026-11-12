// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MoveBlockDialog } from "./MoveBlockDialog";
import { PAST_DAY_NOTE } from "../blockDay";

/** El movimiento del informe: "Ensayo" de 17:00–20:00 a 18:00–21:00, el 4 de diciembre de 2026. */
const FROM = { start: new Date(2026, 11, 4, 17, 0).toISOString(), end: new Date(2026, 11, 4, 20, 0).toISOString() };
const TO = { start: new Date(2026, 11, 4, 18, 0).toISOString(), end: new Date(2026, 11, 4, 21, 0).toISOString() };
/** 20 de octubre de 2026: ya pasó. */
const PAST_TO = {
    start: new Date(2026, 9, 20, 19, 0).toISOString(),
    end: new Date(2026, 9, 20, 21, 30).toISOString(),
};

function renderDialog(overrides: Partial<Parameters<typeof MoveBlockDialog>[0]> = {}) {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const view = render(
        <MoveBlockDialog
            title="Ensayo"
            from={FROM}
            to={TO}
            isSaving={false}
            onCancel={onCancel}
            onConfirm={onConfirm}
            {...overrides}
        />
    );
    return { ...view, onConfirm, onCancel };
}

/**
 * Ronda 12: mover un bloque escribía al soltar. La pregunta tiene la misma forma y la misma voz que el
 * diálogo del bloqueo, y dice qué mueve y a dónde, porque el manager tiene que poder decidir sin adivinar.
 */
describe("MoveBlockDialog · la pregunta antes del movimiento", () => {
    it("names the block and both places: where it is and where it would go", () => {
        renderDialog();

        const dialog = screen.getByRole("dialog", { name: "Mover este bloque" });
        expect(within(dialog).getByText("Ensayo")).toBeInTheDocument();
        expect(within(dialog).getByText("Ahora: viernes 4 de diciembre, 17:00 a 20:00")).toBeInTheDocument();
        expect(within(dialog).getByText("Después: viernes 4 de diciembre, 18:00 a 21:00")).toBeInTheDocument();
        // Y dice que nada cambió todavía: es la frase que convierte un arrastre en una decisión.
        expect(within(dialog).getByText("El bloque no se mueve hasta que lo confirmes.")).toBeInTheDocument();
    });

    it("asks before writing: cancelling reports nothing to move", async () => {
        const user = userEvent.setup();
        const { onConfirm, onCancel } = renderDialog();

        const dialog = screen.getByRole("dialog", { name: "Mover este bloque" });
        expect(onConfirm).not.toHaveBeenCalled();

        await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onConfirm).not.toHaveBeenCalled();

        await user.click(within(dialog).getByRole("button", { name: "Mover bloque" }));
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("says it is saving while the move is on its way", () => {
        renderDialog({ isSaving: true });

        const dialog = screen.getByRole("dialog", { name: "Mover este bloque" });
        expect(within(dialog).getByRole("button", { name: "Moviendo…" })).toBeDisabled();
        expect(within(dialog).getByRole("button", { name: "Cancelar" })).toBeDisabled();
    });

    it("keeps 44 px on both buttons and does not turn the focus ring off", () => {
        renderDialog();

        const dialog = screen.getByRole("dialog", { name: "Mover este bloque" });
        const cancel = within(dialog).getByRole("button", { name: "Cancelar" });
        const confirm = within(dialog).getByRole("button", { name: "Mover bloque" });
        expect(cancel).toHaveClass("min-h-11");
        expect(confirm).toHaveClass("min-h-11");
        expect(cancel.className).not.toMatch(/outline-none/);
        expect(confirm.className).not.toMatch(/outline-none/);
    });
});

/**
 * Ronda 12: "I can block a day that already passed". El formulario del día ya lo rechazaba; el arrastre y
 * ahora el movimiento leen la misma regla y dicen la misma frase (el pasado no se puede mover al pasado).
 */
describe("MoveBlockDialog · un movimiento al pasado se rechaza con la frase del formulario", () => {
    it("refuses a destination that already passed and does not offer to write", () => {
        renderDialog({ to: PAST_TO });

        const dialog = screen.getByRole("dialog", { name: "Mover este bloque" });
        const note = within(dialog).getByText(PAST_DAY_NOTE);
        // La frase del formulario del día, la misma, y el botón apagado con la razón como descripción.
        expect(note).toBeInTheDocument();
        const confirm = within(dialog).getByRole("button", { name: "Mover bloque" });
        expect(confirm).toBeDisabled();
        expect(confirm.getAttribute("aria-describedby")?.split(" ")).toContain(note.id);
    });

    it("still offers the move to today", () => {
        renderDialog({ to: TO });

        const dialog = screen.getByRole("dialog", { name: "Mover este bloque" });
        expect(within(dialog).queryByText(PAST_DAY_NOTE)).toBeNull();
        expect(within(dialog).getByRole("button", { name: "Mover bloque" })).toBeEnabled();
    });
});
