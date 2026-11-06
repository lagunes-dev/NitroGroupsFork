import { describe, expect, it } from "vitest";
import {
    NOTICE_ACTION_LABEL,
    NOTICE_KINDS,
    isNoticeKind,
    noticeActionName,
    noticeManagerLine,
    noticeSentLabel,
    noticeSlots,
    noticesByGig,
} from "./notices";

describe("isNoticeKind", () => {
    it("accepts only the five kinds of the contract", () => {
        expect(NOTICE_KINDS).toEqual(["CallTime", "Pay", "Setlist", "Late", "CannotFindVenue"]);
        for (const kind of NOTICE_KINDS) expect(isNoticeKind(kind)).toBe(true);
        for (const other of ["Chat", "pay", "", null, undefined, 1, {}]) expect(isNoticeKind(other), String(other)).toBe(false);
    });
});

describe("the one-tap action", () => {
    it("is one quiet label, named per slot so the three buttons never sound alike", () => {
        expect(NOTICE_ACTION_LABEL).toBe("Avisar que falta");
        expect(noticeActionName("CallTime")).toBe("Avisar que falta la llegada");
        expect(noticeActionName("Pay")).toBe("Avisar que falta el pago");
        expect(noticeActionName("Setlist")).toBe("Avisar que falta el setlist");
        expect(new Set(NOTICE_KINDS.map(noticeActionName)).size).toBe(5);
    });

    it("names the two day-of notices in their own words, not as something missing (S17)", () => {
        expect(noticeActionName("Late")).toBe("Avisar que llego tarde");
        expect(noticeActionName("CannotFindVenue")).toBe("Avisar que no encuentro el lugar");
    });
});

describe("noticeSentLabel", () => {
    it("says it was sent today, without blaming anyone", () => {
        expect(noticeSentLabel("CallTime")).toBe("Avisaste hoy que falta la llegada");
        expect(noticeSentLabel("Pay")).toBe("Avisaste hoy que falta el pago");
        expect(noticeSentLabel("Setlist")).toBe("Avisaste hoy que falta el setlist");
        expect(noticeSentLabel("Late")).toBe("Avisaste hoy que llegas tarde");
        expect(noticeSentLabel("CannotFindVenue")).toBe("Avisaste hoy que no encuentras el lugar");
    });
});

describe("noticeManagerLine", () => {
    it("names the musician and what is missing, so nobody has to guess", () => {
        expect(noticeManagerLine("Mateo Ruiz", "Pay")).toBe("Mateo Ruiz avisa que falta el pago");
        expect(noticeManagerLine("Mateo", "CallTime")).toBe("Mateo avisa que falta la llegada");
        expect(noticeManagerLine("Sofía Nava", "Setlist")).toBe("Sofía Nava avisa que falta el setlist");
        expect(noticeManagerLine("Mateo", "Late")).toBe("Mateo avisa que llega tarde");
        expect(noticeManagerLine("Mateo", "CannotFindVenue")).toBe("Mateo avisa que no encuentra el lugar");
    });

    it("never leaves a line without a subject", () => {
        expect(noticeManagerLine("   ", "Pay")).toBe("Un músico del grupo avisa que falta el pago");
    });
});

describe("noticeSlots", () => {
    const MISSING = { callTimeLabel: null, setlist: null, payLabel: null };
    const DAY_OF = [
        { kind: "Late", sent: false },
        { kind: "CannotFindVenue", sent: false },
    ];

    it("offers the slots that are missing, and always the two day-of notices after them", () => {
        expect(noticeSlots(MISSING, [])).toEqual([
            { kind: "CallTime", sent: false },
            { kind: "Pay", sent: false },
            { kind: "Setlist", sent: false },
            ...DAY_OF,
        ]);
        expect(noticeSlots({ ...MISSING, payLabel: "Tu pago: $2,000" }, [])).toEqual([
            { kind: "CallTime", sent: false },
            { kind: "Setlist", sent: false },
            ...DAY_OF,
        ]);
    });

    it("still offers the two day-of notices when the call time, the setlist and the pay are loaded", () => {
        expect(noticeSlots({ callTimeLabel: "Llegada 17:30", setlist: "Intro", payLabel: "Tu pago: $0" }, [])).toEqual(DAY_OF);
    });

    it("marks what was already sent today so the row does not offer it again", () => {
        expect(noticeSlots(MISSING, ["Pay"])).toEqual([
            { kind: "CallTime", sent: false },
            { kind: "Pay", sent: true },
            { kind: "Setlist", sent: false },
            ...DAY_OF,
        ]);
        expect(noticeSlots(MISSING, ["Pay", "Chat", 3 as unknown as string])).toEqual([
            { kind: "CallTime", sent: false },
            { kind: "Pay", sent: true },
            { kind: "Setlist", sent: false },
            ...DAY_OF,
        ]);
        expect(noticeSlots({ callTimeLabel: "x", setlist: "x", payLabel: "x" }, ["Late"])).toEqual([
            { kind: "Late", sent: true },
            { kind: "CannotFindVenue", sent: false },
        ]);
    });
});

describe("noticesByGig", () => {
    it("keeps the API order inside each gig and drops what has no gig", () => {
        const grouped = noticesByGig([
            { id: 1, gigId: 5, fullName: "Mateo", kind: "Pay" },
            { id: 2, gigId: 5, fullName: "Sofía", kind: "Setlist" },
            { id: 3, gigId: 6, fullName: "Mateo", kind: "CallTime" },
            { id: 4, fullName: "Sin toque", kind: "Pay" },
        ]);
        expect(Object.keys(grouped)).toEqual(["5", "6"]);
        expect(grouped[5].map((notice) => notice.fullName)).toEqual(["Mateo", "Sofía"]);
        expect(grouped[6]).toHaveLength(1);
    });

    it("returns nothing for an empty or absent list", () => {
        expect(noticesByGig([])).toEqual({});
        expect(noticesByGig(null)).toEqual({});
        expect(noticesByGig(undefined)).toEqual({});
    });
});
