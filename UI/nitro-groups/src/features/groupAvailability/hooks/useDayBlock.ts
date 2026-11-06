import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { groupAvailabilityService } from "../services/groupAvailability.service";
import type { ScheduleEventDto } from "../services/groupAvailability.service";
import { dayBounds, wholeDayBlocks } from "../blockDay";

/**
 * Un día visto por el manager: qué bloques lo reclaman entero y las dos escrituras que el arrastre del
 * calendario ya usa (crear y borrar un bloque ocupado). No hay una segunda forma de escribir el dato.
 */
export function useDayBlock({ groupId, day }: { groupId: number; day: string }) {
    const queryClient = useQueryClient();
    const bounds = dayBounds(day);

    const events = useQuery<ScheduleEventDto[]>({
        queryKey: ["day-block", groupId, day],
        queryFn: () => groupAvailabilityService.getGroupSchedules(groupId, bounds!.start, bounds!.end),
        enabled: bounds !== null,
    });

    const blocks = wholeDayBlocks(events.data ?? [], day);

    const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: ["day-block", groupId] });
        // La agenda pinta los mismos bloques con su propia clave: se refrescan juntos.
        void queryClient.invalidateQueries({ queryKey: ["schedules", groupId] });
    };

    const block = useMutation({
        mutationFn: () =>
            groupAvailabilityService.createBusySchedule(groupId, {
                title: "No disponible",
                start: bounds!.start,
                end: bounds!.end,
                source: "personal",
            }),
        onSuccess: refresh,
    });

    const unblock = useMutation({
        mutationFn: async () => {
            for (const item of blocks) {
                if (item.id.startsWith("avail_")) await groupAvailabilityService.removeAvailability(groupId, item.id);
                else await groupAvailabilityService.removeBusySchedule(groupId, item.id);
            }
        },
        onSuccess: refresh,
    });

    // Como en el arrastre, el aviso habla del último cambio enviado: si el siguiente sale bien, se va.
    const last = block.submittedAt > unblock.submittedAt ? block : unblock;

    return {
        isBlocked: blocks.length > 0,
        /** While the day is being read the control cannot claim whether it is already blocked. */
        isChecking: events.isPending,
        isSaving: block.isPending || unblock.isPending,
        failed: last.isError,
        block,
        unblock,
    };
}
