"use client";

import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { UserTypeEnum } from "@/features/groups/types/User";
import { groupsService } from "@/features/groups/services/groups.service";
import { membershipService } from "@/features/membership/membership.service";
import { pendingCount } from "@/features/membership/counts";

// Short enough that a new invitation shows up on the next focus or navigation; never polled.
const STALE_MS = 30_000;

export interface PendingMembership {
    /** The musician's group id, or null without one (or while it loads). */
    groupId: number | null;
    /** Whether the user has a group; null while that is still being read. */
    hasGroup: boolean | null;
    /** Invitations received by the current user and still waiting for an answer. */
    invitations: number;
    /** Join requests waiting for the manager of the user's group. */
    joinRequests: number;
}

/**
 * Pending membership counts for the signed-in musician. It reads the same queries as the lists
 * (`my-membership-requests`, `membership-requests/{groupId}`), so answering a row there updates
 * the counts here. A failed read counts as zero: it never throws.
 */
export function usePendingMembership(): PendingMembership {
    const { user } = useCurrentUser();
    const userId = user?.id;
    const isMusician = user?.userType === UserTypeEnum.Musician;

    const group = useQuery({
        queryKey: ["music-group", userId],
        queryFn: () => groupsService.getByUserId(userId!),
        enabled: isMusician && Boolean(userId),
        staleTime: 1000 * 60 * 10,
        retry: false,
    });
    const groupId = group.data?.id ?? null;

    const mine = useQuery({
        queryKey: ["my-membership-requests"],
        queryFn: () => membershipService.mine(),
        enabled: isMusician,
        staleTime: STALE_MS,
        refetchOnWindowFocus: true,
        retry: false,
    });

    const forGroup = useQuery({
        queryKey: ["membership-requests", groupId],
        queryFn: () => membershipService.forGroup(groupId!),
        enabled: groupId !== null,
        staleTime: STALE_MS,
        refetchOnWindowFocus: true,
        retry: false,
    });

    return {
        groupId,
        hasGroup: group.isPending ? null : groupId !== null,
        invitations: mine.isSuccess ? pendingCount(mine.data, "Invitation") : 0,
        joinRequests: forGroup.isSuccess ? pendingCount(forGroup.data, "Request") : 0,
    };
}
