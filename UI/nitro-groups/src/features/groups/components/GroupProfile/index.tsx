"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MusicGroup } from "../../types/MusicGroup";
import { NoGroupPaths } from "@/features/membership/components/NoGroupPaths";
import { groupsService } from "../../services/groups.service";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import GroupProfileView from "./GroupProfileView";
import GroupProfileEdit from "./GroupProfileEdit";
import type { GroupProfileProps } from "./types";

/* ─── empty‑state fallback ─── */
const emptyGroup: MusicGroup = {
  id: 0, ownerUserId: 0, slug: "", groupName: "", description: "",
  biography: "", numMembers: 0, yearsExperience: 0, phone: "", email: "",
  locationText: "", serviceRadiusKm: 0, currency: "", basePrice: 0,
  hourlyRate: 0, minimumDurationHours: 0, setupTimeMinutes: 0,
  averageRating: 0, totalReviews: 0, viewCount: 0, bookingCount: 0,
  isVerified: false, isFeatured: false, isAcceptingBookings: false, active: false,
};

export default function GroupProfile({ mode = "private", slug, initialGroup }: GroupProfileProps) {
  const { user: currentUser, isLoading: isUserLoading, isError: isUserError } = useCurrentUser();
  const userId = currentUser?.id;
  const isPublic = mode === "public";

  const queryClient = useQueryClient();
  const [group, setGroup] = useState<MusicGroup>(initialGroup ?? emptyGroup);
  const [originalGroup, setOriginalGroup] = useState<MusicGroup>(initialGroup ?? emptyGroup);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);

  const shouldFetch =
    !initialGroup && (!isPublic || Boolean(slug)) && (!isPublic ? Boolean(userId) : true);

  /* ── queries ── */
  const groupQuery = useQuery({
    queryKey: isPublic ? ["music-group-public", slug] : ["music-group", userId],
    queryFn: async () => {
      if (isPublic) {
        if (!slug) throw new Error("No se pudo cargar el grupo");
        return groupsService.getBySlug(slug);
      }
      if (!userId) throw new Error("Usuario no autenticado");
      return groupsService.getByUserId(userId);
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
    retry: 5,
    retryDelay: 3000,
    enabled: shouldFetch,
  });

  const genresQuery = useQuery({
    queryKey: ["music-genres"],
    queryFn: () => groupsService.listGenres(),
    staleTime: 1000 * 60 * 60,
    enabled: isEditing,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: MusicGroup) => {
      const updatePayload = {
        slug: payload.slug,
        groupName: payload.groupName,
        description: payload.description,
        biography: payload.biography,
        numMembers: payload.numMembers,
        yearsExperience: payload.yearsExperience,
        phone: payload.phone || "",
        email: payload.email || "",
        locationText: payload.locationText,
        serviceRadiusKm: payload.serviceRadiusKm,
        currency: payload.currency,
        basePrice: payload.basePrice,
        hourlyRate: payload.hourlyRate,
        minimumDurationHours: payload.minimumDurationHours,
        setupTimeMinutes: payload.setupTimeMinutes,
        isAcceptingBookings: payload.isAcceptingBookings,
        profilePictureUrl: payload.profilePictureUrl,
        coverImageUrl: payload.coverImageUrl,
      };

      const updatedGroup = await groupsService.update(payload.id, updatePayload);
      if (group.id > 0) {
        await groupsService.assignGenres(group.id, selectedGenres);
        // Refresh the whole group to get the newly mapped genre objects
        if (!isPublic) {
          const fresh = await groupsService.getByUserId(userId!);
          if (fresh) return fresh;
        }
      }
      return updatedGroup;
    },
    onSuccess: (updatedGroup) => {
      // El panel y la galería leen el grupo con la clave ["music-group", userId].
      if (userId) queryClient.setQueryData(["music-group", userId], updatedGroup);
      setGroup(updatedGroup);
      setOriginalGroup(updatedGroup);
      setIsEditing(false);
    },
  });

  // Sincroniza el formulario cuando cambia la fuente (props o query) ajustando el estado
  // durante el render, sin un efecto que dispare renders en cascada.
  const source = initialGroup ?? groupQuery.data;
  // Arranca con initialGroup (el estado inicial ya lo usa); si en el primer render la
  // fuente es la caché de React Query, la condición de abajo sincroniza el formulario.
  const [syncedSource, setSyncedSource] = useState<MusicGroup | undefined>(initialGroup);
  if (source && source !== syncedSource) {
    setSyncedSource(source);
    setGroup(source);
    setOriginalGroup(source);
  }

  /* ── handlers ── */
  const toggleEdit = () => {
    if (isPublic) return;
    if (!isEditing) {
      setOriginalGroup({ ...group });
      setSelectedGenres(group.genres?.map(g => g.id) || []);
    }
    setIsEditing(!isEditing);
  };
  const handleSave = (e: React.FormEvent) => { e.preventDefault(); if (!isPublic) saveMutation.mutate(group); };
  const handleCancel = () => { setGroup({ ...originalGroup }); setIsEditing(false); };
  const set = <K extends keyof MusicGroup>(k: K, v: MusicGroup[K]) => setGroup((p) => ({ ...p, [k]: v }));

  /* ── carga / error ── */
  // En el panel privado, sin usuario todavía no hay grupo que pedir: se muestra la carga.
  const waitingForUser = !isPublic && !initialGroup && isUserLoading;
  if (waitingForUser || (shouldFetch && groupQuery.isLoading)) return <ProfileSkeleton />;
  if (!isPublic && !initialGroup && isUserError) return (
    <div role="alert" className="max-w-[56ch] pt-14">
      <p className="type-heading text-3xl">No pudimos cargar tu cuenta</p>
      <p className="mt-3 text-tinta-2">Recarga la página en un momento. Si sigue igual, vuelve a iniciar sesión.</p>
    </div>
  );
  if (shouldFetch && groupQuery.isError) return <NoGroupPaths />;

  if (isEditing && !isPublic) {
    return (
      <GroupProfileEdit
        group={group}
        originalGroup={originalGroup}
        selectedGenres={selectedGenres}
        setSelectedGenres={setSelectedGenres}
        isPending={saveMutation.isPending}
        saveError={saveMutation.isError ? "No pudimos guardar los cambios. Revisa tu conexión e inténtalo de nuevo." : null}
        genres={genresQuery.data || []}
        isGenresLoading={genresQuery.isLoading}
        handleSave={handleSave}
        handleCancel={handleCancel}
        set={set}
      />
    );
  }

  return (
    <GroupProfileView
      group={group}
      isPublic={isPublic}
      toggleEdit={toggleEdit}
    />
  );
}

/** Silueta de la cabecera mientras llega el grupo: mismos bloques, sin contenido. */
function ProfileSkeleton() {
  return (
    <div aria-busy className="pt-10 md:pt-14">
      <span className="sr-only" role="status">Cargando tu grupo…</span>
      <div aria-hidden className="flex items-end gap-5 md:gap-8">
        <div className="size-20 bg-fondo-2 md:size-32" />
        <div className="flex-1 space-y-4">
          <div className="h-10 w-2/3 max-w-md bg-fondo-2 md:h-16" />
          <div className="h-4 w-44 bg-fondo-2" />
        </div>
      </div>
      <div aria-hidden className="mt-8 h-[14.75rem] rounded-[12px] bg-fondo-2 sm:h-[10.25rem] xl:h-[5.75rem]" />
    </div>
  );
}
