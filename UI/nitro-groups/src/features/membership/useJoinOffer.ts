"use client";

import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { membershipService } from "./membership.service";
import { joinOffer, type JoinOffer } from "./join";

interface JoinOfferArgs {
    groupId: number;
    active: boolean;
    ownerUserId: number;
    signedIn: boolean;
}

/**
 * What "ask to join" offers this viewer, from the single rule in `join.ts`. The profile's header
 * button and its bottom form both read it (same query key), so they always agree.
 */
export function useJoinOffer({ groupId, active, ownerUserId, signedIn }: JoinOfferArgs): { offer: JoinOffer; membersPending: boolean } {
    const { user } = useCurrentUser();
    // Public list of member ids. If it cannot be read we show the form and let the API answer 409.
    const members = useQuery({
        queryKey: ["group-members", groupId],
        queryFn: () => membershipService.groupMembers(groupId),
        enabled: signedIn,
        retry: false,
    });

    const offer = joinOffer({
        signedIn,
        user: user ? { id: user.id, userType: user.userType } : null,
        group: { active, ownerUserId },
        // While the list loads we wait instead of flashing a form the viewer may not be allowed to use.
        members: members.data ?? null,
    });
    return { offer, membersPending: members.isPending };
}
