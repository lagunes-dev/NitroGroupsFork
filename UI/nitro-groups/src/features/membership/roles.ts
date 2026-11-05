import type { MembershipRole, MyMembership } from "./types";

const ROLES: MembershipRole[] = ["Owner", "Member", "Manager"]; // = backend enum values 0..2

/** The API sends the enum name; the integer is accepted too in case the serialization changes. */
export function normalizeRole(value: unknown): MembershipRole | null {
    if (typeof value === "number") return ROLES[value] ?? null;
    return ROLES.find((r) => r === value) ?? null;
}

export function roleLabel(role: MembershipRole | null): string {
    switch (role) {
        case "Owner":
            return "Dueño";
        case "Manager":
            return "Manager";
        default:
            return "Miembro";
    }
}

/** Only the Owner and Managers get the management tools; a plain Member does not. */
export function canManage(role: MembershipRole | null): boolean {
    return role === "Owner" || role === "Manager";
}

/**
 * "Mis grupos" tab: shown when the user belongs to a group they do not manage, or to more than
 * one. A single membership that is the managed group keeps the dashboard as it was. Hidden while
 * the memberships load, so the tab never flashes in and out.
 */
export function showMyGroupsTab({ memberships, managedGroupId }: { memberships: MyMembership[] | undefined; managedGroupId: number | null }): boolean {
    if (!memberships || memberships.length === 0) return false;
    return memberships.length > 1 || memberships[0].groupId !== managedGroupId;
}

/**
 * "Mis grupos" menu entry: only for a musician with no managed group who still belongs to one.
 * With a managed group, "Mi grupo" already leads to the same panel, so no second entry.
 */
export function showMyGroupsEntry({ hasGroup, memberships }: { hasGroup: boolean | null; memberships: number }): boolean {
    return hasGroup === false && memberships > 0;
}
