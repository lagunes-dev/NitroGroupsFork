"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePendingMembership } from "@/hooks/usePendingMembership";
import { membershipService } from "./membership.service";
import { inviteOffer, type InviteOffer } from "./invite";
import { pendingByMusician } from "./pending";

interface InviteOfferArgs {
    musicianUserId: number;
    isOpenToJoin: boolean;
}

/**
 * What "Invitar a mi grupo" offers this viewer for this musician, from the single rule in
 * `invite.ts`. The group is the one the dashboard manages; the requests and members queries use
 * the same keys as the team tab, so a card, the profile and the team list always agree.
 */
export function useInviteOffer({ musicianUserId, isOpenToJoin }: InviteOfferArgs): { offer: InviteOffer; groupId: number | null } {
    const { user, isLoading } = useCurrentUser();
    const { groupId, hasGroup } = usePendingMembership();

    const requests = useQuery({
        queryKey: ["membership-requests", groupId],
        queryFn: () => membershipService.forGroup(groupId!),
        enabled: groupId !== null,
        retry: false,
    });
    const members = useQuery({
        queryKey: ["group-members", groupId],
        queryFn: () => membershipService.groupMembers(groupId!),
        enabled: groupId !== null,
        retry: false,
    });

    const pending = useMemo(() => pendingByMusician(requests.data), [requests.data]);
    const loading = isLoading || hasGroup === null || (groupId !== null && (requests.isPending || members.isPending));

    const offer = inviteOffer({
        viewer: user ? { id: user.id, userType: user.userType } : null,
        managedGroupId: groupId,
        musician: { userId: musicianUserId, isOpenToJoin },
        memberIds: members.data ? members.data.filter((m) => m.isActive).map((m) => m.userId) : null,
        pending: requests.data ? pending : undefined,
        loading,
    });
    return { offer, groupId };
}
