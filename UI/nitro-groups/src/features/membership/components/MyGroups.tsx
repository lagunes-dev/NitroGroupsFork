"use client";

import Link from "next/link";
import { ExternalLink, Settings } from "lucide-react";
import { Alert, AlertDescription, Badge, Button } from "@/components/ui";
import { ROUTES } from "@/config/routes";
import { useMyMemberships } from "@/hooks/useMyMemberships";
import { canManage, roleLabel } from "../roles";
import type { MyMembership } from "../types";
import { Avatar } from "./Avatar";

/** Groups the musician belongs to, with their role. Only the group in `managedGroupId` has management tools in this panel. */
export function MyGroups({ managedGroupId }: { managedGroupId: number | null }) {
    const memberships = useMyMemberships();

    if (memberships.isPending) return (
        <div aria-busy className="py-6">
            <span className="sr-only" role="status">Cargando tus grupos…</span>
            <ul aria-hidden className="flex flex-col gap-4">
                {[0, 1].map((i) => (
                    <li key={i} className="superficie flex items-center gap-4 rounded-[12px] p-4 sm:p-5">
                        <div className="size-12 shrink-0 rounded-full bg-fondo-3 motion-safe:animate-pulse" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 w-1/3 rounded bg-fondo-3 motion-safe:animate-pulse" />
                            <div className="h-3 w-1/2 rounded bg-fondo-3 motion-safe:animate-pulse" />
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );

    if (memberships.isError) return (
        <div className="py-6">
            <Alert variant="destructive">
                <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    No pudimos cargar tus grupos.
                    <Button variant="outline" className="h-11 sm:h-10" onClick={() => memberships.refetch()}>Reintentar</Button>
                </AlertDescription>
            </Alert>
        </div>
    );

    return (
        <div className="py-6">
            <p className="max-w-[60ch] text-tinta-2">Solo el Dueño y los Managers gestionan un grupo; como Miembro puedes ver su perfil público.</p>
            <ul className="mt-6 flex flex-col gap-4">
                {memberships.data.map((m) => <GroupCard key={m.groupId} membership={m} managed={m.groupId === managedGroupId} />)}
            </ul>
        </div>
    );
}

function GroupCard({ membership: m, managed }: { membership: MyMembership; managed: boolean }) {
    return (
        <li className="superficie flex flex-col gap-4 rounded-[12px] p-4 sm:flex-row sm:items-center sm:p-5">
            <div className="flex min-w-0 flex-1 items-center gap-4">
                <Avatar name={m.groupName} src={m.profilePictureUrl} />
                <div className="min-w-0">
                    <p className="truncate font-semibold text-tinta">{m.groupName}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Badge>Rol: {roleLabel(m.role)}</Badge>
                        {managed && canManage(m.role) && (
                            <span className="inline-flex items-center gap-1.5 text-sm text-tinta-2">
                                <Settings aria-hidden className="size-4" />
                                Lo gestionas en este panel
                            </span>
                        )}
                    </div>
                </div>
            </div>
            {m.slug && (
                <Button asChild variant="outline" className="h-11 w-full sm:h-10 sm:w-auto">
                    <Link href={ROUTES.GROUPS.PUBLIC_PROFILE(m.slug)} aria-label={`Ver perfil público de ${m.groupName}`}>
                        Ver perfil público
                        <ExternalLink aria-hidden />
                    </Link>
                </Button>
            )}
        </li>
    );
}
