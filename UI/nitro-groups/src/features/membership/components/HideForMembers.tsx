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
    const { isMember } = useJoinOffer({ groupId, slug, active, ownerUserId, signedIn });
    if (isMember) return null;
    return <>{children}</>;
}
