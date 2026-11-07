import type { UserType } from "@/features/groups/types/User";
import { pendingLabel } from "./pending";
import type { MembershipDirection } from "./types";

export type InviteOffer =
    | { kind: "hidden" }
    | { kind: "invite" }
    /** A pending row already exists: a status line, never a button. */
    | { kind: "pending"; label: string }
    | { kind: "member" };

interface InviteOfferInput {
    /** The signed-in user's record; null for a visitor or while it loads. */
    viewer: { id: number; userType: UserType } | null;
    /** The group the viewer manages, or null (none, or still loading). */
    managedGroupId: number | null;
    musician: { userId: number; isOpenToJoin: boolean };
    /** Ids of the group's active members; null when the list could not be read. */
    memberIds: number[] | null;
    /** Musicians with a pending row in the group, with its direction. */
    pending: Map<number, MembershipDirection | null> | undefined;
    loading: boolean;
}

/**
 * What "Invitar a mi grupo" offers this viewer for this musician. Clients do not hire musicians:
 * the only channel is a manager inviting, so everyone else sees nothing. When a list cannot be
 * read we still offer the button and let the API answer 409 (same policy as the join form).
 */
export function inviteOffer({ viewer, managedGroupId, musician, memberIds, pending, loading }: InviteOfferInput): InviteOffer {
    if (!viewer || viewer.userType !== "Musician" || managedGroupId === null || loading) return { kind: "hidden" };
    if (viewer.id === musician.userId) return { kind: "hidden" };
    if (memberIds?.includes(musician.userId)) return { kind: "member" };
    if (pending?.has(musician.userId)) return { kind: "pending", label: pendingLabel(pending.get(musician.userId) ?? null) };
    if (!musician.isOpenToJoin) return { kind: "hidden" };
    return { kind: "invite" };
}
