// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProfileVisits } from "./ProfileVisits";

const { profileVisits } = vi.hoisted(() => ({ profileVisits: vi.fn() }));
vi.mock("../membership.service", () => ({ membershipService: { profileVisits } }));

function renderBlock() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}><ProfileVisits /></QueryClientProvider>);
}

describe("ProfileVisits", () => {
    it("names the feature for a musician nobody looked at, instead of hiding it", async () => {
        profileVisits.mockResolvedValue({ count: 0, groups: [] });
        renderBlock();

        expect(await screen.findByText("Sin visitas")).toBeInTheDocument();
        expect(screen.getByText(/aquí verás qué grupo abre tu perfil/)).toBeInTheDocument();
    });

    it("keeps the empty notice to one compact line, still a labelled section (T54)", async () => {
        profileVisits.mockResolvedValue({ count: 0, groups: [] });
        const { container } = renderBlock();

        const heading = await screen.findByRole("heading", { name: "Sin visitas" });
        const section = screen.getByRole("region", { name: "Sin visitas" });
        // jsdom has no layout: assert the markup that makes it one line (no block paragraph, inline
        // heading, compact padding, no sm:p-5 growth) instead of a pixel height.
        expect(container.querySelector("p")).toBeNull();
        expect(heading.className).toContain("inline");
        expect(section.className).toContain("py-2.5");
        expect(section.className).not.toMatch(/\bp-4\b|sm:p-5/);
        expect(section).not.toHaveAttribute("aria-hidden");
        expect(section).toHaveTextContent("Sin visitas · aquí verás qué grupo abre tu perfil");
    });

    it("says how many groups looked and links each one to its public profile", async () => {
        profileVisits.mockResolvedValue({
            count: 2,
            groups: [
                { id: 7, groupName: "Los Vargas", slug: "los-vargas", lastVisitedAt: "2026-11-05T18:00:00Z" },
                { id: 3, groupName: "Mariachi Oro", slug: "mariachi-oro", lastVisitedAt: "2026-11-04T18:00:00Z" },
            ],
        });
        renderBlock();

        expect(await screen.findByText("2 grupos miraron tu perfil")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Los Vargas" })).toHaveAttribute("href", "/groups/los-vargas");
        expect(screen.getByRole("link", { name: "Mariachi Oro" })).toHaveAttribute("href", "/groups/mariachi-oro");
        // The populated state keeps its card shape.
        expect(screen.getByRole("region", { name: "2 grupos miraron tu perfil" }).className).toContain("p-4");
    });

    it("stays quiet when the notice cannot be read: it is a courtesy, not the work", async () => {
        profileVisits.mockRejectedValue(new Error("boom"));
        const { container } = renderBlock();

        await vi.waitFor(() => expect(profileVisits).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });
});
