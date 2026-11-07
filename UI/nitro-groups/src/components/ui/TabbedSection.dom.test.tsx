// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TabbedSection, { TabItem } from "./TabbedSection";

/** The panel of the musician dashboard, shortened: two long titles and one pending count. */
function Tabs() {
    return (
        <TabbedSection label="Gestión del grupo">
            <TabItem title="Pedidos de fecha" shortTitle="Pedidos" tabKey="pedidos">
                <p>Los pedidos</p>
            </TabItem>
            <TabItem title="Agenda" tabKey="agenda">
                <p>La agenda</p>
            </TabItem>
            <TabItem title="Equipo" count={1} tabKey="equipo">
                <p>El equipo</p>
            </TabItem>
            <TabItem title="Mi perfil" shortTitle="Perfil" tabKey="mi-perfil">
                <p>El perfil</p>
            </TabItem>
        </TabbedSection>
    );
}

/** jsdom has no layout, so the box the bar measures is written on the element itself. */
function measure(el: HTMLElement, box: { clientWidth?: number; scrollWidth?: number }) {
    if (box.clientWidth !== undefined) Object.defineProperty(el, "clientWidth", { configurable: true, value: box.clientWidth });
    if (box.scrollWidth !== undefined) Object.defineProperty(el, "scrollWidth", { configurable: true, value: box.scrollWidth });
}

describe("TabbedSection", () => {
    it("keeps a space between the label and the pending count", () => {
        render(<Tabs />);

        const tab = screen.getByRole("tab", { name: "Equipo, 1 pendiente" });
        // La ronda 6 leyó "Equipo1": el rótulo y la píldora no tenían ni un espacio entre ellos.
        expect(tab.textContent).toBe("Equipo 1");
        // La separación es del contenedor, no un margen que se pierde en un contenedor nuevo.
        expect(tab).toHaveClass("gap-2");
    });

    it("gives every tab a short label for a phone and the full name to the screen reader", () => {
        render(<Tabs />);

        const compact = screen.getAllByRole("tab").map((tab) => tab.querySelector('[data-label="compact"]')?.textContent ?? null);
        expect(compact).toEqual(["Pedidos", "Agenda", "Equipo", "Perfil"]);

        // Las pestañas acortadas conservan su nombre completo a partir de sm y para el lector de pantalla.
        const full = screen.getAllByRole("tab").map((tab) => tab.querySelector('[data-label="full"]')?.textContent ?? null);
        expect(full).toEqual(["Pedidos de fecha", null, null, "Mi perfil"]);

        const names = screen.getAllByRole("tab").map((tab) => tab.getAttribute("aria-label") ?? tab.textContent);
        expect(names).toEqual(["Pedidos de fecha", "Agenda", "Equipo, 1 pendiente", "Mi perfil"]);
    });

    it("warns that the bar scrolls when the tabs do not fit", () => {
        const { container } = render(<Tabs />);
        const bar = screen.getByRole("tablist");

        // Sin desbordamiento no hay señal: la barra se ve entera.
        expect(container.querySelector('[data-edge="end"]')).toBeNull();

        measure(bar, { clientWidth: 390, scrollWidth: 820 });
        act(() => {
            window.dispatchEvent(new Event("resize"));
        });
        expect(container.querySelector('[data-edge="end"]')).not.toBeNull();
        expect(container.querySelector('[data-edge="start"]')).toBeNull();

        // Ya se desplazó: el borde que avisa ahora es el de la izquierda.
        bar.scrollLeft = 100;
        act(() => {
            bar.dispatchEvent(new Event("scroll"));
        });
        expect(container.querySelector('[data-edge="start"]')).not.toBeNull();
        expect(container.querySelector('[data-edge="end"]')).not.toBeNull();
    });

    it("brings the chosen tab into view instead of leaving it off screen", async () => {
        render(<Tabs />);
        const bar = screen.getByRole("tablist");
        measure(bar, { clientWidth: 390, scrollWidth: 900 });

        const perfil = screen.getByRole("tab", { name: "Mi perfil" });
        Object.defineProperty(perfil, "offsetLeft", { configurable: true, value: 520 });
        Object.defineProperty(perfil, "offsetWidth", { configurable: true, value: 90 });

        await userEvent.click(perfil);

        // 520 + 90 - 390: el borde derecho de la pestaña queda pegado al borde de la barra.
        expect(bar.scrollLeft).toBe(220);
    });

    it("does not move the bar when the chosen tab is already visible", async () => {
        render(<Tabs />);
        const bar = screen.getByRole("tablist");
        measure(bar, { clientWidth: 390, scrollWidth: 900 });

        await userEvent.click(screen.getByRole("tab", { name: "Agenda" }));

        expect(bar.scrollLeft).toBe(0);
    });

    it("keeps the keyboard pattern and the panel wiring of the chosen tab", async () => {
        render(<Tabs />);

        const agenda = screen.getByRole("tab", { name: "Agenda" });
        await userEvent.click(agenda);

        expect(agenda).toHaveAttribute("aria-selected", "true");
        expect(screen.getByRole("tabpanel")).toHaveTextContent("La agenda");
        expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", agenda.id);
    });
});

describe("TabbedSection when the tabs arrive after mounting", () => {
    /** The dashboard adds its tabs as the data lands: the bar mounts with fewer than it ends up with. */
    function Growing({ withMore }: { withMore: boolean }) {
        return (
            <TabbedSection label="Mi panel">
                <TabItem title="Mi agenda" tabKey="agenda">
                    <p>La agenda</p>
                </TabItem>
                <TabItem title="Mis grupos" tabKey="grupos">
                    <p>Los grupos</p>
                </TabItem>
                {withMore ? (
                    <TabItem title="Mi perfil" shortTitle="Perfil" tabKey="mi-perfil">
                        <p>El perfil</p>
                    </TabItem>
                ) : null}
            </TabbedSection>
        );
    }

    it("re-measures when a tab is added, without waiting for a resize or a scroll", () => {
        const { container, rerender } = render(<Growing withMore={false} />);
        const bar = screen.getByRole("tablist");
        expect(container.querySelector('[data-edge="end"]')).toBeNull();

        // Medida en el navegador real: la barra no cambia de tamaño, solo crece su contenido.
        measure(bar, { clientWidth: 390, scrollWidth: 520 });
        rerender(<Growing withMore />);

        expect(container.querySelector('[data-edge="end"]')).not.toBeNull();
    });
});
