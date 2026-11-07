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

export type MembershipRole = "Owner" | "Manager" | "Member";

/**
 * Row of `GET api/groups/{id}/team` (Owner or Manager only): an active member with a name and a
 * role. Never an email. `role` arrives as the enum name and `toTeamView` normalizes it.
 */
export interface GroupTeamMember {
    userId: number;
    fullName: string;
    /** Unknown value: normalize it, never trust it. */
    role: unknown;
    profilePictureUrl: string | null;
    joinedAt: string;
    /** Free text loaded by the musician on his own profile; null or missing when he has not. */
    instruments?: string | null;
    city?: string | null;
}

/** Fila de `GET api/users/me/memberships`: un grupo activo del usuario y su rol. */
export interface MyMembership {
    groupId: number;
    groupName: string;
    slug: string;
    profilePictureUrl: string | null;
    /** Null si la API manda un valor que esta versión no conoce. */
    role: MembershipRole | null;
    joinedAt: string;
}

/**
 * Un grupo que miró el perfil del músico (`GET api/me/profile-visits`, S9). `slug` es el del
 * perfil público del grupo. Nunca trae el email de nadie.
 */
export interface ProfileVisitGroup {
    id: number;
    groupName: string;
    slug: string;
    lastVisitedAt: string;
}

/** Lo que el músico ve en su panel: cuántos grupos lo miraron y cuáles. */
export interface ProfileVisits {
    count: number;
    groups: ProfileVisitGroup[];
}
