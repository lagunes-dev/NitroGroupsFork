// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBlockMove } from "./useBlockMove";
import type { PendingBlockMove } from "../blockMove";

const { updateAvailability, updateBusySchedule } = vi.hoisted(() => ({
    updateAvailability: vi.fn(),
    updateBusySchedule: vi.fn(),
}));
vi.mock("../services/groupAvailability.service", () => ({
    groupAvailabilityService: { updateAvailability, updateBusySchedule },
}));

function at(hour: number): string {
    return new Date(2026, 11, 4, hour).toISOString();
}

/** El movimiento que el arrastre dejó como pregunta: "Ensayo" de 17:00–20:00 a 18:00–21:00. */
const MOVE: PendingBlockMove = {
    id: "busy_1",
    kind: "busy",
    title: "Ensayo",
    from: { start: at(17), end: at(20) },
    to: { start: at(18), end: at(21) },
};

const MOVE_AVAIL: PendingBlockMove = { ...MOVE, id: "avail_105", kind: "avail", title: "Disponible" };

function render(groupId = 1) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return renderHook(() => useBlockMove(groupId), { wrapper });
}

beforeEach(() => {
    updateAvailability.mockReset();
    updateAvailability.mockResolvedValue({});
    updateBusySchedule.mockReset();
    updateBusySchedule.mockResolvedValue({});
});

/**
 * Ronda 12: "Moving a block writes instantly, no confirm, no undo: dragged «Ensayo» 17:00–20:00 →
 * 18:00–21:00; the card changed on screen and a PUT went out the same instant." Mover un bloque es una
 * decisión: primero la pregunta, después la escritura.
 */
describe("useBlockMove · nada se escribe antes de que el manager confirme", () => {
    it("asks first and writes nothing while the question is open", () => {
        const { result } = render();

        act(() => result.current.request(MOVE));

        expect(result.current.pending).toEqual(MOVE);
        expect(updateBusySchedule).not.toHaveBeenCalled();
        expect(updateAvailability).not.toHaveBeenCalled();
    });

    it("writes the block the manager confirmed, once, with both new bounds", async () => {
        const { result } = render(1);

        act(() => result.current.request(MOVE));
        act(() => result.current.confirm());

        await waitFor(() =>
            expect(updateBusySchedule).toHaveBeenCalledWith(1, "busy_1", { start: at(18), end: at(21) })
        );
        expect(updateBusySchedule).toHaveBeenCalledTimes(1);
        // La pregunta se cierra cuando la respuesta del servidor llega, no al pulsar.
        await waitFor(() => expect(result.current.pending).toBeNull());
    });

    it("writes a marked availability through its own endpoint", async () => {
        const { result } = render(1);

        act(() => result.current.request(MOVE_AVAIL));
        expect(updateAvailability).not.toHaveBeenCalled();
        act(() => result.current.confirm());

        await waitFor(() =>
            expect(updateAvailability).toHaveBeenCalledWith(1, "avail_105", { start: at(18), end: at(21) })
        );
        expect(updateBusySchedule).not.toHaveBeenCalled();
    });

    it("cancelling forgets the move and writes nothing at all", () => {
        const { result } = render();

        act(() => result.current.request(MOVE));
        act(() => result.current.cancel());

        expect(result.current.pending).toBeNull();
        expect(updateBusySchedule).not.toHaveBeenCalled();
        expect(updateAvailability).not.toHaveBeenCalled();
    });

    it("never writes twice over the same question", async () => {
        const { result } = render();

        act(() => result.current.request(MOVE));
        act(() => result.current.confirm());
        act(() => result.current.confirm());

        await waitFor(() => expect(updateBusySchedule).toHaveBeenCalledTimes(1));
    });
});
