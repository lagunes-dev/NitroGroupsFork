"use client";

import { useEffect, useRef, useState } from "react";
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
import { GroupAgenda, MyAgenda } from "@/features/gigs/components";
import { useConfirmedGigDates } from "@/features/gigs/gigs.queries";
import { TeamTab } from "@/features/membership/components/TeamTab";
import { ProfileVisits } from "@/features/membership/components/ProfileVisits";
import { MyInvitations } from "@/features/membership/components/MyInvitations";
import { MyGroups } from "@/features/membership/components/MyGroups";
import { MusicianProfileForm } from "@/features/musicians/components/MusicianProfileForm";
import { UserTypeEnum } from "@/features/groups/types/User";

/**
 * El calendario del grupo con sus días de toque marcados. La consulta vive aquí y no en la página
 * para que solo corra cuando el manager abre la pestaña: los paneles se montan al activarse.
 */
function CalendarWithConfirmedGigs({ groupId }: { groupId: number }) {
  const confirmedGigDays = useConfirmedGigDates(groupId);
  return <GroupCalendar groupId={groupId} mode="private" confirmedGigDays={confirmedGigDays} />;
}

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

  // Un enlace puede pedir una pestaña concreta ("#mi-perfil"): aterrizar en la agenda cuando el
  // botón promete el interruptor de disponibilidad es un callejón (ronda 5, Miguel).
  // El hash es un sistema externo y no existe en el servidor, así que se lee al montar.
  useEffect(() => {
    const tab = window.location.hash.replace("#", "");
    // El hash no existe en el servidor: se aplica una vez al montar, no en cada render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tab) setActiveTab(tab);
  }, []);

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
        Aviso de visitas (S9): qué grupos miraron el perfil del músico. Va suelto arriba, no en una
        pestaña: son dos renglones y no cambia la pestaña con la que abre el panel. Sin visitas no
        dibuja nada, y solo se pide para quien tiene perfil de músico.
      */}
      {user?.userType === UserTypeEnum.Musician ? <ProfileVisits /> : null}

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
          {/*
            La agenda del grupo va en su propia pestaña y no dentro de "Calendario": ahí el calendario es
            una rejilla editable para bloquear horarios, y una lista de asistencia con nombres al lado
            obliga a bajar por ella cada vez que se quiere ver la semana.
          */}
          {groupId ? (
            <TabItem title="Agenda" tabKey="agenda">
              <GroupAgenda groupId={groupId} />
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
              <CalendarWithConfirmedGigs groupId={groupId} />
            </TabItem>
          ) : null}
          {/*
            "Mi agenda" es del músico, no del grupo: sin grupo gestionado queda como primera pestaña del
            panel, y con grupo espera a las pestañas de trabajo (el panel sigue abriendo en "Pedidos de fecha").
          */}
          <TabItem title="Mi agenda" tabKey="mi-agenda">
            <MyAgenda />
          </TabItem>
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
