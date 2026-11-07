/**
 * The public musician profile, exactly as the API contract fixes it:
 * `GET api/musicians/{userId}` (public) and `PUT api/musicians/me` (authenticated) return the same shape.
 */

/** A group the musician plays in, with their role in it. */
export interface MusicianGroupRefResponse {
    groupId: number;
    groupName: string;
    slug: string;
    /** Backend enum name: Owner | Manager | Member. */
    role: string | null;
}

export interface MusicianProfileResponse {
    userId: number;
    fullName: string;
    headline?: string | null;
    shortBio?: string | null;
    instruments?: string | null;
    city?: string | null;
    yearsExperience?: number | null;
    profilePictureUrl?: string | null;
    videoUrl?: string | null;
    isOpenToJoin?: boolean;
    groups?: MusicianGroupRefResponse[] | null;
}

/**
 * Body of `PUT api/musicians/me`. It replaces the editable part of the profile, so an empty
 * string clears a text field; `yearsExperience` is omitted while the field is empty.
 */
export interface MusicianProfileUpdateRequest {
    headline: string;
    shortBio: string;
    instruments: string;
    /** Optional; "" clears it. */
    city: string;
    videoUrl: string;
    isOpenToJoin: boolean;
    yearsExperience?: number;
}

/** One row of `GET api/musicians` (public, open-to-join musicians only, never an email). */
export interface MusicianDirectoryItemResponse {
    userId: number;
    fullName: string;
    headline?: string | null;
    /** Comma separated, like the profile; a list is accepted in case the serialization changes. */
    instruments?: string | string[] | null;
    city?: string | null;
    yearsExperience?: number | null;
    profilePictureUrl?: string | null;
}

/** Paged envelope of `GET api/musicians`. */
export interface MusicianDirectoryResponse {
    items: MusicianDirectoryItemResponse[];
    pageNumber: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasPreviousPage?: boolean;
    hasNextPage?: boolean;
}
