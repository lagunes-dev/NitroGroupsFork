import { describe, expect, it } from "vitest";
import { UNKNOWN_MEMBER_NAME, orderTeam, teamCountLabel, teamHeadingLabel, teamQueryKey, toTeamView } from "./team";
import type { GroupTeamMember } from "./types";

const member = (over: Partial<GroupTeamMember> = {}): GroupTeamMember => ({
    userId: 10,
    fullName: "Olga Ortiz",
    role: "Owner",
    profilePictureUrl: null,
    joinedAt: "2026-10-04T18:00:00Z",
    ...over,
});

describe("toTeamView", () => {
    it("maps a team row with the Spanish role and its profile link", () => {
        expect(toTeamView([member({ profilePictureUrl: "https://x/y.png" })])).toEqual([
            {
                userId: 10,
                fullName: "Olga Ortiz",
                role: "Owner",
                roleLabel: "Dueño",
                profileHref: "/musicians/10",
                profilePictureUrl: "https://x/y.png",
                joinedLabel: "Se unió el 4 de octubre de 2026",
                joinedAt: "2026-10-04T18:00:00Z",
                craftLabel: null,
            },
        ]);
    });

    it("trims the name", () => {
        expect(toTeamView([member({ fullName: "  Olga Ortiz \n" })])[0].fullName).toBe("Olga Ortiz");
    });

    it.each([
        ["Owner", "Dueño"],
        ["Manager", "Manager"],
        ["Member", "Miembro"],
        [0, "Dueño"],
        [1, "Miembro"],
        [2, "Manager"],
    ])("labels the role %s as %s", (role, label) => {
        expect(toTeamView([member({ role })])[0].roleLabel).toBe(label);
    });

    it.each(["Mystery", "", null, undefined, 9, -1])("falls back to Miembro for the unknown role %s", (role) => {
        expect(toTeamView([member({ role })])[0]).toMatchObject({ role: null, roleLabel: "Miembro" });
    });

    it("names a row whose user has no name", () => {
        const [view] = toTeamView([member({ fullName: "   " })]);
        expect(view.fullName).toBe(UNKNOWN_MEMBER_NAME);
    });

    it("links the profile only for a real positive integer id", () => {
        expect(toTeamView([member({ userId: 42 })])[0].profileHref).toBe("/musicians/42");
        for (const userId of [0, -3, 1.5, Number.NaN, null as unknown as number, "10" as unknown as number]) {
            expect(toTeamView([member({ userId })])[0].profileHref).toBeNull();
        }
    });

    it("keeps the row when the join date cannot be read", () => {
        for (const joinedAt of ["no-es-fecha", "", null as unknown as string]) {
            expect(toTeamView([member({ joinedAt })])[0]).toMatchObject({
                fullName: "Olga Ortiz",
                joinedLabel: null,
                joinedAt: null,
            });
        }
    });

    it("has no rows without data", () => {
        expect(toTeamView([])).toEqual([]);
    });
});

describe("orderTeam", () => {
    it("puts the owner first, then the managers, then the members", () => {
        const rows = [
            member({ userId: 1, role: "Member", joinedAt: "2025-01-01T00:00:00Z" }),
            member({ userId: 2, role: "Manager", joinedAt: "2025-06-01T00:00:00Z" }),
            member({ userId: 3, role: "Owner", joinedAt: "2026-01-01T00:00:00Z" }),
        ];
        expect(orderTeam(rows).map((r) => r.userId)).toEqual([3, 2, 1]);
    });

    it("keeps the oldest membership first inside the same role", () => {
        const rows = [
            member({ userId: 1, role: "Member", joinedAt: "2026-03-01T00:00:00Z" }),
            member({ userId: 2, role: "Member", joinedAt: "2025-01-01T00:00:00Z" }),
            member({ userId: 3, role: "Member", joinedAt: "2026-02-01T00:00:00Z" }),
        ];
        expect(orderTeam(rows).map((r) => r.userId)).toEqual([2, 3, 1]);
    });

    it("ranks an unknown role as a plain member", () => {
        const rows = [member({ userId: 1, role: "Mystery" }), member({ userId: 2, role: "Owner" })];
        expect(orderTeam(rows).map((r) => r.userId)).toEqual([2, 1]);
    });

    it("sends an unreadable join date to the end of its role and keeps the order stable", () => {
        const rows = [
            member({ userId: 1, role: "Member", joinedAt: "no-es-fecha" }),
            member({ userId: 2, role: "Member", joinedAt: "2026-01-01T00:00:00Z" }),
            member({ userId: 3, role: "Member", joinedAt: "" }),
        ];
        expect(orderTeam(rows).map((r) => r.userId)).toEqual([2, 1, 3]);
    });

    it("does not touch the rows it receives", () => {
        const rows = [member({ userId: 1, role: "Member" }), member({ userId: 2, role: "Owner" })];
        const before = rows.map((r) => r.userId);
        orderTeam(rows);
        expect(rows.map((r) => r.userId)).toEqual(before);
    });
});

describe("section labels", () => {
    it("counts the members in the heading", () => {
        expect(teamHeadingLabel(4)).toBe("El equipo (4)");
        expect(teamHeadingLabel(0)).toBe("El equipo (0)");
    });

    it("describes the amount in singular and plural", () => {
        expect(teamCountLabel(1)).toBe("1 músico en el equipo");
        expect(teamCountLabel(4)).toBe("4 músicos en el equipo");
        expect(teamCountLabel(0)).toBe("Ningún músico en el equipo");
    });
});

describe("teamQueryKey", () => {
    it("scopes the team query to one group", () => {
        expect(teamQueryKey(7)).toEqual(["group-team", 7]);
    });
});

describe("craftLabel", () => {
    const base = { userId: 12, fullName: "Beto Bravo", role: "Member", profilePictureUrl: null, joinedAt: "2026-10-04T18:00:00Z" };

    it("says what the musician plays and where he lives", () => {
        expect(toTeamView([{ ...base, instruments: "Bajo", city: "Guadalajara, Jalisco" }])[0].craftLabel).toBe(
            "Bajo · Guadalajara, Jalisco"
        );
        expect(toTeamView([{ ...base, instruments: "Bajo", city: null }])[0].craftLabel).toBe("Bajo");
        expect(toTeamView([{ ...base, instruments: "  ", city: "Puebla, Puebla" }])[0].craftLabel).toBe("Puebla, Puebla");
    });

    it("stays empty when the musician has not loaded his profile", () => {
        expect(toTeamView([{ ...base, instruments: null, city: null }])[0].craftLabel).toBeNull();
        expect(toTeamView([base])[0].craftLabel).toBeNull();
    });
});
