import { Check, CircleHelp, X, type LucideIcon } from "lucide-react";
import type { GigAnswer } from "./types";

/** Chip tone. The colour never travels alone: the chip always carries an icon and a word. */
export type AttendanceTone = "ok" | "error" | "muted";

/** How one answer reads and looks: the word, the tone and the icon. */
export interface AttendanceAppearance {
    /** The answer this version understands, or null when nobody answered or we do not know the value. */
    status: GigAnswer | null;
    text: string;
    tone: AttendanceTone;
    icon: LucideIcon;
}

const KNOWN: Record<GigAnswer, AttendanceAppearance> = {
    Confirmed: { status: "Confirmed", text: "Confirmado", tone: "ok", icon: Check },
    Declined: { status: "Declined", text: "No puedo ir", tone: "error", icon: X },
};

const UNANSWERED: AttendanceAppearance = { status: null, text: "Sin responder", tone: "muted", icon: CircleHelp };

/**
 * Presentation of the caller's answer. A status we do not know prints as it arrived in a neutral
 * tone, so a new value never disguises itself as a confirmation.
 */
export function attendanceAppearance(value: unknown): AttendanceAppearance {
    const raw = typeof value === "string" ? value.trim() : "";
    if (!raw) return UNANSWERED;
    return KNOWN[raw as GigAnswer] ?? { status: null, text: raw, tone: "muted", icon: CircleHelp };
}
