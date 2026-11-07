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

        expect(await screen.findByText("Ningún grupo miró tu perfil todavía")).toBeInTheDocument();
        expect(screen.getByText(/Cuando un manager abra tu perfil/)).toBeInTheDocument();
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
    });

    it("stays quiet when the notice cannot be read: it is a courtesy, not the work", async () => {
        profileVisits.mockRejectedValue(new Error("boom"));
        const { container } = renderBlock();

        await vi.waitFor(() => expect(profileVisits).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });
});
