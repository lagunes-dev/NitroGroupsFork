"use client";

import { useQuery } from "@tanstack/react-query";
import { TabItem, TabbedSection } from "@/components/ui";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePendingMembership } from "@/hooks/usePendingMembership";
import { tabTitle } from "@/features/membership/counts";
import { groupsService } from "@/features/groups/services/groups.service";
import GroupProfile from "@/features/groups/components/GroupProfile";
import GroupCalendar from "@/features/groupAvailability/components/GroupCalendar";
import GroupGallery from "@/features/groupMedia/components/GroupGallery";
import { GroupInbox } from "@/features/bookings/components/GroupInbox";
import { TeamTab } from "@/features/membership/components/TeamTab";
import { MyInvitations } from "@/features/membership/components/MyInvitations";

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
  const { invitations, joinRequests } = usePendingMembership();

  return (
    <div className="page-frame pb-24">
      <GroupProfile />

      {/*
        Las pestañas del grupo solo existen con grupo; "Invitaciones" es del músico y se queda
        aunque no tenga uno (así puede aceptar la invitación a su primer grupo). Mientras el
        grupo carga no se muestra nada: la cabecera ya explica la carga o el error.
      */}
      {!groupPending || groupId ? (
        <TabbedSection label="Gestión del grupo" className="mt-16 md:mt-20">
          {groupId ? (
            <TabItem title="Pedidos de fecha" tabKey="pedidos">
              <GroupInbox groupId={groupId} />
            </TabItem>
          ) : null}
          {groupId ? (
            <TabItem title={tabTitle("Equipo", joinRequests)} tabKey="equipo">
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
          <TabItem title={tabTitle("Invitaciones", invitations)} tabKey="invitaciones">
            <MyInvitations />
          </TabItem>
        </TabbedSection>
      ) : null}
    </div>
  );
}
