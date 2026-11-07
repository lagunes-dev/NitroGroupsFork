/**
 * Rules of the musician profile form ("Mi perfil"). Pure functions, no React and no network: the
 * component only paints what these return, and every rule is tested in node.
 */

import { SHORT_BIO_MAX } from "@/features/onboarding/rules";
import { isHttpUrl } from "./links";
import type { MusicianProfileUpdateRequest } from "./types";
import type { MusicianProfileView } from "./profileView";

/** Column limit of `musicians.headline`. */
export const HEADLINE_MAX = 120;
/** Column limit of `musicians.instruments`. */
export const INSTRUMENTS_MAX = 120;
/** Column limit of `musicians.city`. */
export const CITY_MAX = 80;
export { SHORT_BIO_MAX };

export type ProfileField = "headline" | "instruments" | "city" | "yearsExperience" | "videoUrl" | "shortBio";

/** Reading order of the form; the first invalid field in this list takes the focus. */
export const PROFILE_FIELD_ORDER: readonly ProfileField[] = [
    "headline",
    "instruments",
    "city",
    "yearsExperience",
    "videoUrl",
    "shortBio",
];

export type ProfileErrors = Partial<Record<ProfileField, string>>;

/** The form keeps raw text (that is what an input holds) and converts on submit. */
export interface ProfileFormValues {
    headline: string;
    shortBio: string;
    instruments: string;
    city: string;
    /** Raw text of a number field: empty means "no lo digo", which is not zero. */
    yearsExperience: string;
    videoUrl: string;
    isOpenToJoin: boolean;
}

/** The current public profile becomes the starting point of the form. */
export function profileFormValues(profile: MusicianProfileView): ProfileFormValues {
    return {
        headline: profile.headline ?? "",
        shortBio: profile.shortBio ?? "",
        instruments: profile.instruments.join(", "),
        city: profile.city ?? "",
        yearsExperience: profile.yearsExperience === null ? "" : String(profile.yearsExperience),
        videoUrl: profile.videoUrl ?? "",
        isOpenToJoin: profile.isOpenToJoin,
    };
}

const YEARS_MESSAGE = "Escribe los años de experiencia con un número entero de 0 en adelante.";
const VIDEO_MESSAGE = "Escribe un enlace que empiece con http:// o https://.";

/**
 * Every field is optional; each rule only fires when the musician wrote something.
 * Limits are checked on the raw text, the same text the counter shows.
 */
export function validateProfileForm(values: ProfileFormValues): ProfileErrors {
    const errors: ProfileErrors = {};

    if (values.headline.length > HEADLINE_MAX) {
        errors.headline = `El titular no puede pasar de ${HEADLINE_MAX} caracteres.`;
    }
    if (values.instruments.length > INSTRUMENTS_MAX) {
        errors.instruments = `Los instrumentos no pueden pasar de ${INSTRUMENTS_MAX} caracteres.`;
    }

    if (values.city.length > CITY_MAX) {
        errors.city = `La ciudad no puede pasar de ${CITY_MAX} caracteres.`;
    }

    const years = values.yearsExperience.trim();
    if (years !== "" && !/^\d+$/.test(years)) {
        errors.yearsExperience = YEARS_MESSAGE;
    }

    const video = values.videoUrl.trim();
    if (video !== "" && !isHttpUrl(video)) {
        errors.videoUrl = VIDEO_MESSAGE;
    }

    if (values.shortBio.length > SHORT_BIO_MAX) {
        errors.shortBio = `La biografía no puede pasar de ${SHORT_BIO_MAX} caracteres.`;
    }

    return errors;
}

/** The field that should take the focus after a rejected submit, or null when the form is valid. */
export function firstInvalidField(errors: ProfileErrors): ProfileField | null {
    return PROFILE_FIELD_ORDER.find((field) => errors[field] !== undefined) ?? null;
}

/**
 * Body of `PUT api/musicians/me`. The endpoint replaces the editable profile, so an erased text
 * field travels as "" (it clears it); years of experience is left out while it is empty so the
 * server keeps the stored value instead of reading it as zero.
 */
export function toUpdateRequest(values: ProfileFormValues): MusicianProfileUpdateRequest {
    const years = values.yearsExperience.trim();
    const request: MusicianProfileUpdateRequest = {
        headline: values.headline.trim(),
        shortBio: values.shortBio.trim(),
        instruments: values.instruments.trim(),
        city: values.city.trim(),
        videoUrl: values.videoUrl.trim(),
        isOpenToJoin: values.isOpenToJoin,
    };
    if (years !== "") request.yearsExperience = Number(years);
    return request;
}
