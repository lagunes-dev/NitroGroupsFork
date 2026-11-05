import { describe, expect, it } from "vitest";
import { compareGigsByDate, splitAgenda } from "./agenda";

const gig = (id: number, eventDate: string, startTime: string | null = "20:00:00") => ({ id, eventDate, startTime });

const ids = (list: { id: number }[]) => list.map((g) => g.id);

describe("compareGigsByDate", () => {
    it("orders by date, soonest first", () => {
        const list = [gig(1, "2026-12-20"), gig(2, "2026-12-01"), gig(3, "2026-12-10")];
        expect(ids([...list].sort(compareGigsByDate))).toEqual([2, 3, 1]);
    });

    it("orders two gigs of the same day by start time", () => {
        const list = [gig(1, "2026-12-01", "21:00:00"), gig(2, "2026-12-01", "09:00:00")];
        expect(ids([...list].sort(compareGigsByDate))).toEqual([2, 1]);
    });

    it("leaves a gig without a start time after the timed ones of that day", () => {
        const list = [gig(1, "2026-12-01", null), gig(2, "2026-12-01", "09:00:00")];
        expect(ids([...list].sort(compareGigsByDate))).toEqual([2, 1]);
    });

    it("breaks the remaining ties by id", () => {
        const list = [gig(9, "2026-12-01"), gig(4, "2026-12-01")];
        expect(ids([...list].sort(compareGigsByDate))).toEqual([4, 9]);
    });

    it("sends a date it cannot read to the end instead of throwing", () => {
        const list = [gig(1, "sin-fecha"), gig(2, "2026-12-20"), gig(3, "2026-13-45")];
        expect(ids([...list].sort(compareGigsByDate))).toEqual([2, 1, 3]);
    });
});

describe("splitAgenda", () => {
    const TODAY = "2026-11-15";

    it("keeps today's gig in the upcoming list: the answer is still due", () => {
        const { upcoming, past } = splitAgenda([gig(1, TODAY), gig(2, "2026-11-14")], TODAY);
        expect(ids(upcoming)).toEqual([1]);
        expect(ids(past)).toEqual([2]);
    });

    it("reads the upcoming list from the closest date and the past from the most recent", () => {
        const { upcoming, past } = splitAgenda([gig(1, "2027-01-10"), gig(2, "2026-12-01"), gig(3, "2026-10-01"), gig(4, "2026-11-01")], TODAY);
        expect(ids(upcoming)).toEqual([2, 1]);
        expect(ids(past)).toEqual([4, 3]);
    });

    it("shows a gig whose date it cannot read instead of burying it", () => {
        const { upcoming, past } = splitAgenda([{ id: 1, eventDate: "sin-fecha", startTime: null }, gig(2, "2026-12-01")], TODAY);
        expect(ids(upcoming)).toEqual([2, 1]);
        expect(past).toEqual([]);
    });

    it("hides nothing when today itself is unreadable", () => {
        const { upcoming, past } = splitAgenda([gig(1, "2020-01-01"), gig(2, "2026-12-01")], "hoy");
        expect(ids(upcoming)).toEqual([1, 2]);
        expect(past).toEqual([]);
    });

    it("returns two empty lists for an empty agenda", () => {
        expect(splitAgenda([], TODAY)).toEqual({ upcoming: [], past: [] });
    });
});
