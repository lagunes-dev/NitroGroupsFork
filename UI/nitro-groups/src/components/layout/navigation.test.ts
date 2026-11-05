import { describe, expect, it } from "vitest";
import { dashboardEntries } from "./navigation";

const none = { hasGroup: true as boolean | null, invitations: 0, joinRequests: 0 };

describe("dashboardEntries", () => {
    it("gives a client one entry named after date orders", () => {
        expect(dashboardEntries(false, none)).toEqual([{ href: "/dashboard/client", label: "Mis pedidos", count: 0 }]);
    });
    it("shows a manager's join requests on Mi grupo", () => {
        const entries = dashboardEntries(true, { ...none, joinRequests: 2 });
        expect(entries).toEqual([{ href: "/dashboard/musician", label: "Mi grupo", count: 2 }]);
    });
    it("adds Invitaciones next to Mi grupo only with pending invitations", () => {
        const entries = dashboardEntries(true, { ...none, invitations: 1 });
        expect(entries.map((e) => [e.label, e.count])).toEqual([["Mi grupo", 0], ["Invitaciones", 1]]);
    });
    it("offers Invitaciones, not Mi grupo, to a musician without a group", () => {
        const entries = dashboardEntries(true, { hasGroup: false, invitations: 0, joinRequests: 0 });
        expect(entries.map((e) => [e.label, e.count])).toEqual([["Invitaciones", 0]]);
    });
    it("keeps Mi grupo while the group is still loading", () => {
        const entries = dashboardEntries(true, { hasGroup: null, invitations: 3, joinRequests: 0 });
        expect(entries.map((e) => e.label)).toEqual(["Mi grupo"]);
    });
});
