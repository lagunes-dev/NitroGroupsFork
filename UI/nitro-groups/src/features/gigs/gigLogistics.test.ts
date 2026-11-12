import { describe, expect, it } from "vitest";
import {
    SETLIST_MAX,
    agendaBalanceLabel,
    agendaCachetLabel,
    attendeePayLines,
    buildDetailsBody,
    buildPayBody,
    initialLogisticsForm,
    parseAmount,
    setlistRead,
    validateLogistics,
    type LogisticsForm,
} from "./gigLogistics";
import { balanceLabel, paymentDueLabel } from "@/features/bookings/deposit";

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
    it("lists only the attendees that have a pay, each one with its state (ronda 11)", () => {
        // A figure with no state reads as paid. Every row says whether it was paid.
        expect(
            attendeePayLines([
                { userId: 5, fullName: "Mateo Músico", pay: 2000 },
                { userId: 6, fullName: "Ana", pay: null },
                { userId: 7, fullName: "Luis", pay: 0 },
                { userId: 8, fullName: "Eva", pay: -3 },
            ])
        ).toEqual(["Mateo Músico $2,000 pendiente de pago", "Luis $0 pendiente de pago"]);
    });

    it("says paid or pending in words, paid first when both are on the line (T48, ronda 11)", () => {
        expect(
            attendeePayLines([
                { userId: 5, fullName: "Mateo", pay: 2000, paidAt: "2026-12-13T16:00:00Z" },
                { userId: 6, fullName: "Ana", pay: 1500, paidAt: null },
            ])
        ).toEqual(["Mateo $2,000 pagado", "Ana $1,500 pendiente de pago"]);
    });

    it("copes with a missing list", () => {
        expect(attendeePayLines(null)).toEqual([]);
    });
});

describe("setlistRead", () => {
    it("counts the characters over the maximum, in words and without separators", () => {
        expect(setlistRead("abc").counter).toBe("3 de 4000 caracteres");
        expect(setlistRead("").counter).toBe("0 de 4000 caracteres");
        expect(setlistRead("abc").note).toBeNull();
    });

    it("says nothing extra at exactly the maximum", () => {
        expect(setlistRead("x".repeat(SETLIST_MAX)).note).toBeNull();
    });

    it("says by how many characters the text is over, one character included", () => {
        expect(setlistRead("x".repeat(SETLIST_MAX + 1)).note).toBe(
            "Te pasaste por 1 carácter: el setlist admite hasta 4000 y no se guarda con más."
        );
        expect(setlistRead("x".repeat(SETLIST_MAX + 25)).note).toBe(
            "Te pasaste por 25 caracteres: el setlist admite hasta 4000 y no se guarda con más."
        );
    });
});

/**
 * S18/S23/S24: el renglón del manager dice el saldo del cliente con su fecha límite, igual que el
 * editor. La plata y las fechas vienen de los helpers del trato; acá solo se decide cuándo aplican.
 */
describe("agendaBalanceLabel", () => {
    const DEAL = {
        eventDate: "2026-11-19",
        budget: 14000,
        currency: "MXN",
        deposit: { amount: 7800, receivedAt: "2026-11-04T18:00:00Z" },
    };

    it("says what is still owed with the deadline the group loaded", () => {
        expect(agendaBalanceLabel({ ...DEAL, balanceDueDate: "2026-11-15" })).toBe(
            "Saldo: falta pagar $6,200 · para el 15 de noviembre de 2026"
        );
    });

    it("says what is still owed without a deadline when the group loaded none", () => {
        expect(agendaBalanceLabel({ ...DEAL, balanceDueDate: null })).toBe("Saldo: falta pagar $6,200");
        expect(agendaBalanceLabel(DEAL)).toBe("Saldo: falta pagar $6,200");
    });

    it("draws no balance line when nothing is owed", () => {
        // El anticipo cubre el cachet: no hay saldo que anunciar, y "Sin saldo pendiente" sería una línea de más.
        expect(agendaBalanceLabel({ ...DEAL, deposit: { amount: 14000, receivedAt: "2026-11-04T18:00:00Z" } })).toBeNull();
        expect(
            agendaBalanceLabel({ ...DEAL, deposit: { amount: 15000, receivedAt: "2026-11-04T18:00:00Z" } })
        ).toBeNull();
    });

    it("draws no balance line without an anticipo loaded, and states the agreed one without a deadline", () => {
        // Ronda 11: with an agreed anticipo and no deadline, the figure is still said ("Saldo $6,200 ·
        // pendiente"); what is never invented is a figure against an anticipo nobody set.
        expect(agendaBalanceLabel({ ...DEAL, deposit: { amount: 7800, receivedAt: null } })).toBe("Saldo: falta pagar $6,200");
        expect(agendaBalanceLabel({ ...DEAL, deposit: null })).toBeNull();
    });

    it("states the balance amount while the deposit has not landed (ronda 11)", () => {
        // The figure comes from what the manager AGREED (cachet and anticipo), not from money received:
        // the deposit state already says whether it landed, and the balance line cannot read as paid.
        expect(agendaBalanceLabel({ ...DEAL, deposit: { amount: 4000, receivedAt: null }, balanceDueDate: "2026-11-15" })).toBe(
            "Saldo: falta pagar $10,000 · para el 15 de noviembre de 2026"
        );
        expect(agendaBalanceLabel({ ...DEAL, deposit: { amount: 4000, receivedAt: null } })).toBe("Saldo: falta pagar $10,000");
    });

    it("never computes a balance from money that does not exist (ronda 11)", () => {
        // No cachet, or zero, means no figure: only the deadline the manager loaded is left to say.
        for (const budget of [null, 0]) {
            expect(
                agendaBalanceLabel({ ...DEAL, budget, deposit: { amount: 4000, receivedAt: null }, balanceDueDate: "2026-11-15" }),
                String(budget)
            ).toBe("Saldo: pendiente · para el 15 de noviembre de 2026");
        }
        // Nor without an anticipo loaded: a difference against one nobody set is not a balance.
        expect(agendaBalanceLabel({ ...DEAL, deposit: null, balanceDueDate: "2026-11-15" })).toBe(
            "Saldo: pendiente · para el 15 de noviembre de 2026"
        );
        // A pending anticipo that already covers the cachet leaves no balance to announce.
        expect(agendaBalanceLabel({ ...DEAL, deposit: { amount: 15000, receivedAt: null }, balanceDueDate: "2026-11-15" })).toBeNull();
    });

    it("states the balance deadline even without a cachet to compare against", () => {
        expect(agendaBalanceLabel({ ...DEAL, budget: null, balanceDueDate: "2026-11-15" })).toBe(
            "Saldo: pendiente · para el 15 de noviembre de 2026"
        );
    });

    it("never announces a balance deadline once nothing is owed", () => {
        // El anticipo cubre el cachet: hay plazo cargado, pero no queda saldo que anunciar.
        expect(
            agendaBalanceLabel({
                ...DEAL,
                deposit: { amount: 14000, receivedAt: "2026-11-04T18:00:00Z" },
                balanceDueDate: "2026-11-15",
            })
        ).toBeNull();
    });

    it("keeps saying the balance arrived once the group recorded it (T48)", () => {
        expect(
            agendaBalanceLabel({ ...DEAL, balanceReceivedAt: "2026-12-13T18:00:00Z", balanceDueDate: "2026-11-15" })
        ).toBe("Saldo recibido el 13 de diciembre de 2026 · $6,200");
    });

    it("reads a cachet that arrives as text and a missing currency as pesos", () => {
        expect(agendaBalanceLabel({ ...DEAL, budget: "14000", currency: null })).toBe("Saldo: falta pagar $6,200");
    });

    it("has nothing to say without a cachet to compare against", () => {
        expect(agendaBalanceLabel({ ...DEAL, budget: null })).toBeNull();
        expect(agendaBalanceLabel({ ...DEAL, budget: 0 })).toBeNull();
    });

    it("says a pending balance in one voice before and after the deposit lands, and as the client reads it (round 12)", () => {
        // The manager's row sits next to "Pagos:" (musicians): "Saldo:" up front says whose money it is.
        const landed = { ...DEAL, balanceDueDate: "2026-11-15" };
        const agreed = { ...landed, deposit: { amount: 7800, receivedAt: null } };
        const client = { ...landed, status: "Accepted" as const };
        expect(agendaBalanceLabel(landed)).toBe(balanceLabel(client, "Client"));
        expect(agendaBalanceLabel(landed)).toBe(paymentDueLabel(client));
        expect(agendaBalanceLabel(agreed)).toBe(agendaBalanceLabel(landed));
        expect(agendaBalanceLabel(agreed)).toMatch(/^Saldo: falta pagar \$6,200 · para el 15 de noviembre de 2026$/);
    });

    it("reads an agreed deposit written as text and a missing currency as pesos", () => {
        expect(agendaBalanceLabel({ ...DEAL, budget: "14000", currency: null, deposit: { amount: "4000", receivedAt: null } })).toBe(
            "Saldo: falta pagar $10,000"
        );
    });
});

/**
 * Ronda 11: the agenda row never said the cachet total, so the manager could not judge whether an
 * anticipo made sense without opening the editor.
 */
describe("agendaCachetLabel", () => {
    it("states the cachet total the manager agreed", () => {
        expect(agendaCachetLabel({ budget: 14000, currency: "MXN" })).toBe("Cachet total $14,000");
        expect(agendaCachetLabel({ budget: "14000", currency: null })).toBe("Cachet total $14,000");
    });

    it("says 'Sin presupuesto' for a cachet that is absent or zero, never a $0", () => {
        for (const budget of [null, undefined, 0, -1]) {
            expect(agendaCachetLabel({ budget, currency: "MXN" }), String(budget)).toBe("Sin presupuesto");
        }
        expect(agendaCachetLabel({})).toBe("Sin presupuesto");
    });
});
