import type { UserType } from "@/features/groups/types/User";
import type { MyMembership } from "./types";

export const JOIN_MESSAGE_MAX = 2000; // the API rejects longer messages with 400

export type JoinOffer = "form" | "login" | "hidden";

/**
 * Whether the viewer already belongs to this group, from `GET api/users/me/memberships` (the groups
 * the viewer is an active member of, with their role). A number matches `groupId`; a string matches
 * `slug`, ignoring case and surrounding spaces.
 *
 * An empty, unreadable or still-loading list is never a membership: callers that must not flash an
 * impossible offer wait for the list instead (see `membershipsPending` in `joinOffer`).
 */
export function isActiveMemberOf(
    memberships: MyMembership[] | null | undefined,
    groupIdOrSlug: number | string | null | undefined
): boolean {
    if (!memberships?.length || groupIdOrSlug === null || groupIdOrSlug === undefined) return false;
    if (typeof groupIdOrSlug === "number") return memberships.some((m) => m.groupId === groupIdOrSlug);
    const slug = groupIdOrSlug.trim().toLowerCase();
    return slug !== "" && memberships.some((m) => m.slug.trim().toLowerCase() === slug);
}

interface JoinOfferInput {
    signedIn: boolean;
    /** The viewer's record; null while it loads (or if it could not be read). */
    user: { id: number; userType: UserType } | null;
    group: { active: boolean; ownerUserId: number; groupId?: number; slug?: string };
    /** Rows of the public members list; null when it could not be read. */
    members: { userId: number; isActive: boolean }[] | null;
    /** The viewer's own memberships: undefined while they load, null if they could not be read. */
    memberships?: MyMembership[] | null;
    /** True while those memberships load: we wait instead of offering a form a member may not use. */
    membershipsPending?: boolean;
}

/**
 * What the public group profile offers for "ask to join". Only a musician who is not already an
 * active member of an active group gets the form; anonymous visitors get a login link. When the
 * lists are unknown we still show the form and let the API answer 409 — except while the viewer's
 * own memberships are still loading, where a member could be wrongly offered the form.
 */
export function joinOffer({ signedIn, user, group, members, memberships, membershipsPending = false }: JoinOfferInput): JoinOffer {
    if (!group.active) return "hidden";
    if (!signedIn) return "login";
    if (!user || user.userType !== "Musician") return "hidden";
    if (user.id === group.ownerUserId) return "hidden";
    if (membershipsPending) return "hidden";
    if (isActiveMemberOf(memberships, group.groupId) || isActiveMemberOf(memberships, group.slug)) return "hidden";
    if (members?.some((m) => m.userId === user.id && m.isActive)) return "hidden";
    return "form";
}

/** The header shortcut appears only where the form below will be, and not while it still waits for the members list. */
export function showJoinShortcut(offer: JoinOffer, membersPending: boolean): boolean {
    return offer === "form" && !membersPending;
}

export type JoinMessageResult = { ok: true; message: string | undefined } | { ok: false; error: string };

/** Blank means "no message" (omitted from the body); the limit is checked on the trimmed text. */
export function prepareJoinMessage(raw: string): JoinMessageResult {
    const message = raw.trim();
    if (message.length > JOIN_MESSAGE_MAX) return { ok: false, error: `El mensaje admite hasta ${JOIN_MESSAGE_MAX} caracteres.` };
    return { ok: true, message: message || undefined };
}
