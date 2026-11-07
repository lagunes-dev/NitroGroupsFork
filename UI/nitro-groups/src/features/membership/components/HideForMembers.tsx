"use client";

import type { ReactNode } from "react";
import { useJoinOffer } from "../useJoinOffer";

interface HideForMembersProps {
    groupId: number;
    slug?: string | null;
    active: boolean;
    ownerUserId: number;
    signedIn: boolean;
    children: ReactNode;
}

/**
 * Renders its children only for people who are NOT members of the group. A member is not a client in
 * their own group: the contracting form makes no sense there, so it disappears instead of being
 * filled in by accident.
 */
export function HideForMembers({ groupId, slug, active, ownerUserId, signedIn, children }: HideForMembersProps) {
    const { isMember, membersPending } = useJoinOffer({ groupId, slug, active, ownerUserId, signedIn });
    // Un miembro nunca ve esto. Tampoco mientras se leen sus membresías: devolver los hijos ahí
    // hacía parpadear el formulario de contratación dentro del grupo propio (visto en la ronda 3).
    if (isMember) return null;
    if (signedIn && membersPending) return null;
    return <>{children}</>;
}
