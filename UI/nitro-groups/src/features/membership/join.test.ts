import { describe, expect, it } from "vitest";
import { isActiveMemberOf, JOIN_MESSAGE_MAX, joinOffer, prepareJoinMessage, showJoinShortcut } from "./join";
import type { MyMembership } from "./types";

const group = { active: true, ownerUserId: 1 };
const groupWithId = { ...group, groupId: 4, slug: "mariachi-vargas" };
const musician = { id: 5, userType: "Musician" as const };
const members = [
    { userId: 1, isActive: true },
    { userId: 8, isActive: true },
    { userId: 9, isActive: false },
];

const membership = (over: Partial<MyMembership> = {}): MyMembership => ({
    groupId: 4,
    groupName: "Mariachi Vargas",
    slug: "mariachi-vargas",
    profilePictureUrl: null,
    role: "Member",
    joinedAt: "2026-01-05T12:00:00Z",
    ...over,
});

describe("isActiveMemberOf", () => {
    it("finds the viewer's group by its id", () => {
        expect(isActiveMemberOf([membership()], 4)).toBe(true);
        expect(isActiveMemberOf([membership({ groupId: 7 })], 4)).toBe(false);
    });
    it("finds it by slug, ignoring case and surrounding spaces", () => {
        expect(isActiveMemberOf([membership()], "mariachi-vargas")).toBe(true);
        expect(isActiveMemberOf([membership()], "  Mariachi-Vargas ")).toBe(true);
        expect(isActiveMemberOf([membership()], "otro-grupo")).toBe(false);
        expect(isActiveMemberOf([membership()], "")).toBe(false);
    });
    it("counts every role, including the owner and the manager", () => {
        expect(isActiveMemberOf([membership({ role: "Owner" })], "mariachi-vargas")).toBe(true);
        expect(isActiveMemberOf([membership({ role: "Manager" })], 4)).toBe(true);
        expect(isActiveMemberOf([membership({ role: null })], 4)).toBe(true); // an unknown role is still a member
    });
    it("an empty, unreadable or still-loading list is never a membership", () => {
        expect(isActiveMemberOf([], 4)).toBe(false);
        expect(isActiveMemberOf(null, 4)).toBe(false);
        expect(isActiveMemberOf(null, "mariachi-vargas")).toBe(false);
        expect(isActiveMemberOf(undefined, 4)).toBe(false);
        expect(isActiveMemberOf(undefined, "mariachi-vargas")).toBe(false);
    });
    it("without a group reference there is nothing to match", () => {
        expect(isActiveMemberOf([membership()], null)).toBe(false);
        expect(isActiveMemberOf([membership()], undefined)).toBe(false);
    });
    it("only the viewer's own groups count", () => {
        expect(isActiveMemberOf([membership({ groupId: 4 }), membership({ groupId: 9, slug: "sonora-la-luna" })], 9)).toBe(true);
        expect(isActiveMemberOf([membership({ groupId: 4 })], 9)).toBe(false);
    });
});

describe("joinOffer", () => {
    it("anonymous visitors get the login link, not the form", () => {
        expect(joinOffer({ signedIn: false, user: null, group, members })).toBe("login");
    });
    it("a signed-in account whose record is still loading shows nothing yet", () => {
        expect(joinOffer({ signedIn: true, user: null, group, members })).toBe("hidden");
    });
    it("clients never see it", () => {
        expect(joinOffer({ signedIn: true, user: { id: 5, userType: "Client" }, group, members })).toBe("hidden");
    });
    it("a musician who is not a member gets the form", () => {
        expect(joinOffer({ signedIn: true, user: musician, group, members })).toBe("form");
    });
    it("an active member does not", () => {
        expect(joinOffer({ signedIn: true, user: { ...musician, id: 8 }, group, members })).toBe("hidden");
    });
    it("the owner does not, even if the members list is missing", () => {
        expect(joinOffer({ signedIn: true, user: { ...musician, id: 1 }, group, members: null })).toBe("hidden");
    });
    it("someone who left (inactive row) may ask again", () => {
        expect(joinOffer({ signedIn: true, user: { ...musician, id: 9 }, group, members })).toBe("form");
    });
    it("an unknown members list still shows the form and leaves the 409 to the API", () => {
        expect(joinOffer({ signedIn: true, user: musician, group, members: null })).toBe("form");
    });
    it("an inactive group offers nothing, to anyone", () => {
        const inactive = { ...group, active: false };
        expect(joinOffer({ signedIn: true, user: musician, group: inactive, members })).toBe("hidden");
        expect(joinOffer({ signedIn: false, user: null, group: inactive, members })).toBe("hidden");
    });
    it("a member of the group does not get the form, even without the members list", () => {
        const memberships = [membership({ groupId: 4, slug: "mariachi-vargas" })];
        expect(joinOffer({ signedIn: true, user: musician, group: groupWithId, members: null, memberships })).toBe("hidden");
        expect(joinOffer({ signedIn: true, user: musician, group: groupWithId, members: null, memberships: [membership({ groupId: 99, slug: "sonora-la-luna" })] })).toBe("form");
    });
    it("while the viewer's memberships load we wait instead of offering the form", () => {
        expect(joinOffer({ signedIn: true, user: musician, group: groupWithId, members, membershipsPending: true })).toBe("hidden");
    });
    it("an unreadable memberships list falls back to the group members list", () => {
        expect(joinOffer({ signedIn: true, user: musician, group: groupWithId, members, memberships: null })).toBe("form");
        expect(joinOffer({ signedIn: true, user: { ...musician, id: 8 }, group: groupWithId, members, memberships: null })).toBe("hidden");
    });
    it("anonymous visitors still get the login link and clients still get nothing", () => {
        expect(joinOffer({ signedIn: false, user: null, group: groupWithId, members, memberships: [], membershipsPending: true })).toBe("login");
        expect(joinOffer({ signedIn: true, user: { id: 5, userType: "Client" }, group: groupWithId, members, memberships: [] })).toBe("hidden");
    });
});

describe("showJoinShortcut", () => {
    it("shows the header button only with the form, once the members list settled", () => {
        expect(showJoinShortcut("form", false)).toBe(true);
        expect(showJoinShortcut("form", true)).toBe(false);
    });
    it("never for anonymous visitors or hidden offers", () => {
        expect(showJoinShortcut("login", false)).toBe(false);
        expect(showJoinShortcut("hidden", false)).toBe(false);
    });
});

describe("prepareJoinMessage", () => {
    it("omits an empty or blank message", () => {
        expect(prepareJoinMessage("")).toEqual({ ok: true, message: undefined });
        expect(prepareJoinMessage("   \n ")).toEqual({ ok: true, message: undefined });
    });
    it("trims a real message", () => {
        expect(prepareJoinMessage("  Toco la batería  ")).toEqual({ ok: true, message: "Toco la batería" });
    });
    it("accepts exactly 2000 characters and rejects 2001", () => {
        expect(JOIN_MESSAGE_MAX).toBe(2000);
        expect(prepareJoinMessage("a".repeat(2000)).ok).toBe(true);
        const tooLong = prepareJoinMessage("a".repeat(2001));
        expect(tooLong).toEqual({ ok: false, error: "El mensaje admite hasta 2000 caracteres." });
    });
    it("counts the trimmed text, not the padding", () => {
        expect(prepareJoinMessage(` ${"a".repeat(2000)} `).ok).toBe(true);
    });
});
