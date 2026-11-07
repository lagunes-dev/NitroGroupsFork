import type { DepositPayload } from "./deposit";
import type { DateClashSignal } from "./signals";

export type EventRequestStatus = "Pending" | "Accepted" | "Declined" | "Cancelled";
export type EventRequestParty = "Client" | "Group";

export interface EventRequestMessage {
    id: number;
    senderUserId: number;
    senderParty: EventRequestParty;
    senderName: string;
    body: string;
    createdAt: string;
}

/** The client's review of one event, as `GET api/event-requests/{id}` carries it. */
export interface EventReview {
    rating: number;
    comment: string | null;
    createdAt: string;
}

export interface EventRequest {
    id: number;
    groupId: number;
    groupName: string;
    groupSlug: string;
    clientName: string;
    eventDate: string; // YYYY-MM-DD
    startTime: string | null; // HH:mm:ss
    durationHours: number;
    eventType: string;
    locationText: string;
    guestCount: number | null;
    budget: number | null;
    currency: string;
    message: string;
    status: EventRequestStatus;
    isSelfBooked: boolean;
    createdAt: string;
    respondedAt: string | null;
    responseMessage: string | null;
    messages?: EventRequestMessage[] | null;
    /** Recorded by the group once the request is accepted; the app never charges it. */
    deposit?: DepositPayload | null;
    /** T48: ISO timestamp the group recorded when the balance arrived; null until then. */
    balanceReceivedAt?: string | null;
    /**
     * T39: only on the lists the group receives, one per row, and only when the day already has an
     * accepted gig. The client's list never carries it and keeps rendering exactly as it did.
     */
    dateClash?: DateClashSignal | null;
    /**
     * Ronda 10: the group's payment method in one line, for the client's row. Only on the client's
     * list and only for accepted requests; missing when the group wrote nothing.
     */
    paymentMethod?: string | null;
    /** D7: only on the client's payloads. True when the accepted event already happened and has no review. */
    canReview?: boolean;
    review?: EventReview | null;
}

export interface CreateEventRequestBody {
    groupId: number;
    eventDate: string;
    startTime?: string | null;
    durationHours: number;
    eventType: string;
    locationText: string;
    guestCount?: number | null;
    budget?: number | null;
    message: string;
}

export const EVENT_TYPES = ["Boda", "XV años", "Cumpleaños", "Corporativo", "Otro"] as const;
