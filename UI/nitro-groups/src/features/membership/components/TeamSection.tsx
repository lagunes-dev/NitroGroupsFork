"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { UserRoundPlus } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { membershipService } from "../membership.service";
import { teamCountLabel, teamHeadingLabel, teamQueryKey, toTeamView, type TeamMemberView } from "../team";
import { Avatar } from "./Avatar";
import { RequestSkeleton } from "./RequestCard";
import { focusMusicianSearch } from "./searchFocus";

/** Short on purpose: a manager who just accepted someone expects to see them next time. */
const TEAM_STALE_MS = 30_000;
const SECTION_ID = "equipo-miembros";

/**
 * "El equipo": the group's real members with their role and profile link, first thing in the tab.
 * The rows come from `GET api/groups/{id}/team`; the invitation search and the pending answers
 * stay below, so the manager sees the team they recognise before the work to grow it.
 */
export function TeamSection({ groupId }: { groupId: number }) {
    const team = useQuery({
        queryKey: teamQueryKey(groupId),
        queryFn: () => membershipService.team(groupId),
        staleTime: TEAM_STALE_MS,
    });

    if (team.isPending) return (
        <section aria-labelledby={SECTION_ID}>
            <h3 id={SECTION_ID} className="type-heading text-2xl">El equipo</h3>
            <div aria-busy className="mt-4">
                <span className="sr-only" role="status">Cargando el equipo…</span>
                <RequestSkeleton rows={3} />
            </div>
        </section>
    );

    if (team.isError) return (
        <section aria-labelledby={SECTION_ID}>
            <h3 id={SECTION_ID} className="type-heading text-2xl">El equipo</h3>
            <div role="alert" className="superficie mt-4 flex flex-col items-center gap-4 rounded-[12px] px-6 py-8 text-center">
                <p className="max-w-[48ch] text-error">No pudimos cargar el equipo. Inténtalo de nuevo en un momento.</p>
                <Button variant="outline" className="h-11 sm:h-10" onClick={() => team.refetch()}>Reintentar</Button>
            </div>
        </section>
    );

    const members = toTeamView(team.data);

    return (
        <section aria-labelledby={SECTION_ID}>
            <h3 id={SECTION_ID} className="type-heading text-2xl">{teamHeadingLabel(members.length)}</h3>
            {members.length === 0 ? (
                <div className="superficie mt-4 flex flex-col items-center gap-4 rounded-[12px] px-6 py-10 text-center">
                    <UserRoundPlus aria-hidden className="size-6 text-tinta-2" />
                    <p className="max-w-[48ch] text-tinta">Todavía no hay músicos en el equipo.</p>
                    <p className="max-w-[48ch] text-tinta-2">Invita a un músico desde la búsqueda de abajo: en cuanto acepte, aparecerá en esta lista.</p>
                    <Button variant="outline" className="h-11 sm:h-10" onClick={focusMusicianSearch}>Buscar músicos para invitar</Button>
                </div>
            ) : (
                <ul aria-label={teamCountLabel(members.length)} aria-busy={team.isFetching} className="mt-4 flex flex-col gap-4">
                    {members.map((member) => <TeamMemberRow key={member.userId} member={member} />)}
                </ul>
            )}
        </section>
    );
}

/**
 * One member: avatar and name on the left, the role as a chip, the join date as secondary text.
 * The name is the profile link only when the id behind it is a real user.
 */
function TeamMemberRow({ member: m }: { member: TeamMemberView }) {
    return (
        <li className="superficie grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 rounded-[12px] p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:p-5">
            <Avatar name={m.fullName} src={m.profilePictureUrl} />
            <div className="min-w-0">
                <p className="font-semibold text-tinta">
                    {m.profileHref ? (
                        <Link
                            href={m.profileHref}
                            aria-label={`Ver el perfil de ${m.fullName}`}
                            className="inline-flex min-h-11 max-w-full min-w-0 items-center underline decoration-acento decoration-2 underline-offset-4"
                        >
                            <span className="truncate">{m.fullName}</span>
                        </Link>
                    ) : (
                        <span className="inline-flex min-h-11 max-w-full items-center truncate">{m.fullName}</span>
                    )}
                </p>
                {m.joinedLabel && (
                    <p className="text-sm text-tinta-2">
                        {m.joinedAt ? <time dateTime={m.joinedAt}>{m.joinedLabel}</time> : m.joinedLabel}
                    </p>
                )}
            </div>
            {/* The role always reads as text: the colour never carries it alone. */}
            <Badge className="col-span-2 justify-self-start sm:col-span-1 sm:justify-self-end">Rol: {m.roleLabel}</Badge>
        </li>
    );
}
