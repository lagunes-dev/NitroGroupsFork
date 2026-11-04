"use client";

import { useQuery } from "@tanstack/react-query";
import { TabItem, TabbedSection } from "@/components/ui";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { groupsService } from "@/features/groups/services/groups.service";
import GroupProfile from "@/features/groups/components/GroupProfile";
import GroupCalendar from "@/features/groupAvailability/components/GroupCalendar";
import GroupGallery from "@/features/groupMedia/components/GroupGallery";
import { GroupInbox } from "@/features/bookings/components/GroupInbox";
import { TeamTab } from "@/features/membership/components/TeamTab";

/**
 * Panel del grupo. Arriba, quién es y en qué estado está; abajo, el trabajo diario:
 * responder solicitudes primero, después la galería y el calendario.
 */
export default function MusicianDashboardPage() {
  const { user } = useCurrentUser();
  const userId = user?.id;

  const { data: group } = useQuery({
    queryKey: ["music-group", userId],
    queryFn: async () => {
      if (!userId) throw new Error("Usuario no autenticado");
      return groupsService.getByUserId(userId);
    },
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 10,
  });

  return (
    <div className="page-frame pb-24">
      <GroupProfile />

      {/* Sin grupo no hay nada que gestionar: la cabecera ya explica la carga o el error. */}
      {group?.id ? (
        <TabbedSection label="Gestión del grupo" className="mt-16 md:mt-20">
          <TabItem title="Solicitudes" tabKey="solicitudes">
            <GroupInbox groupId={group.id} />
          </TabItem>
          <TabItem title="Equipo" tabKey="equipo">
            <TeamTab groupId={group.id} />
          </TabItem>
          <TabItem title="Galería" tabKey="galeria">
            <GroupGallery />
          </TabItem>
          <TabItem title="Calendario" tabKey="calendario">
            <GroupCalendar groupId={group.id} mode="private" />
          </TabItem>
        </TabbedSection>
      ) : null}
    </div>
  );
}
