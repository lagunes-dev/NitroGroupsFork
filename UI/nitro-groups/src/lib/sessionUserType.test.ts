import { describe, expect, it } from "vitest";
import { sessionUserType } from "./sessionUserType";

describe("sessionUserType", () => {
    it("maps the numeric enum", () => {
        expect(sessionUserType(0)).toBe("client");
        expect(sessionUserType(1)).toBe("musician");
    });

    it("maps the enum names in any case", () => {
        expect(sessionUserType("Client")).toBe("client");
        expect(sessionUserType("musician")).toBe("musician");
        expect(sessionUserType("MUSICIAN")).toBe("musician");
    });

    it("maps numeric strings", () => {
        expect(sessionUserType("0")).toBe("client");
        expect(sessionUserType("1")).toBe("musician");
    });

    it("returns undefined for anything unknown so the caller keeps its default", () => {
        expect(sessionUserType(undefined)).toBeUndefined();
        expect(sessionUserType(null)).toBeUndefined();
        expect(sessionUserType(7)).toBeUndefined();
        expect(sessionUserType("admin")).toBeUndefined();
        expect(sessionUserType({})).toBeUndefined();
    });
});
