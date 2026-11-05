import { describe, expect, it } from "vitest";
import { balanceLabel, clientDepositLabel, depositLabel, nextStepLabel } from "./deposit";

describe("depositLabel", () => {
    it("says when the deposit was received, with the full date in Spanish", () => {
        expect(depositLabel({ amount: 3000, receivedAt: "2026-11-04T18:00:00Z" })).toBe("Anticipo $3,000 · recibido el 4 de noviembre de 2026");
    });

    it("reads the date in Mexico, not in UTC", () => {
        expect(depositLabel({ amount: 500, receivedAt: "2026-11-05T03:30:00Z" })).toBe("Anticipo $500 · recibido el 4 de noviembre de 2026");
    });

    it("says pending while there is no received date", () => {
        expect(depositLabel({ amount: 3000, receivedAt: null })).toBe("Anticipo $3,000 · pendiente");
        expect(depositLabel({ amount: "3000" })).toBe("Anticipo $3,000 · pendiente");
    });

    it("never invents a date it cannot read", () => {
        expect(depositLabel({ amount: 3000, receivedAt: "yesterday" })).toBe("Anticipo $3,000 · recibido");
    });

    it("returns null when there is no usable deposit", () => {
        expect(depositLabel(null)).toBeNull();
        expect(depositLabel(undefined)).toBeNull();
        expect(depositLabel({ amount: null, receivedAt: null })).toBeNull();
        expect(depositLabel({ amount: -1 })).toBeNull();
        expect(depositLabel({ amount: "abc" })).toBeNull();
        expect(depositLabel("3000")).toBeNull();
    });
});

describe("clientDepositLabel", () => {
    const deposit = { amount: 3000, receivedAt: null };

    it("shows the deposit of an accepted request to the client", () => {
        expect(clientDepositLabel({ status: "Accepted", deposit }, "Client")).toBe("Anticipo $3,000 · pendiente");
    });

    it("shows nothing for other statuses, for the group's own view or without a deposit", () => {
        expect(clientDepositLabel({ status: "Pending", deposit }, "Client")).toBeNull();
        expect(clientDepositLabel({ status: "Cancelled", deposit }, "Client")).toBeNull();
        expect(clientDepositLabel({ status: "Accepted", deposit }, "Group")).toBeNull();
        expect(clientDepositLabel({ status: "Accepted", deposit: null }, "Client")).toBeNull();
        expect(clientDepositLabel({ status: "Accepted" }, "Client")).toBeNull();
    });
});

describe("balanceLabel", () => {
    const received = { amount: 4000, receivedAt: "2026-11-05T18:00:00Z" };

    it("says what is left to pay once the deposit was received", () => {
        expect(balanceLabel({ status: "Accepted", budget: 18000, deposit: received }, "Client")).toBe("Falta pagar $14,000");
    });

    it("says nothing is owed when the deposit already covers the budget", () => {
        expect(balanceLabel({ status: "Accepted", budget: 4000, deposit: received }, "Client")).toBe("Sin saldo pendiente");
        expect(balanceLabel({ status: "Accepted", budget: 3000, deposit: received }, "Client")).toBe("Sin saldo pendiente");
    });

    it("stays silent while the deposit has not landed, and for everyone who is not the client", () => {
        expect(balanceLabel({ status: "Accepted", budget: 18000, deposit: { amount: 4000, receivedAt: null } }, "Client")).toBeNull();
        expect(balanceLabel({ status: "Accepted", budget: 18000, deposit: received }, "Group")).toBeNull();
        expect(balanceLabel({ status: "Pending", budget: 18000, deposit: received }, "Client")).toBeNull();
        expect(balanceLabel({ status: "Accepted", budget: null, deposit: received }, "Client")).toBeNull();
        expect(balanceLabel({ status: "Accepted", budget: 18000, deposit: null }, "Client")).toBeNull();
    });
});

describe("nextStepLabel", () => {
    const received = { amount: 4000, receivedAt: "2026-11-05T18:00:00Z" };
    const pendingDeposit = { amount: 4000, receivedAt: null };

    it("tells the client where the deal stands", () => {
        expect(nextStepLabel({ status: "Pending" }, "Client")).toBe("El grupo todavía no respondió.");
        expect(nextStepLabel({ status: "Accepted", budget: 18000, deposit: pendingDeposit }, "Client")).toBe(
            "Acuerda el anticipo con el grupo para cerrar la fecha."
        );
        expect(nextStepLabel({ status: "Accepted", budget: 18000, deposit: received }, "Client")).toBe(
            "Acuerda el saldo con el grupo para el día del evento."
        );
        expect(nextStepLabel({ status: "Accepted", budget: 4000, deposit: received }, "Client")).toBe("No queda nada por pagar.");
        expect(nextStepLabel({ status: "Declined" }, "Client")).toBe("El grupo no puede con esa fecha. Busca otro grupo.");
        expect(nextStepLabel({ status: "Cancelled" }, "Client")).toBe("Este evento se canceló.");
    });

    it("is only for the client", () => {
        expect(nextStepLabel({ status: "Accepted", budget: 18000, deposit: received }, "Group")).toBeNull();
    });
});
