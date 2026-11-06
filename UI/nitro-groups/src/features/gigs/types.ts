import type { DepositPayload } from "@/features/bookings/deposit";

/** The two answers `POST api/gigs/{id}/attendance` accepts. */
export type GigAnswer = "Confirmed" | "Declined";

/**
 * One row of `GET api/me/gigs` and of `GET api/groups/{groupId}/gigs`, as the API sends it.
 * Every field is optional on purpose: the mappers run over what an older or a partial response
 * carries, and a missing field must never break the list.
 */
export interface GigPayload {
    id?: number | string | null;
    groupId?: number | string | null;
    groupName?: string | null;
    groupSlug?: string | null;
    /** `YYYY-MM-DD`. */
    eventDate?: string | null;
    /** `HH:mm:ss`. */
    startTime?: string | null;
    durationHours?: number | string | null;
    eventType?: string | null;
    locationText?: string | null;
    /** The caller's role in that group. */
    role?: string | null;
    /** `"Confirmed"`, `"Declined"` or `null` when the caller has not answered. */
    attendance?: string | null;
    /** `HH:mm:ss`: when the musicians must be at the venue. */
    callTime?: string | null;
    /** Free text with line breaks. */
    setlist?: string | null;
    /** What the caller is paid for this gig. Only ever the caller's own amount; informational. */
    myPay?: number | string | null;
    /** ISO timestamp the manager recorded when the caller was paid; null until then. */
    myPayPaidAt?: string | null;
    /**
     * The group manager's phone (S22). Only the musician's own agenda carries it, and only for an
     * active member; null when the group has no phone loaded.
     */
    managerPhone?: string | null;
    /** Who plays this gig: the members who confirmed (S22). Empty when nobody confirmed yet. */
    teammates?: TeammatePayload[] | null;
}

/** A member and their answer, as the manager view lists them. Never carries an email. */
export interface AttendeePayload {
    userId?: number | string | null;
    fullName?: string | null;
    status?: string | null;
    /** What this member is paid for the gig. Manager view only; informational. */
    pay?: number | string | null;
    /** ISO timestamp the manager recorded when this member was paid; null until then. */
    paidAt?: string | null;
}

/**
 * One person who plays the gig, as `GET api/me/gigs` sends it (S22). Only confirmed members are
 * listed, and the name comes from the API: never an email. The role is the one inside the group,
 * which is what tells the musician who is leading it.
 */
export interface TeammatePayload {
    userId?: number | string | null;
    fullName?: string | null;
    /** "Owner" | "Manager" | "Member"; the card labels it in Spanish. Null when it did not arrive. */
    role?: string | number | null;
}

/** Manager row: the same gig plus who answered. */
export interface GroupGigPayload extends GigPayload {
    attendees?: AttendeePayload[] | null;
    deposit?: DepositPayload | null;
    /** ISO timestamp the manager recorded when the client's balance arrived; null until then. */
    balanceReceivedAt?: string | null;
}
