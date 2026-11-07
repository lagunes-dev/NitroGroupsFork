/**
 * Api payload → view model for the public musician profile. No React, no network: the page and the
 * dashboard form both read this shape, and every rule here is tested in node.
 */

import { normalizeRole, roleLabel } from "@/features/membership/roles";
import type { MembershipRole } from "@/features/membership/types";
import { isHttpUrl } from "./links";
import type { MusicianGroupRefResponse, MusicianProfileResponse } from "./types";

/** A group the musician plays in, ready to render: role already in Spanish, slug possibly empty. */
export interface MusicianProfileGroup {
    groupId: number;
    groupName: string;
    /** Empty when the API does not send one: the name is then shown without a link. */
    slug: string;
    role: MembershipRole | null;
    roleLabel: string;
}

export interface MusicianProfileView {
    userId: number;
    /** Trimmed; may be empty, and the page then falls back to a neutral title. */
    fullName: string;
    headline: string | null;
    shortBio: string | null;
    instruments: string[];
    yearsExperience: number | null;
    photoUrl: string | null;
    /** Only ever an http(s) link, so it is safe in an `href`. */
    videoUrl: string | null;
    isOpenToJoin: boolean;
    groups: MusicianProfileGroup[];
}

/** Blank and whitespace-only text is absence, not a value. */
function text(value: string | null | undefined): string | null {
    const trimmed = (value ?? "").trim();
    return trimmed === "" ? null : trimmed;
}

/** "Guitarra, bajo; teclado" → ["Guitarra", "bajo", "teclado"], without duplicates. */
export function splitInstruments(value: string | null | undefined): string[] {
    const seen = new Set<string>();
    return (value ?? "")
        .split(/[,;/\n]+/)
        .map((part) => part.trim())
        .filter((part) => {
            const key = part.toLocaleLowerCase("es-MX");
            if (!part || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

function years(value: number | null | undefined): number | null {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
    return Math.trunc(value);
}

function toGroup(raw: MusicianGroupRefResponse): MusicianProfileGroup | null {
    const groupId = raw.groupId;
    const groupName = text(raw.groupName);
    if (!Number.isInteger(groupId) || groupId <= 0 || !groupName) return null;
    const role: MembershipRole | null = normalizeRole(raw.role);
    return { groupId, groupName, slug: (raw.slug ?? "").trim(), role, roleLabel: roleLabel(role) };
}

export function toMusicianProfile(payload: MusicianProfileResponse): MusicianProfileView {
    const videoUrl = text(payload.videoUrl);
    return {
        userId: payload.userId,
        fullName: (payload.fullName ?? "").trim(),
        headline: text(payload.headline),
        shortBio: text(payload.shortBio),
        instruments: splitInstruments(payload.instruments),
        yearsExperience: years(payload.yearsExperience),
        photoUrl: text(payload.profilePictureUrl),
        videoUrl: videoUrl && isHttpUrl(videoUrl) ? videoUrl : null,
        // Only an explicit true counts: a missing switch never opens the profile to invitations.
        isOpenToJoin: payload.isOpenToJoin === true,
        groups: (payload.groups ?? []).map(toGroup).filter((g): g is MusicianProfileGroup => g !== null),
    };
}

/** `/musicians/42` → 42. Anything that is not a real id (0, negative, decimals, text) → null, i.e. a 404. */
export function parseMusicianId(raw: string | undefined): number | null {
    const value = (raw ?? "").trim();
    if (!/^[1-9]\d*$/.test(value)) return null;
    const id = Number(value);
    return Number.isSafeInteger(id) ? id : null;
}

/** "a, b y c": the list read as a sentence, never "a,b,c". */
export function naturalList(items: string[]): string {
    if (items.length <= 1) return items.join("");
    return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

/** What the musician can still add for the public profile to say everything a group needs. */
export const PROFILE_GAP_LABELS = {
    photoUrl: "una foto",
    instruments: "tus instrumentos",
    yearsExperience: "tus años de experiencia",
    shortBio: "una biografía corta",
    videoUrl: "un video",
} as const;

/**
 * The dashboard hint: an incomplete profile is not an error, it just leaves questions open.
 * Order matches the order of the fields in the form.
 */
export function profileGaps(profile: MusicianProfileView): { complete: boolean; missing: string[] } {
    const missing: string[] = [];
    if (!profile.photoUrl) missing.push(PROFILE_GAP_LABELS.photoUrl);
    if (profile.instruments.length === 0) missing.push(PROFILE_GAP_LABELS.instruments);
    if (profile.yearsExperience === null) missing.push(PROFILE_GAP_LABELS.yearsExperience);
    if (!profile.shortBio) missing.push(PROFILE_GAP_LABELS.shortBio);
    if (!profile.videoUrl) missing.push(PROFILE_GAP_LABELS.videoUrl);
    return { complete: missing.length === 0, missing };
}
