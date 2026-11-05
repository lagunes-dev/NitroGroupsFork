// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TeamSection } from "./TeamSection";

const { team } = vi.hoisted(() => ({ team: vi.fn() }));
vi.mock("../membership.service", () => ({ membershipService: { team } }));

const rows = [
    { userId: 10, fullName: " Olga Ortiz ", role: "Owner", profilePictureUrl: null, joinedAt: "2026-10-04T18:00:00Z" },
    { userId: 11, fullName: "Iván Ruiz", role: "Member", profilePictureUrl: null, joinedAt: "2026-11-06T18:00:00Z" },
];

function renderSection() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}><TeamSection groupId={3} /></QueryClientProvider>);
}

describe("TeamSection", () => {
    it("lists the real team with the role and the profile link", async () => {
        team.mockResolvedValue(rows);
        renderSection();

        const list = await screen.findByRole("list", { name: "2 músicos en el equipo" });
        expect(team).toHaveBeenCalledWith(3);
        expect(screen.getByRole("heading", { name: "El equipo (2)" })).toBeInTheDocument();
        const [first, second] = within(list).getAllByRole("listitem");
        expect(within(first).getByRole("link", { name: "Ver el perfil de Olga Ortiz" })).toHaveAttribute("href", "/musicians/10");
        expect(within(first).getByText("Rol: Dueño")).toBeInTheDocument();
        expect(within(first).getByText("Se unió el domingo, 4 de octubre de 2026")).toBeInTheDocument();
        expect(within(second).getByText("Rol: Miembro")).toBeInTheDocument();
    });

    it("says what each member plays and where he lives, and stays quiet when he has not loaded it", async () => {
        team.mockResolvedValue([
            { ...rows[0], instruments: "Bajo", city: "Guadalajara, Jalisco" },
            rows[1],
        ]);
        renderSection();

        const list = await screen.findByRole("list", { name: "2 músicos en el equipo" });
        const [first, second] = within(list).getAllByRole("listitem");
        expect(within(first).getByText("Bajo · Guadalajara, Jalisco")).toBeInTheDocument();
        expect(within(second).queryByText(/·/)).toBeNull();
    });

    it("offers the invite search when the team is empty", async () => {
        team.mockResolvedValue([]);
        renderSection();

        expect(await screen.findByText("Todavía no hay músicos en el equipo.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Buscar músicos para invitar" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "El equipo (0)" })).toBeInTheDocument();
    });

    it("explains the failure and retries", async () => {
        team.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(rows);
        renderSection();

        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent("No pudimos cargar el equipo.");
        await userEvent.click(within(alert).getByRole("button", { name: "Reintentar" }));
        expect(await screen.findByRole("list", { name: "2 músicos en el equipo" })).toBeInTheDocument();
    });

    it("uses the compact row so five members fit in a 390 px screen", async () => {
        team.mockResolvedValue([
            rows[0],
            { ...rows[1], instruments: "Bajo", city: "Guadalajara, Jalisco" },
            { ...rows[1], userId: 12, fullName: "María Vega", instruments: "Violín", city: "Puebla" },
            { ...rows[1], userId: 13, fullName: "Luis Lara", instruments: "Teclados", city: "Monterrey" },
            { ...rows[1], userId: 14, fullName: "Mateo Ruiz", instruments: "Guitarra", city: "Zapopan" },
        ]);
        renderSection();

        const list = await screen.findByRole("list", { name: "5 músicos en el equipo" });
        const members = within(list).getAllByRole("listitem");
        expect(members).toHaveLength(5);
        for (const member of members) {
            // El renglón compacto del perfil público, ahora donde el manager administra: 10 px arriba
            // y abajo (12 a partir de sm), y 2 px entre las líneas del bloque.
            expect(member).toHaveClass("py-2.5", "sm:py-3");
            expect(member).not.toHaveClass("p-4");
            expect(member.querySelector("div")).toHaveClass("gap-0.5");
            // Un avatar de 40 px, no de 48: el alto de la fila lo manda el texto, no la foto.
            expect(member.querySelector("span[aria-hidden]")).toHaveClass("size-10");
        }
    });

    it("keeps the craft on one line and the join date beside the role", async () => {
        team.mockResolvedValue([
            { ...rows[0], instruments: "Guitarra eléctrica, acordeón y coros", city: "San Pedro Tlaquepaque, Jalisco" },
        ]);
        renderSection();

        const list = await screen.findByRole("list", { name: "1 músico en el equipo" });
        const member = within(list).getByRole("listitem");
        const craft = within(member).getByText("Guitarra eléctrica, acordeón y coros · San Pedro Tlaquepaque, Jalisco");
        expect(craft).toHaveClass("truncate");
        expect(craft).toHaveAttribute("title", "Guitarra eléctrica, acordeón y coros · San Pedro Tlaquepaque, Jalisco");
        // La fecha y el rol comparten renglón: una línea menos por miembro.
        expect(within(member).getByText(/Se unió el/).closest("p")).toBe(within(member).getByText("Rol: Dueño").closest("p"));
    });

    it("marks the section busy while it loads", () => {
        team.mockReturnValue(new Promise(() => {}));
        renderSection();
        expect(screen.getByText("Cargando el equipo…")).toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent("Cargando el equipo…");
    });
});
