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
import { AVAILABILITY_ANCHOR_ID, AvailabilityAnchor, tabFromHash } from "./AvailabilityAnchor";
import { CollapsibleProfile } from "./CollapsibleProfile";

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
  /*
   * Ronda 10: el perfil del músico y el del grupo son dos identidades distintas y no se mezclan, pero
   * editar el grupo no puede estar detrás de la ficha. Esta clave sube con cada pulsación de "Editar
   * perfil del grupo": remonta la tarjeta en modo formulario, incluso después de haberlo cerrado.
   */
  const [profileEditKey, setProfileEditKey] = useState(0);
  /*
   * Ronda 10: the fold above the card has to name what is on screen and cannot close the editor
   * silently. The form reports its own mode, and discarding resets the key to open in read view.
   */
  const [profileEditing, setProfileEditing] = useState(false);
  // Solo la llegada por enlace mueve el foco al interruptor; abrir la pestaña a mano no lo roba.
  const [arrivedAtAvailability, setArrivedAtAvailability] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const banner = groupId ? joinBannerText(joinRequests) : null;

  // Un enlace puede pedir una pestaña concreta ("#mi-perfil", "#invitaciones"): aterrizar en la agenda
  // cuando el botón promete otra cosa es un callejón (ronda 5, Miguel; ronda 7, T45).
  // El hash es un sistema externo y no existe en el servidor: se lee al montar y cada vez que cambia.
  // `hashchange` no basta: el <Link> de Next hace `pushState` (no lo dispara) y un hash igual tampoco.
  // Por eso, además, se mira el clic en cualquier enlace a esta misma página con hash (el de la
  // cabecera, escritorio y móvil), y la pestaña elegida a mano se escribe en el hash para que un
  // clic posterior en "#invitaciones" siempre cambie algo.
  useEffect(() => {
    const openTab = (tab: string) => {
      if (!tab) return;
      setArrivedAtAvailability(tab === AVAILABILITY_ANCHOR_ID);
      setActiveTab(tab);
    };
    const applyHash = () => openTab(tabFromHash(window.location.hash));
    const onLinkClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!anchor) return;
      const url = new URL((anchor as HTMLAnchorElement).href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname !== window.location.pathname) return;
      openTab(tabFromHash(url.hash));
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    document.addEventListener("click", onLinkClick);
    return () => {
      window.removeEventListener("hashchange", applyHash);
      document.removeEventListener("click", onLinkClick);
    };
  }, []);

  /** A tab picked by hand: state plus hash, with `replaceState` so there is no history entry or scroll jump. */
  const pickTab = (tabKey: string) => {
    setActiveTab(tabKey);
    window.history.replaceState(window.history.state, "", `#${tabKey}`);
  };

  const showTab = (tabKey: string) => {
    setArrivedAtAvailability(false);
    pickTab(tabKey);
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

      {/*
        El perfil va primero porque dice quién es el grupo, pero a 390 px ocupaba una pantalla entera
        y la bandeja arrancaba debajo (T42). Debajo de `md` queda plegado detrás de su nombre, a una
        pulsación; de `md` para arriba se ve siempre, como hasta ahora.
      */}
      {/*
        Sin grupo propio no hay perfil de grupo que mostrar: la tarjeta vacía, su "Editar perfil" (que abre
        el formulario de crear grupo) y el aviso de perfil incompleto eran gestión ajena para un miembro (T44).
      */}
      {groupId ? (
        <CollapsibleProfile
          title={group?.groupName?.trim() || "Tu grupo"}
          editAction={{ label: "Editar perfil del grupo", onClick: () => setProfileEditKey((key) => key + 1) }}
          editing={profileEditing}
          onDiscard={() => setProfileEditKey(0)}
        >
          <GroupProfile key={profileEditKey} startInEdit={profileEditKey > 0} onEditingChange={setProfileEditing} />
        </CollapsibleProfile>
      ) : null}

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
        <TabbedSection label={groupId ? "Gestión del grupo" : "Mi panel"} className="mt-8 md:mt-20" activeKey={activeTab} onActiveKeyChange={pickTab}>
          {groupId ? (
            <TabItem title="Pedidos de fecha" shortTitle="Pedidos" tabKey="pedidos">
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
            <TabItem title="Mi perfil" shortTitle="Perfil" tabKey={AVAILABILITY_ANCHOR_ID}>
              {/* El id del enlace vive en el interruptor: "Cambiar mi disponibilidad" baja hasta él. */}
              <AvailabilityAnchor focusOnMount={arrivedAtAvailability}>
                <MusicianProfileForm userId={userId} />
              </AvailabilityAnchor>
            </TabItem>
          ) : null}
        </TabbedSection>
        </div>
      ) : null}
    </div>
  );
}
