// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InviteToMyGroup } from "./InviteToMyGroup";

const mocks = vi.hoisted(() => ({
    invite: vi.fn(),
    forGroup: vi.fn(),
    groupMembers: vi.fn(),
    user: vi.fn(),
    pending: vi.fn(),
}));
vi.mock("../membership.service", () => ({
    membershipService: { invite: mocks.invite, forGroup: mocks.forGroup, groupMembers: mocks.groupMembers },
}));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: mocks.user }));
vi.mock("@/hooks/usePendingMembership", () => ({ usePendingMembership: mocks.pending }));

const manager = { user: { id: 1, userType: "Musician" }, isLoading: false };

function renderButton(props: Partial<React.ComponentProps<typeof InviteToMyGroup>> = {}) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <InviteToMyGroup musicianUserId={7} musicianName="Mateo Músico" isOpenToJoin {...props} />
        </QueryClientProvider>,
    );
}

beforeEach(() => {
    vi.resetAllMocks();
    mocks.user.mockReturnValue(manager);
    mocks.pending.mockReturnValue({ groupId: 3, hasGroup: true });
    mocks.forGroup.mockResolvedValue([]);
    mocks.groupMembers.mockResolvedValue([]);
});

describe("InviteToMyGroup", () => {
    it("invites through the membership service and confirms", async () => {
        mocks.invite.mockResolvedValue({});
        renderButton();
        await userEvent.click(await screen.findByRole("button", { name: "Invitar a Mateo Músico a mi grupo" }));
        expect(mocks.invite).toHaveBeenCalledWith(3, 7);
        expect(await screen.findByText("Invitación enviada a Mateo Músico.")).toBeInTheDocument();
    });

    it("shows the mapped error and keeps the button when the API answers 409", async () => {
        mocks.invite.mockRejectedValue({ response: { status: 409, data: { error: "Ya hay una invitación pendiente." } } });
        renderButton();
        await userEvent.click(await screen.findByRole("button", { name: /Invitar a Mateo/ }));
        expect(await screen.findByRole("alert")).toHaveTextContent("Ya hay una invitación pendiente.");
        expect(screen.getByRole("button", { name: /Invitar a Mateo/ })).toBeEnabled();
    });

    it("renders nothing for an anonymous visitor", () => {
        mocks.user.mockReturnValue({ user: null, isLoading: false });
        mocks.pending.mockReturnValue({ groupId: null, hasGroup: null });
        const { container } = renderButton();
        expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing for a client", () => {
        mocks.user.mockReturnValue({ user: { id: 2, userType: "Client" }, isLoading: false });
        mocks.pending.mockReturnValue({ groupId: null, hasGroup: null });
        const { container } = renderButton();
        expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing for a plain member without a managed group", () => {
        mocks.pending.mockReturnValue({ groupId: null, hasGroup: false });
        const { container } = renderButton();
        expect(container).toBeEmptyDOMElement();
    });

    it("says the musician is already in the group instead of offering a button", async () => {
        mocks.groupMembers.mockResolvedValue([{ userId: 7, isActive: true }]);
        renderButton();
        expect(await screen.findByText("Ya está en tu grupo")).toBeInTheDocument();
        expect(screen.queryByRole("button")).toBeNull();
    });

    it("renders nothing for a musician who is not open to join", async () => {
        const { container } = renderButton({ isOpenToJoin: false });
        await vi.waitFor(() => expect(mocks.groupMembers).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });
});
