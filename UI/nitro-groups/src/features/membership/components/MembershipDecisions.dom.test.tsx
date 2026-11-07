// @vitest-environment jsdom
// Round 9 measured the accept/reject pair of the membership inboxes at 36 px, in the middle of the
// manager's and the musician's most consequential screen: a decision about who joins the group.
// The app holds 44 px for tap targets, and the same pair exists in both inboxes, so both are pinned
// here: fixing one and leaving its sibling is the defect the critics keep reporting.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MembershipRequestList } from "./MembershipRequestList";
import { MyInvitations } from "./MyInvitations";

const service = vi.hoisted(() => ({ forGroup: vi.fn(), mine: vi.fn() }));
vi.mock("../membership.service", () => ({ membershipService: { forGroup: service.forGroup, mine: service.mine } }));

/** Una solicitud pendiente, que es el estado donde se ve el par aceptar/rechazar. */
const pending = {
    id: 41,
    groupId: 3,
    groupName: "Versátil Rock y Pop",
    groupSlug: "versatil-rock-y-pop",
    musicianUserId: 77,
    musicianName: "Mateo Músico",
    initiatedByUserId: 77,
    direction: "Request",
    status: "Pending",
    message: "Toco guitarra.",
    resolvedByUserId: null,
    createdAt: "2026-11-01T18:00:00Z",
    updatedAt: null,
};

function renderWithClient(node: React.ReactNode) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe("membership decisions keep a thumb-sized target", () => {
    it("gives the group inbox's accept and reject 44 px", async () => {
        service.forGroup.mockResolvedValue([pending]);
        renderWithClient(<MembershipRequestList groupId={3} />);

        const accept = await screen.findByRole("button", { name: /^Aceptar solicitud de/ });
        const reject = screen.getByRole("button", { name: /^Rechazar solicitud de/ });

        expect(accept).toHaveClass("min-h-11");
        expect(reject).toHaveClass("min-h-11");
    });

    it("gives the musician's invitations the same 44 px", async () => {
        service.mine.mockResolvedValue([{ ...pending, direction: "Invitation", status: "Pending" }]);
        renderWithClient(<MyInvitations />);

        const accept = await screen.findByRole("button", { name: /^Aceptar invitación de/ });
        const reject = screen.getByRole("button", { name: /^Rechazar invitación de/ });

        expect(accept).toHaveClass("min-h-11");
        expect(reject).toHaveClass("min-h-11");
    });
});
