import { useCallback, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    groupAvailabilityService,
    type UpdateAvailabilityRequest,
    type UpdateBusyScheduleRequest,
} from "../services/groupAvailability.service";
import type { PendingBlockMove } from "../blockMove";

/**
 * Moving a block, in two steps (round 12): the drag leaves a question, and the manager answers it.
 *
 * This hook is the only writer of a move, and it writes from `confirm`, never from `request`. That is the
 * rule the round-12 report broke: "Moving a block writes instantly, no confirm, no undo". Keeping the
 * write here is what makes it testable, and it uses the same two service functions the rest of the
 * calendar already writes with — there is no second way to write the data.
 */
export function useBlockMove(groupId: number) {
    const queryClient = useQueryClient();
    const [pending, setPending] = useState<PendingBlockMove | null>(null);
    /* Una escritura a la vez: dos toques en el mismo instante no pueden mandar el movimiento dos veces. */
    const writing = useRef(false);

    const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: ["schedules", groupId] });
    };

    const updateAvailability = useMutation({
        mutationFn: (req: { id: string; data: UpdateAvailabilityRequest }) =>
            groupAvailabilityService.updateAvailability(groupId, req.id, req.data),
        onSuccess: refresh,
    });

    const updateBusy = useMutation({
        mutationFn: (req: { id: string; data: UpdateBusyScheduleRequest }) =>
            groupAvailabilityService.updateBusySchedule(groupId, req.id, req.data),
        onSuccess: refresh,
    });

    /** Remembers what the manager dragged. Nothing is written here: this is the question. */
    const request = (move: PendingBlockMove) => setPending(move);

    const cancel = useCallback(() => setPending(null), []);

    /** The answer. The question closes when the server answered, not when the button was pressed. */
    const confirm = () => {
        /* Un segundo toque no escribe otra vez: el arrastre es una pregunta y se contesta una sola vez. */
        if (!pending || writing.current) return;
        writing.current = true;
        const data = { start: pending.to.start, end: pending.to.end };
        const settled = {
            onSuccess: () => setPending(null),
            onSettled: () => {
                writing.current = false;
            },
        };
        if (pending.kind === "avail") updateAvailability.mutate({ id: pending.id, data }, settled);
        else updateBusy.mutate({ id: pending.id, data }, settled);
    };

    return {
        pending,
        request,
        cancel,
        confirm,
        isSaving: updateAvailability.isPending || updateBusy.isPending,
        failed: updateAvailability.isError || updateBusy.isError,
    };
}
