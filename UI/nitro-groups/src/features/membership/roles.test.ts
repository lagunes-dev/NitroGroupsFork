import { describe, expect, it } from "vitest";
import { canManage, normalizeRole, roleLabel, showMyGroupsEntry, showMyGroupsTab } from "./roles";
import type { MyMembership } from "./types";

const membership = (groupId: number, role: MyMembership["role"] = "Member") =>
    ({ groupId, groupName: `Group ${groupId}`, slug: `g-${groupId}`, profilePictureUrl: null, role, joinedAt: "2026-01-01T00:00:00Z" }) as MyMembership;

describe("normalizeRole", () => {
    it("accepts the enum names", () => {
        expect(normalizeRole("Owner")).toBe("Owner");
        expect(normalizeRole("Manager")).toBe("Manager");
        expect(normalizeRole("Member")).toBe("Member");
    });
    it("accepts the numeric backend values (Owner 0, Member 1, Manager 2)", () => {
        expect(normalizeRole(0)).toBe("Owner");
        expect(normalizeRole(1)).toBe("Member");
        expect(normalizeRole(2)).toBe("Manager");
    });
    it("maps anything unknown to null", () => {
        expect(normalizeRole("Admin")).toBeNull();
        expect(normalizeRole(7)).toBeNull();
        expect(normalizeRole(-1)).toBeNull();
        expect(normalizeRole(undefined)).toBeNull();
        expect(normalizeRole(null)).toBeNull();
    });
});

describe("roleLabel", () => {
    it("names each role in Spanish", () => {
        expect(roleLabel("Owner")).toBe("Dueño");
        expect(roleLabel("Manager")).toBe("Manager");
        expect(roleLabel("Member")).toBe("Miembro");
    });
    it("falls back to Miembro for an unknown role", () => {
        expect(roleLabel(null)).toBe("Miembro");
    });
});

describe("canManage", () => {
    it("is true only for Owner and Manager", () => {
        expect(canManage("Owner")).toBe(true);
        expect(canManage("Manager")).toBe(true);
        expect(canManage("Member")).toBe(false);
        expect(canManage(null)).toBe(false);
    });
});

describe("showMyGroupsTab", () => {
    it("hides while the memberships are loading, even with a managed group", () => {
        expect(showMyGroupsTab({ memberships: undefined, managedGroupId: 1 })).toBe(false);
        expect(showMyGroupsTab({ memberships: undefined, managedGroupId: null })).toBe(false);
    });
    it("hides without memberships", () => {
        expect(showMyGroupsTab({ memberships: [], managedGroupId: null })).toBe(false);
        expect(showMyGroupsTab({ memberships: [], managedGroupId: 1 })).toBe(false);
    });
    it("hides for a single membership that is the managed group", () => {
        expect(showMyGroupsTab({ memberships: [membership(1, "Owner")], managedGroupId: 1 })).toBe(false);
    });
    it("shows for a single membership in a group the user does not manage", () => {
        expect(showMyGroupsTab({ memberships: [membership(2)], managedGroupId: 1 })).toBe(true);
        expect(showMyGroupsTab({ memberships: [membership(2)], managedGroupId: null })).toBe(true);
    });
    it("shows for more than one membership", () => {
        expect(showMyGroupsTab({ memberships: [membership(1, "Owner"), membership(2)], managedGroupId: 1 })).toBe(true);
    });
});

describe("showMyGroupsEntry", () => {
    it("shows for a musician without a managed group who belongs to a group", () => {
        expect(showMyGroupsEntry({ hasGroup: false, memberships: 1 })).toBe(true);
    });
    it("hides without memberships", () => {
        expect(showMyGroupsEntry({ hasGroup: false, memberships: 0 })).toBe(false);
    });
    it("hides when Mi grupo already leads to the same panel", () => {
        expect(showMyGroupsEntry({ hasGroup: true, memberships: 3 })).toBe(false);
    });
    it("hides while the managed group is still loading", () => {
        expect(showMyGroupsEntry({ hasGroup: null, memberships: 1 })).toBe(false);
    });
});
