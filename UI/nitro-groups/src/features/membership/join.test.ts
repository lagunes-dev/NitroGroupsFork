import { describe, expect, it } from "vitest";
import { JOIN_MESSAGE_MAX, joinOffer, prepareJoinMessage, showJoinShortcut } from "./join";

const group = { active: true, ownerUserId: 1 };
const musician = { id: 5, userType: "Musician" as const };
const members = [
    { userId: 1, isActive: true },
    { userId: 8, isActive: true },
    { userId: 9, isActive: false },
];

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
