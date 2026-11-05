import { ROUTES } from "@/config/routes";

/** Enlaces públicos de la barra. Pocos y planos (DESIGN.md → Navigation). */
export const PUBLIC_LINKS = [
    { href: ROUTES.GROUPS.SEARCH, label: "Explorar grupos" },
    { href: ROUTES.AUTH.SIGNUP_MUSICIAN, label: "Publicar mi grupo" },
] as const;

export interface DashboardEntry {
    href: string;
    label: string;
    /** Pending items waiting for the user; the menu shows a badge when above zero. */
    count: number;
}

interface PendingState {
    /** Null while the user's group is still loading. */
    hasGroup: boolean | null;
    invitations: number;
    joinRequests: number;
}

/**
 * Menu entries that lead to the user's panel. A client has one (date orders). A musician with a
 * group has "Mi grupo" (join requests badge) and, only with invitations waiting, "Invitaciones";
 * without a group, "Invitaciones" replaces "Mi grupo" so the way in is not hidden.
 */
export function dashboardEntries(isMusician: boolean, pending: PendingState): DashboardEntry[] {
    if (!isMusician) return [{ href: ROUTES.DASHBOARD.CLIENT, label: "Mis pedidos", count: 0 }];
    const href = ROUTES.DASHBOARD.MUSICIAN;
    if (pending.hasGroup === false) return [{ href, label: "Invitaciones", count: pending.invitations }];
    const entries: DashboardEntry[] = [{ href, label: "Mi grupo", count: pending.joinRequests }];
    if (pending.hasGroup && pending.invitations > 0) entries.push({ href, label: "Invitaciones", count: pending.invitations });
    return entries;
}
