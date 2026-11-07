// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
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
