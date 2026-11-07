import type { UserType } from "@/features/groups/types/User";

export const JOIN_MESSAGE_MAX = 2000; // the API rejects longer messages with 400

export type JoinOffer = "form" | "login" | "hidden";

interface JoinOfferInput {
    signedIn: boolean;
    /** The viewer's record; null while it loads (or if it could not be read). */
    user: { id: number; userType: UserType } | null;
    group: { active: boolean; ownerUserId: number };
    /** Rows of the public members list; null when it could not be read. */
    members: { userId: number; isActive: boolean }[] | null;
}

/**
 * What the public group profile offers for "ask to join". Only a musician who is not already an
 * active member of an active group gets the form; anonymous visitors get a login link. When the
 * members list is unknown we still show the form and let the API answer 409.
 */
export function joinOffer({ signedIn, user, group, members }: JoinOfferInput): JoinOffer {
    if (!group.active) return "hidden";
    if (!signedIn) return "login";
    if (!user || user.userType !== "Musician") return "hidden";
    if (user.id === group.ownerUserId) return "hidden";
    if (members?.some((m) => m.userId === user.id && m.isActive)) return "hidden";
    return "form";
}

export type JoinMessageResult = { ok: true; message: string | undefined } | { ok: false; error: string };

/** Blank means "no message" (omitted from the body); the limit is checked on the trimmed text. */
export function prepareJoinMessage(raw: string): JoinMessageResult {
    const message = raw.trim();
    if (message.length > JOIN_MESSAGE_MAX) return { ok: false, error: `El mensaje admite hasta ${JOIN_MESSAGE_MAX} caracteres.` };
    return { ok: true, message: message || undefined };
}
