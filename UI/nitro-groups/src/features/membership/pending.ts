import type { MembershipDirection, MembershipRequest } from "./types";

/**
 * Musicians that already have a pending row with the group, with the direction of that row.
 * The API allows one pending row per (group, musician), so inviting them again would answer 409.
 */
export function pendingByMusician(requests: MembershipRequest[] | undefined): Map<number, MembershipDirection | null> {
    const map = new Map<number, MembershipDirection | null>();
    for (const request of requests ?? []) {
        if (request.status === "Pending") map.set(request.musicianUserId, request.direction);
    }
    return map;
}

/** Text for the disabled button of a musician who already has a pending row. */
export function pendingLabel(direction: MembershipDirection | null): string {
    if (direction === "Invitation") return "Invitación pendiente";
    if (direction === "Request") return "Pidió unirse";
    return "Pendiente";
}
