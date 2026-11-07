import type { MembershipDirection, MembershipRequest, MembershipStatus } from "./types";

const STATUSES: MembershipStatus[] = ["Pending", "Accepted", "Declined", "Cancelled"]; // = valores 0..3 de la API
const DIRECTIONS: MembershipDirection[] = ["Invitation", "Request"]; // = valores 0..1

/** La API manda el nombre del enum; aceptamos también el entero por si cambia la serialización. */
export function normalizeStatus(value: unknown): MembershipStatus | null {
    if (typeof value === "number") return STATUSES[value] ?? null;
    return STATUSES.find((s) => s === value) ?? null;
}

export function normalizeDirection(value: unknown): MembershipDirection | null {
    if (typeof value === "number") return DIRECTIONS[value] ?? null;
    return DIRECTIONS.find((d) => d === value) ?? null;
}

export function statusLabel(status: MembershipStatus | null): string {
    switch (status) {
        case "Pending":
            return "Pendiente";
        case "Accepted":
            return "Aceptada";
        case "Declined":
            return "Rechazada";
        case "Cancelled":
            return "Cancelada";
        default:
            return "Estado desconocido";
    }
}

export type StatusTone = "attention" | "ok" | "muted";

/** El tono acompaña a la etiqueta de texto; nunca la reemplaza. */
export function statusTone(status: MembershipStatus | null): StatusTone {
    if (status === "Pending") return "attention";
    if (status === "Accepted") return "ok";
    return "muted";
}

export function directionLabel(direction: MembershipDirection | null): string {
    switch (direction) {
        case "Invitation":
            return "Invitación enviada";
        case "Request":
            return "Solicitud para unirse";
        default:
            return "Movimiento";
    }
}

/**
 * Acciones del grupo (reflejan las transiciones de la API; si no, devuelve 409): responde las
 * solicitudes del músico y retira las invitaciones propias.
 */
export function availableActions(row: Pick<MembershipRequest, "direction" | "status">) {
    const pending = row.status === "Pending";
    return {
        accept: pending && row.direction === "Request",
        decline: pending && row.direction === "Request",
        cancel: pending && row.direction === "Invitation",
    };
}
