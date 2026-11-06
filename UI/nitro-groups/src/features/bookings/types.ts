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
    /**
     * T39: only on the lists the group receives, one per row, and only when the day already has an
     * accepted gig. The client's list never carries it and keeps rendering exactly as it did.
     */
    dateClash?: DateClashSignal | null;
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
