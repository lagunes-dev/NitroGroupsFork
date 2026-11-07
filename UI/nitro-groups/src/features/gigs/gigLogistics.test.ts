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

const FORM: LogisticsForm = {
    callTime: "",
    setlist: "",
    depositAmount: "",
    depositReceived: false,
    balanceReceived: false,
    depositDueDate: "",
    balanceDueDate: "",
    pay: {},
    paid: {},
};

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
        expect(form).toEqual({
            callTime: "17:30",
            setlist: "Intro",
            depositAmount: "3000",
            depositReceived: true,
            balanceReceived: false,
            depositDueDate: "",
            balanceDueDate: "",
            pay: { "5": "2000", "6": "" },
            paid: { "5": false, "6": false },
        });
    });

    it("starts the balance and each musician as recorded when the row says so (T48)", () => {
        const form = initialLogisticsForm({
            balanceReceivedAt: "2026-12-13T15:00:00Z",
            attendees: [
                { userId: 5, fullName: "Mateo", pay: 2000, paidAt: "2026-12-13T16:00:00Z" },
                { userId: 6, fullName: "Ana", pay: 1500, paidAt: null },
            ],
        });
        expect(form.balanceReceived).toBe(true);
        expect(form.paid).toEqual({ "5": true, "6": false });
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
        expect(
            buildDetailsBody({ ...FORM, callTime: "17:30", setlist: "Intro", depositAmount: "3000", depositReceived: true })
        ).toEqual({
            callTime: "17:30",
            setlist: "Intro",
            depositAmount: 3000,
            depositReceived: true,
            balanceReceived: false,
            depositDueDate: null,
            balanceDueDate: null,
        });
    });

    it("omits an empty call time and deposit, keeps the setlist so it can be cleared", () => {
        expect(buildDetailsBody(FORM)).toEqual({ setlist: "", depositReceived: false, balanceReceived: false, depositDueDate: null, balanceDueDate: null });
    });

    it("sends the balance like the deposit: true records it, false clears it (T48)", () => {
        expect(buildDetailsBody({ ...FORM, balanceReceived: true }).balanceReceived).toBe(true);
        expect(buildDetailsBody({ ...FORM, balanceReceived: false }).balanceReceived).toBe(false);
    });
});

describe("fechas límite del anticipo y del saldo (T61, S24)", () => {
    it("reads the two deadlines the row carries, as YYYY-MM-DD", () => {
        const form = initialLogisticsForm({ deposit: { amount: 3000, dueDate: "2026-11-15" }, balanceDueDate: "2026-12-12" });
        expect(form.depositDueDate).toBe("2026-11-15");
        expect(form.balanceDueDate).toBe("2026-12-12");
    });

    it("starts both empty when the row has no deadline or cannot be read", () => {
        expect(initialLogisticsForm({}).depositDueDate).toBe("");
        expect(initialLogisticsForm({}).balanceDueDate).toBe("");
        const odd = initialLogisticsForm({ deposit: { dueDate: "15/11/2026" }, balanceDueDate: "2026-02-30" });
        expect(odd.depositDueDate).toBe("");
        expect(odd.balanceDueDate).toBe("");
    });

    it("sends both deadlines always, so an emptied date clears the saved one", () => {
        expect(buildDetailsBody({ ...FORM, depositDueDate: "2026-11-15", balanceDueDate: "2026-12-12" })).toMatchObject({
            depositDueDate: "2026-11-15",
            balanceDueDate: "2026-12-12",
        });
        expect(buildDetailsBody(FORM)).toMatchObject({ depositDueDate: null, balanceDueDate: null });
    });

    it("does not validate the deadline: a day that already passed is a fact", () => {
        expect(validateLogistics({ ...FORM, depositDueDate: "2020-01-01", balanceDueDate: "2020-01-01" })).toEqual({
            valid: true,
            errors: { pay: {} },
            firstInvalid: null,
        });
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

    it("carries each musician's paid state only for the rows that go out (T48)", () => {
        expect(buildPayBody({ "5": "2000", "6": "1500", "7": "" }, { "5": true, "6": false, "7": true })).toEqual({
            payments: [
                { userId: 5, amount: 2000, paid: true },
                { userId: 6, amount: 1500, paid: false },
            ],
        });
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

    it("marks the ones already paid, in words (T48)", () => {
        expect(
            attendeePayLines([
                { userId: 5, fullName: "Mateo", pay: 2000, paidAt: "2026-12-13T16:00:00Z" },
                { userId: 6, fullName: "Ana", pay: 1500, paidAt: null },
            ])
        ).toEqual(["Mateo $2,000 pagado", "Ana $1,500"]);
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
