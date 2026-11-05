import { describe, expect, it } from "vitest";
import { isHttpUrl, musicianProfileHref } from "./links";

describe("musicianProfileHref", () => {
    it("builds the shareable public profile path", () => {
        expect(musicianProfileHref(42)).toBe("/musicians/42");
    });
});

describe("isHttpUrl", () => {
    it("accepts absolute http and https links", () => {
        expect(isHttpUrl("https://www.youtube.com/watch?v=abc")).toBe(true);
        expect(isHttpUrl("http://example.com/vivo")).toBe(true);
    });

    it("ignores the surrounding spaces the user may paste", () => {
        expect(isHttpUrl("  https://youtu.be/abc  ")).toBe(true);
    });

    it("rejects a bare domain, which is not a link yet", () => {
        expect(isHttpUrl("youtu.be/abc")).toBe(false);
        expect(isHttpUrl("www.youtube.com/watch?v=abc")).toBe(false);
    });

    it("rejects other schemes, including javascript:", () => {
        expect(isHttpUrl("ftp://example.com/video.mp4")).toBe(false);
        expect(isHttpUrl("javascript:alert(1)")).toBe(false);
        expect(isHttpUrl("data:text/html,<p>hola</p>")).toBe(false);
    });

    it("rejects an empty value and plain text", () => {
        expect(isHttpUrl("")).toBe(false);
        expect(isHttpUrl("   ")).toBe(false);
        expect(isHttpUrl("mi video")).toBe(false);
    });
});
