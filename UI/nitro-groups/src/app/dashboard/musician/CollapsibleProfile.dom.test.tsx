// @vitest-environment jsdom
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CollapsibleProfile } from "./CollapsibleProfile";

/** jsdom no mide píxeles: lo que se fija acá es la decisión de layout que produce el resultado a 390 px. */
function renderProfile() {
    return render(
        <CollapsibleProfile title="Versátil Rock y Pop">
            <div>Tarjeta del grupo</div>
        </CollapsibleProfile>
    );
}

describe("CollapsibleProfile", () => {
    it("names the entry as the group's profile, not the person's", () => {
        // Ronda 9: el panel ya tiene una pestaña "Perfil" del músico. Este botón abre el perfil del
        // grupo, y lo dice: "Ver perfil" no decía de quién era el perfil que abría.
        renderProfile();

        const toggle = screen.getByRole("button", { name: "Perfil del grupo" });
        expect(toggle).toHaveAccessibleName("Perfil del grupo");
        expect(screen.queryByRole("button", { name: "Ver perfil" })).toBeNull();
    });

    it("starts folded on a phone so the pending work is not one screen down", () => {
        renderProfile();

        const toggle = screen.getByRole("button", { name: "Perfil del grupo" });
        expect(toggle).toHaveAttribute("aria-expanded", "false");

        const panel = document.getElementById(toggle.getAttribute("aria-controls") ?? "");
        expect(panel).not.toBeNull();
        // Plegado en móvil, abierto y sin botón que lo gobierne de `md` para arriba.
        expect(panel).toHaveClass("hidden");
        expect(panel).toHaveClass("md:block");
        // Lo de hoy sigue estando: se pliega, no se esconde.
        expect(screen.getByText("Tarjeta del grupo")).toBeInTheDocument();
        // El resumen va antes del perfil plegado.
        expect(toggle.compareDocumentPosition(panel as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("opens the whole card with one press and puts it back", async () => {
        const user = userEvent.setup();
        renderProfile();

        await user.click(screen.getByRole("button", { name: "Perfil del grupo" }));

        const close = screen.getByRole("button", { name: "Ocultar perfil del grupo" });
        expect(close).toHaveAttribute("aria-expanded", "true");
        const panel = document.getElementById(close.getAttribute("aria-controls") ?? "");
        expect(panel).toHaveClass("block");
        expect(panel).not.toHaveClass("hidden");
        expect(screen.getByText("Tarjeta del grupo")).toBeVisible();

        await user.click(close);
        expect(screen.getByRole("button", { name: "Perfil del grupo" })).toHaveAttribute("aria-expanded", "false");
    });

    it("does not offer the summary on a wide screen, where the card is always open", () => {
        renderProfile();

        const toggle = screen.getByRole("button", { name: "Perfil del grupo" });
        // El renglón del resumen solo existe en móvil; en escritorio el perfil se lee completo.
        expect(toggle.parentElement).toHaveClass("md:hidden");
        expect(toggle.parentElement).toHaveClass("mt-8");
    });
});

/**
 * Ronda 10: desde el panel del manager, el perfil del grupo se edita en un toque. Leerlo y editarlo son
 * dos acciones distintas y el nombre de la nueva lo dice: abre un formulario, no muestra la ficha.
 */
describe("CollapsibleProfile · editar el perfil del grupo en un toque (ronda 10)", () => {
    const EDIT = "Editar perfil del grupo";

    function renderWithEdit(onClick = vi.fn()) {
        render(
            <CollapsibleProfile
                title="Versátil Rock y Pop"
                editAction={{ label: EDIT, onClick }}
            >
                <div>Tarjeta del grupo</div>
            </CollapsibleProfile>
        );
        return { onClick };
    }

    it("names the edit action after what it does and who it edits", () => {
        renderWithEdit();

        const edit = screen.getByRole("button", { name: EDIT });
        // Dice que edita y de qué identidad: "Editar" a secas se confunde con el perfil del músico.
        expect(edit).toHaveAccessibleName("Editar perfil del grupo");
        expect(screen.getByRole("button", { name: "Perfil del grupo" })).toBeInTheDocument();
    });

    it("opens the panel and asks for the form in one press", async () => {
        const user = userEvent.setup();
        const { onClick } = renderWithEdit();

        await user.click(screen.getByRole("button", { name: EDIT }));

        expect(onClick).toHaveBeenCalledTimes(1);
        const close = screen.getByRole("button", { name: "Ocultar perfil del grupo" });
        expect(close).toHaveAttribute("aria-expanded", "true");
        const panel = document.getElementById(close.getAttribute("aria-controls") ?? "");
        expect(panel).toHaveClass("block");
    });

    it("holds 44 px on the entry that opens the profile and on the one that opens the form", () => {
        renderWithEdit();

        // Ronda 10: a 390 px las dos entradas medían 36 px (Button size="sm").
        expect(screen.getByRole("button", { name: "Perfil del grupo" })).toHaveClass("min-h-11");
        expect(screen.getByRole("button", { name: EDIT })).toHaveClass("min-h-11");
    });

    it("offers no edit action when the caller does not ask for one", () => {
        renderProfile();

        expect(screen.queryByRole("button", { name: /Editar/i })).toBeNull();
    });
});
/**
 * Ronda 10: el manager abrió el formulario del grupo, escribió "Cómo pagar" y tocó "Ocultar perfil del
 * grupo". El formulario se fue sin preguntar y el botón seguía diciendo que el perfil del grupo estaba
 * desplegado cuando en pantalla estaba el editor. Dos reglas: cerrar el editor no descarta el borrador
 * en silencio, y el renglón de plegado nombra lo que de verdad hay en el panel.
 */
describe("CollapsibleProfile · cerrar el formulario del grupo (ronda 10)", () => {
    const OPEN_EDITOR = "Ocultar el formulario del grupo";

    /** The page's wiring: asking for the form turns `editing` on; discarding turns it off. */
    function EditingHarness({ onDiscard }: { onDiscard: () => void }) {
        const [editing, setEditing] = useState(false);
        return (
            <CollapsibleProfile
                title="Versátil Rock y Pop"
                editing={editing}
                onDiscard={() => { onDiscard(); setEditing(false); }}
                editAction={{ label: "Editar perfil del grupo", onClick: () => setEditing(true) }}
            >
                <div>Formulario del perfil del grupo</div>
            </CollapsibleProfile>
        );
    }

    function renderEditing() {
        const onDiscard = vi.fn();
        render(<EditingHarness onDiscard={onDiscard} />);
        return { onDiscard };
    }

    async function openEditor() {
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "Editar perfil del grupo" }));
        return user;
    }

    it("names the expanded panel after the editor that is on screen", async () => {
        renderEditing();
        await openEditor();

        const toggle = screen.getByRole("button", { name: OPEN_EDITOR });
        expect(toggle).toHaveAttribute("aria-expanded", "true");
        // Nombrar el perfil del grupo cuando en el panel está el editor es describir otra pantalla.
        expect(screen.queryByRole("button", { name: "Ocultar perfil del grupo" })).toBeNull();
    });

    it("asks before closing the editor and keeps the draft on screen when the manager stays", async () => {
        const { onDiscard } = renderEditing();
        const user = await openEditor();

        await user.click(screen.getByRole("button", { name: OPEN_EDITOR }));

        const dialog = screen.getByRole("dialog", { name: "¿Cerrar el formulario sin guardar?" });
        expect(dialog).toHaveTextContent("Lo que escribiste no se guarda");
        // El formulario sigue donde estaba: todavía no se descartó nada.
        expect(screen.getByText("Formulario del perfil del grupo")).toBeVisible();

        await user.click(screen.getByRole("button", { name: "Seguir editando" }));

        expect(screen.queryByRole("dialog")).toBeNull();
        const toggle = screen.getByRole("button", { name: OPEN_EDITOR });
        expect(document.getElementById(toggle.getAttribute("aria-controls") ?? "")).toHaveClass("block");
        // The keyboard stays where the question came from, not on a button that just disappeared.
        expect(toggle).toHaveFocus();
        expect(onDiscard).not.toHaveBeenCalled();
    });

    it("closes and discards only when the manager confirms", async () => {
        const { onDiscard } = renderEditing();
        const user = await openEditor();

        await user.click(screen.getByRole("button", { name: OPEN_EDITOR }));
        await user.click(screen.getByRole("button", { name: "Cerrar sin guardar" }));

        expect(onDiscard).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole("dialog")).toBeNull();
        const toggle = screen.getByRole("button", { name: "Perfil del grupo" });
        expect(toggle).toHaveAttribute("aria-expanded", "false");
        expect(document.getElementById(toggle.getAttribute("aria-controls") ?? "")).toHaveClass("hidden");
    });

    it("still folds the read view with one press, with nothing to ask about", async () => {
        const user = userEvent.setup();
        renderProfile();

        await user.click(screen.getByRole("button", { name: "Perfil del grupo" }));
        await user.click(screen.getByRole("button", { name: "Ocultar perfil del grupo" }));

        expect(screen.queryByRole("dialog")).toBeNull();
        expect(screen.getByRole("button", { name: "Perfil del grupo" })).toHaveAttribute("aria-expanded", "false");
    });

    it("holds 44 px on the two answers of the confirmation", async () => {
        renderEditing();
        const user = await openEditor();

        await user.click(screen.getByRole("button", { name: OPEN_EDITOR }));

        expect(screen.getByRole("button", { name: "Seguir editando" })).toHaveClass("min-h-11");
        expect(screen.getByRole("button", { name: "Cerrar sin guardar" })).toHaveClass("min-h-11");
    });
});
