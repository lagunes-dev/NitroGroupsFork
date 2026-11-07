"use client";

import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { membershipService } from "./membership.service";
import { isActiveMemberOf, joinOffer, type JoinOffer } from "./join";
import { useMyMemberships } from "@/hooks/useMyMemberships";

interface JoinOfferArgs {
    groupId: number;
    /** Slug of the group, when the page knows it: the memberships list carries both. */
    slug?: string | null;
    active: boolean;
    ownerUserId: number;
    signedIn: boolean;
}

/**
 * What "ask to join" offers this viewer, from the single rule in `join.ts`. The profile's header
 * button and its bottom form both read it (same query key), so they always agree.
 */
export function useJoinOffer({ groupId, slug, active, ownerUserId, signedIn }: JoinOfferArgs): { offer: JoinOffer; membersPending: boolean; isMember: boolean } {
    const { user } = useCurrentUser();
    // Public list of member ids. If it cannot be read we show the form and let the API answer 409.
    const members = useQuery({
        queryKey: ["group-members", groupId],
        queryFn: () => membershipService.groupMembers(groupId),
        enabled: signedIn,
        retry: false,
    });

    // The viewer's own memberships: a member of THIS group must not be offered a join form.
    const memberships = useMyMemberships();
    const isMember = isActiveMemberOf(memberships.data, groupId) || isActiveMemberOf(memberships.data, slug);

    const offer = joinOffer({
        signedIn,
        user: user ? { id: user.id, userType: user.userType } : null,
        group: { active, ownerUserId, groupId, slug: slug ?? undefined },
        // While the list loads we wait instead of flashing a form the viewer may not be allowed to use.
        members: members.data ?? null,
        memberships: memberships.data,
        membershipsPending: signedIn && memberships.isPending,
    });
    return { offer, membersPending: members.isPending, isMember };
}
