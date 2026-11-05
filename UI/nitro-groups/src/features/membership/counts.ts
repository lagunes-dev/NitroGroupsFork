import type { MembershipDirection, MembershipRequest } from "./types";

/** Pending rows of one direction; resolved rows and unknown values never count. */
export function pendingCount(rows: Pick<MembershipRequest, "direction" | "status">[] | undefined, direction: MembershipDirection): number {
    return (rows ?? []).filter((r) => r.status === "Pending" && r.direction === direction).length;
}

/** Accessible name of a tab or menu entry with a count: "Equipo, 2 pendientes"; just the title at zero. */
export function pendingTabLabel(title: string, count: number): string {
    if (count <= 0) return title;
    return `${title}, ${count} ${count === 1 ? "pendiente" : "pendientes"}`;
}

/** Banner for a manager with join requests waiting; null when there are none. */
export function joinBannerText(count: number): string | null {
    if (count <= 0) return null;
    return count === 1 ? "1 músico quiere unirse a tu grupo" : `${count} músicos quieren unirse a tu grupo`;
}

/** Visible tab title with its pending count: "Equipo (2)"; the bare title at zero. */
export function tabTitle(title: string, count: number): string {
    return count > 0 ? `${title} (${count})` : title;
}
