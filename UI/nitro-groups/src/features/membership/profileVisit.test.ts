import { describe, expect, it } from "vitest";
import { toProfileVisitsView, visitGroupToRecord } from "./profileVisit";
import type { ProfileVisits } from "./types";

const groups = [
    { id: 7, groupName: "Los Vargas", slug: "los-vargas", lastVisitedAt: "2026-11-05T18:00:00Z" },
    { id: 3, groupName: "Mariachi Oro", slug: "mariachi-oro", lastVisitedAt: "2026-11-04T18:00:00Z" },
];

const summary = (count: number, rows = groups): ProfileVisits => ({ count, groups: rows });

describe("toProfileVisitsView", () => {
    it("names the groups that looked, in the order they arrived", () => {
        expect(toProfileVisitsView(summary(2))).toEqual({ headline: "2 grupos miraron tu perfil", groups });
    });

    it("uses the singular for one group", () => {
        expect(toProfileVisitsView(summary(1, [groups[0]]))?.headline).toBe("1 grupo miró tu perfil");
    });

    it("says nothing at all when no group looked", () => {
        // Un músico sin visitas ve que la función existe: antes el bloque no se dibujaba y no
        // sabía que su perfil se podía mirar (ronda 4, Mateo).
        const empty = toProfileVisitsView(summary(0, []));
        expect(empty?.headline).toBe("Ningún grupo miró tu perfil todavía");
        expect(empty?.groups).toEqual([]);
        expect(toProfileVisitsView(undefined)).toBeNull();
        expect(toProfileVisitsView(null)).toBeNull();
    });

    it("ignores a count that is not a real number of groups", () => {
        expect(toProfileVisitsView(summary(-1))).toBeNull();
        expect(toProfileVisitsView(summary(Number.NaN))).toBeNull();
        expect(toProfileVisitsView(summary(1.5))).toBeNull();
    });

    it("shows nothing when there are names to show but no groups behind the count", () => {
        expect(toProfileVisitsView(summary(2, []))).toBeNull();
    });
});

describe("visitGroupToRecord", () => {
    const musician = { id: 10, userType: "Musician" } as const;

    it("records the managed group when a manager opens someone else's profile", () => {
        expect(visitGroupToRecord({ viewer: musician, managedGroupId: 3, musicianUserId: 20 })).toBe(3);
    });

    it("does not record a manager's visit to his own profile", () => {
        expect(visitGroupToRecord({ viewer: musician, managedGroupId: 3, musicianUserId: 10 })).toBeNull();
    });

    it("does not record anything without a managed group", () => {
        expect(visitGroupToRecord({ viewer: musician, managedGroupId: null, musicianUserId: 20 })).toBeNull();
        expect(visitGroupToRecord({ viewer: null, managedGroupId: 3, musicianUserId: 20 })).toBeNull();
    });

    it("does not record a client's visit: clients do not look for musicians", () => {
        expect(visitGroupToRecord({ viewer: { id: 11, userType: "Client" }, managedGroupId: 3, musicianUserId: 20 })).toBeNull();
    });
});
