import type { MembershipDirection, MembershipRequest } from "./types";

/** Pending rows of one direction; resolved rows and unknown values never count. */
export function pendingCount(rows: Pick<MembershipRequest, "direction" | "status">[] | undefined, direction: MembershipDirection): number {
    return (rows ?? []).filter((r) => r.status === "Pending" && r.direction === direction).length;
}

export { tabCountLabel as pendingTabLabel } from "@/lib/tabCount";

/** Banner for a manager with join requests waiting; null when there are none. */
export function joinBannerText(count: number): string | null {
    if (count <= 0) return null;
    return count === 1 ? "1 músico quiere unirse a tu grupo" : `${count} músicos quieren unirse a tu grupo`;
}
