import { Ban, Check, CircleHelp, Clock, X, type LucideIcon } from "lucide-react";
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "@/components/ui/Badge";
import { isIsoDate, todayInMexico } from "@/lib/format";
import type { EventRequest, EventRequestParty, EventRequestStatus } from "./types";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/** How a status looks: the word, the chip tone and its icon (colour never travels alone). */
export interface StatusAppearance {
    text: string;
    variant: BadgeVariant;
    /** Extra classes for the tones the Badge does not ship. */
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
 * Presentation of one status. The API sends the status as text: a value we do not know prints as it
 * arrived, in a neutral tone, so a new transition never disguises itself as "accepted".
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

/**
 * Acciones disponibles: reflejan las transiciones que acepta la API (si no, devuelve 409).
 *
 * Un evento aceptado cuya fecha (día de México, la misma regla que los avisos del toque) ya pasó no
 * se cancela: ya se tocó, y el botón ofrecía deshacer algo que ocurrió. La conversación sigue
 * abierta y la reseña también (S5, S8). `today` se recibe para poder fijarlo en los tests.
 */
export function availableActions(
    request: Pick<EventRequest, "status" | "eventDate">,
    viewer: EventRequestParty,
    today: string = todayInMexico(),
) {
    const { status } = request;
    const cancellableAccepted = status === "Accepted" && !alreadyHappened(request.eventDate, today);
    return {
        accept: viewer === "Group" && status === "Pending",
        decline: viewer === "Group" && status === "Pending",
        cancel: viewer === "Client" ? status === "Pending" || cancellableAccepted : cancellableAccepted,
        message: status === "Pending" || status === "Accepted",
        // Una solicitud cerrada no se reabre: otra fecha es una solicitud nueva.
        requestAgain: viewer === "Client" && (status === "Declined" || status === "Cancelled"),
    };
}

/** true si la fecha del evento quedó antes de hoy en México; una fecha ilegible nunca se da por pasada. */
function alreadyHappened(eventDate: string | null | undefined, today: string): boolean {
    if (!isIsoDate(eventDate) || !isIsoDate(today)) return false;
    return eventDate < today;
}

/** "20:00" a partir de "20:00:00". */
export function shortTime(time: string | null): string | null {
    return time ? time.slice(0, 5) : null;
}
