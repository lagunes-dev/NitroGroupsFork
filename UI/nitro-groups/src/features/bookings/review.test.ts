import { describe, expect, it } from "vitest";
import { REVIEW_COMMENT_MAX, commentCounter, ratingText, reviewError } from "./review";

describe("review helpers", () => {
    it("reads a rating as 'N de 5'", () => {
        expect(ratingText(4)).toBe("4 de 5");
    });

    it("asks for a rating between 1 and 5 and accepts a comment up to the limit", () => {
        expect(reviewError(0, "")).toBe("Elige una calificación de 1 a 5.");
        expect(reviewError(6, "")).toBe("Elige una calificación de 1 a 5.");
        expect(reviewError(3.5, "")).toBe("Elige una calificación de 1 a 5.");
        expect(reviewError(5, "x".repeat(REVIEW_COMMENT_MAX))).toBeNull();
        expect(reviewError(5, "x".repeat(REVIEW_COMMENT_MAX + 1))).toBe("El comentario admite hasta 1000 caracteres.");
        expect(reviewError(1, "")).toBeNull();
    });

    it("counts the comment against the limit", () => {
        expect(commentCounter("hola")).toBe("4/1000");
    });
});
