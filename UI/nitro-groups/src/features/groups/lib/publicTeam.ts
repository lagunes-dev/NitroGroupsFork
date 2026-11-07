import { musicianProfileHref } from "@/features/musicians/links";
import { normalizeRole, roleLabel } from "@/features/membership/roles";
import type { PublicGroupTeamMember } from "../types/PublicGroupTeamMember";

/** Heading of the public section. The count is not repeated here: the facts row already says it. */
export const PUBLIC_TEAM_HEADING = "El equipo";

/** One honest line for a group whose public team is empty, so the heading is never alone. */
export const PUBLIC_TEAM_EMPTY = "Todavía no hay integrantes para mostrar.";

/** Shown when the API has no name for a member whose user row is gone. */
export const UNKNOWN_PUBLIC_MEMBER_NAME = "Músico del grupo";

/** One row of "El equipo" in the public profile: the view prints this, it decides nothing. */
export interface PublicTeamMemberView {
    /** Wire id, also the React key: an invalid id still identifies its own row. */
    userId: number;
    fullName: string;
    /** "Dueño" | "Manager" | "Miembro"; an unknown role reads as a plain member. */
    roleLabel: string;
    /** `/musicians/{userId}` when the id is a real one; null so the name renders as plain text. */
    profileHref: string | null;
    /** "Bajo · Guadalajara, Jalisco"; null when the profile is closed or nothing was loaded. */
    craftLabel: string | null;
}

/** Spoken summary of the list: "1 músico en el equipo" / "5 músicos en el equipo". */
export function publicTeamCountLabel(count: number): string {
    if (count <= 0) return "Ningún músico en el equipo";
    return count === 1 ? "1 músico en el equipo" : `${count} músicos en el equipo`;
}

/**
 * The public team as the section shows it. The API already sends Owner, Manager, Member and the
 * oldest membership first, so the order is kept: a second sort here could only disagree with it.
 */
export function toPublicTeamView(rows: PublicGroupTeamMember[]): PublicTeamMemberView[] {
    return (rows ?? []).map((row) => {
        const role = normalizeRole(row.role);
        return {
            userId: row.userId,
            fullName: name(row.fullName),
            roleLabel: roleLabel(role),
            profileHref: profileHref(row.userId),
            craftLabel: craftLabel(row),
        };
    });
}

/** "Bajo · Guadalajara, Jalisco": what the member plays and where he lives, whichever half arrived. */
function craftLabel(row: PublicGroupTeamMember): string | null {
    const parts = [loaded(row.instruments), loaded(row.city)];
    const present = parts.filter((part): part is string => part !== null);
    return present.length > 0 ? present.join(" · ") : null;
}

/** A trimmed value, or null when the field came empty: nunca se inventa un dato del perfil. */
function loaded(value: unknown): string | null {
    const trimmed = typeof value === "string" ? value.trim() : "";
    return trimmed || null;
}

function name(value: unknown): string {
    const trimmed = typeof value === "string" ? value.trim() : "";
    return trimmed || UNKNOWN_PUBLIC_MEMBER_NAME;
}

/** Only a real user id gets a profile link: 0, negatives, decimals and text are not users. */
function profileHref(userId: unknown): string | null {
    return typeof userId === "number" && Number.isInteger(userId) && userId > 0 ? musicianProfileHref(userId) : null;
}
