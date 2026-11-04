import { describe, expect, it } from "vitest";
import { pendingByMusician, pendingLabel } from "./pending";
import type { MembershipRequest } from "./types";

const row = (over: Partial<MembershipRequest>): MembershipRequest => ({
    id: 1, groupId: 9, groupName: "G", groupSlug: "g", musicianUserId: 7, musicianName: "Ana",
    initiatedByUserId: 1, direction: "Invitation", status: "Pending", message: null,
    resolvedByUserId: null, createdAt: "2026-11-04T00:00:00Z", updatedAt: null, counterpartName: "Ana", ...over,
});

describe("pendingByMusician", () => {
    it("maps each musician with a pending row to its direction", () => {
        const map = pendingByMusician([row({ musicianUserId: 7 }), row({ id: 2, musicianUserId: 8, direction: "Request" })]);
        expect(map.get(7)).toBe("Invitation");
        expect(map.get(8)).toBe("Request");
    });

    it("ignores rows that are already resolved", () => {
        const map = pendingByMusician([
            row({ id: 1, musicianUserId: 7, status: "Declined" }),
            row({ id: 2, musicianUserId: 8, status: "Accepted" }),
            row({ id: 3, musicianUserId: 9, status: "Cancelled" }),
        ]);
        expect(map.size).toBe(0);
    });

    it("ignores rows with an unknown status", () => {
        expect(pendingByMusician([row({ status: null })]).size).toBe(0);
    });

    it("returns an empty map for undefined input", () => {
        expect(pendingByMusician(undefined).size).toBe(0);
    });
});

describe("pendingLabel", () => {
    it("names the pending invitation", () => {
        expect(pendingLabel("Invitation")).toBe("Invitación pendiente");
    });

    it("names a musician's own request", () => {
        expect(pendingLabel("Request")).toBe("Pidió unirse");
    });

    it("falls back for an unknown direction", () => {
        expect(pendingLabel(null)).toBe("Pendiente");
    });
});
