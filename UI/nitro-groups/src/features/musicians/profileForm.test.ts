import { describe, expect, it } from "vitest";
import {
    HEADLINE_MAX,
    INSTRUMENTS_MAX,
    PROFILE_FIELD_ORDER,
    firstInvalidField,
    profileFormValues,
    toUpdateRequest,
    validateProfileForm,
    type ProfileFormValues,
} from "./profileForm";
import { toMusicianProfile } from "./profileView";
import { SHORT_BIO_MAX } from "@/features/onboarding/rules";

const empty: ProfileFormValues = {
    headline: "",
    shortBio: "",
    instruments: "",
    yearsExperience: "",
    videoUrl: "",
    isOpenToJoin: false,
};

const filled: ProfileFormValues = {
    headline: "Guitarrista de bodas",
    shortBio: "Toco cumbia y bolero.",
    instruments: "Guitarra, bajo",
    yearsExperience: "12",
    videoUrl: "https://youtu.be/abc",
    isOpenToJoin: true,
};

describe("validateProfileForm", () => {
    it("accepts the whole form when it is empty: every field is optional", () => {
        expect(validateProfileForm(empty)).toEqual({});
    });

    it("accepts a filled form", () => {
        expect(validateProfileForm(filled)).toEqual({});
    });

    it("accepts a headline of exactly 120 characters and rejects one more", () => {
        expect(validateProfileForm({ ...empty, headline: "a".repeat(HEADLINE_MAX) })).toEqual({});
        expect(validateProfileForm({ ...empty, headline: "a".repeat(HEADLINE_MAX + 1) })).toEqual({
            headline: `El titular no puede pasar de ${HEADLINE_MAX} caracteres.`,
        });
    });

    it("accepts instruments of exactly 120 characters and rejects one more", () => {
        expect(validateProfileForm({ ...empty, instruments: "a".repeat(INSTRUMENTS_MAX) })).toEqual({});
        expect(validateProfileForm({ ...empty, instruments: "a".repeat(INSTRUMENTS_MAX + 1) })).toEqual({
            instruments: `Los instrumentos no pueden pasar de ${INSTRUMENTS_MAX} caracteres.`,
        });
    });

    it("accepts a short bio of exactly the limit and rejects one more", () => {
        expect(validateProfileForm({ ...empty, shortBio: "a".repeat(SHORT_BIO_MAX) })).toEqual({});
        expect(validateProfileForm({ ...empty, shortBio: "a".repeat(SHORT_BIO_MAX + 1) })).toEqual({
            shortBio: `La biografía no puede pasar de ${SHORT_BIO_MAX} caracteres.`,
        });
    });

    it("accepts zero years of experience", () => {
        expect(validateProfileForm({ ...empty, yearsExperience: "0" })).toEqual({});
        expect(validateProfileForm({ ...empty, yearsExperience: "35" })).toEqual({});
    });

    it("rejects negative, fractional or non-numeric years of experience", () => {
        const message = "Escribe los años de experiencia con un número entero de 0 en adelante.";
        expect(validateProfileForm({ ...empty, yearsExperience: "-1" })).toEqual({ yearsExperience: message });
        expect(validateProfileForm({ ...empty, yearsExperience: "3.5" })).toEqual({ yearsExperience: message });
        expect(validateProfileForm({ ...empty, yearsExperience: "doce" })).toEqual({ yearsExperience: message });
    });

    it("accepts an empty video and a well-formed link, with or without spaces", () => {
        expect(validateProfileForm({ ...empty, videoUrl: "" })).toEqual({});
        expect(validateProfileForm({ ...empty, videoUrl: "https://www.youtube.com/watch?v=abc" })).toEqual({});
        expect(validateProfileForm({ ...empty, videoUrl: "  https://youtu.be/abc  " })).toEqual({});
    });

    it("rejects a malformed video URL", () => {
        const message = "Escribe un enlace que empiece con http:// o https://.";
        expect(validateProfileForm({ ...empty, videoUrl: "youtu.be/abc" })).toEqual({ videoUrl: message });
        expect(validateProfileForm({ ...empty, videoUrl: "mi video" })).toEqual({ videoUrl: message });
        expect(validateProfileForm({ ...empty, videoUrl: "javascript:alert(1)" })).toEqual({ videoUrl: message });
    });

    it("reports every invalid field at once", () => {
        const errors = validateProfileForm({ ...empty, headline: "a".repeat(121), yearsExperience: "-2", videoUrl: "x" });
        expect(Object.keys(errors).sort()).toEqual(["headline", "videoUrl", "yearsExperience"]);
    });
});

describe("firstInvalidField", () => {
    it("returns null when nothing is wrong", () => {
        expect(firstInvalidField({})).toBeNull();
    });

    it("returns the field the user should be sent to first, in reading order", () => {
        expect(firstInvalidField({ yearsExperience: "x", headline: "y" })).toBe("headline");
        expect(firstInvalidField({ videoUrl: "x", instruments: "y" })).toBe("instruments");
        expect(firstInvalidField({ shortBio: "x", videoUrl: "y" })).toBe("videoUrl");
    });

    it("only considers fields that exist in the form", () => {
        expect(PROFILE_FIELD_ORDER).toEqual(["headline", "instruments", "yearsExperience", "videoUrl", "shortBio"]);
    });
});

describe("profileFormValues", () => {
    it("seeds the form from the public profile", () => {
        const profile = toMusicianProfile({
            userId: 7,
            fullName: "Mateo Ruiz",
            headline: "Guitarrista",
            shortBio: "Toco desde los quince.",
            instruments: "Guitarra, bajo",
            yearsExperience: 12,
            videoUrl: "https://youtu.be/abc",
            isOpenToJoin: true,
        });
        expect(profileFormValues(profile)).toEqual({
            headline: "Guitarrista",
            shortBio: "Toco desde los quince.",
            instruments: "Guitarra, bajo",
            yearsExperience: "12",
            videoUrl: "https://youtu.be/abc",
            isOpenToJoin: true,
        });
    });

    it("leaves the gaps empty instead of writing a placeholder", () => {
        const profile = toMusicianProfile({ userId: 9, fullName: "Ana" });
        expect(profileFormValues(profile)).toEqual(empty);
    });
});

describe("toUpdateRequest", () => {
    it("sends the text fields trimmed and the switch as it is", () => {
        expect(toUpdateRequest({ ...filled, headline: "  Guitarrista  " })).toEqual({
            headline: "Guitarrista",
            shortBio: "Toco cumbia y bolero.",
            instruments: "Guitarra, bajo",
            yearsExperience: 12,
            videoUrl: "https://youtu.be/abc",
            isOpenToJoin: true,
        });
    });

    it("sends empty text to clear a field the musician erased", () => {
        expect(toUpdateRequest({ ...filled, headline: "", shortBio: "   ", videoUrl: "" })).toEqual({
            headline: "",
            shortBio: "",
            instruments: "Guitarra, bajo",
            yearsExperience: 12,
            videoUrl: "",
            isOpenToJoin: true,
        });
    });

    it("omits years of experience when the field is empty, so the server keeps what it has", () => {
        const request = toUpdateRequest({ ...filled, yearsExperience: "   " });
        expect("yearsExperience" in request).toBe(false);
    });
});
