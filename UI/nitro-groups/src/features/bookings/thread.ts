import { compareByCreatedAtAsc } from "./order";
import type { EventRequest, EventRequestParty } from "./types";

export type ThreadItemKind = "request" | "response" | "message";

export interface ThreadItem {
    /** Stable React key: the API id plus what the item is ("message-8"). */
    key: string;
    kind: ThreadItemKind;
    senderParty: EventRequestParty;
    senderName: string;
    body: string;
    /** The API timestamp, or null when the part has none (an answer saved without a date). */
    createdAt: string | null;
}

type ThreadSource = Pick<EventRequest, "id" | "createdAt" | "message" | "clientName" | "groupName" | "responseMessage" | "respondedAt" | "messages">;

/**
 * The whole conversation in send order: the opening request, the group's answer and every message
 * the API returns, sorted instead of trusting the order they arrive in. The answer without a
 * timestamp keeps the place it had — right after the request it answers.
 */
export function threadItems(request: ThreadSource): ThreadItem[] {
    const items: { item: ThreadItem; orderId: number }[] = [
        {
            item: {
                key: `request-${request.id}`,
                kind: "request",
                senderParty: "Client",
                senderName: request.clientName,
                body: request.message,
                createdAt: request.createdAt,
            },
            orderId: 0,
        },
    ];

    if (request.responseMessage) {
        items.push({
            item: {
                key: `response-${request.id}`,
                kind: "response",
                senderParty: "Group",
                senderName: request.groupName,
                body: request.responseMessage,
                createdAt: request.respondedAt ?? null,
            },
            orderId: 0,
        });
    }

    for (const message of request.messages ?? []) {
        items.push({
            item: {
                key: `message-${message.id}`,
                kind: "message",
                senderParty: message.senderParty,
                senderName: message.senderName,
                body: message.body,
                createdAt: message.createdAt,
            },
            orderId: message.id,
        });
    }

    return items
        .sort((a, b) =>
            compareByCreatedAtAsc(
                { id: a.orderId, createdAt: a.item.createdAt ?? request.createdAt },
                { id: b.orderId, createdAt: b.item.createdAt ?? request.createdAt }
            )
        )
        .map(({ item }) => item);
}
