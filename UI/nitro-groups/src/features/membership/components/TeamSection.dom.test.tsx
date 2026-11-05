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

    it("marks the section busy while it loads", () => {
        team.mockReturnValue(new Promise(() => {}));
        renderSection();
        expect(screen.getByText("Cargando el equipo…")).toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent("Cargando el equipo…");
    });
});
