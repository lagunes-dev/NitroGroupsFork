// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { RecordProfileVisit } from "./RecordProfileVisit";

const { recordProfileVisit } = vi.hoisted(() => ({ recordProfileVisit: vi.fn() }));
vi.mock("../membership.service", () => ({ membershipService: { recordProfileVisit } }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ user: { id: 10, userType: "Musician" } }) }));
vi.mock("@/hooks/usePendingMembership", () => ({ usePendingMembership: () => ({ groupId: 3 }) }));

describe("RecordProfileVisit", () => {
    it("leaves one visit per visit, even when the page renders again", async () => {
        recordProfileVisit.mockResolvedValue(undefined);
        const { rerender } = render(<RecordProfileVisit musicianUserId={20} />);

        await vi.waitFor(() => expect(recordProfileVisit).toHaveBeenCalledWith(3, 20));
        rerender(<RecordProfileVisit musicianUserId={20} />);
        rerender(<RecordProfileVisit musicianUserId={20} />);

        expect(recordProfileVisit).toHaveBeenCalledTimes(1);
    });

    it("never breaks the page when the notice cannot be sent", async () => {
        recordProfileVisit.mockRejectedValue(new Error("boom"));
        const { container } = render(<RecordProfileVisit musicianUserId={20} />);

        await vi.waitFor(() => expect(recordProfileVisit).toHaveBeenCalled());
        // Nothing rendered, no error thrown up to the profile.
        expect(container).toBeEmptyDOMElement();
    });
});
