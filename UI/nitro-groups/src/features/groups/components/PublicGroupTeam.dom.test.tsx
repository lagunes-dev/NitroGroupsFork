// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { PublicGroupTeam } from "./PublicGroupTeam";
import { PUBLIC_TEAM_EMPTY, PUBLIC_TEAM_HEADING } from "../lib/publicTeam";
import type { PublicGroupTeamMember } from "../types/PublicGroupTeamMember";

const rows: PublicGroupTeamMember[] = [
    { userId: 10, fullName: "Olga Ortiz", role: "Owner", instruments: "Guitarra", city: "Guadalajara, Jalisco" },
    { userId: 11, fullName: "Mateo Ruiz", role: "Member", instruments: "Bajo", city: null },
    { userId: 12, fullName: "Nadia Nava", role: "Member", instruments: null, city: null },
];

describe("PublicGroupTeam", () => {
    it("lists the team with the name, the role and what each one plays and where he lives", () => {
        render(<PublicGroupTeam members={rows} />);

        expect(screen.getByRole("heading", { name: PUBLIC_TEAM_HEADING })).toBeInTheDocument();

        const list = screen.getByRole("list", { name: "3 músicos en el equipo" });
        const [first, second] = within(list).getAllByRole("listitem");
        expect(within(first).getByRole("link", { name: "Olga Ortiz" })).toHaveAttribute("href", "/musicians/10");
        expect(within(first).getByText("Dueño")).toBeInTheDocument();
        expect(within(first).getByText("Guitarra · Guadalajara, Jalisco")).toBeInTheDocument();
        expect(within(second).getByText("Bajo")).toBeInTheDocument();
        expect(within(second).getByText("Miembro")).toBeInTheDocument();
    });

    it("shows the name and the role of a member whose profile is closed, without inventing a craft line", () => {
        render(<PublicGroupTeam members={[rows[2]]} />);

        const list = screen.getByRole("list", { name: "1 músico en el equipo" });
        const row = within(list).getByRole("listitem");
        expect(within(row).getByText("Nadia Nava")).toBeInTheDocument();
        expect(within(row).getByText("Miembro")).toBeInTheDocument();
        expect(within(row).queryByText(/·/)).toBeNull();
    });

    it("explains an empty team in one line instead of leaving a naked heading", () => {
        render(<PublicGroupTeam members={[]} />);

        expect(screen.getByRole("heading", { name: PUBLIC_TEAM_HEADING })).toBeInTheDocument();
        expect(screen.getByText(PUBLIC_TEAM_EMPTY)).toBeInTheDocument();
        expect(screen.queryByRole("list")).toBeNull();
    });
});
