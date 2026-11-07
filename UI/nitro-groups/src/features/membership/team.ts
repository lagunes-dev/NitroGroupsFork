import { formatEventDate } from "@/lib/format";
import { musicianProfileHref } from "@/features/musicians/links";
import { normalizeRole, roleLabel } from "./roles";
import type { GroupTeamMember, MembershipRole } from "./types";

/** Shown when the API has no name for a member (the user row behind the membership is gone). */
export const UNKNOWN_MEMBER_NAME = "Músico sin nombre";

/** Owner first, then Manager, then Member: the order the manager reads the team in. */
const ROLE_RANK: Record<MembershipRole, number> = { Owner: 0, Manager: 1, Member: 2 };

/** One row of "El equipo": every field the view prints is decided here, so the view stays dumb. */
export interface TeamMemberView {
    /** Wire id, also the React key: an invalid id still identifies its own row. */
    userId: number;
    fullName: string;
    role: MembershipRole | null;
    /** "Dueño" | "Manager" | "Miembro"; an unknown role reads as a plain member. */
    roleLabel: string;
    /** `/musicians/{userId}` when the id is a real one; null so the name renders as plain text. */
    profileHref: string | null;
    profilePictureUrl: string | null;
    /** "Se unió el 4 de octubre de 2026"; null when the timestamp cannot be read. */
    joinedLabel: string | null;
    joinedAt: string | null;
    /** "Bajo · Guadalajara, Jalisco"; null when the musician has not loaded either one. */
    craftLabel: string | null;
}

/** React Query key of one group's team: also the key the membership answers invalidate. */
export function teamQueryKey(groupId: number) {
    return ["group-team", groupId] as const;
}

/** Heading of the section: "El equipo (4)". */
export function teamHeadingLabel(count: number): string {
    return `El equipo (${count})`;
}

/** Spoken summary of the list: "1 músico en el equipo" / "4 músicos en el equipo". */
export function teamCountLabel(count: number): string {
    if (count <= 0) return "Ningún músico en el equipo";
    return count === 1 ? "1 músico en el equipo" : `${count} músicos en el equipo`;
}

/** The team as the section shows it: the same order the API promises, made explicit here. */
export function toTeamView(rows: GroupTeamMember[]): TeamMemberView[] {
    return orderTeam(rows).map(toMemberView);
}

/**
 * Owner first, then Manager, then Member; the oldest membership first inside each role. The API
 * already sorts this way, so the sort is idempotent: it keeps the view honest if the order changes.
 */
export function orderTeam(rows: GroupTeamMember[]): GroupTeamMember[] {
    return rows
        .map((row, index) => ({ row, index, rank: ROLE_RANK[normalizeRole(row.role) ?? "Member"], since: joinTime(row.joinedAt) }))
        // A join date nobody can read belongs to the end of its role, never above a dated row.
        .sort((a, b) => a.rank - b.rank || (a.since ?? Infinity) - (b.since ?? Infinity) || a.index - b.index)
        .map(({ row }) => row);
}

function toMemberView(row: GroupTeamMember): TeamMemberView {
    const role = normalizeRole(row.role);
    const time = joinTime(row.joinedAt);
    // Sin el día de la semana: en una fecha de ingreso no informa nada y partía el renglón en dos líneas.
    const date =
        time === null ? null : formatEventDate(new Date(time).toISOString().slice(0, 10))?.replace(/^[^,]+,\s*/, "") ?? null;

    return {
        userId: row.userId,
        fullName: name(row.fullName),
        role,
        roleLabel: roleLabel(role),
        profileHref: profileHref(row.userId),
        profilePictureUrl: row.profilePictureUrl ?? null,
        joinedLabel: date ? `Se unió el ${date}` : null,
        joinedAt: time === null ? null : row.joinedAt,
        craftLabel: craftLabel(row),
    };
}

/** "Bajo · Guadalajara, Jalisco": what the member plays and where he lives, whichever half arrived. */
function craftLabel(row: GroupTeamMember): string | null {
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
    return trimmed || UNKNOWN_MEMBER_NAME;
}

/** Only a real user id gets a profile link: 0, negatives, decimals and text are not users. */
function profileHref(userId: unknown): string | null {
    return typeof userId === "number" && Number.isInteger(userId) && userId > 0 ? musicianProfileHref(userId) : null;
}

/** Milliseconds of a join timestamp; null when the value is not a readable date. */
function joinTime(value: unknown): number | null {
    if (typeof value !== "string") return null;
    const time = Date.parse(value);
    return Number.isNaN(time) ? null : time;
}
