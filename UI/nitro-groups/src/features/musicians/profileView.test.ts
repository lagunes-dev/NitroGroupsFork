import { describe, expect, it } from "vitest";
import { naturalList, parseMusicianId, profileGaps, splitInstruments, toMusicianProfile } from "./profileView";
import type { MusicianProfileResponse } from "./types";

const full: MusicianProfileResponse = {
    userId: 7,
    fullName: "Mateo Ruiz",
    headline: "Guitarrista de bodas y eventos",
    shortBio: "Toco desde los quince.\n\nCumbia, bolero y rock.",
    instruments: "Guitarra, bajo",
    city: " Guadalajara ",
    yearsExperience: 12,
    profilePictureUrl: "https://cdn.example.com/mateo.jpg",
    videoUrl: "https://www.youtube.com/watch?v=abc",
    isOpenToJoin: true,
    groups: [
        { groupId: 3, groupName: "Los Relámpagos", slug: "los-relampagos", role: "Owner" },
        { groupId: 5, groupName: "Trío Aurora", slug: "trio-aurora", role: "Member" },
    ],
};

describe("toMusicianProfile", () => {
    it("maps a complete payload to the view model", () => {
        expect(toMusicianProfile(full)).toEqual({
            userId: 7,
            fullName: "Mateo Ruiz",
            headline: "Guitarrista de bodas y eventos",
            shortBio: "Toco desde los quince.\n\nCumbia, bolero y rock.",
            instruments: ["Guitarra", "bajo"],
            city: "Guadalajara",
            yearsExperience: 12,
            photoUrl: "https://cdn.example.com/mateo.jpg",
            videoUrl: "https://www.youtube.com/watch?v=abc",
            isOpenToJoin: true,
            groups: [
                { groupId: 3, groupName: "Los Relámpagos", slug: "los-relampagos", role: "Owner", roleLabel: "Dueño" },
                { groupId: 5, groupName: "Trío Aurora", slug: "trio-aurora", role: "Member", roleLabel: "Miembro" },
            ],
        });
    });

    it("turns missing, null and blank fields into null instead of fake data", () => {
        const view = toMusicianProfile({ userId: 9, fullName: "  Ana López  " });
        expect(view.fullName).toBe("Ana López");
        expect(view.headline).toBeNull();
        expect(view.shortBio).toBeNull();
        expect(view.instruments).toEqual([]);
        expect(view.yearsExperience).toBeNull();
        expect(view.city).toBeNull();
        expect(view.photoUrl).toBeNull();
        expect(view.videoUrl).toBeNull();
        expect(view.groups).toEqual([]);
        expect(view.isOpenToJoin).toBe(false);
    });

    it("treats a blank city as absent", () => {
        expect(toMusicianProfile({ userId: 1, fullName: "Sol", city: "  " }).city).toBeNull();
    });

    it("treats whitespace-only text as empty", () => {
        const view = toMusicianProfile({ userId: 1, fullName: "Sol", headline: "   ", shortBio: "\n  \n", instruments: " , " });
        expect(view.headline).toBeNull();
        expect(view.shortBio).toBeNull();
        expect(view.instruments).toEqual([]);
    });

    it("keeps zero years of experience, which is a real answer", () => {
        expect(toMusicianProfile({ userId: 1, fullName: "Sol", yearsExperience: 0 }).yearsExperience).toBe(0);
    });

    it("drops a negative or non-finite years of experience", () => {
        expect(toMusicianProfile({ userId: 1, fullName: "Sol", yearsExperience: -3 }).yearsExperience).toBeNull();
        expect(toMusicianProfile({ userId: 1, fullName: "Sol", yearsExperience: Number.NaN }).yearsExperience).toBeNull();
        expect(toMusicianProfile({ userId: 1, fullName: "Sol", yearsExperience: 7.8 }).yearsExperience).toBe(7);
    });

    it("refuses a video link that is not http(s), so it can never become a javascript: link", () => {
        expect(toMusicianProfile({ userId: 1, fullName: "Sol", videoUrl: "javascript:alert(1)" }).videoUrl).toBeNull();
        expect(toMusicianProfile({ userId: 1, fullName: "Sol", videoUrl: "mi video" }).videoUrl).toBeNull();
        expect(toMusicianProfile({ userId: 1, fullName: "Sol", videoUrl: " https://youtu.be/abc " }).videoUrl).toBe("https://youtu.be/abc");
    });

    it("maps an unknown role to no role, never to an invented one", () => {
        const view = toMusicianProfile({
            userId: 1,
            fullName: "Sol",
            groups: [{ groupId: 2, groupName: "Banda Sol", slug: "banda-sol", role: "Superstar" }],
        });
        expect(view.groups).toEqual([
            { groupId: 2, groupName: "Banda Sol", slug: "banda-sol", role: null, roleLabel: "Miembro" },
        ]);
    });

    it("keeps a group with no slug, so the name is still readable", () => {
        const view = toMusicianProfile({
            userId: 1,
            fullName: "Sol",
            groups: [{ groupId: 2, groupName: " Banda Sol ", slug: "  ", role: "Manager" }],
        });
        expect(view.groups).toEqual([
            { groupId: 2, groupName: "Banda Sol", slug: "", role: "Manager", roleLabel: "Manager" },
        ]);
    });

    it("drops a group row with no id or no name", () => {
        const view = toMusicianProfile({
            userId: 1,
            fullName: "Sol",
            groups: [
                { groupId: 0, groupName: "Fantasma", slug: "fantasma", role: "Member" },
                { groupId: 4, groupName: "   ", slug: "sin-nombre", role: "Member" },
                { groupId: 6, groupName: "Real", slug: "real", role: "Member" },
            ] as MusicianProfileResponse["groups"],
        });
        expect(view.groups.map((g) => g.groupName)).toEqual(["Real"]);
    });
});

describe("splitInstruments", () => {
    it("splits on commas, semicolons, slashes and newlines", () => {
        expect(splitInstruments("Guitarra, bajo; batería / teclado\nvoz")).toEqual([
            "Guitarra",
            "bajo",
            "batería",
            "teclado",
            "voz",
        ]);
    });

    it("removes duplicates that differ only in case, and keeps the first spelling", () => {
        expect(splitInstruments("Guitarra, guitarra, GUITARRA")).toEqual(["Guitarra"]);
    });

    it("returns an empty list for an empty value", () => {
        expect(splitInstruments("")).toEqual([]);
        expect(splitInstruments(null)).toEqual([]);
        expect(splitInstruments("  ,  ")).toEqual([]);
    });
});

describe("parseMusicianId", () => {
    it("reads a positive integer out of the route", () => {
        expect(parseMusicianId("42")).toBe(42);
        expect(parseMusicianId(" 7 ")).toBe(7);
    });

    it("rejects anything that is not a public musician id", () => {
        expect(parseMusicianId(undefined)).toBeNull();
        expect(parseMusicianId("")).toBeNull();
        expect(parseMusicianId("0")).toBeNull();
        expect(parseMusicianId("-3")).toBeNull();
        expect(parseMusicianId("4.5")).toBeNull();
        expect(parseMusicianId("mateo")).toBeNull();
        expect(parseMusicianId("042")).toBeNull();
    });
});

describe("naturalList", () => {
    it("joins the gaps the way people write them", () => {
        expect(naturalList([])).toBe("");
        expect(naturalList(["una foto"])).toBe("una foto");
        expect(naturalList(["una foto", "un video"])).toBe("una foto y un video");
        expect(naturalList(["una foto", "un video", "tus instrumentos"])).toBe("una foto, un video y tus instrumentos");
    });
});

describe("profileGaps", () => {
    it("lists what the public profile is still missing", () => {
        const view = toMusicianProfile({ userId: 1, fullName: "Sol", headline: "Cantante" });
        expect(profileGaps(view)).toEqual({
            complete: false,
            missing: ["una foto", "tus instrumentos", "tus años de experiencia", "una biografía corta", "un video"],
        });
    });

    it("reports a complete profile when every optional piece is there", () => {
        expect(profileGaps(toMusicianProfile(full))).toEqual({ complete: true, missing: [] });
    });

    it("does not count the open-to-join switch as a missing piece", () => {
        const complete = toMusicianProfile(full);
        expect(profileGaps({ ...complete, isOpenToJoin: false }).complete).toBe(true);
    });
});
