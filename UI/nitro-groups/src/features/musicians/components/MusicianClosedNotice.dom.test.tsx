// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MusicianClosedNotice } from "./MusicianClosedNotice";

const { useCurrentUser } = vi.hoisted(() => ({ useCurrentUser: vi.fn() }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser }));

describe("MusicianClosedNotice", () => {
    it("talks to a stranger about a third person", () => {
        useCurrentUser.mockReturnValue({ user: { id: 99 } });
        render(<MusicianClosedNotice name="María Hernández" musicianUserId={6} />);

        expect(screen.getByText(/Por ahora María Hernández no está recibiendo invitaciones de grupos/)).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /Cambiar mi disponibilidad/ })).toBeNull();
    });

    it("talks to the owner in the second person and offers the way out", () => {
        useCurrentUser.mockReturnValue({ user: { id: 6 } });
        render(<MusicianClosedNotice name="María Hernández" musicianUserId={6} />);

        expect(screen.getByText(/No estás recibiendo invitaciones de grupos/)).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Cambiar mi disponibilidad/ })).toHaveAttribute("href", "/dashboard/musician");
    });
});
