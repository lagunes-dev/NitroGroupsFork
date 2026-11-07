import { describe, expect, it } from "vitest";
import { inviteOffer } from "./invite";

const manager = { id: 1, userType: "Musician" as const };
const open = { userId: 7, isOpenToJoin: true };
const base = { viewer: manager, managedGroupId: 3, musician: open, memberIds: [] as number[] | null, pending: new Map(), loading: false };

describe("inviteOffer", () => {
    it("offers the invitation to a manager for an open musician who is neither a member nor pending", () => {
        expect(inviteOffer(base)).toEqual({ kind: "invite" });
    });

    it("never shows anything to an anonymous visitor", () => {
        expect(inviteOffer({ ...base, viewer: null })).toEqual({ kind: "hidden" });
    });

    it("never shows anything to a client", () => {
        expect(inviteOffer({ ...base, viewer: { id: 2, userType: "Client" } })).toEqual({ kind: "hidden" });
    });

    it("never shows anything to a musician without a managed group (a plain member)", () => {
        expect(inviteOffer({ ...base, managedGroupId: null })).toEqual({ kind: "hidden" });
    });

    it("waits while anything is still loading", () => {
        expect(inviteOffer({ ...base, loading: true })).toEqual({ kind: "hidden" });
    });

    it("hides the invitation for a musician who is not open to join", () => {
        expect(inviteOffer({ ...base, musician: { userId: 7, isOpenToJoin: false } })).toEqual({ kind: "hidden" });
    });

    it("says so instead of offering a button when the musician already is a member", () => {
        expect(inviteOffer({ ...base, memberIds: [7] })).toEqual({ kind: "member" });
        expect(inviteOffer({ ...base, memberIds: [7], musician: { userId: 7, isOpenToJoin: false } })).toEqual({ kind: "member" });
    });

    it("says so when an invitation or a join request is already pending", () => {
        expect(inviteOffer({ ...base, pending: new Map([[7, "Invitation"]]) })).toEqual({ kind: "pending", label: "Invitación pendiente" });
        expect(inviteOffer({ ...base, pending: new Map([[7, "Request"]]) })).toEqual({ kind: "pending", label: "Pidió unirse" });
    });

    it("does not invite the viewer to their own group", () => {
        expect(inviteOffer({ ...base, musician: { userId: 1, isOpenToJoin: true } })).toEqual({ kind: "hidden" });
    });

    it("still offers the button when the member list could not be read (the API answers 409)", () => {
        expect(inviteOffer({ ...base, memberIds: null })).toEqual({ kind: "invite" });
    });
});
