import { Ban, Check, CircleHelp, Clock, X, type LucideIcon } from "lucide-react";
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "@/components/ui/Badge";
import type { EventRequest, EventRequestParty, EventRequestStatus } from "./types";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/** Cómo se ve un estado: la palabra, el tono del chip y su icono (el color nunca va solo). */
export interface StatusAppearance {
    text: string;
    variant: BadgeVariant;
    /** Clases extra para los tonos que el Badge no trae de fábrica. */
    className?: string;
    icon: LucideIcon;
}

const STATUS_APPEARANCE: Record<EventRequestStatus, StatusAppearance> = {
    Pending: { text: "Pendiente", variant: "default", className: "text-acento", icon: Clock },
    Accepted: { text: "Aceptada", variant: "ok", icon: Check },
    Declined: { text: "Rechazada", variant: "destructive", icon: X },
    Cancelled: { text: "Cancelada", variant: "secondary", icon: Ban },
};

/**
 * Presentación de un estado. La API manda el estado como texto: uno que no conocemos se muestra
 * tal cual, en tono neutro, para que una transición nueva no se disface de "aceptada".
 */
export function statusAppearance(status: string): StatusAppearance {
    return STATUS_APPEARANCE[status as EventRequestStatus] ?? { text: status.trim() || "Sin estado", variant: "secondary", icon: CircleHelp };
}

/** Cómo se nombra cada estado ante cada parte. */
export function statusLabel(status: EventRequestStatus, viewer: EventRequestParty): string {
    switch (status) {
        case "Pending":
            return viewer === "Client" ? "Esperando respuesta del grupo" : "Por responder";
        case "Accepted":
            return "Aceptada";
        case "Declined":
            return "Rechazada";
        case "Cancelled":
            return "Cancelada";
    }
}

/** Acciones disponibles: reflejan las transiciones que acepta la API (si no, devuelve 409). */
export function availableActions(request: Pick<EventRequest, "status">, viewer: EventRequestParty) {
    const { status } = request;
    return {
        accept: viewer === "Group" && status === "Pending",
        decline: viewer === "Group" && status === "Pending",
        cancel: viewer === "Client" ? status === "Pending" || status === "Accepted" : status === "Accepted",
        message: status === "Pending" || status === "Accepted",
        // Una solicitud cerrada no se reabre: otra fecha es una solicitud nueva.
        requestAgain: viewer === "Client" && (status === "Declined" || status === "Cancelled"),
    };
}

/** "20:00" a partir de "20:00:00". */
export function shortTime(time: string | null): string | null {
    return time ? time.slice(0, 5) : null;
}
