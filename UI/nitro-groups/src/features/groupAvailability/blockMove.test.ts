import { describe, expect, it, vi } from "vitest";
import { blockKindOf, pendingBlockMove, planBlockDrag, type BlockDragChange } from "./blockMove";

/** "2026-12-04 17:00" en hora local: como el calendario entrega un borde de bloque. */
function at(hour: number, minute = 0): Date {
    return new Date(2026, 11, 4, hour, minute);
}

describe("blockKindOf", () => {
    it("names the two kinds of block the manager can drag", () => {
        expect(blockKindOf("avail_105")).toBe("avail");
        expect(blockKindOf("busy_1")).toBe("busy");
    });

    it("owns nothing else: a confirmed gig is not a block of the manager's", () => {
        expect(blockKindOf("gig_2026-12-04")).toBeNull();
        expect(blockKindOf("gig_hour_9")).toBeNull();
        expect(blockKindOf("")).toBeNull();
    });
});

/**
 * Ronda 12: mover un bloque escribía al soltar. Lo que el arrastre produce es una intención con dos
 * lugares —donde está y donde iría—, no un cambio; esta regla la fija antes de que nadie escriba.
 */
describe("pendingBlockMove", () => {
    it("keeps both places: where the block is now and where the manager dropped it", () => {
        const move = pendingBlockMove({
            id: "busy_1",
            title: "Ensayo",
            start: at(18),
            end: at(21),
            oldStart: at(17),
            oldEnd: at(20),
        });

        expect(move).toEqual({
            id: "busy_1",
            kind: "busy",
            title: "Ensayo",
            from: { start: at(17).toISOString(), end: at(20).toISOString() },
            to: { start: at(18).toISOString(), end: at(21).toISOString() },
        });
    });

    it("names a block the API titled with nothing instead of showing an empty question", () => {
        const move = pendingBlockMove({
            id: "avail_105",
            title: "  ",
            start: at(18),
            end: at(21),
            oldStart: at(17),
            oldEnd: at(20),
        });
        expect(move?.title).toBe("Bloque del calendario");
    });

    it("has nothing to move for a block the calendar does not own", () => {
        expect(
            pendingBlockMove({ id: "gig_1", title: "Toque", start: at(18), end: at(21), oldStart: at(17), oldEnd: at(20) })
        ).toBeNull();
    });

    it("has nothing to move when a bound cannot be read", () => {
        expect(
            pendingBlockMove({ id: "busy_1", title: "Ensayo", start: null, end: at(21), oldStart: at(17), oldEnd: at(20) })
        ).toBeNull();
        expect(
            pendingBlockMove({ id: "busy_1", title: "Ensayo", start: at(18), end: at(21), oldStart: null, oldEnd: at(20) })
        ).toBeNull();
    });

    it("has nothing to move for a destination that ends before it starts", () => {
        expect(
            pendingBlockMove({ id: "busy_1", title: "Ensayo", start: at(21), end: at(21), oldStart: at(17), oldEnd: at(20) })
        ).toBeNull();
    });
});

/**
 * Ronda 12: "arrastré «Ensayo» de 17:00–20:00 a 18:00–21:00 y la tarjeta cambió en pantalla y salió un
 * PUT en el mismo instante". El arrastre vuelve a dejar la rejilla como estaba y lo único que queda es
 * la pregunta; nada se escribe hasta que el manager la contesta.
 */
describe("planBlockDrag", () => {
    function drag(overrides: Partial<BlockDragChange["event"]> = {}): BlockDragChange {
        return {
            event: { id: "busy_1", title: "Ensayo", start: at(18), end: at(21), ...overrides },
            oldEvent: { start: at(17), end: at(20) },
            revert: vi.fn(),
        };
    }

    it("puts the block back where it was, so the grid never shows a move that has not been confirmed", () => {
        const change = drag();
        planBlockDrag(change);
        expect(change.revert).toHaveBeenCalledTimes(1);
    });

    it("hands over the question and nothing else: both ranges, the block and its title", () => {
        const change = drag();
        expect(planBlockDrag(change)).toEqual({
            id: "busy_1",
            kind: "busy",
            title: "Ensayo",
            from: { start: at(17).toISOString(), end: at(20).toISOString() },
            to: { start: at(18).toISOString(), end: at(21).toISOString() },
        });
    });

    it("still puts the grid back when there is nothing to ask about", () => {
        const change = drag({ id: "gig_1" });
        expect(planBlockDrag(change)).toBeNull();
        expect(change.revert).toHaveBeenCalledTimes(1);
    });
});
