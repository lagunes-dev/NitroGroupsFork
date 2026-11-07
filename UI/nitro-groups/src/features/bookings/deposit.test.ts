import { describe, expect, it } from "vitest";
import {
    balanceBlock,
    balanceLabel,
    clientDepositLabel,
    clientPaymentMethodLabel,
    depositLabel,
    dueDateLabel,
    nextStepLabel,
    nothingLeftToPay,
} from "./deposit";

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
        // Pendiente no lleva próximo paso: el chip de estado ya lo dice.
        expect(nextStepLabel({ status: "Pending" }, "Client")).toBeNull();
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

    // Ronda 9 (Camila): con la fecha límite del saldo ya dicha arriba, "para el día del evento" era un
    // segundo plazo para el mismo saldo, y los dos se contradecían.
    it("does not name a second date for the balance when the group loaded the deadline", () => {
        const step = nextStepLabel(
            { status: "Accepted", budget: 12000, deposit: received, balanceDueDate: "2026-11-15", eventDate: "2026-12-19" },
            "Client",
            "2026-11-07"
        );

        expect(step).toBe("Acuerda el saldo con el grupo.");
        expect(step).not.toMatch(/día del evento/);
    });

    it("keeps the event day as the balance purpose while there is no deadline", () => {
        expect(
            nextStepLabel({ status: "Accepted", budget: 12000, deposit: received, eventDate: "2026-12-19" }, "Client", "2026-11-07")
        ).toBe("Acuerda el saldo con el grupo para el día del evento.");
    });

    // Ronda 9 (Camila): un evento que ya pasó no puede pedir "cerrar la fecha" ni "acordar el saldo para
    // el día del evento": son acciones sobre un futuro que ya no existe.
    it("states that a past event is over instead of asking to settle it", () => {
        const past = { status: "Accepted" as const, eventDate: "2026-10-24", budget: 9000 };

        expect(nextStepLabel(past, "Client", "2026-11-07")).toBe("Este evento ya pasó.");
        expect(nextStepLabel({ ...past, deposit: received }, "Client", "2026-11-07")).toBe("Este evento ya pasó.");
    });

    it("still says nothing is owed on a past event the group recorded as paid", () => {
        expect(
            nextStepLabel({ status: "Accepted", eventDate: "2026-10-24", balanceReceivedAt: "2026-10-25T02:00:00Z" }, "Client", "2026-11-07")
        ).toBe("No queda nada por pagar.");
    });

    it("does not treat the day of the event as past", () => {
        expect(
            nextStepLabel({ status: "Accepted", eventDate: "2026-11-07", budget: 9000 }, "Client", "2026-11-07")
        ).toBe("Acuerda el anticipo con el grupo para cerrar la fecha.");
    });

    it("never invents a past event from a date it cannot read", () => {
        expect(nextStepLabel({ status: "Accepted", eventDate: "no es fecha", budget: 9000 }, "Client", "2026-11-07")).toBe(
            "Acuerda el anticipo con el grupo para cerrar la fecha."
        );
    });
});

describe("fecha límite del anticipo y del saldo (T61, S24)", () => {
    const received = { amount: 4000, receivedAt: "2026-11-05T18:00:00Z" };
    const owed = { status: "Accepted" as const, budget: 18000, deposit: received };

    it("says the deadline in Spanish, at the end of the line", () => {
        expect(dueDateLabel("2026-11-15")).toBe("para el 15 de noviembre de 2026");
        expect(dueDateLabel("2026-10-01")).toBe("para el 1 de octubre de 2026");
    });

    it("puts the deposit deadline at the end of the pending deposit line", () => {
        expect(depositLabel({ amount: 3000, receivedAt: null, dueDate: "2026-11-15" })).toBe(
            "Anticipo $3,000 · pendiente · para el 15 de noviembre de 2026"
        );
        expect(clientDepositLabel({ status: "Accepted", deposit: { amount: 3000, dueDate: "2026-11-15" } }, "Client")).toBe(
            "Anticipo $3,000 · pendiente · para el 15 de noviembre de 2026"
        );
    });

    it("says the balance the client owes with its deadline, like the spec's example", () => {
        expect(balanceLabel({ ...owed, balanceDueDate: "2026-11-15" }, "Client")).toBe("Falta pagar $14,000 · para el 15 de noviembre de 2026");
    });

    it("keeps today's words when there is no deadline loaded", () => {
        expect(depositLabel({ amount: 3000, receivedAt: null })).toBe("Anticipo $3,000 · pendiente");
        expect(depositLabel({ amount: 3000, receivedAt: "2026-11-04T18:00:00Z" })).toBe("Anticipo $3,000 · recibido el 4 de noviembre de 2026");
        expect(balanceLabel({ ...owed, balanceDueDate: null }, "Client")).toBe("Falta pagar $14,000");
        expect(balanceLabel(owed, "Client")).toBe("Falta pagar $14,000");
    });

    it("states a deadline that already passed as the same fact, never as an error", () => {
        // La fecha ya pasó: el texto es el mismo y no aparece ninguna marca de deuda vencida.
        const line = balanceLabel({ ...owed, balanceDueDate: "2026-10-01" }, "Client");
        expect(line).toBe("Falta pagar $14,000 · para el 1 de octubre de 2026");
        expect(line).not.toMatch(/vencid|atras|error|reclam/i);
        expect(depositLabel({ amount: 3000, dueDate: "2026-10-01" })).toBe("Anticipo $3,000 · pendiente · para el 1 de octubre de 2026");
    });

    it("never invents a deadline it cannot read", () => {
        expect(dueDateLabel("15/11/2026")).toBeNull();
        expect(dueDateLabel(null)).toBeNull();
        expect(dueDateLabel("ayer")).toBeNull();
        expect(depositLabel({ amount: 3000, dueDate: "15/11/2026" })).toBe("Anticipo $3,000 · pendiente");
        expect(balanceLabel({ ...owed, balanceDueDate: "ayer" }, "Client")).toBe("Falta pagar $14,000");
    });

    it("does not add a deadline to money that already arrived", () => {
        expect(depositLabel({ amount: 3000, receivedAt: "2026-11-04T18:00:00Z", dueDate: "2026-11-15" })).toBe(
            "Anticipo $3,000 · recibido el 4 de noviembre de 2026"
        );
        expect(balanceLabel({ ...owed, balanceReceivedAt: "2026-12-13T15:00:00Z", balanceDueDate: "2026-11-15" }, "Client")).toBe(
            "Saldo recibido el 13 de diciembre de 2026"
        );
    });

    it("is for the client of an accepted request only, as today", () => {
        expect(clientDepositLabel({ status: "Accepted", deposit: { amount: 3000, dueDate: "2026-11-15" } }, "Group")).toBeNull();
        expect(clientDepositLabel({ status: "Pending", deposit: { amount: 3000, dueDate: "2026-11-15" } }, "Client")).toBeNull();
        expect(balanceLabel({ ...owed, balanceDueDate: "2026-11-15" }, "Group")).toBeNull();
        expect(balanceLabel({ ...owed, status: "Pending", balanceDueDate: "2026-11-15" }, "Client")).toBeNull();
    });

    it("uses the deadline as the block's 'para el …' instead of repeating it", () => {
        expect(balanceBlock({ ...owed, balanceDueDate: "2026-11-15", eventDate: "2026-12-12" }, "Client", "2026-11-07")).toEqual({
            balance: "Falta pagar $14,000 · para el 15 de noviembre de 2026",
            purpose: null,
            // Una sola fecha para el saldo: la del plazo. "El día del evento" sería otra y se contradirían.
            nextStep: "Acuerda el saldo con el grupo.",
        });
    });

    it("keeps the event day as the purpose while there is no deadline", () => {
        expect(balanceBlock({ ...owed, eventDate: "2026-12-12" }, "Client", "2026-11-07")).toEqual({
            balance: "Falta pagar $14,000",
            purpose: "para el 12 de diciembre de 2026",
            nextStep: "Acuerda el saldo con el grupo para el día del evento.",
        });
    });
});

describe("balance received (T48)", () => {
    const received = { amount: 4000, receivedAt: "2026-11-05T18:00:00Z" };
    const settled = { status: "Accepted" as const, budget: 18000, deposit: received, balanceReceivedAt: "2026-12-13T15:00:00Z" };

    it("says the balance arrived, with the date in Mexico, instead of asking for it", () => {
        expect(balanceLabel(settled, "Client")).toBe("Saldo recibido el 13 de diciembre de 2026");
        expect(balanceLabel({ ...settled, balanceReceivedAt: "2026-12-14T03:30:00Z" }, "Client")).toBe("Saldo recibido el 13 de diciembre de 2026");
    });

    it("never invents a date it cannot read", () => {
        expect(balanceLabel({ ...settled, balanceReceivedAt: "ayer" }, "Client")).toBe("Saldo recibido");
    });

    it("does not need the deposit or the budget to state a fact the group recorded", () => {
        expect(balanceLabel({ status: "Accepted", balanceReceivedAt: "2026-12-13T15:00:00Z" }, "Client")).toBe("Saldo recibido el 13 de diciembre de 2026");
    });

    it("changes nothing before it exists", () => {
        expect(balanceLabel({ ...settled, balanceReceivedAt: null }, "Client")).toBe("Falta pagar $14,000");
        expect(balanceLabel({ status: "Accepted", budget: 18000, deposit: received }, "Client")).toBe("Falta pagar $14,000");
    });

    it("is for the client of an accepted request only", () => {
        expect(balanceLabel(settled, "Group")).toBeNull();
        expect(balanceLabel({ ...settled, status: "Pending" }, "Client")).toBeNull();
        expect(balanceLabel({ ...settled, status: "Cancelled" }, "Client")).toBeNull();
    });

    it("turns the next step into the settled one: nothing asks him to pay again", () => {
        expect(nextStepLabel(settled, "Client")).toBe("No queda nada por pagar.");
        expect(nextStepLabel({ status: "Accepted", balanceReceivedAt: "2026-12-13T15:00:00Z" }, "Client")).toBe("No queda nada por pagar.");
        expect(nextStepLabel({ ...settled, balanceReceivedAt: null }, "Client")).toBe("Acuerda el saldo con el grupo para el día del evento.");
        expect(nextStepLabel(settled, "Group")).toBeNull();
    });

    it("keeps the block, now settled, and without the 'para el ...' purpose of a debt", () => {
        expect(balanceBlock({ ...settled, eventDate: "2026-12-12" }, "Client")).toEqual({
            balance: "Saldo recibido el 13 de diciembre de 2026",
            purpose: null,
            nextStep: "No queda nada por pagar.",
        });
        expect(balanceBlock({ ...settled, balanceReceivedAt: null, eventDate: "2026-12-12" }, "Client")).toEqual({
            balance: "Falta pagar $14,000",
            purpose: "para el 12 de diciembre de 2026",
            nextStep: "Acuerda el saldo con el grupo para el día del evento.",
        });
        expect(balanceBlock({ ...settled, eventDate: "2026-12-12" }, "Group")).toBeNull();
    });
});

/**
 * Ronda 10: el ruido de pago en un evento ya saldado. La misma regla que la línea del saldo, dicha
 * una vez para que la lista y el detalle no decidan distinto (L15).
 */
describe("nothingLeftToPay (ronda 10)", () => {
    const received = { amount: 4000, receivedAt: "2026-11-05T18:00:00Z" };

    it("is settled once the group recorded the balance as received", () => {
        expect(nothingLeftToPay({ balanceReceivedAt: "2026-12-13T15:00:00Z", budget: 18000, deposit: received })).toBe(true);
        // El registro del grupo manda aunque falten cuentas para comprobarlo.
        expect(nothingLeftToPay({ balanceReceivedAt: "2026-12-13T15:00:00Z" })).toBe(true);
    });

    it("is settled when nothing is left over: zero or less", () => {
        expect(nothingLeftToPay({ budget: 4000, deposit: received })).toBe(true);
        expect(nothingLeftToPay({ budget: 3000, deposit: received })).toBe(true);
    });

    it("is not settled while the deposit is still pending or a balance is owed", () => {
        expect(nothingLeftToPay({ budget: 18000, deposit: { amount: 4000, receivedAt: null } })).toBe(false);
        expect(nothingLeftToPay({ budget: 18000, deposit: received })).toBe(false);
        // Sin números para decirlo, no se afirma que el trato está cerrado.
        expect(nothingLeftToPay({ budget: null, deposit: received })).toBe(false);
        expect(nothingLeftToPay({})).toBe(false);
    });
});

/**
 * Ronda 10: cómo pagar en la fila de la lista. Es texto, no un control, y desaparece cuando no queda
 * nada por pagar: bajo "Saldo recibido" una CLABE vuelve a ser el ruido que el cliente reportó.
 */
describe("clientPaymentMethodLabel (ronda 10)", () => {
    const received = { amount: 4000, receivedAt: "2026-11-05T18:00:00Z" };
    const owed = {
        status: "Accepted" as const,
        budget: 18000,
        deposit: received,
        paymentMethod: "Transfiere a la CLABE 0121 8000 1234 5678, BBVA.",
    };

    it("shows the group's method on the client's row, next to the money", () => {
        expect(clientPaymentMethodLabel(owed, "Client")).toBe("Transfiere a la CLABE 0121 8000 1234 5678, BBVA.");
    });

    it("says nothing when the group wrote nothing", () => {
        expect(clientPaymentMethodLabel({ ...owed, paymentMethod: null }, "Client")).toBeNull();
        expect(clientPaymentMethodLabel({ ...owed, paymentMethod: "   " }, "Client")).toBeNull();
    });

    it("says nothing once there is nothing left to pay", () => {
        expect(clientPaymentMethodLabel({ ...owed, balanceReceivedAt: "2026-12-13T15:00:00Z" }, "Client")).toBeNull();
        expect(clientPaymentMethodLabel({ ...owed, budget: 4000 }, "Client")).toBeNull();
    });

    it("is only for the client of an accepted event", () => {
        expect(clientPaymentMethodLabel(owed, "Group")).toBeNull();
        expect(clientPaymentMethodLabel({ ...owed, status: "Pending" }, "Client")).toBeNull();
        expect(clientPaymentMethodLabel({ ...owed, status: "Declined" }, "Client")).toBeNull();
    });
});
