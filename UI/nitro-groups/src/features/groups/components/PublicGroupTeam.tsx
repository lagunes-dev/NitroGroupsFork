import Link from "next/link";
import { PUBLIC_TEAM_EMPTY, PUBLIC_TEAM_HEADING, publicTeamCountLabel, toPublicTeamView } from "../lib/publicTeam";
import type { PublicGroupTeamMember } from "../types/PublicGroupTeamMember";

/**
 * "El equipo" del perfil público (S14): los miembros activos con nombre, rol e instrumento ·
 * ciudad. Una fila por persona, legible desde 390 px: el nombre arriba y el oficio debajo. Con la
 * lista vacía la sección se explica en una línea en vez de dejar un título solo.
 */
export function PublicGroupTeam({ members }: { members: PublicGroupTeamMember[] }) {
    const rows = toPublicTeamView(members);

    return (
        <section className="page-frame mt-[var(--section-gap)]" aria-labelledby="equipo">
            <h2 id="equipo" className="titulo">{PUBLIC_TEAM_HEADING}</h2>

            {rows.length === 0 ? (
                <p className="mt-4 max-w-[52ch] text-lg text-tinta-2">{PUBLIC_TEAM_EMPTY}</p>
            ) : (
                <ul className="mt-8 max-w-[52rem] border-t border-linea" aria-label={publicTeamCountLabel(rows.length)}>
                    {rows.map((row) => (
                        <li
                            key={row.userId}
                            className="flex flex-col gap-1 border-b border-linea py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
                        >
                            <span className="type-heading text-xl">
                                {row.profileHref ? (
                                    <Link href={row.profileHref} className="no-underline hover:text-acento transition-colors">
                                        {row.fullName}
                                    </Link>
                                ) : (
                                    row.fullName
                                )}
                            </span>
                            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-tinta-2">
                                <span>{row.roleLabel}</span>
                                {row.craftLabel && <span className="tabular">{row.craftLabel}</span>}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
