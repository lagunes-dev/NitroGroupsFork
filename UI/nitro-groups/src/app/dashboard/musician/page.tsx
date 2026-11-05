"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, TabItem, TabbedSection } from "@/components/ui";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePendingMembership } from "@/hooks/usePendingMembership";
import { useMyMemberships } from "@/hooks/useMyMemberships";
import { showMyGroupsTab } from "@/features/membership/roles";
import { joinBannerText } from "@/features/membership/counts";
import { groupsService } from "@/features/groups/services/groups.service";
import GroupProfile from "@/features/groups/components/GroupProfile";
import GroupCalendar from "@/features/groupAvailability/components/GroupCalendar";
import GroupGallery from "@/features/groupMedia/components/GroupGallery";
import { GroupInbox } from "@/features/bookings/components/GroupInbox";
import { TeamTab } from "@/features/membership/components/TeamTab";
import { MyInvitations } from "@/features/membership/components/MyInvitations";
import { MyGroups } from "@/features/membership/components/MyGroups";
import { MusicianProfileForm } from "@/features/musicians/components/MusicianProfileForm";
import { UserTypeEnum } from "@/features/groups/types/User";

/**
 * Panel del grupo. Arriba, quién es y en qué estado está; abajo, el trabajo diario:
 * responder los pedidos de fecha primero, después la galería y el calendario.
 */
export default function MusicianDashboardPage() {
  const { user } = useCurrentUser();
  const userId = user?.id;

  const { data: group, isPending: groupPending } = useQuery({
    queryKey: ["music-group", userId],
    queryFn: async () => {
      if (!userId) throw new Error("Usuario no autenticado");
      return groupsService.getByUserId(userId);
    },
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 10,
  });

  const groupId = group?.id;
  const memberships = useMyMemberships();
  const myGroupsTab = showMyGroupsTab({ memberships: memberships.data, managedGroupId: groupId ?? null });
  const { invitations, joinRequests } = usePendingMembership();
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
  const tabsRef = useRef<HTMLDivElement>(null);
  const banner = groupId ? joinBannerText(joinRequests) : null;

  const showTab = (tabKey: string) => {
    setActiveTab(tabKey);
    // The panel mounts after the state change: move focus there once it exists.
    setTimeout(() => tabsRef.current?.querySelector<HTMLElement>('[role="tabpanel"]')?.focus(), 0);
  };

  return (
    <div className="page-frame pb-24">
      {banner && (
        <div className="superficie mt-6 flex flex-col gap-3 rounded-[12px] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p role="status" aria-live="polite" className="font-semibold text-tinta">{banner}</p>
          <Button variant="outline" onClick={() => showTab("equipo")}>Ver solicitudes</Button>
        </div>
      )}

      <GroupProfile />

      {/*
        Las pestañas del grupo solo existen con grupo; "Invitaciones" es del músico y se queda
        aunque no tenga uno (así puede aceptar la invitación a su primer grupo). Mientras el
        grupo carga no se muestra nada: la cabecera ya explica la carga o el error.
      */}
      {!groupPending || groupId ? (
        <div ref={tabsRef}>
        <TabbedSection label="Gestión del grupo" className="mt-16 md:mt-20" activeKey={activeTab} onActiveKeyChange={setActiveTab}>
          {groupId ? (
            <TabItem title="Pedidos de fecha" tabKey="pedidos">
              <GroupInbox groupId={groupId} />
            </TabItem>
          ) : null}
          {groupId ? (
            <TabItem title="Equipo" count={joinRequests} tabKey="equipo">
              <TeamTab groupId={groupId} />
            </TabItem>
          ) : null}
          {groupId ? (
            <TabItem title="Galería" tabKey="galeria">
              <GroupGallery />
            </TabItem>
          ) : null}
          {groupId ? (
            <TabItem title="Calendario" tabKey="calendario">
              <GroupCalendar groupId={groupId} mode="private" />
            </TabItem>
          ) : null}
          {myGroupsTab ? (
            <TabItem title="Mis grupos" tabKey="mis-grupos">
              <MyGroups managedGroupId={groupId ?? null} />
            </TabItem>
          ) : null}
          <TabItem title="Invitaciones" count={invitations} tabKey="invitaciones">
            <MyInvitations onViewMyGroups={() => showTab("mis-grupos")} />
          </TabItem>
          {/*
            "Mi perfil" va al final a propósito: es el trabajo menos frecuente del panel y, al no ser
            la primera pestaña, no cambia la pestaña que abre el panel hoy.
          */}
          {userId && user?.userType === UserTypeEnum.Musician ? (
            <TabItem title="Mi perfil" tabKey="mi-perfil">
              <MusicianProfileForm userId={userId} />
            </TabItem>
          ) : null}
        </TabbedSection>
        </div>
      ) : null}
    </div>
  );
}
