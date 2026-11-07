import { UserTypeEnum, type UserType } from "@/features/groups/types/User";
import type { ProfileVisitGroup, ProfileVisits } from "./types";

/** "2 grupos miraron tu perfil" and the groups behind that number. */
export interface ProfileVisitsView {
    headline: string;
    groups: ProfileVisitGroup[];
}

/**
 * The notice a musician reads in his panel, or null when there is nothing to say. Nothing at all
 * is the honest answer for a new musician: no empty furniture, no "0 grupos".
 */
/** Lo que ve un músico a quien todavía nadie miró: nombra la función, no la disimula. */
export const EMPTY_VISITS = "Ningún grupo miró tu perfil todavía";

export function toProfileVisitsView(summary: ProfileVisits | null | undefined): ProfileVisitsView | null {
    // Sin respuesta no hay nada que decir; con cero visitas sí, porque el músico tiene que saber
    // que la función existe.
    if (summary == null) return null;
    const count = summary.count ?? 0;
    if (!Number.isInteger(count) || count < 0) return null;

    // Un músico sin visitas ve que la función existe: esconder el bloque entero lo dejaba sin saber
    // que su perfil se puede mirar (ronda 4, Mateo). El estado vacío es una línea, no un adorno.
    if (count === 0) return { headline: EMPTY_VISITS, groups: [] };

    // A number without names behind it is not worth showing: the block lists who looked.
    const groups = summary?.groups ?? [];
    if (groups.length === 0) return null;

    return {
        headline: count === 1 ? "1 grupo miró tu perfil" : `${count} grupos miraron tu perfil`,
        groups,
    };
}

interface VisitTargetInput {
    /** The signed-in user's record; null for a visitor or while it loads. */
    viewer: { id: number; userType: UserType } | null;
    /** The group the viewer manages, or null (none, or still loading). */
    managedGroupId: number | null;
    /** The musician whose profile is open. */
    musicianUserId: number;
}

/**
 * The group that should leave a visit, or null. Only the manager of a group leaves one, and never
 * on his own musician profile: a self-view is not news for anyone.
 */
export function visitGroupToRecord({ viewer, managedGroupId, musicianUserId }: VisitTargetInput): number | null {
    if (!viewer || viewer.userType !== UserTypeEnum.Musician) return null;
    if (managedGroupId === null || !Number.isInteger(managedGroupId) || managedGroupId < 1) return null;
    if (viewer.id === musicianUserId) return null;
    return managedGroupId;
}
