"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription, Button } from "@/components/ui";
import { fieldClass } from "@/features/groups/components/GroupProfile/Common";
import { Avatar } from "./Avatar";
import { membershipService } from "../membership.service";
import { membershipErrorMessage } from "../errors";
import { debounced, normalizeQuery } from "../search";
import type { OpenMusician } from "../types";

const PAGE_SIZE = 10;
const DEBOUNCE_MS = 350;

/** Busca músicos abiertos a unirse por nombre y permite invitarlos. Nunca muestra emails. */
export function MusicianSearch({ groupId }: { groupId: number }) {
    const queryClient = useQueryClient();
    const inputId = useId();
    const [text, setText] = useState("");
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");

    const applyQuery = useMemo(() => debounced((value: string) => { setQuery(normalizeQuery(value)); setPage(1); }, DEBOUNCE_MS), []);
    useEffect(() => () => applyQuery.cancel(), [applyQuery]);

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
            ? "No encontramos músicos abiertos a unirse con ese nombre."
            : `${count} ${count === 1 ? "músico encontrado" : "músicos encontrados"}. Página ${data?.pageNumber} de ${data?.totalPages}.`;

    return (
        <div className="flex flex-col gap-4">
            <div className="max-w-[40rem]">
                <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-tinta">Buscar músicos por nombre</label>
                <input
                    id={inputId}
                    type="search"
                    value={text}
                    onChange={(e) => { setText(e.target.value); applyQuery(e.target.value); }}
                    className={fieldClass}
                    placeholder="Ej. Ana Pérez"
                    autoComplete="off"
                    aria-describedby={`${inputId}-hint`}
                />
                <p id={`${inputId}-hint`} className="mt-2 text-sm text-tinta-2">Solo aparecen músicos que marcaron que están abiertos a unirse a un grupo.</p>
            </div>

            <p role="status" aria-live="polite" className="text-sm text-tinta-2">{summary}</p>
            {notice && <p role="status" className="text-tinta">{notice}</p>}
            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            {results.isError && <p role="alert" className="text-error">No pudimos buscar músicos. Inténtalo de nuevo en un momento.</p>}

            {data && data.items.length > 0 && (
                <ul className="flex flex-col" aria-busy={results.isFetching}>
                    {data.items.map((m) => (
                        <li key={m.userId} className="py-4 flex flex-wrap items-center justify-between gap-4 [&+&]:shadow-[inset_0_1px_0_var(--fondo-3)]">
                            <div className="flex min-w-0 items-center gap-4">
                                <Avatar name={m.fullName} src={m.profilePictureUrl} />
                                <div className="min-w-0">
                                    <p className="font-semibold text-tinta">{m.fullName}</p>
                                    {m.yearsExperience ? <p className="text-sm text-tinta-2">{m.yearsExperience} {m.yearsExperience === 1 ? "año" : "años"} de experiencia</p> : null}
                                </div>
                            </div>
                            <Button size="sm" disabled={invite.isPending} onClick={() => invite.mutate(m)} aria-label={`Invitar a ${m.fullName}`}>Invitar</Button>
                        </li>
                    ))}
                </ul>
            )}

            {data && data.totalPages > 1 && (
                <nav aria-label="Páginas de resultados" className="flex items-center gap-3">
                    <Button size="sm" variant="outline" disabled={!data.hasPreviousPage || results.isFetching} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                    <Button size="sm" variant="outline" disabled={!data.hasNextPage || results.isFetching} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
                </nav>
            )}
        </div>
    );
}
