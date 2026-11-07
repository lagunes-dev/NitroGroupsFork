import { describe, expect, it } from "vitest";
import {
    PUBLIC_TEAM_EMPTY,
    PUBLIC_TEAM_HEADING,
    UNKNOWN_PUBLIC_MEMBER_NAME,
    publicTeamCountLabel,
    toPublicTeamView,
} from "./publicTeam";
import type { PublicGroupTeamMember } from "../types/PublicGroupTeamMember";

const member = (over: Partial<PublicGroupTeamMember> = {}): PublicGroupTeamMember => ({
    userId: 10,
    fullName: "Olga Ortiz",
    role: "Owner",
    instruments: null,
    city: null,
    ...over,
});

describe("toPublicTeamView", () => {
    it("maps a public row with the Spanish role, the profile link and the craft line", () => {
        expect(toPublicTeamView([member({ instruments: "Bajo", city: "Guadalajara, Jalisco" })])).toEqual([
            {
                userId: 10,
                fullName: "Olga Ortiz",
                roleLabel: "Dueño",
                profileHref: "/musicians/10",
                craftLabel: "Bajo · Guadalajara, Jalisco",
            },
        ]);
    });

    it("keeps the order the API promises instead of inventing a second one", () => {
        const rows = [member({ userId: 10, role: "Owner" }), member({ userId: 11, role: "Manager" }), member({ userId: 12, role: "Member" })];

        expect(toPublicTeamView(rows).map((row) => row.userId)).toEqual([10, 11, 12]);
    });

    it("trims the name", () => {
        expect(toPublicTeamView([member({ fullName: "  Olga Ortiz \n" })])[0].fullName).toBe("Olga Ortiz");
    });

    it.each([
        ["Owner", "Dueño"],
        ["Manager", "Manager"],
        ["Member", "Miembro"],
        [0, "Dueño"],
        [1, "Miembro"],
        [2, "Manager"],
    ])("labels the role %s as %s", (role, label) => {
        expect(toPublicTeamView([member({ role })])[0].roleLabel).toBe(label);
    });

    it.each(["Mystery", "", null, undefined, 9, -1])("reads the unknown role %s as a plain member", (role) => {
        expect(toPublicTeamView([member({ role })])[0].roleLabel).toBe("Miembro");
    });

    it.each([
        ["Bajo", null, "Bajo"],
        [null, "Guadalajara, Jalisco", "Guadalajara, Jalisco"],
        ["  Bajo ", "  Zapopan, Jalisco ", "Bajo · Zapopan, Jalisco"],
        [null, null, null],
        ["", "   ", null],
    ])("builds the craft line from %s and %s", (instruments, city, craftLabel) => {
        expect(toPublicTeamView([member({ instruments, city })])[0].craftLabel).toBe(craftLabel);
    });

    it("treats a closed profile (no instruments and no city) as a row without craft", () => {
        // El backend calla el oficio de quien cerró su perfil: el renglón no inventa nada.
        const [view] = toPublicTeamView([member({ fullName: "Nadia Nava", instruments: null, city: null })]);

        expect(view).toMatchObject({ fullName: "Nadia Nava", roleLabel: "Dueño", craftLabel: null });
    });

    it("names a row that arrived without a name", () => {
        expect(toPublicTeamView([member({ fullName: "   " })])[0].fullName).toBe(UNKNOWN_PUBLIC_MEMBER_NAME);
    });

    it("links the profile only for a real positive integer id", () => {
        expect(toPublicTeamView([member({ userId: 42 })])[0].profileHref).toBe("/musicians/42");
        for (const userId of [0, -3, 1.5, Number.NaN, null as unknown as number, "10" as unknown as number]) {
            expect(toPublicTeamView([member({ userId })])[0].profileHref).toBeNull();
        }
    });

    it("returns no rows for an empty team", () => {
        expect(toPublicTeamView([])).toEqual([]);
    });
});

describe("public team copy", () => {
    it("titles the section in plain Spanish", () => {
        expect(PUBLIC_TEAM_HEADING).toBe("El equipo");
    });

    it("explains an empty team in one line", () => {
        expect(PUBLIC_TEAM_EMPTY).toBe("Todavía no hay integrantes para mostrar.");
    });

    it.each([
        [0, "Ningún músico en el equipo"],
        [1, "1 músico en el equipo"],
        [5, "5 músicos en el equipo"],
    ])("summarizes %s rows", (count, label) => {
        expect(publicTeamCountLabel(count)).toBe(label);
    });
});
