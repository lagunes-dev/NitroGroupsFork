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
}

/** A member and their answer, as the manager view lists them. Never carries an email. */
export interface AttendeePayload {
    userId?: number | string | null;
    fullName?: string | null;
    status?: string | null;
}

/** Manager row: the same gig plus who answered. */
export interface GroupGigPayload extends GigPayload {
    attendees?: AttendeePayload[] | null;
}
