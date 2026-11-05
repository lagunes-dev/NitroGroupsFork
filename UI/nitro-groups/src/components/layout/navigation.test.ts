import { describe, expect, it } from "vitest";
import { dashboardEntries, directoryEntry } from "./navigation";

const none = { hasGroup: true as boolean | null, invitations: 0, joinRequests: 0, memberships: 0 };

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
        const entries = dashboardEntries(true, { ...none, hasGroup: false });
        expect(entries.map((e) => [e.label, e.count])).toEqual([["Invitaciones", 0]]);
    });
    it("keeps Mi grupo while the group is still loading", () => {
        const entries = dashboardEntries(true, { ...none, hasGroup: null, invitations: 3 });
        expect(entries.map((e) => e.label)).toEqual(["Mi grupo"]);
    });
    it("adds Mi panel for a musician who belongs to a group but manages none", () => {
        const entries = dashboardEntries(true, { hasGroup: false, invitations: 2, joinRequests: 0, memberships: 1 });
        expect(entries).toEqual([
            { href: "/dashboard/musician", label: "Mi panel", count: 0 },
            { href: "/dashboard/musician", label: "Invitaciones", count: 2 },
        ]);
    });
    it("does not add a second entry next to Mi grupo", () => {
        const entries = dashboardEntries(true, { ...none, memberships: 2 });
        expect(entries.map((e) => e.label)).toEqual(["Mi grupo"]);
    });
    it("does not add Mi panel for a client", () => {
        expect(dashboardEntries(false, { ...none, hasGroup: false, memberships: 1 }).map((e) => e.label)).toEqual(["Mis pedidos"]);
    });
});

describe("directoryEntry", () => {
    it("offers Músicos to a manager of a group", () => {
        expect(directoryEntry(true)).toEqual({ href: "/musicians", label: "Músicos" });
    });
    it("offers nothing without a group, while it loads, or to a client", () => {
        expect(directoryEntry(false)).toBeNull();
        expect(directoryEntry(null)).toBeNull();
    });
    it("does not change the dashboard entries", () => {
        expect(dashboardEntries(true, none).map((e) => e.label)).toEqual(["Mi grupo"]);
    });
});
