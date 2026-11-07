import { describe, expect, it } from "vitest";
import { compareByCreatedAtAsc, compareClientRequests, groupClientRequests } from "./order";
import type { EventRequest, EventRequestMessage, EventRequestStatus } from "./types";

function request(id: number, eventDate: string, status: EventRequestStatus = "Pending"): EventRequest {
    return {
        id,
        groupId: 1,
        groupName: "Mariachi Sol de Jalisco",
        groupSlug: "mariachi-sol-de-jalisco",
        clientName: "Sofía",
        eventDate,
        startTime: "20:00:00",
        durationHours: 3,
        eventType: "Wedding",
        locationText: "Hacienda Los Arcos",
        guestCount: 150,
        budget: 14000,
        currency: "MXN",
        message: "Hola",
        status,
        isSelfBooked: false,
        createdAt: "2026-11-01T10:00:00Z",
        respondedAt: null,
        responseMessage: null,
        messages: null,
    };
}

const TODAY = "2026-11-05";

const ids = (list: EventRequest[]) => list.map((r) => r.id);

describe("compareClientRequests", () => {
    it("orders by event date, soonest first", () => {
        const list = [request(1, "2026-12-20"), request(2, "2026-12-01"), request(3, "2026-12-10")];
        expect(ids([...list].sort((a, b) => compareClientRequests(a, b, TODAY)))).toEqual([2, 3, 1]);
    });

    it("breaks a tie on the same date by id", () => {
        const list = [request(9, "2026-12-01"), request(4, "2026-12-01")];
        expect(ids([...list].sort((a, b) => compareClientRequests(a, b, TODAY)))).toEqual([4, 9]);
    });

    it("leaves cancelled requests at the end, whatever their date", () => {
        const list = [request(1, "2026-12-01", "Cancelled"), request(2, "2026-12-20"), request(3, "2026-12-10")];
        expect(ids([...list].sort((a, b) => compareClientRequests(a, b, TODAY)))).toEqual([3, 2, 1]);
    });

    it("leaves dates that already passed after the upcoming ones", () => {
        const list = [request(1, "2026-10-01"), request(2, "2026-12-20")];
        expect(ids([...list].sort((a, b) => compareClientRequests(a, b, TODAY)))).toEqual([2, 1]);
    });

    it("sorts an invalid date last instead of throwing", () => {
        const list = [request(1, "2026-13-45"), request(2, "2026-12-20"), request(3, "no-date")];
        expect(ids([...list].sort((a, b) => compareClientRequests(a, b, TODAY)))).toEqual([2, 1, 3]);
    });

    it("keeps the order stable when today is not a date", () => {
        const list = [request(1, "2026-10-01"), request(2, "2026-10-02")];
        expect(ids([...list].sort((a, b) => compareClientRequests(a, b, "hoy")))).toEqual([1, 2]);
    });
});

describe("groupClientRequests", () => {
    it("groups by status with a count, pending first and cancelled last", () => {
        const groups = groupClientRequests(
            [request(1, "2026-12-01", "Cancelled"), request(2, "2026-12-05"), request(3, "2026-12-03", "Accepted"), request(4, "2026-12-02")],
            TODAY
        );
        expect(groups.map((g) => [g.status, g.appearance.text, g.requests.length])).toEqual([
            ["Pending", "Pendiente", 2],
            ["Accepted", "Aceptada", 1],
            ["Cancelled", "Cancelada", 1],
        ]);
    });

    it("sorts every group by event date", () => {
        const groups = groupClientRequests([request(1, "2026-12-20"), request(2, "2026-12-01")], TODAY);
        expect(ids(groups[0].requests)).toEqual([2, 1]);
    });

    it("leaves empty statuses out", () => {
        const groups = groupClientRequests([request(1, "2026-12-01", "Declined")], TODAY);
        expect(groups.map((g) => g.status)).toEqual(["Declined"]);
    });

    it("keeps an unknown status in a last group, spelled as it arrived", () => {
        const groups = groupClientRequests([request(1, "2026-12-01"), request(2, "2026-12-02", "Expired" as EventRequestStatus)], TODAY);
        expect(groups.map((g) => [g.status, g.appearance.text])).toEqual([
            ["Pending", "Pendiente"],
            ["Expired", "Expired"],
        ]);
    });

    it("returns nothing for an empty list", () => {
        expect(groupClientRequests([], TODAY)).toEqual([]);
    });
});

describe("compareByCreatedAtAsc", () => {
    const message = (id: number, createdAt: string): EventRequestMessage => ({
        id,
        senderUserId: 1,
        senderParty: "Client",
        senderName: "Sofía",
        body: `mensaje ${id}`,
        createdAt,
    });

    it("reads the thread in send order", () => {
        const list = [message(1, "2026-11-01T12:00:00Z"), message(2, "2026-11-01T09:00:00Z"), message(3, "2026-11-01T18:00:00Z")];
        expect([...list].sort(compareByCreatedAtAsc).map((m) => m.id)).toEqual([2, 1, 3]);
    });

    it("breaks a tie on the same timestamp by id", () => {
        const list = [message(7, "2026-11-01T12:00:00Z"), message(3, "2026-11-01T12:00:00Z")];
        expect([...list].sort(compareByCreatedAtAsc).map((m) => m.id)).toEqual([3, 7]);
    });

    it("leaves an unreadable timestamp last", () => {
        const list = [message(1, "not-a-date"), message(2, "2026-11-01T12:00:00Z")];
        expect([...list].sort(compareByCreatedAtAsc).map((m) => m.id)).toEqual([2, 1]);
    });
});
