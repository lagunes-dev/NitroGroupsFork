"use client";

import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { UserTypeEnum } from "@/features/groups/types/User";
import { membershipService } from "@/features/membership/membership.service";

export const MY_MEMBERSHIPS_KEY = ["my-memberships"];

// Short enough that a join request accepted by a group shows up on the next focus; never polled.
const STALE_MS = 30_000;

/** The signed-in musician's active memberships. Shared by the menu, the dashboard tab and the invitation inbox. */
export function useMyMemberships() {
    const { user } = useCurrentUser();
    return useQuery({
        queryKey: MY_MEMBERSHIPS_KEY,
        queryFn: () => membershipService.myGroups(),
        enabled: user?.userType === UserTypeEnum.Musician,
        staleTime: STALE_MS,
        refetchOnWindowFocus: true,
        retry: false,
    });
}
