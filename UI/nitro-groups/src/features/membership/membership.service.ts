import { apiClient } from "@/lib/api-client";
import { normalizeDirection, normalizeStatus } from "./status";
import { openMusiciansParams } from "./search";
import type { MembershipFilters, MembershipRequest, OpenMusician, PagedResult } from "./types";

type WireRequest = Omit<MembershipRequest, "direction" | "status"> & { direction: unknown; status: unknown };

const toRequest = (r: WireRequest): MembershipRequest => ({
    ...r,
    direction: normalizeDirection(r.direction),
    status: normalizeStatus(r.status),
});

/** API de invitaciones y solicitudes para unirse a un grupo. El usuario sale del token. */
export const membershipService = {
    searchOpenMusicians: async (query: string, page = 1, size = 10) =>
        (await apiClient.get<PagedResult<OpenMusician>>("/musicians/open-to-join", { params: openMusiciansParams(query, page, size) })).data,

    invite: async (groupId: number, musicianUserId: number, message?: string) =>
        toRequest((await apiClient.post<WireRequest>(`/groups/${groupId}/membership-invitations`, { musicianUserId, message: message?.trim() || undefined })).data),

    forGroup: async (groupId: number, filters?: MembershipFilters) =>
        (await apiClient.get<WireRequest[]>(`/groups/${groupId}/membership-requests`, { params: filters })).data.map(toRequest),

    /** The caller's own rows: invitations received and join requests sent. */
    mine: async (filters?: MembershipFilters) =>
        (await apiClient.get<WireRequest[]>("/membership-requests/mine", { params: filters })).data.map(toRequest),

    requestToJoin: async (groupId: number, message?: string) =>
        toRequest((await apiClient.post<WireRequest>(`/groups/${groupId}/membership-requests`, { message: message?.trim() || undefined })).data),

    accept: async (id: number) => toRequest((await apiClient.post<WireRequest>(`/membership-requests/${id}/accept`)).data),
    decline: async (id: number) => toRequest((await apiClient.post<WireRequest>(`/membership-requests/${id}/decline`)).data),
    cancel: async (id: number) => toRequest((await apiClient.post<WireRequest>(`/membership-requests/${id}/cancel`)).data),
};
