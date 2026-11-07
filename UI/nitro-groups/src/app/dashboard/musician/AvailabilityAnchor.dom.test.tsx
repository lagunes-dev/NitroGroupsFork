// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AVAILABILITY_ANCHOR_ID, AvailabilityAnchor, tabFromHash } from "./AvailabilityAnchor";

/** jsdom does not implement scrolling: the anchor calls it, so the test watches it. */
const scrollIntoView = vi.fn();
beforeEach(() => {
    scrollIntoView.mockClear();
    Element.prototype.scrollIntoView = scrollIntoView;
});

const Switch = () => (
    <button type="button" role="switch" aria-checked="true">
        Aparecer en el directorio y aceptar invitaciones
    </button>
);

describe("AvailabilityAnchor", () => {
    it("lands on the switch when the link asked for it", () => {
        render(
            <AvailabilityAnchor focusOnMount>
                <Switch />
            </AvailabilityAnchor>
        );

        const control = screen.getByRole("switch");
        // El interruptor es el bloque de disponibilidad: es él quien lleva el id del enlace.
        expect(control).toHaveAttribute("id", AVAILABILITY_ANCHOR_ID);
        expect(AVAILABILITY_ANCHOR_ID).toBe("mi-perfil");
        expect(control).toHaveFocus();
        expect(scrollIntoView).toHaveBeenCalled();
        // El foco se ve, aunque el navegador no lo considere `:focus-visible` tras un salto por hash.
        expect(control.style.outlineWidth).toBe("2px");
        expect(control.style.outlineStyle).toBe("solid");
    });

    it("marks the block without stealing the focus when the person opened the tab", () => {
        render(
            <AvailabilityAnchor>
                <Switch />
            </AvailabilityAnchor>
        );

        const control = screen.getByRole("switch");
        expect(control).toHaveAttribute("id", AVAILABILITY_ANCHOR_ID);
        expect(control).not.toHaveFocus();
        expect(scrollIntoView).not.toHaveBeenCalled();
        expect(control.style.outlineStyle).toBe("");
    });

    it("waits for the form to load before it anchors the switch", async () => {
        const { rerender } = render(
            <AvailabilityAnchor focusOnMount>
                <p>Cargando tu perfil…</p>
            </AvailabilityAnchor>
        );
        expect(document.getElementById(AVAILABILITY_ANCHOR_ID)).toBeNull();

        rerender(
            <AvailabilityAnchor focusOnMount>
                <Switch />
            </AvailabilityAnchor>
        );

        await waitFor(() => expect(document.getElementById(AVAILABILITY_ANCHOR_ID)).not.toBeNull());
        expect(screen.getByRole("switch")).toHaveFocus();
    });

    it("releases the ring as soon as the focus moves on", () => {
        render(
            <AvailabilityAnchor focusOnMount>
                <Switch />
            </AvailabilityAnchor>
        );

        const control = screen.getByRole("switch");
        fireEvent.blur(control);

        expect(control.style.outlineStyle).toBe("");
        expect(control.style.outlineWidth).toBe("");
    });

    it("reads the tab a deep link asks for", () => {
        expect(tabFromHash("#mi-perfil")).toBe("mi-perfil");
        expect(tabFromHash("mi-perfil")).toBe("mi-perfil");
        expect(tabFromHash("")).toBe("");
        expect(tabFromHash("#")).toBe("");
    });
});
