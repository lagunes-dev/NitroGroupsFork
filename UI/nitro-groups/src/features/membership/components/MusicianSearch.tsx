"use client";

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, UsersRound } from "lucide-react";
import { Alert, AlertDescription, Button, Input } from "@/components/ui";
import { Avatar } from "./Avatar";
import { membershipService } from "../membership.service";
import { membershipErrorMessage } from "../errors";
import { experienceLabel } from "../experience";
import { pendingByMusician, pendingLabel } from "../pending";
import { debounced, normalizeQuery } from "../search";
import type { OpenMusician } from "../types";

/** Id of the search field, so the empty states of the team tab can point at it. */
export const SEARCH_INPUT_ID = "equipo-buscar";

const PAGE_SIZE = 10;
const DEBOUNCE_MS = 350;

/** Busca músicos abiertos a unirse por nombre y permite invitarlos. Nunca muestra emails. */
export function MusicianSearch({ groupId }: { groupId: number }) {
    const queryClient = useQueryClient();
    const [text, setText] = useState("");
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");

    const applyQuery = useMemo(() => debounced((value: string) => { setQuery(normalizeQuery(value)); setPage(1); }, DEBOUNCE_MS), []);
    useEffect(() => () => applyQuery.cancel(), [applyQuery]);

    // Same key as the requests list, so inviting someone updates both at once.
    const groupRequests = useQuery({ queryKey: ["membership-requests", groupId], queryFn: () => membershipService.forGroup(groupId) });
    const pending = useMemo(() => pendingByMusician(groupRequests.data), [groupRequests.data]);

    const results = useQuery({
        queryKey: ["open-musicians", query, page],
        queryFn: () => membershipService.searchOpenMusicians(query, page, PAGE_SIZE),
        placeholderData: keepPreviousData,
    });

    const invite = useMutation({
        mutationFn: (musician: OpenMusician) => membershipService.invite(groupId, musician.userId),
        onSuccess: (_data, musician) => {
            setError("");
            setNotice(`Invitación enviada a ${musician.fullName}.`);
            queryClient.invalidateQueries({ queryKey: ["membership-requests", groupId] });
        },
        onError: (e) => {
            setNotice("");
            setError(membershipErrorMessage(e, "No pudimos enviar la invitación. Inténtalo de nuevo."));
        },
    });

    const data = results.data;
    const count = data?.totalCount ?? 0;
    const summary = results.isError
        ? ""
        : results.isPending
          ? "Buscando músicos…"
          : count === 0
            ? ""
            : `${count} ${count === 1 ? "músico encontrado" : "músicos encontrados"}. Página ${data?.pageNumber} de ${data?.totalPages}.`;

    const emptyMessage = query
        ? `Ningún músico abierto coincide con “${query}”. Prueba con otro nombre o con menos letras.`
        : "Todavía no hay músicos abiertos a unirse a un grupo.";

    return (
        <div className="flex flex-col gap-4">
            <Input
                id={SEARCH_INPUT_ID}
                type="search"
                label="Buscar músicos por nombre"
                icon={<Search aria-hidden />}
                value={text}
                onChange={(e) => { setText(e.target.value); applyQuery(e.target.value); }}
                placeholder="Ej. Ana Pérez"
                autoComplete="off"
                helperText="Solo aparecen músicos que marcaron que están abiertos a unirse a un grupo."
            />

            {notice && <p role="status" className="text-tinta">{notice}</p>}
            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <div role="status" aria-live="polite" className="flex flex-col gap-4">
                <p className="min-h-5 text-sm leading-5 text-tinta-2">{summary}</p>
                {results.isSuccess && count === 0 && (
                    <div className="superficie flex flex-col items-center gap-2 rounded-[12px] px-6 py-10 text-center">
                        <UsersRound aria-hidden className="size-6 text-tinta-2" />
                        <p className="max-w-[48ch] text-tinta">{emptyMessage}</p>
                    </div>
                )}
            </div>

            {results.isError && (
                <div role="alert" className="superficie flex flex-col items-center gap-4 rounded-[12px] px-6 py-10 text-center">
                    <p className="text-error">No pudimos buscar músicos. Inténtalo de nuevo en un momento.</p>
                    <Button size="sm" variant="outline" onClick={() => results.refetch()}>Reintentar</Button>
                </div>
            )}

            {results.isPending && (
                <ul aria-hidden className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }, (_, i) => (
                        <li key={i} className="superficie flex h-[10.5rem] flex-col gap-4 rounded-[12px] p-5">
                            <div className="flex items-center gap-4">
                                <div className="size-12 shrink-0 rounded-full bg-fondo-3 motion-safe:animate-pulse" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 w-3/4 rounded bg-fondo-3 motion-safe:animate-pulse" />
                                    <div className="h-3 w-1/2 rounded bg-fondo-3 motion-safe:animate-pulse" />
                                </div>
                            </div>
                            <div className="mt-auto h-9 rounded-[8px] bg-fondo-3 motion-safe:animate-pulse" />
                        </li>
                    ))}
                </ul>
            )}

            {data && data.items.length > 0 && (
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy={results.isFetching}>
                    {data.items.map((m) => (
                        <li key={m.userId} className="superficie flex flex-col gap-4 rounded-[12px] p-5">
                            <div className="flex min-w-0 items-center gap-4">
                                <Avatar name={m.fullName} src={m.profilePictureUrl} />
                                <div className="min-w-0">
                                    <p className="truncate font-semibold text-tinta" title={m.fullName}>{m.fullName}</p>
                                    <p className={`truncate text-sm ${m.yearsExperience ? "text-tinta-2" : "text-tinta-2/80"}`}>{experienceLabel(m.yearsExperience)}</p>
                                </div>
                            </div>
                            {pending.has(m.userId) ? (
                                <Button size="sm" variant="outline" className="mt-auto w-full" disabled aria-label={`${pendingLabel(pending.get(m.userId) ?? null)}: ${m.fullName}`}>{pendingLabel(pending.get(m.userId) ?? null)}</Button>
                            ) : (
                                <Button size="sm" className="mt-auto w-full" disabled={invite.isPending} onClick={() => invite.mutate(m)} aria-label={`Invitar a ${m.fullName}`}>Invitar</Button>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {data && data.totalPages > 1 && (
                <nav aria-label="Páginas de resultados" className="flex items-center justify-between gap-4">
                    <span aria-hidden className="text-sm text-tinta-2">Página {data.pageNumber} de {data.totalPages}</span>
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" disabled={!data.hasPreviousPage || results.isFetching} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                        <Button size="sm" variant="outline" disabled={!data.hasNextPage || results.isFetching} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
                    </div>
                </nav>
            )}
        </div>
    );
}
