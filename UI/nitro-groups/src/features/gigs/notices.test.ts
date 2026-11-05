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
    it("accepts only the three kinds of the contract", () => {
        expect(NOTICE_KINDS).toEqual(["CallTime", "Pay", "Setlist"]);
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
        expect(new Set(NOTICE_KINDS.map(noticeActionName)).size).toBe(3);
    });
});

describe("noticeSentLabel", () => {
    it("says it was sent today, without blaming anyone", () => {
        expect(noticeSentLabel("CallTime")).toBe("Avisaste hoy que falta la llegada");
        expect(noticeSentLabel("Pay")).toBe("Avisaste hoy que falta el pago");
        expect(noticeSentLabel("Setlist")).toBe("Avisaste hoy que falta el setlist");
    });
});

describe("noticeManagerLine", () => {
    it("names the musician and what is missing, so nobody has to guess", () => {
        expect(noticeManagerLine("Mateo Ruiz", "Pay")).toBe("Mateo Ruiz avisa que falta el pago");
        expect(noticeManagerLine("Mateo", "CallTime")).toBe("Mateo avisa que falta la llegada");
        expect(noticeManagerLine("Sofía Nava", "Setlist")).toBe("Sofía Nava avisa que falta el setlist");
    });

    it("never leaves a line without a subject", () => {
        expect(noticeManagerLine("   ", "Pay")).toBe("Un músico del grupo avisa que falta el pago");
    });
});

describe("noticeSlots", () => {
    const MISSING = { callTimeLabel: null, setlist: null, payLabel: null };

    it("offers only the slots that are missing", () => {
        expect(noticeSlots(MISSING, [])).toEqual([
            { kind: "CallTime", sent: false },
            { kind: "Pay", sent: false },
            { kind: "Setlist", sent: false },
        ]);
        expect(noticeSlots({ ...MISSING, payLabel: "Tu pago: $2,000" }, [])).toEqual([
            { kind: "CallTime", sent: false },
            { kind: "Setlist", sent: false },
        ]);
        expect(noticeSlots({ callTimeLabel: "Llegada 17:30", setlist: "Intro", payLabel: "Tu pago: $0" }, [])).toEqual([]);
    });

    it("marks what was already sent today so the row does not offer it again", () => {
        expect(noticeSlots(MISSING, ["Pay"])).toEqual([
            { kind: "CallTime", sent: false },
            { kind: "Pay", sent: true },
            { kind: "Setlist", sent: false },
        ]);
        expect(noticeSlots(MISSING, ["Pay", "Chat", 3 as unknown as string])).toEqual([
            { kind: "CallTime", sent: false },
            { kind: "Pay", sent: true },
            { kind: "Setlist", sent: false },
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
