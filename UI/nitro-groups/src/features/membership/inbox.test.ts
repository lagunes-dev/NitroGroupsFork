import { describe, expect, it } from "vitest";
import { musicianActions, splitGroupRequests, splitMyRequests } from "./inbox";
import type { MembershipRequest } from "./types";

const row = (over: Partial<MembershipRequest>): MembershipRequest => ({
    id: 1, groupId: 3, groupName: "Los Arcos", groupSlug: "los-arcos", musicianUserId: 9, musicianName: "Ana",
    initiatedByUserId: 2, direction: "Invitation", status: "Pending", message: null, resolvedByUserId: null,
    createdAt: "2026-01-01T00:00:00Z", updatedAt: null, counterpartName: "Los Arcos", ...over,
});

describe("splitMyRequests", () => {
    it("separates pending invitations received from pending requests sent", () => {
        const rows = [
            row({ id: 1, direction: "Invitation" }),
            row({ id: 2, direction: "Request" }),
            row({ id: 3, direction: "Invitation" }),
        ];
        const { received, sent, history } = splitMyRequests(rows);
        expect(received.map((r) => r.id)).toEqual([1, 3]);
        expect(sent.map((r) => r.id)).toEqual([2]);
        expect(history).toEqual([]);
    });
    it("moves everything resolved to history, newest resolution first", () => {
        const rows = [
            row({ id: 1, status: "Accepted", updatedAt: "2026-02-01T00:00:00Z" }),
            row({ id: 2, direction: "Request", status: "Cancelled", updatedAt: "2026-03-01T00:00:00Z" }),
            row({ id: 3, status: "Declined", updatedAt: null, createdAt: "2026-01-15T00:00:00Z" }),
        ];
        const { received, sent, history } = splitMyRequests(rows);
        expect(received).toEqual([]);
        expect(sent).toEqual([]);
        expect(history.map((r) => r.id)).toEqual([2, 1, 3]);
    });
    it("treats an unknown status as history, never as pending", () => {
        expect(splitMyRequests([row({ status: null })]).history).toHaveLength(1);
    });
    it("returns empty groups for an empty list", () => {
        expect(splitMyRequests([])).toEqual({ received: [], sent: [], history: [] });
    });
});

describe("musicianActions", () => {
    it("a pending invitation can be accepted or declined, not cancelled", () => {
        expect(musicianActions(row({ direction: "Invitation", status: "Pending" }))).toEqual({ accept: true, decline: true, cancel: false });
    });
    it("a pending request can only be cancelled", () => {
        expect(musicianActions(row({ direction: "Request", status: "Pending" }))).toEqual({ accept: false, decline: false, cancel: true });
    });
    it("resolved rows have no actions", () => {
        expect(musicianActions(row({ status: "Accepted" }))).toEqual({ accept: false, decline: false, cancel: false });
    });
});

describe("splitGroupRequests", () => {
    const rows = [
        row({ id: 1, direction: "Request", status: "Pending" }),
        row({ id: 2, direction: "Invitation", status: "Pending" }),
        row({ id: 3, direction: "Request", status: "Declined", updatedAt: "2026-02-01T00:00:00Z" }),
        row({ id: 4, direction: "Request", status: "Accepted", updatedAt: "2026-03-01T00:00:00Z" }),
        row({ id: 5, direction: "Invitation", status: "Cancelled" }),
    ];
    it("splits join requests and sent invitations, pending first", () => {
        const { incoming, invitations } = splitGroupRequests(rows);
        expect(incoming.pending.map((r) => r.id)).toEqual([1]);
        expect(invitations.pending.map((r) => r.id)).toEqual([2]);
        expect(invitations.history.map((r) => r.id)).toEqual([5]);
    });
    it("orders each history newest first", () => {
        expect(splitGroupRequests(rows).incoming.history.map((r) => r.id)).toEqual([4, 3]);
    });
    it("sends rows with an unknown direction or status to no pending list", () => {
        const odd = [row({ id: 7, direction: null }), row({ id: 8, status: null })];
        const { incoming, invitations } = splitGroupRequests(odd);
        expect(incoming.pending).toEqual([]);
        expect(invitations.pending).toEqual([]);
    });
});
