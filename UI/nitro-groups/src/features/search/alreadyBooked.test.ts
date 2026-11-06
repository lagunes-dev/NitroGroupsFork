import { describe, expect, it } from "vitest";
import { alreadyBooked } from "./alreadyBooked";
import type { EventRequest } from "@/features/bookings/types";

const base = {
    id: 8,
    groupId: 1,
    groupName: "Versátil Rock y Pop",
    groupSlug: "versatil-rock-y-pop",
    clientName: "Camila Ramos",
    eventDate: "2026-11-19",
    startTime: "20:00:00",
    durationHours: 3,
    eventType: "Boda",
    locationText: "Hacienda San Gabriel",
    guestCount: 120,
    budget: 18000,
    currency: "MXN",
    message: "Boda.",
    status: "Accepted" as const,
    isSelfBooked: false,
    createdAt: "2026-10-01T18:00:00Z",
    respondedAt: "2026-10-02T18:00:00Z",
    responseMessage: null,
};

describe("alreadyBooked", () => {
    it("returns the pieces of the note: group, its profile, the day and the request", () => {
        expect(alreadyBooked([base as EventRequest], "2026-11-19")).toEqual({
            groupName: "Versátil Rock y Pop",
            groupSlug: "versatil-rock-y-pop",
            requestId: 8,
            day: "jueves, 19 de noviembre de 2026",
        });
    });

    it("stays quiet when the request is not accepted or not that day", () => {
        expect(alreadyBooked([{ ...base, status: "Pending" } as EventRequest], "2026-11-19")).toBeNull();
        expect(alreadyBooked([base as EventRequest], "2026-11-20")).toBeNull();
    });

    it("stays quiet without a date, without a session or without requests", () => {
        expect(alreadyBooked([base as EventRequest], null)).toBeNull();
        expect(alreadyBooked(null, "2026-11-19")).toBeNull();
        expect(alreadyBooked([], "2026-11-19")).toBeNull();
    });
});
