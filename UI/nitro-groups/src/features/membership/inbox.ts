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
