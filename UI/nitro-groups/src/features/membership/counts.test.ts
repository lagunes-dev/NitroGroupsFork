import { describe, expect, it } from "vitest";
import { joinBannerText, pendingCount, pendingTabLabel } from "./counts";
import type { MembershipRequest } from "./types";

const row = (direction: MembershipRequest["direction"], status: MembershipRequest["status"]) =>
    ({ direction, status }) as MembershipRequest;

describe("pendingCount", () => {
    const rows = [
        row("Invitation", "Pending"),
        row("Invitation", "Pending"),
        row("Request", "Pending"),
        row("Invitation", "Accepted"),
        row("Request", "Declined"),
        row("Invitation", null),
        row(null, "Pending"),
    ];
    it("counts only pending rows of the given direction", () => {
        expect(pendingCount(rows, "Invitation")).toBe(2);
        expect(pendingCount(rows, "Request")).toBe(1);
    });
    it("is zero without data", () => {
        expect(pendingCount(undefined, "Invitation")).toBe(0);
        expect(pendingCount([], "Request")).toBe(0);
    });
});

describe("pendingTabLabel", () => {
    it("names the tab with its pending count", () => {
        expect(pendingTabLabel("Equipo", 2)).toBe("Equipo, 2 pendientes");
    });
    it("uses the singular for one", () => {
        expect(pendingTabLabel("Invitaciones", 1)).toBe("Invitaciones, 1 pendiente");
    });
    it("is just the title at zero", () => {
        expect(pendingTabLabel("Equipo", 0)).toBe("Equipo");
    });
});

describe("joinBannerText", () => {
    it("singular for one musician", () => {
        expect(joinBannerText(1)).toBe("1 músico quiere unirse a tu grupo");
    });
    it("plural for more", () => {
        expect(joinBannerText(2)).toBe("2 músicos quieren unirse a tu grupo");
    });
    it("nothing at zero", () => {
        expect(joinBannerText(0)).toBeNull();
    });
});
