import { describe, expect, it } from "vitest";
import { formatPrice } from "@/lib/format";
import {
    REQUEST_LOCATION_MAX,
    REQUEST_MESSAGE_MAX,
    REQUEST_MESSAGE_MIN,
    belowBasePriceNote,
    limitRead,
    messageSendReason,
    pastedLength,
    requestSendReason,
} from "./formNotes";

/**
 * Ronda 13 (la clienta): la app aceptó en silencio una oferta de $1,000 contra un precio base de
 * $12,000, cortó 500 caracteres sin decirlo, dejó dos botones apagados sin motivo y nunca dijo que
 * un mismo grupo no se pide dos veces para la misma fecha. Nada de esto bloquea: se dice.
 */
describe("belowBasePriceNote (ronda 13, tarea 2)", () => {
    it("says the two figures out loud when the offer is below the group's base price", () => {
        expect(belowBasePriceNote(1000, 12000)).toBe("Ofreces $1,000 y el grupo suele cobrar desde $12,000.");
    });

    it("disappears at or above the base price, which is not a defect", () => {
        expect(belowBasePriceNote(12000, 12000)).toBeNull();
        expect(belowBasePriceNote(15000, 12000)).toBeNull();
        expect(belowBasePriceNote(25000, 12000)).toBeNull();
    });

    it("disappears when either figure is unknown, instead of guessing", () => {
        expect(belowBasePriceNote(null, 12000)).toBeNull();
        expect(belowBasePriceNote(undefined, 12000)).toBeNull();
        expect(belowBasePriceNote(1000, null)).toBeNull();
        expect(belowBasePriceNote(1000, undefined)).toBeNull();
        // Un cero no es un precio: "Sin presupuesto" del lado del cliente y "precio a cotizar" del grupo.
        expect(belowBasePriceNote(0, 12000)).toBeNull();
        expect(belowBasePriceNote(1000, 0)).toBeNull();
    });

    it("counts the group's price in the group's currency", () => {
        // El precio base es del grupo: se cuenta en su moneda, no en la del cliente (S15).
        const note = belowBasePriceNote(1000, 12000, "USD") ?? "";
        expect(note).toContain("USD");
        expect(note).toBe(`Ofreces ${formatPrice(1000, "USD")} y el grupo suele cobrar desde ${formatPrice(12000, "USD")}.`);
    });
});

describe("limitRead (ronda 13, tarea 3)", () => {
    const full = "a".repeat(REQUEST_MESSAGE_MAX);

    it("shows the counter and, at the limit, a sentence that says nothing else fits", () => {
        expect(limitRead(full, REQUEST_MESSAGE_MAX)).toEqual({
            counter: "2000 de 2000",
            atLimit: true,
            note: "Llegaste al límite de 2000 caracteres: lo que escribas después no entra.",
        });
    });

    it("says it in words when a paste did not fit, instead of cutting in silence", () => {
        expect(limitRead(full, REQUEST_MESSAGE_MAX, true).note).toBe(
            "Pegaste más texto del que cabe: el campo se quedó con los primeros 2000 caracteres."
        );
    });

    it("stays quiet while the text fits", () => {
        expect(limitRead("corto", REQUEST_MESSAGE_MAX)).toEqual({ counter: "5 de 2000", atLimit: false, note: null });
    });

    it("uses the field's own limit for the place of the event", () => {
        expect(limitRead("b".repeat(REQUEST_LOCATION_MAX), REQUEST_LOCATION_MAX).note).toBe(
            "Llegaste al límite de 200 caracteres: lo que escribas después no entra."
        );
    });
});

describe("pastedLength", () => {
    it("counts what the field would hold if it took the whole paste", () => {
        expect(pastedLength({ value: "hola", selectionStart: 4, selectionEnd: 4 }, "mundo")).toBe(9);
    });

    it("discounts the text the paste replaces", () => {
        expect(pastedLength({ value: "hola", selectionStart: 0, selectionEnd: 4 }, "mundo")).toBe(5);
    });
});

describe("requestSendReason (ronda 13, tarea 4)", () => {
    const message = "Buscamos mariachi para la entrada y el vals.";

    it("names the date the app already asks for when it is missing", () => {
        expect(requestSendReason({ eventDate: "", message })).toBe("Elige la fecha del evento.");
    });

    it("names the characters the app already asks for when the message is short", () => {
        expect(requestSendReason({ eventDate: "2099-12-05", message: "corto" })).toBe(
            `Escribe al menos ${REQUEST_MESSAGE_MIN} caracteres.`
        );
    });

    it("says nothing when the request can be sent", () => {
        expect(requestSendReason({ eventDate: "2099-12-05", message })).toBeNull();
    });
});

describe("messageSendReason (ronda 13, tarea 4)", () => {
    it("says why 'Enviar mensaje' is off", () => {
        expect(messageSendReason("")).toBe("Escribe tu mensaje.");
        expect(messageSendReason("   ")).toBe("Escribe tu mensaje.");
    });

    it("says nothing once there is something to send", () => {
        expect(messageSendReason("Hola")).toBeNull();
    });
});
