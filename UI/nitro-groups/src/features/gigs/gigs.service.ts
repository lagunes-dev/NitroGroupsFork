import { apiClient } from "@/lib/api-client";
import type { DetailsBody, PayBody } from "./gigLogistics";
import type { GigAnswer, GigPayload, GroupGigPayload } from "./types";

/**
 * Gigs of the caller and their answers (odd/tasks/ola-2b-agenda-gigs.md). `apiClient` attaches the
 * session token in the browser, so every call is authenticated and the user always comes from it.
 */
export const gigsService = {
    /** `GET api/me/gigs`: accepted gigs of the caller's active memberships, from 30 days back. */
    mine: async () => (await apiClient.get<GigPayload[]>("/me/gigs")).data,

    /** `POST api/gigs/{id}/attendance`: upserts the caller's answer. 404 outside their groups. */
    answer: async (id: number, status: GigAnswer) =>
        (await apiClient.post<{ id?: number; attendance?: string | null }>(`/gigs/${id}/attendance`, { status })).data,

    /** `GET api/groups/{groupId}/gigs`: the manager's view, the same rows plus who answered. */
    forGroup: async (groupId: number) => (await apiClient.get<GroupGigPayload[]>(`/groups/${groupId}/gigs`)).data,

    /** `PUT api/groups/{groupId}/gigs/{id}/details`: setlist, call time and deposit; the API updates only what is sent. */
    saveDetails: async (groupId: number, id: number, body: DetailsBody) =>
        (await apiClient.put(`/groups/${groupId}/gigs/${id}/details`, body)).data,

    /** `PUT api/groups/{groupId}/gigs/{id}/pay`: replaces what each musician is paid for the gig (informational). */
    savePay: async (groupId: number, id: number, body: PayBody) => (await apiClient.put(`/groups/${groupId}/gigs/${id}/pay`, body)).data,
};
