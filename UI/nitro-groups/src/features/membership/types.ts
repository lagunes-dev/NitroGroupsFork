export type MembershipDirection = "Invitation" | "Request";
export type MembershipStatus = "Pending" | "Accepted" | "Declined" | "Cancelled";

/** Fila de `GET api/groups/{id}/membership-requests`. Nunca trae email. */
export interface MembershipRequest {
    id: number;
    groupId: number;
    groupName: string;
    groupSlug: string;
    musicianUserId: number;
    musicianName: string;
    initiatedByUserId: number;
    /** Null si la API manda un valor que esta versión no conoce. */
    direction: MembershipDirection | null;
    status: MembershipStatus | null;
    message: string | null;
    resolvedByUserId: number | null;
    createdAt: string;
    updatedAt: string | null;
    /** Para el grupo, el nombre del músico. */
    counterpartName: string;
}

/** Resumen de un músico abierto a unirse (sin email). */
export interface OpenMusician {
    userId: number;
    fullName: string;
    profilePictureUrl: string | null;
    yearsExperience: number | null;
}

export interface PagedResult<T> {
    items: T[];
    pageNumber: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
}

export interface MembershipFilters {
    direction?: MembershipDirection;
    status?: MembershipStatus;
}
