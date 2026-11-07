"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, UserPlus } from "lucide-react";
import { Button } from "@/components/ui";
import { membershipService } from "../membership.service";
import { membershipErrorMessage } from "../errors";
import { useInviteOffer } from "../useInviteOffer";

interface InviteToMyGroupProps {
    musicianUserId: number;
    musicianName: string;
    isOpenToJoin: boolean;
}

/**
 * "Invitar a mi grupo", for the directory cards and the public musician profile. It renders
 * nothing unless the viewer manages a group and the musician can be invited: clients do not hire
 * musicians, groups invite them. A musician already in the group or with a pending row gets a
 * status line instead of a button.
 */
export function InviteToMyGroup({ musicianUserId, musicianName, isOpenToJoin }: InviteToMyGroupProps) {
    const queryClient = useQueryClient();
    const { offer, groupId } = useInviteOffer({ musicianUserId, isOpenToJoin });

    const send = useMutation({
        mutationFn: () => membershipService.invite(groupId!, musicianUserId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["membership-requests", groupId] });
            queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
        },
    });

    // Once sent, the pending row flips the offer to "pending": keep saying what just happened.
    if (send.isSuccess) {
        return (
            <p role="status" className="flex min-h-11 items-center gap-2 text-sm text-ok">
                <Check aria-hidden className="size-4 shrink-0" />
                Invitación enviada a {musicianName}.
            </p>
        );
    }

    if (offer.kind === "hidden") return null;
    if (offer.kind === "pending") return <p role="status" className="flex min-h-11 items-center text-sm text-tinta-2">{offer.label}</p>;
    if (offer.kind === "member") return <p role="status" className="flex min-h-11 items-center text-sm text-tinta-2">Ya está en tu grupo</p>;

    return (
        <div className="flex flex-col gap-2">
            <Button
                type="button"
                variant="outline"
                className="h-11 w-full sm:w-auto"
                disabled={send.isPending}
                onClick={() => send.mutate()}
                aria-label={`Invitar a ${musicianName} a mi grupo`}
            >
                <UserPlus aria-hidden />
                {send.isPending ? "Enviando…" : "Invitar a mi grupo"}
            </Button>
            {send.isError && (
                <p role="alert" className="text-sm text-error">
                    {membershipErrorMessage(send.error, "No pudimos enviar la invitación. Inténtalo de nuevo.")}
                </p>
            )}
        </div>
    );
}
