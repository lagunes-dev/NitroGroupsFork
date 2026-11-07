import { describe, expect, it } from "vitest";
import { threadItems } from "./thread";
import type { EventRequest, EventRequestMessage, EventRequestParty } from "./types";

function message(id: number, createdAt: string, body = `mensaje ${id}`, senderParty: EventRequestParty = "Client"): EventRequestMessage {
    return { id, senderUserId: 1, senderParty, senderName: senderParty === "Group" ? "El grupo" : "Sofía", body, createdAt };
}

function request(overrides: Partial<EventRequest> = {}): EventRequest {
    return {
        id: 12,
        groupId: 1,
        groupName: "Mariachi Sol de Jalisco",
        groupSlug: "mariachi-sol-de-jalisco",
        clientName: "Sofía",
        eventDate: "2026-12-12",
        startTime: "20:00:00",
        durationHours: 3,
        eventType: "Wedding",
        locationText: "Hacienda Los Arcos",
        guestCount: 150,
        budget: 14000,
        currency: "MXN",
        message: "Pedido inicial",
        status: "Accepted",
        isSelfBooked: false,
        createdAt: "2026-11-01T10:00:00Z",
        respondedAt: "2026-11-01T11:00:00Z",
        responseMessage: "Aceptado",
        messages: [],
        ...overrides,
    };
}

const bodies = (items: ReturnType<typeof threadItems>) => items.map((item) => item.body);

describe("threadItems", () => {
    it("reads the opening message, the reply and the conversation in send order", () => {
        const items = threadItems(
            request({
                messages: [
                    message(2, "2026-11-01T13:00:00Z", "tercero"),
                    message(1, "2026-11-01T10:30:00Z", "segundo"),
                ],
            })
        );
        expect(bodies(items)).toEqual(["Pedido inicial", "segundo", "Aceptado", "tercero"]);
    });

    it("keeps the order by id when two messages share a timestamp", () => {
        const items = threadItems(
            request({
                messages: [
                    message(9, "2026-11-01T11:30:00Z", "nueve"),
                    message(4, "2026-11-01T11:30:00Z", "cuatro"),
                ],
            })
        );
        expect(bodies(items)).toEqual(["Pedido inicial", "Aceptado", "cuatro", "nueve"]);
    });

    it("places a reply without its own timestamp right after the request", () => {
        const items = threadItems(request({ respondedAt: null, messages: [message(1, "2026-11-01T10:15:00Z", "mensaje")] }));
        expect(bodies(items)).toEqual(["Pedido inicial", "Aceptado", "mensaje"]);
        expect(items[1].createdAt).toBeNull();
    });

    it("leaves the reply out when the group has not answered", () => {
        const items = threadItems(request({ status: "Pending", respondedAt: null, responseMessage: null, messages: null }));
        expect(bodies(items)).toEqual(["Pedido inicial"]);
        expect(items[0]).toMatchObject({ key: "request-12", kind: "request", senderParty: "Client" });
    });

    it("names who wrote each part", () => {
        const items = threadItems(request({ messages: [message(1, "2026-11-01T12:00:00Z", "hola", "Group")] }));
        expect(items.map((item) => [item.kind, item.senderParty, item.senderName])).toEqual([
            ["request", "Client", "Sofía"],
            ["response", "Group", "Mariachi Sol de Jalisco"],
            ["message", "Group", "El grupo"],
        ]);
    });
});
