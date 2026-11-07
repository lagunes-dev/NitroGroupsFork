import { describe, expect, it } from "vitest";
import { answerNotice, confirmButtonName, declineButtonName, scheduleLabel, toGigView } from "./viewModel";
import type { GigPayload } from "./types";

const ROW: GigPayload = {
    id: 7,
    groupId: 3,
    groupName: "Mariachi Sol de Jalisco",
    groupSlug: "mariachi-sol-de-jalisco",
    eventDate: "2026-11-15",
    startTime: "20:00:00",
    durationHours: 3,
    eventType: "Wedding",
    locationText: "Hacienda Los Arcos",
    role: "Member",
    attendance: "Confirmed",
};

describe("toGigView", () => {
    it("maps a complete row into what the card shows", () => {
        const view = toGigView(ROW);
        expect(view).toMatchObject({
            id: 7,
            eventDate: "2026-11-15",
            dateLabel: "domingo 15 de noviembre de 2026",
            placeLabel: "Hacienda Los Arcos",
            timeLabel: "20:00",
            durationLabel: "3 h",
            roleLabel: null,
        });
        expect(view.group).toEqual({ id: 3, name: "Mariachi Sol de Jalisco", slug: "mariachi-sol-de-jalisco", href: "/groups/mariachi-sol-de-jalisco" });
        expect(view.attendance).toMatchObject({ status: "Confirmed", text: "Confirmado" });
    });

    it("keeps the group name and date even when the row has no start time", () => {
        const view = toGigView({ ...ROW, startTime: null });
        expect(view.timeLabel).toBeNull();
        expect(scheduleLabel(view)).toBe("3 h");
    });

    it("tolerates a missing duration, a zero and a negative one", () => {
        expect(toGigView({ ...ROW, durationHours: null }).durationLabel).toBeNull();
        expect(toGigView({ ...ROW, durationHours: 0 }).durationLabel).toBeNull();
        expect(toGigView({ ...ROW, durationHours: -2 }).durationLabel).toBeNull();
        expect(toGigView({ ...ROW, durationHours: undefined }).durationLabel).toBeNull();
        expect(toGigView({ ...ROW, durationHours: "2.5" }).durationLabel).toBe("2.5 h");
    });

    it("says the time is still unknown when neither time nor duration arrived", () => {
        const view = toGigView({ ...ROW, startTime: null, durationHours: null });
        expect(scheduleLabel(view)).toBe("Horario por definir");
    });

    it("shows an unanswered gig as unanswered", () => {
        expect(toGigView({ ...ROW, attendance: null }).attendance).toMatchObject({ status: null, text: "Sin responder" });
    });

    it("does not guess an attendance status it does not know", () => {
        expect(toGigView({ ...ROW, attendance: "Maybe" }).attendance).toMatchObject({ status: null, text: "Maybe", tone: "muted" });
    });

    it("labels the roles it knows and stays silent about the ones it does not", () => {
        expect(toGigView({ ...ROW, role: "Owner" }).roleLabel).toBe("Dueño");
        expect(toGigView({ ...ROW, role: "Manager" }).roleLabel).toBe("Manager");
        expect(toGigView({ ...ROW, role: "Member" }).roleLabel).toBeNull();
        expect(toGigView({ ...ROW, role: "Wizard" }).roleLabel).toBeNull();
        expect(toGigView({ ...ROW, role: null }).roleLabel).toBeNull();
    });

    it("fills the gaps of a sparse row without throwing", () => {
        const view = toGigView({ id: 1 });
        expect(view).toMatchObject({
            eventDate: "",
            dateLabel: "Fecha por definir",
            placeLabel: "Lugar por definir",
            timeLabel: null,
            durationLabel: null,
            roleLabel: null,
        });
        expect(view.group).toEqual({ id: null, name: "Grupo sin nombre", slug: "", href: null });
        expect(view.attendance.text).toBe("Sin responder");
    });

    it("does not link to a group without a slug", () => {
        expect(toGigView({ ...ROW, groupSlug: "  " }).group.href).toBeNull();
    });

    it("prints an unreadable date as pending instead of inventing one", () => {
        expect(toGigView({ ...ROW, eventDate: "2026-02-30" }).dateLabel).toBe("Fecha por definir");
        expect(toGigView({ ...ROW, eventDate: null }).dateLabel).toBe("Fecha por definir");
    });
});

describe("answer button names", () => {
    it("names the group and the date, so a screen reader user can tell two rows apart", () => {
        const view = toGigView(ROW);
        expect(confirmButtonName(view)).toBe("Confirmar el domingo 15 de noviembre de 2026 · Mariachi Sol de Jalisco");
        expect(declineButtonName(view)).toBe("Avisar que no puedo el domingo 15 de noviembre de 2026 · Mariachi Sol de Jalisco");
    });

    it("reads naturally when the date is still unknown", () => {
        const view = toGigView({ id: 1, groupName: "Mariachi Sol" });
        expect(confirmButtonName(view)).toBe("Confirmar la fecha por definir · Mariachi Sol");
    });
});

describe("answerNotice", () => {
    it("tells the musician what was saved, in past tense", () => {
        expect(answerNotice("Confirmed", "sábado 15 de noviembre", "Mariachi Sol")).toBe(
            "Confirmaste el sábado 15 de noviembre · Mariachi Sol"
        );
        expect(answerNotice("Declined", "sábado 15 de noviembre", "Mariachi Sol")).toBe(
            "Avisaste que no puedes el sábado 15 de noviembre · Mariachi Sol"
        );
    });
});

describe("scheduleLabel", () => {
    it("joins the start time and the duration", () => {
        expect(scheduleLabel(toGigView(ROW))).toBe("20:00 · 3 h");
    });

    it("keeps only what arrived", () => {
        expect(scheduleLabel(toGigView({ ...ROW, startTime: null }))).toBe("3 h");
        expect(scheduleLabel(toGigView({ ...ROW, durationHours: null }))).toBe("20:00");
    });

    it("prints a one digit hour with two digits", () => {
        expect(toGigView({ ...ROW, startTime: "9:30" }).timeLabel).toBe("09:30");
    });

    it("ignores a start time it cannot read", () => {
        expect(toGigView({ ...ROW, startTime: "tarde" }).timeLabel).toBeNull();
    });
});

describe("toGigView logistics", () => {
    it("maps the call time, the setlist and the caller's own pay", () => {
        const view = toGigView({ ...ROW, callTime: "17:30:00", setlist: "  Intro\nValses\n", myPay: 2000 });
        expect(view.callTimeLabel).toBe("Llegada 17:30");
        expect(view.setlist).toBe("Intro\nValses");
        expect(view.payLabel).toBe("Tu pago: $2,000");
    });

    it("leaves all three empty when the row does not carry them", () => {
        const view = toGigView(ROW);
        expect(view.callTimeLabel).toBeNull();
        expect(view.setlist).toBeNull();
        expect(view.payLabel).toBeNull();
    });

    it("treats null, blank and malformed values as missing", () => {
        const view = toGigView({ ...ROW, callTime: "later", setlist: "   ", myPay: -5 });
        expect(view.callTimeLabel).toBeNull();
        expect(view.setlist).toBeNull();
        expect(view.payLabel).toBeNull();
        expect(toGigView({ ...ROW, myPay: null }).payLabel).toBeNull();
        expect(toGigView({ ...ROW, myPay: "abc" as unknown as number }).payLabel).toBeNull();
    });

    it("keeps a zero pay and reads a numeric string", () => {
        expect(toGigView({ ...ROW, myPay: 0 }).payLabel).toBe("Tu pago: $0");
        expect(toGigView({ ...ROW, myPay: "1500.00" as unknown as number }).payLabel).toBe("Tu pago: $1,500");
    });
});

describe("toGigView paidLabel (T48)", () => {
    it("says when the musician was paid, in Mexico's calendar", () => {
        expect(toGigView({ ...ROW, myPay: 2000, myPayPaidAt: "2026-12-13T15:00:00Z" }).paidLabel).toBe("pagado el 13 de diciembre de 2026");
        expect(toGigView({ ...ROW, myPay: 2000, myPayPaidAt: "2026-12-14T03:30:00Z" }).paidLabel).toBe("pagado el 13 de diciembre de 2026");
    });

    it("says pending while the pay exists and was not recorded as paid", () => {
        expect(toGigView({ ...ROW, myPay: 2000 }).paidLabel).toBe("pendiente");
        expect(toGigView({ ...ROW, myPay: 0, myPayPaidAt: null }).paidLabel).toBe("pendiente");
    });

    it("never invents a date it cannot read", () => {
        expect(toGigView({ ...ROW, myPay: 2000, myPayPaidAt: "ayer" }).paidLabel).toBe("pagado");
    });

    it("has nothing to say when no pay is loaded: that stays 'Tu pago sin definir'", () => {
        expect(toGigView(ROW).paidLabel).toBeNull();
        expect(toGigView({ ...ROW, myPay: null, myPayPaidAt: "2026-12-13T15:00:00Z" }).paidLabel).toBeNull();
        expect(toGigView({ ...ROW, myPay: -5 }).paidLabel).toBeNull();
    });

    it("keeps the pay label exactly as it was", () => {
        expect(toGigView({ ...ROW, myPay: 2000, myPayPaidAt: "2026-12-13T15:00:00Z" }).payLabel).toBe("Tu pago: $2,000");
    });
});

describe("toGigView unpaidNotice (S21)", () => {
    it("carries the one notice a past gig may offer when the pay is still pending", () => {
        expect(toGigView({ ...ROW, myPay: 1500 }).unpaidNotice).toEqual({ kind: "Unpaid", sent: false });
        expect(toGigView({ ...ROW, myPay: 1500 }, ["Unpaid"]).unpaidNotice).toEqual({ kind: "Unpaid", sent: true });
    });

    it("carries nothing when the pay was recorded as received", () => {
        expect(toGigView({ ...ROW, myPay: 1500, myPayPaidAt: "2026-11-20T15:00:00Z" }).unpaidNotice).toBeNull();
    });

    it("carries nothing when there is no pay row for the caller", () => {
        expect(toGigView(ROW).unpaidNotice).toBeNull();
        expect(toGigView({ ...ROW, myPay: -5 }).unpaidNotice).toBeNull();
    });

    it("does not leak into the notices of a future gig", () => {
        expect(toGigView({ ...ROW, myPay: 1500 }).notices.map((slot) => slot.kind)).not.toContain("Unpaid");
    });
});

describe("toGigView teammates and manager phone (S22)", () => {
    const conGente: GigPayload = {
        ...ROW,
        managerPhone: "33 1234 5678",
        teammates: [
            { userId: 400, fullName: "Mateo Músico", role: "Manager" },
            { userId: 500, fullName: "Luis Percusión", role: "Member" },
        ],
    };

    it("turns the confirmed teammates into name and group role", () => {
        expect(toGigView(conGente).players).toEqual([
            { name: "Mateo Músico", roleLabel: "Manager" },
            { name: "Luis Percusión", roleLabel: "Miembro" },
        ]);
    });

    it("turns the manager phone into a tel: link labelled with the group", () => {
        expect(toGigView(conGente).managerContact).toEqual({ href: "tel:3312345678", label: "Llamar a Mariachi Sol de Jalisco" });
        expect(toGigView({ ...ROW, managerPhone: "+52 (33) 1234-5678" }).managerContact?.href).toBe("tel:+523312345678");
    });

    it("draws no contact when the group has no phone loaded", () => {
        for (const managerPhone of [null, undefined, "", "   ", "sin telefono"]) {
            expect(toGigView({ ...ROW, managerPhone }).managerContact).toBeNull();
        }
    });

    it("draws nobody when the payload has no teammates or a broken one", () => {
        expect(toGigView(ROW).players).toEqual([]);
        expect(toGigView({ ...ROW, teammates: "Mateo" as never }).players).toEqual([]);
        expect(toGigView({ ...ROW, teammates: [null, 3, { fullName: "  " }] as never }).players).toEqual([]);
    });

    it("keeps a teammate whose role did not arrive, with the name only", () => {
        expect(toGigView({ ...ROW, teammates: [{ userId: 1, fullName: "Mateo Músico" }] }).players).toEqual([
            { name: "Mateo Músico", roleLabel: null },
        ]);
        // El rol llega como entero en la serialización vieja: se rotula igual.
        expect(toGigView({ ...ROW, teammates: [{ fullName: "Mateo Músico", role: 2 }] }).players).toEqual([
            { name: "Mateo Músico", roleLabel: "Manager" },
        ]);
        // Un rol que no es ninguno de los tres no inventa una etiqueta.
        expect(toGigView({ ...ROW, teammates: [{ fullName: "Mateo Músico", role: "Dueño del mundo" }] }).players).toEqual([
            { name: "Mateo Músico", roleLabel: null },
        ]);
    });

    it("keeps the rest of the row exactly as before", () => {
        const view = toGigView(conGente);
        expect(view.dateLabel).toBe("domingo 15 de noviembre de 2026");
        expect(view.payLabel).toBeNull();
        expect(view.setlist).toBeNull();
    });
});
