import type { MembershipRequest } from "./types";

const stamp = (r: MembershipRequest) => Date.parse(r.updatedAt ?? r.createdAt) || 0;

/**
 * Splits the musician's own rows: pending invitations received, pending requests sent, and
 * everything resolved as history (newest first). An unknown status is history, never an action.
 */
export function splitMyRequests(rows: MembershipRequest[]) {
    const pending = rows.filter((r) => r.status === "Pending");
    return {
        received: pending.filter((r) => r.direction === "Invitation"),
        sent: pending.filter((r) => r.direction === "Request"),
        history: rows.filter((r) => r.status !== "Pending").sort((a, b) => stamp(b) - stamp(a)),
    };
}

/** The musician's side of the API transitions: answer invitations, withdraw own requests. */
export function musicianActions(row: Pick<MembershipRequest, "direction" | "status">) {
    const pending = row.status === "Pending";
    return {
        accept: pending && row.direction === "Invitation",
        decline: pending && row.direction === "Invitation",
        cancel: pending && row.direction === "Request",
    };
}

/**
 * The manager's side, in two lists: join requests received (they need an answer) and invitations
 * the group sent. Each has its pending rows and, apart, its resolved history (newest first).
 * A row with an unknown direction belongs to neither list.
 */
export function splitGroupRequests(rows: MembershipRequest[]) {
    const side = (direction: MembershipRequest["direction"]) => {
        const own = rows.filter((r) => r.direction === direction);
        return {
            pending: own.filter((r) => r.status === "Pending"),
            history: own.filter((r) => r.status !== "Pending").sort((a, b) => stamp(b) - stamp(a)),
        };
    };
    return { incoming: side("Request"), invitations: side("Invitation") };
}
