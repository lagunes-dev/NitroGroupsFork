import { describe, expect, it } from "vitest";
import { attendanceAppearance } from "./attendance";

describe("attendanceAppearance", () => {
    it("reads a confirmed answer as confirmed, with the ok tone", () => {
        expect(attendanceAppearance("Confirmed")).toMatchObject({ status: "Confirmed", text: "Confirmado", tone: "ok" });
    });

    it("reads a declined answer with its own words and tone", () => {
        expect(attendanceAppearance("Declined")).toMatchObject({ status: "Declined", text: "No puedo ir", tone: "error" });
    });

    it("reads no answer as unanswered, not as a decline", () => {
        expect(attendanceAppearance(null)).toMatchObject({ status: null, text: "Sin responder", tone: "muted" });
        expect(attendanceAppearance(undefined)).toMatchObject({ status: null, text: "Sin responder" });
        expect(attendanceAppearance("")).toMatchObject({ status: null, text: "Sin responder" });
    });

    it("prints a status this version does not know as it arrived, in a neutral tone", () => {
        expect(attendanceAppearance("Maybe")).toMatchObject({ status: null, text: "Maybe", tone: "muted" });
    });

    it("never gives the same words to two different answers", () => {
        const texts = [attendanceAppearance(null).text, attendanceAppearance("Confirmed").text, attendanceAppearance("Declined").text];
        expect(new Set(texts).size).toBe(3);
    });

    it("carries an icon for every answer, so the tone is never the only cue", () => {
        for (const value of [null, "Confirmed", "Declined", "Maybe"]) {
            expect(attendanceAppearance(value).icon).toBeTruthy();
        }
    });
});
