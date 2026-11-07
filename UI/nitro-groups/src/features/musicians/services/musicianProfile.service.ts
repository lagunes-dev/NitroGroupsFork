import { apiClient } from "@/lib/api-client";
import { getApiAccessToken } from "@/services/auth.service";
import type { MusicianProfileResponse, MusicianProfileUpdateRequest } from "../types";

/**
 * The two endpoints of the musician profile contract, and no others:
 * the public read and the signed-in musician's own update.
 */
export const musicianProfileService = {
    /** `GET api/musicians/{userId}` — public, so it also works without a session. */
    getPublic: async (userId: number): Promise<MusicianProfileResponse> => {
        const { data } = await apiClient.get<MusicianProfileResponse>(`/musicians/${userId}`);
        return data;
    },

    /** `PUT api/musicians/me` — the identity comes from the token, never from the body. */
    updateMine: async (request: MusicianProfileUpdateRequest): Promise<MusicianProfileResponse> => {
        const accessToken = await getApiAccessToken();
        const { data } = await apiClient.put<MusicianProfileResponse>("/musicians/me", request, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        return data;
    },
};
