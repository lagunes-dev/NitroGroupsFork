"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription, Button } from "@/components/ui";
import { ROUTES } from "@/config/routes";
import { todayInMexico } from "@/lib/format";
import { splitAgenda } from "../agenda";
import { gigsService } from "../gigs.service";
import { MY_GIGS_KEY, MY_NOTICES_TODAY_KEY, useMyGigNoticesToday, useMyGigs } from "../gigs.queries";
import { isNoticeKind, noticesByGig, type GigNoticeKind, type NoticePayload } from "../notices";
import type { GigAnswer, GigPayload } from "../types";
import { answerNotice, toGigView, type GigView } from "../viewModel";
import { GigCard, GigCardSkeleton } from "./GigCard";

interface Answer {
    id: number;
    status: GigAnswer;
}

interface NoticeRequest {
    id: number;
    groupId: number;
    kind: GigNoticeKind;
}

/**
 * "Mi agenda": the caller's gigs, upcoming first and the history folded away. Answering is optimistic
 * — the row changes at once — and the save is announced in a live region while focus stays on the
 * button that was pressed. A failed save restores the previous answer and offers the same one again.
 */
export function MyAgenda() {
    const gigs = useMyGigs();
    const noticesToday = useMyGigNoticesToday();
    const queryClient = useQueryClient();
    const [notice, setNotice] = useState("");
    const [failure, setFailure] = useState<Answer | null>(null);
    const [notifyFailure, setNotifyFailure] = useState<NoticeRequest | null>(null);

    const answer = useMutation({
        mutationFn: (input: Answer) => gigsService.answer(input.id, input.status),
        onMutate: async (input) => {
            await queryClient.cancelQueries({ queryKey: MY_GIGS_KEY });
            const previous = queryClient.getQueryData<GigPayload[]>(MY_GIGS_KEY);
            queryClient.setQueryData<GigPayload[]>(MY_GIGS_KEY, (rows) =>
                rows?.map((row) => (row.id === input.id ? { ...row, attendance: input.status } : row)),
            );
            return { previous };
        },
        onSuccess: (_data, input) => {
            setFailure(null);
            const gig = queryClient.getQueryData<GigPayload[]>(MY_GIGS_KEY)?.find((row) => row.id === input.id);
            const view = gig ? toGigView(gig) : null;
            setNotice(view ? answerNotice(input.status, view.dateLabel, view.group.name) : "Guardamos tu respuesta.");
        },
        onError: (_error, input, context) => {
            // The answer did not land: the row goes back to what the server last told us.
            if (context?.previous) queryClient.setQueryData(MY_GIGS_KEY, context.previous);
            setNotice("");
            setFailure(input);
        },
        // Also after a failure: a 404 here almost always means the agenda was stale.
        onSettled: () => queryClient.invalidateQueries({ queryKey: MY_GIGS_KEY }),
    });

    // The notice is one tap and no text: the slot changes as if it had already landed, and the
    // server's answer (or its failure) puts the row back in line.
    const notify = useMutation({
        mutationFn: (input: NoticeRequest) => gigsService.notify(input.groupId, input.id, input.kind),
        onMutate: async (input) => {
            await queryClient.cancelQueries({ queryKey: MY_NOTICES_TODAY_KEY });
            const previous = queryClient.getQueryData<NoticePayload[]>(MY_NOTICES_TODAY_KEY) ?? [];
            queryClient.setQueryData<NoticePayload[]>(MY_NOTICES_TODAY_KEY, [
                ...previous.filter((row) => !(row.gigId === input.id && row.kind === input.kind)),
                { gigId: input.id, kind: input.kind },
            ]);
            return { previous };
        },
        onSuccess: () => setNotifyFailure(null),
        onError: (_error, input, context) => {
            if (context?.previous) queryClient.setQueryData(MY_NOTICES_TODAY_KEY, context.previous);
            setNotifyFailure(input);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: MY_NOTICES_TODAY_KEY }),
    });

    if (gigs.isPending) {
        return (
            <div aria-busy className="py-6">
                <span role="status" className="sr-only">
                    Cargando tus toques…
                </span>
                <GigCardSkeleton rows={3} />
            </div>
        );
    }

    if (gigs.isError) {
        return (
            <div className="py-6">
                <Alert variant="destructive">
                    <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        No pudimos cargar tu agenda.
                        <Button variant="outline" className="h-11 sm:h-10" onClick={() => gigs.refetch()}>
                            Reintentar
                        </Button>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    if (gigs.data.length === 0) {
        return (
            <div className="py-6">
                <div className="superficie flex flex-col items-start gap-4 rounded-[12px] p-6 sm:p-8">
                    <h3 className="type-heading text-2xl">No tienes toques confirmados todavía</h3>
                    <p className="max-w-[52ch] text-tinta-2">
                        Cuando un grupo acepte una fecha en la que tocas, aparece aquí con el lugar y la hora, y puedes
                        confirmar tu asistencia.
                    </p>
                    <Button asChild variant="outline" className="h-11 sm:h-10">
                        <Link href={ROUTES.GROUPS.SEARCH}>Explorar grupos</Link>
                    </Button>
                </div>
            </div>
        );
    }

    const { upcoming, past } = splitAgenda(gigs.data, todayInMexico());
    const byGig = noticesByGig(noticesToday.data);
    const sentKindsOf = (gigId: unknown): string[] => {
        const id = typeof gigId === "number" ? gigId : Number(gigId);
        return Number.isFinite(id) ? (byGig[id] ?? []).map((row) => row.kind).filter(isNoticeKind) : [];
    };
    // El toque pasado se dibuja sin botones ni avisos: la fecha ya quedó atrás (ronda 6, T32).
    const card = (row: GigPayload, past: boolean) => {
        const gig: GigView = toGigView(row, sentKindsOf(row.id));
        const id = gig.id;
        return (
            <GigCard
                key={id}
                gig={gig}
                past={past}
                saving={answer.isPending && answer.variables?.id === id}
                failed={failure?.id === id}
                onAnswer={(status) => answer.mutate({ id, status })}
                onRetry={() => failure && answer.mutate(failure)}
                notifying={notify.isPending && notify.variables?.id === id ? notify.variables.kind : null}
                notifyFailed={notifyFailure?.id === id}
                onNotify={(kind) => {
                    setNotice("");
                    notify.mutate({ id, groupId: gig.group.id ?? 0, kind });
                }}
            />
        );
    };

    return (
        <div className="flex flex-col gap-10 py-6">
            <p className="max-w-[62ch] text-tinta-2">
                Los toques de tus grupos, del más cercano al más lejano. Confirma o avisa que no puedes: el grupo ve tu
                respuesta.
            </p>

            {/* El aviso del último guardado. Sin texto la región sigue ahí, vacía, para anunciar el siguiente. */}
            <p role="status" aria-live="polite" className={notice ? "text-sm text-ok" : "sr-only"}>
                {notice}
            </p>

            <section aria-labelledby="mi-agenda-proximos">
                <h3 id="mi-agenda-proximos" className="type-heading text-2xl">
                    Próximos <span className="text-base font-normal text-tinta-2">({upcoming.length})</span>
                </h3>
                {upcoming.length > 0 ? (
                    <ul className="mt-4 flex flex-col gap-4">{upcoming.map((row) => card(row, false))}</ul>
                ) : (
                    <p className="mt-2 text-tinta-2">No tienes toques próximos.</p>
                )}
            </section>

            {past.length > 0 && (
                <details>
                    <summary className="type-heading cursor-pointer text-2xl">
                        Pasados <span className="text-base font-normal text-tinta-2">({past.length})</span>
                    </summary>
                    <ul className="mt-4 flex flex-col gap-4">{past.map((row) => card(row, true))}</ul>
                </details>
            )}
        </div>
    );
}
