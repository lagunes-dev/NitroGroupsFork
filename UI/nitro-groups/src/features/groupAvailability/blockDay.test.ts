import { describe, expect, it } from "vitest";
import type { ScheduleEventDto } from "./services/groupAvailability.service";
import {
    confirmedGigFact,
    dayBounds,
    gigNoteText,
    isPastDay,
    longDayName,
    PAST_DAY_NOTE,
    pastRangeRefusal,
    rangeGigFact,
    shortDayName,
    wholeDayBlocks,
} from "./blockDay";

const DAY = "2026-11-19";

function at(day: string, hour: number) {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(y, m - 1, d, hour).toISOString();
}

describe("dayBounds", () => {
    it("covers one whole local day, from midnight to the next midnight", () => {
        const bounds = dayBounds(DAY);
        expect(bounds).not.toBeNull();
        expect(new Date(bounds!.start).getHours()).toBe(0);
        expect(new Date(bounds!.end).getHours()).toBe(0);
        expect(bounds!.start).toBe(at(DAY, 0));
        expect(bounds!.end).toBe(at("2026-11-20", 0));
    });

    it("has no bounds for something that is not a day", () => {
        expect(dayBounds("19/11/2026")).toBeNull();
        expect(dayBounds("2026-02-30")).toBeNull();
    });
});

/** Whether the day of a confirmed gig can be stated: done, nothing, or not known yet. */
describe("confirmedGigFact", () => {
    const read = (days: string[], failed = false) => ({ days, failed });

    it("says the day has a confirmed gig when the agenda lists it", () => {
        expect(confirmedGigFact(DAY, read([DAY]))).toBe("confirmed");
    });

    it("says the day is free only when the agenda was actually read", () => {
        expect(confirmedGigFact(DAY, read([]))).toBe("none");
        expect(confirmedGigFact(DAY, read(["2026-11-20"]))).toBe("none");
    });

    it("does not claim the day is free when the agenda could not be read", () => {
        // El silencio se lee como "no tengo toque": sin lectura, el diálogo tiene que decirlo.
        expect(confirmedGigFact(DAY, read([], true))).toBe("unknown");
    });

    it("keeps a gig it already knows even when the last read failed", () => {
        expect(confirmedGigFact(DAY, read([DAY], true))).toBe("confirmed");
    });
});

/**
 * Ronda 11: el mismo diálogo se abre por dos puertas —el formulario del día y el arrastre sobre el
 * calendario— y las dos tienen que decir el mismo hecho con las mismas palabras. La regla vive acá, una
 * sola vez: qué días cubre el arrastre y qué se puede afirmar de ellos.
 */
describe("rangeGigFact", () => {
    const read = (days: string[], failed = false) => ({ days, failed });
    /* El arrastre del informe: viernes 4 de diciembre, de 19:00 a 21:30. */
    const start = at("2026-12-04", 19);
    const end = new Date(Date.parse(start) + 2.5 * 60 * 60 * 1000).toISOString();

    it("says the dragged hours fall on a day with a confirmed gig", () => {
        expect(rangeGigFact(start, end, read(["2026-12-04"]))).toBe("confirmed");
    });

    it("says nothing when the days the drag covers are free", () => {
        expect(rangeGigFact(start, end, read([]))).toBe("none");
        expect(rangeGigFact(start, end, read(["2026-12-05"]))).toBe("none");
    });

    it("does not claim the day is free when the agenda could not be read", () => {
        expect(rangeGigFact(start, end, read([], true))).toBe("unknown");
    });

    it("counts a gig on any day the drag touches, not only on the day it starts", () => {
        // Un arrastre que cruza la medianoche toca los dos días: el toque del segundo también es hecho.
        const crosses = rangeGigFact(at("2026-12-04", 22), at("2026-12-05", 2), read(["2026-12-05"]));
        expect(crosses).toBe("confirmed");
    });
});

/** Las tres frases, en un solo lugar: la puerta del día y la del arrastre no pueden decir cosas distintas. */
describe("gigNoteText", () => {
    it("keeps one voice for the confirmed gig, the failed read and the read in progress", () => {
        expect(gigNoteText("confirmed")).toBe("Ese día ya tienes un toque confirmado. Bloquearlo no lo cancela.");
        expect(gigNoteText("unknown")).toBe("No pudimos comprobar si ese día ya tienes un toque.");
        expect(gigNoteText("reading")).toBe("Comprobando si ese día ya tienes un toque…");
    });

    it("says nothing on a day with no confirmed gig", () => {
        expect(gigNoteText("none")).toBeNull();
    });
});

/**
 * Ronda 11: la manager eligió 24 de octubre de 2026 y el control le ofreció bloquear un día que ya había
 * pasado. Bloquear el pasado no es una decisión que se pueda cumplir, así que el control lo dice.
 */
describe("isPastDay", () => {
    const TODAY = "2026-11-07";

    it("calls a day past only when it is behind today", () => {
        expect(isPastDay("2026-10-24", TODAY)).toBe(true);
        expect(isPastDay("2026-11-06", TODAY)).toBe(true);
        // Hoy no es pasado: todavía se puede bloquear.
        expect(isPastDay(TODAY, TODAY)).toBe(false);
        expect(isPastDay("2026-11-19", TODAY)).toBe(false);
    });

    it("has nothing to say about something that is not a day", () => {
        expect(isPastDay("24/10/2026", TODAY)).toBe(false);
        expect(isPastDay("2026-10-24", "no-es-fecha")).toBe(false);
    });
});

/**
 * Ronda 12: "I can block a day that already passed (Oct 20 and Oct 24, drag 19:00→21:00) — no past
 * notice, button enabled. The day form refuses the same day." La regla ya existía para el formulario;
 * esta es la misma regla, en un solo lugar, para la reja y para cualquier otra puerta a un bloque.
 */
describe("pastRangeRefusal", () => {
    const TODAY = "2026-11-07";

    it("refuses a dragged range whose day already passed, with the day form's own sentence", () => {
        expect(pastRangeRefusal(at("2026-10-20", 19), at("2026-10-20", 21), TODAY)).toBe(PAST_DAY_NOTE);
        expect(pastRangeRefusal(at("2026-10-24", 19), at("2026-10-24", 21), TODAY)).toBe(PAST_DAY_NOTE);
    });

    it("allows today and any later day: only the past is behind us", () => {
        expect(pastRangeRefusal(at(TODAY, 9), at(TODAY, 11), TODAY)).toBeNull();
        expect(pastRangeRefusal(at("2026-12-04", 19), at("2026-12-04", 21), TODAY)).toBeNull();
    });

    it("allows a night that starts today and ends after midnight", () => {
        // La madrugada del día siguiente no es pasado, aunque su último instante caiga en otro día.
        expect(pastRangeRefusal(at(TODAY, 23), at("2026-11-08", 1), TODAY)).toBeNull();
    });

    it("has nothing to refuse when the bounds cannot be read", () => {
        expect(pastRangeRefusal("no-es-fecha", "no-es-fecha", TODAY)).toBeNull();
    });

    it("says exactly what the day form says", () => {
        expect(PAST_DAY_NOTE).toBe("Este día ya pasó. Elige hoy o una fecha siguiente.");
    });
});

describe("wholeDayBlocks", () => {
    const busy = (id: string, start: string, end: string, isAvailable = false): ScheduleEventDto => ({
        id,
        title: "No disponible",
        start,
        end,
        isAvailable,
        backgroundColor: "#fb7185",
        borderColor: "#fb7185",
        textColor: "#0f172a",
    });

    it("counts a block that claims the whole day", () => {
        const bounds = dayBounds(DAY)!;
        expect(wholeDayBlocks([busy("busy_1", bounds.start, bounds.end)], DAY)).toHaveLength(1);
    });

    it("leaves out a block that only covers part of the day", () => {
        expect(wholeDayBlocks([busy("busy_1", at(DAY, 10), at(DAY, 12))], DAY)).toHaveLength(0);
    });

    it("leaves out a marked availability, which is not a block", () => {
        const bounds = dayBounds(DAY)!;
        expect(wholeDayBlocks([busy("avail_1", bounds.start, bounds.end, true)], DAY)).toHaveLength(0);
    });

    it("keeps the whole-day blocks in the order the API sent them", () => {
        const bounds = dayBounds(DAY)!;
        const blocks = wholeDayBlocks(
            [busy("busy_1", bounds.start, bounds.end), busy("busy_2", at(DAY, 9), at(DAY, 10)), busy("busy_3", at("2026-11-18", 0), at("2026-11-21", 0))],
            DAY
        );
        expect(blocks.map((block) => block.id)).toEqual(["busy_1", "busy_3"]);
    });
});

describe("shortDayName", () => {
    it("says the short day in abbreviated Spanish, without the year", () => {
        expect(shortDayName(DAY)).toBe("jue 19 nov");
        expect(shortDayName("2026-12-24")).toBe("jue 24 dic");
    });

    it("has nothing to say about an invalid day", () => {
        expect(shortDayName("2026-02-30")).toBeNull();
        expect(shortDayName("no-es-fecha")).toBeNull();
        expect(shortDayName("")).toBeNull();
    });
});

describe("longDayName", () => {
    it("says the long day as a Spanish phrase piece", () => {
        expect(longDayName(DAY)).toBe("jueves 19 de noviembre de 2026");
    });

    it("has nothing to say about an invalid day", () => {
        expect(longDayName("2026-02-30")).toBeNull();
    });
});
