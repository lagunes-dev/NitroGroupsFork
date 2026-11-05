"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ROUTES } from "@/config/routes";
import { membershipService } from "../membership.service";
import { toProfileVisitsView } from "../profileVisit";

/** Short enough that a visit from a manager shows up on the next look at the panel. */
const VISITS_STALE_MS = 60_000;
const HEADING_ID = "perfil-visitas";

/**
 * "2 grupos miraron tu perfil" with the groups that looked, linked to their public profile (S9).
 * Renders nothing when there are no visits, when they cannot be read or while they load: the
 * notice is a courtesy, never a hole in the panel.
 */
export function ProfileVisits() {
    const visits = useQuery({
        queryKey: ["profile-visits"],
        queryFn: () => membershipService.profileVisits(),
        staleTime: VISITS_STALE_MS,
        retry: false,
    });

    if (!visits.isSuccess) return null;

    const view = toProfileVisitsView(visits.data);
    if (view === null) return null;

    return (
        <section aria-labelledby={HEADING_ID} className="superficie mt-6 rounded-[12px] p-4 sm:p-5">
            <h2 id={HEADING_ID} className="font-semibold text-tinta">{view.headline}</h2>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                {view.groups.map((group) => (
                    <li key={group.id}>
                        <Link
                            href={ROUTES.GROUPS.PUBLIC_PROFILE(group.slug)}
                            className="inline-flex min-h-11 items-center text-acento underline-offset-4 hover:underline"
                        >
                            {group.groupName}
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}
