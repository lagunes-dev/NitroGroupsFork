/**
 * Moving a block (round 12).
 *
 * The manager reported the worst kind of control: "dragged 'Ensayo' 17:00–20:00 → 18:00–21:00; the card
 * changed on screen and a PUT went out the same instant". A finished drag is not a decision, it is a
 * question, and a question has two places in it: where the block is and where it would go. This module
 * turns what FullCalendar hands over into that question, and puts the grid back where it was while the
 * manager answers. It writes nothing: `useBlockMove` is the only writer, and only after a confirmation.
 */

/** The two kinds of block the calendar lets the manager drag, by the API's own id prefix. */
export type BlockKind = "avail" | "busy";

/** Which kind of block an id names; `null` when the calendar must not move it (a confirmed gig, say). */
export function blockKindOf(id: string): BlockKind | null {
    if (id.startsWith("avail_")) return "avail";
    if (id.startsWith("busy_")) return "busy";
    return null;
}

export interface BlockSpan {
    start: string;
    end: string;
}

/** A move the manager asked for: not a move that happened. Both places travel, so the question is exact. */
export interface PendingBlockMove {
    id: string;
    kind: BlockKind;
    title: string;
    /** The bounds the block has right now, so the dialog can say what it moves. */
    from: BlockSpan;
    /** Where the manager dropped it, so the dialog can say where it would go. */
    to: BlockSpan;
}

/** What the question says when the API never gave the block a title. */
export const UNTITLED_BLOCK = "Bloque del calendario";

export function pendingBlockMove(input: {
    id: string;
    title?: string | null;
    start: Date | null;
    end: Date | null;
    oldStart: Date | null;
    oldEnd: Date | null;
}): PendingBlockMove | null {
    const kind = blockKindOf(input.id);
    if (!kind) return null;

    const { start, end, oldStart, oldEnd } = input;
    if (!start || !end || !oldStart || !oldEnd) return null;
    if (end.getTime() <= start.getTime()) return null;

    return {
        id: input.id,
        kind,
        title: (input.title ?? "").trim() || UNTITLED_BLOCK,
        from: { start: oldStart.toISOString(), end: oldEnd.toISOString() },
        to: { start: start.toISOString(), end: end.toISOString() },
    };
}

/** The part of FullCalendar's change argument this rule needs; anything shaped like it fits. */
export interface BlockDragChange {
    event: { id: string; title?: string | null; start: Date | null; end: Date | null };
    oldEvent: { start: Date | null; end: Date | null };
    revert: () => void;
}

/**
 * What a finished drag does: the grid goes back to where the block was, and what is left is the question.
 * Reverting first is what keeps the screen honest — nothing on it claims a move that has not been agreed.
 */
export function planBlockDrag(change: BlockDragChange): PendingBlockMove | null {
    const move = pendingBlockMove({
        id: change.event.id,
        title: change.event.title,
        start: change.event.start,
        end: change.event.end,
        oldStart: change.oldEvent.start,
        oldEnd: change.oldEvent.end,
    });
    change.revert();
    return move;
}
