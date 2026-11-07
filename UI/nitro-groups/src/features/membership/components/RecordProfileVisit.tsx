"use client";

import { useEffect, useRef } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePendingMembership } from "@/hooks/usePendingMembership";
import { membershipService } from "../membership.service";
import { visitGroupToRecord } from "../profileVisit";

/**
 * Leaves one visit on a musician's public profile when the viewer manages a group (S9). INVISIBLE:
 * it renders nothing and never blocks the profile — a visit that cannot be recorded is a notice
 * the musician will not get, not a page that fails. The ref keeps it to one call per visit, so a
 * re-render does not turn into a second visit.
 */
export function RecordProfileVisit({ musicianUserId }: { musicianUserId: number }) {
    const { user } = useCurrentUser();
    const { groupId } = usePendingMembership();
    const groupToVisit = visitGroupToRecord({
        viewer: user ? { id: user.id, userType: user.userType } : null,
        managedGroupId: groupId,
        musicianUserId,
    });
    const recorded = useRef<number | null>(null);

    useEffect(() => {
        if (groupToVisit === null || recorded.current === groupToVisit) return;
        recorded.current = groupToVisit;
        // Best effort by design: the profile page does not wait for it and does not report it.
        void membershipService.recordProfileVisit(groupToVisit, musicianUserId).catch(() => {});
    }, [groupToVisit, musicianUserId]);

    return null;
}
