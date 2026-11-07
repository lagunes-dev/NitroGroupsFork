import { describe, expect, it } from "vitest";
import {
    SETLIST_MAX,
    attendeePayLines,
    buildDetailsBody,
    buildPayBody,
    initialLogisticsForm,
    parseAmount,
    setlistCounter,
    validateLogistics,
    type LogisticsForm,
} from "./gigLogistics";

const FORM: LogisticsForm = { callTime: "", setlist: "", depositAmount: "", depositReceived: false, pay: {} };

describe("parseAmount", () => {
    it("reads empty, valid and invalid text apart", () => {
        expect(parseAmount("")).toEqual({ kind: "empty" });
        expect(parseAmount("  ")).toEqual({ kind: "empty" });
        expect(parseAmount("2000")).toEqual({ kind: "ok", value: 2000 });
        expect(parseAmount("0")).toEqual({ kind: "ok", value: 0 });
        expect(parseAmount("1500.5")).toEqual({ kind: "ok", value: 1500.5 });
    });

    it("rejects negatives, text, more than two decimals and absurd sizes", () => {
        for (const bad of ["-1", "abc", "12abc", "1.234", "1e3", "NaN", "Infinity", "10000000000"]) {
            expect(parseAmount(bad).kind, bad).toBe("invalid");
        }
    });
});

describe("initialLogisticsForm", () => {
    it("fills the form from a manager row", () => {
        const form = initialLogisticsForm({
            callTime: "17:30:00",
            setlist: "Intro",
            deposit: { amount: 3000, receivedAt: "2026-11-04T18:00:00Z" },
            attendees: [{ userId: 5, fullName: "Mateo", status: "Confirmed", pay: 2000 }, { userId: 6, fullName: "Ana", status: null, pay: null }],
        });
        expect(form).toEqual({ callTime: "17:30", setlist: "Intro", depositAmount: "3000", depositReceived: true, pay: { "5": "2000", "6": "" } });
    });

    it("starts empty for a row without logistics or with malformed values", () => {
        expect(initialLogisticsForm({})).toEqual(FORM);
        expect(initialLogisticsForm({ callTime: "x", setlist: null, deposit: { amount: "abc" }, attendees: [{ fullName: "Sin id" }] })).toEqual(FORM);
    });
});

describe("validateLogistics", () => {
    it("accepts a setlist of exactly the maximum and rejects one more", () => {
        expect(validateLogistics({ ...FORM, setlist: "a".repeat(SETLIST_MAX) }).valid).toBe(true);
        const result = validateLogistics({ ...FORM, setlist: "a".repeat(SETLIST_MAX + 1) });
        expect(result.valid).toBe(false);
        expect(result.errors.setlist).toBe("El setlist admite hasta 4,000 caracteres.");
        expect(result.firstInvalid).toBe("setlist");
    });

    it("rejects a negative or non-numeric deposit", () => {
        expect(validateLogistics({ ...FORM, depositAmount: "-10" }).errors.depositAmount).toBe("Escribe un monto de 0 o más, con hasta 2 decimales.");
        expect(validateLogistics({ ...FORM, depositAmount: "abc" }).valid).toBe(false);
        expect(validateLogistics({ ...FORM, depositAmount: "0" }).valid).toBe(true);
    });

    it("flags each bad pay row by user and points at the first invalid field in screen order", () => {
        const result = validateLogistics({ ...FORM, depositAmount: "-1", pay: { "5": "-2", "6": "100", "7": "x" } });
        expect(Object.keys(result.errors.pay)).toEqual(["5", "7"]);
        expect(result.firstInvalid).toBe("depositAmount");
        expect(validateLogistics({ ...FORM, pay: { "5": "-2" } }).firstInvalid).toBe("pay-5");
    });

    it("is valid when everything is empty", () => {
        expect(validateLogistics(FORM)).toEqual({ valid: true, errors: { pay: {} }, firstInvalid: null });
    });
});

describe("buildDetailsBody", () => {
    it("sends what the manager filled in", () => {
        expect(buildDetailsBody({ callTime: "17:30", setlist: "Intro", depositAmount: "3000", depositReceived: true, pay: {} })).toEqual({
            callTime: "17:30",
            setlist: "Intro",
            depositAmount: 3000,
            depositReceived: true,
        });
    });

    it("omits an empty call time and deposit, keeps the setlist so it can be cleared", () => {
        expect(buildDetailsBody(FORM)).toEqual({ setlist: "", depositReceived: false });
    });
});

describe("buildPayBody", () => {
    it("sends only the rows with a value, as numbers", () => {
        expect(buildPayBody({ "5": "2000", "6": "", "7": "0", "8": "  " })).toEqual({
            payments: [{ userId: 5, amount: 2000 }, { userId: 7, amount: 0 }],
        });
    });

    it("drops rows that are negative or not numbers instead of sending them", () => {
        expect(buildPayBody({ "5": "-1", "6": "abc", "7": "10" })).toEqual({ payments: [{ userId: 7, amount: 10 }] });
    });

    it("sends an empty set when nobody has a value", () => {
        expect(buildPayBody({})).toEqual({ payments: [] });
    });
});

describe("attendeePayLines", () => {
    it("lists only the attendees that have a pay", () => {
        expect(
            attendeePayLines([
                { userId: 5, fullName: "Mateo Músico", pay: 2000 },
                { userId: 6, fullName: "Ana", pay: null },
                { userId: 7, fullName: "Luis", pay: 0 },
                { userId: 8, fullName: "Eva", pay: -3 },
            ])
        ).toEqual(["Mateo Músico $2,000", "Luis $0"]);
    });

    it("copes with a missing list", () => {
        expect(attendeePayLines(null)).toEqual([]);
    });
});

describe("setlistCounter", () => {
    it("shows used over maximum", () => {
        expect(setlistCounter("abc")).toBe("3 / 4,000");
        expect(setlistCounter("")).toBe("0 / 4,000");
    });
});
