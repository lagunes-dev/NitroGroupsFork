"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { gigsService } from "./gigs.service";
import { confirmedGigDates } from "./groupAgenda";

export const MY_GIGS_KEY = ["my-gigs"] as const;
export const groupGigsKey = (groupId: number) => ["group-gigs", groupId] as const;
export const groupNoticesKey = (groupId: number) => ["group-gig-notices", groupId] as const;
export const MY_NOTICES_TODAY_KEY = ["my-gig-notices-today"] as const;

// Answers are saved on the server: a fresh read within half a minute is enough to trust the list.
const STALE_MS = 30_000;

/**
 * The caller's own agenda as the API sends it. The rows stay raw in the cache so an answer can be
 * written back in the same shape; the component maps them to view data right before painting.
 */
export function useMyGigs() {
    return useQuery({
        queryKey: MY_GIGS_KEY,
        queryFn: () => gigsService.mine(),
        staleTime: STALE_MS,
        retry: 1,
    });
}

/** The group's confirmed gigs with who answered: the manager's agenda. */
export function useGroupGigs(groupId: number | null | undefined) {
    return useQuery({
        queryKey: groupGigsKey(groupId ?? 0),
        queryFn: () => gigsService.forGroup(groupId as number),
        enabled: Boolean(groupId),
        staleTime: STALE_MS,
        retry: 1,
    });
}

/**
 * Days that already have a confirmed gig, for marking the group calendar, with the state of the read.
 * The block-day control needs all three: a day is only "free" once the agenda was actually read.
 */
export interface ConfirmedGigDayRead {
    /** `YYYY-MM-DD` of every confirmed gig; empty while nothing is known or there is none. */
    days: string[];
    /** The agenda has not answered yet: the caller must say nothing about a day rather than guess. */
    isReading: boolean;
    /** The agenda could not be read: whoever needed it must say so instead of claiming a day is free. */
    failed: boolean;
}

/**
 * The confirmed gig days as one read, so no surface has to be told them by hand (round 10: the inbox
 * control was never told, and the same dialog then said two different things depending on the tab).
 */
export function useConfirmedGigDayRead(groupId: number | null | undefined): ConfirmedGigDayRead {
    const { data, isPending, isError } = useGroupGigs(groupId);
    const days = useMemo(() => confirmedGigDates(data ?? []), [data]);
    return { days, isReading: isPending, failed: isError && data === undefined };
}

/**
 * Days that already have a confirmed gig, for marking the group calendar. Shares the cache with the
 * agenda tab, so opening both costs one request. Without data it returns an empty list.
 */
export function useConfirmedGigDates(groupId: number | null | undefined): string[] {
    return useConfirmedGigDayRead(groupId).days;
}

/**
 * The notices the group received, newest first: the manager's agenda shows them on each gig row.
 * Manager only on the server; a failure leaves the agenda exactly as it was.
 */
export function useGroupGigNotices(groupId: number | null | undefined) {
    return useQuery({
        queryKey: groupNoticesKey(groupId ?? 0),
        queryFn: () => gigsService.groupNotices(groupId as number),
        enabled: Boolean(groupId),
        staleTime: STALE_MS,
        retry: false,
    });
}

/**
 * What the caller already told the group today. The agenda reads it so a slot that was reported
 * is not offered again after a reload.
 */
export function useMyGigNoticesToday() {
    return useQuery({
        queryKey: MY_NOTICES_TODAY_KEY,
        queryFn: () => gigsService.myNoticesToday(),
        staleTime: STALE_MS,
        retry: false,
    });
}
