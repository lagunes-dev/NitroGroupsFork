"use client";

import Link from "next/link";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { LogoutButton } from "@/components/auth";
import { UserTypeEnum } from "@/features/groups/types/User";
import { ROUTES } from "@/config/routes";
import { usePendingMembership } from "@/hooks/usePendingMembership";
import { dashboardEntries, directoryEntry } from "./navigation";
import { NavCount } from "./NavCount";

export function UserMenu() {
    const { user, auth0User, isLoading } = useCurrentUser();
    const pending = usePendingMembership();

    if (isLoading || !auth0User) return null;

    const directory = directoryEntry(pending.hasGroup);
    const entries = dashboardEntries(user?.userType === UserTypeEnum.Musician, pending);
    const displayName = user?.firstName || auth0User.name || auth0User.nickname || auth0User.email;
    const picture = user?.profilePictureUrl || auth0User.picture;

    return (
        <div className="hidden md:flex items-center gap-7">
            <nav aria-label="Principal" className="flex items-center gap-7">
                <Link href={ROUTES.GROUPS.SEARCH} className="text-[0.875rem] text-tinta-2 no-underline hover:text-tinta transition-colors">
                    Explorar grupos
                </Link>
                {directory && (
                    <Link href={directory.href} className="text-[0.875rem] text-tinta-2 no-underline hover:text-tinta transition-colors">
                        {directory.label}
                    </Link>
                )}
                {entries.map((e) => (
                    <Link key={e.label} href={e.href} className="text-[0.875rem] text-tinta no-underline font-medium hover:text-acento transition-colors">
                        {e.label}
                        <NavCount count={e.count} />
                    </Link>
                ))}
            </nav>
            <div className="flex items-center gap-3">
                {picture ? (
                    // eslint-disable-next-line @next/next/no-img-element -- avatar de Auth0/R2 con dominio variable
                    <img src={picture} alt="" className="size-9 rounded-full object-cover" />
                ) : (
                    <span aria-hidden className="size-9 rounded-full bg-fondo-3 grid place-items-center font-semibold">
                        {displayName?.charAt(0).toUpperCase()}
                    </span>
                )}
                <span className="text-tinta-2 text-sm">{displayName}</span>
            </div>
            <LogoutButton />
        </div>
    );
}
