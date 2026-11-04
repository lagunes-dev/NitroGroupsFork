"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Film, Music, Plus, Trash2, X } from "lucide-react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { groupsService } from "@/features/groups/services/groups.service";
import { uploadGroupMediaFile } from "@/lib/groupMediaUpload";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { GroupMediaResponse } from "../types/GroupMedia";

type GroupGalleryProps = {
    media?: GroupMediaResponse[];
};

export default function GroupGallery({ media: mediaProp }: GroupGalleryProps) {
    const { user } = useCurrentUser();
    const queryClient = useQueryClient();

    // Use query to subscribe to the cache/fetch if needed
    const groupQuery = useQuery({
        queryKey: ["music-group", user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            return groupsService.getByUserId(user.id);
        },
        enabled: !mediaProp && !!user?.id,
        staleTime: 1000 * 60 * 10,
    });

    const cachedGroup = groupQuery.data;
    const media = mediaProp ?? cachedGroup?.media ?? [];
    const groupId = cachedGroup?.id;

    // Local state for add media modal
    const [isAdding, setIsAdding] = useState(false);
    const [addMode, setAddMode] = useState<"upload" | "url">("upload");
    const [newMedia, setNewMedia] = useState({ type: "photo", url: "", title: "" });
    /** `File` en `useState` fuerza re-renders con un objeto gordo; en Windows + Next 16 (Turbopack) a veces inestable al elegir archivo; se usa ref + etiqueta. */
    const fileRef = useRef<File | null>(null);
    const [fileSelectionLabel, setFileSelectionLabel] = useState<string | null>(null);
    const [fileInputKey, setFileInputKey] = useState(0);

    const openAddModal = () => {
        setFileInputKey((k) => k + 1);
        fileRef.current = null;
        setFileSelectionLabel(null);
        setIsAdding(true);
    };

    // Borrado en dos pasos: primero se pide confirmar, luego se elimina.
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [confirmingId, setConfirmingId] = useState<number | null>(null);

    // Mutations
    const addMutation = useMutation({
        mutationFn: async () => {
            if (!groupId) throw new Error("No group context");
            const picked = fileRef.current;
            if (addMode === "upload" && picked) {
                const { url, mediaType } = await uploadGroupMediaFile(groupId, picked);
                return groupsService.addMedia(groupId, {
                    type: mediaType,
                    url,
                    title: newMedia.title,
                    displayOrder: media.length,
                });
            }
            return groupsService.addMedia(groupId, {
                type: newMedia.type,
                url: newMedia.url,
                title: newMedia.title,
                displayOrder: media.length,
            });
        },
        onSuccess: () => {
            // Refetch group to get updated media list
            if (user?.id) {
                groupsService.getByUserId(user.id).then(freshGroup => {
                    if (freshGroup) queryClient.setQueryData(["music-group", user.id], freshGroup);
                });
            }
            setIsAdding(false);
            setAddMode("upload");
            fileRef.current = null;
            setFileSelectionLabel(null);
            setFileInputKey((k) => k + 1);
            setNewMedia({ type: "photo", url: "", title: "" });
        }
    });

    const removeMutation = useMutation({
        mutationFn: async (mediaId: number) => {
            if (!groupId) throw new Error("No group context");
            return groupsService.removeMedia(groupId, mediaId);
        },
        onSuccess: (_, deletedId) => {
            if (user?.id && cachedGroup) {
                const updatedGroup = { 
                    ...cachedGroup, 
                    media: cachedGroup.media?.filter((m: GroupMediaResponse) => m.id !== deletedId) || [] 
                };
                queryClient.setQueryData(["music-group", user.id], updatedGroup);
            }
            setDeletingId(null);
            setConfirmingId(null);
        }
    });

    const handleAddSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (addMode === "upload") {
            if (fileRef.current) {
                addMutation.mutate();
            }
        } else if (newMedia.url?.trim()) {
            addMutation.mutate();
        }
    };

    const closeDialog = () => {
        setIsAdding(false);
        setAddMode("upload");
        fileRef.current = null;
        setFileSelectionLabel(null);
        setFileInputKey((k) => k + 1);
        addMutation.reset();
    };

    const dialogRef = useRef<HTMLDivElement>(null);
    const titleId = useId();
    // Escape cierra igual que el botón Cancelar (resetea archivo, modo y error).
    const closeDialogRef = useRef(closeDialog);
    useEffect(() => { closeDialogRef.current = closeDialog; });
    useEffect(() => {
        if (!isAdding) return;
        // Al abrir, el foco entra al diálogo; Escape lo cierra.
        dialogRef.current?.querySelector<HTMLElement>("input, button")?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            // Escape inside an open Select panel (rendered in a portal) only closes that panel, not the dialog.
            if ((e.target as HTMLElement | null)?.closest('[role="listbox"], [aria-expanded="true"]')) return;
            closeDialogRef.current();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [isAdding]);

    // The dialog is fondo-2, the same step as a field, so its fields drop one step to stay visible.
    const field = "bg-fondo";
    const modeTab = (active: boolean) =>
        `h-10 border-b-2 px-1 font-semibold transition-colors ${active ? "border-acento text-tinta" : "border-transparent text-tinta-2 hover:text-tinta"}`;

    const items = media as GroupMediaResponse[];

    return (
        <section aria-labelledby="galeria-titulo" className="py-10">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-[60ch]">
                    <h2 id="galeria-titulo" className="sr-only">Galería</h2>
                    <p className="text-tinta-2">
                        Fotos, videos y audio de tus presentaciones. Es lo primero que mira un cliente en tu perfil.
                    </p>
                </div>
                {groupId && items.length > 0 && (
                    <Button onClick={openAddModal} className="self-start sm:self-auto">
                        <Plus aria-hidden /> Subir foto o video
                    </Button>
                )}
            </div>

            {groupQuery.isLoading ? (
                <div aria-busy className="mt-8 grid grid-cols-2 gap-0.5 lg:grid-cols-4">
                    <span className="sr-only" role="status">Cargando galería…</span>
                    <div aria-hidden className="col-span-2 row-span-2 aspect-square bg-fondo-2" />
                    {[0, 1, 2, 3].map((n) => <div key={n} aria-hidden className="aspect-square bg-fondo-2" />)}
                </div>
            ) : items.length === 0 ? (
                <div className="mt-8 flex flex-col items-start gap-5 bg-fondo-2 px-6 py-12 md:px-10 md:py-16">
                    <p className="type-heading text-2xl">Tu galería está vacía</p>
                    <p className="max-w-[52ch] text-tinta-2">
                        Sube fotos de tus presentaciones. La primera hace de portada mientras no elijas una en tu perfil.
                    </p>
                    {groupId && (
                        <Button onClick={openAddModal}>
                            <Plus aria-hidden /> Subir foto o video
                        </Button>
                    )}
                </div>
            ) : (
                <ul className="mt-8 grid grid-cols-2 gap-x-0.5 gap-y-6 lg:grid-cols-4">
                    {items.map((item, index) => {
                        const kind = item.type.toLowerCase();
                        const preview = kind === "photo" ? item.url : item.thumbnailUrl;
                        const label = item.title || (kind === "video" ? "Video sin título" : kind === "audio" ? "Audio sin título" : "Foto sin título");
                        const isDeleting = removeMutation.isPending && deletingId === item.id;
                        const isConfirming = confirmingId === item.id;
                        return (
                            <li key={item.id} className={index === 0 ? "col-span-2 lg:row-span-2" : undefined}>
                                {/* La primera pieza manda: en escritorio llena dos filas para que su pie cierre con el de la segunda fila. */}
                                <figure className="flex h-full flex-col">
                                    <div className={`relative aspect-square overflow-hidden bg-fondo-3 ${index === 0 ? "lg:aspect-auto lg:min-h-0 lg:flex-1" : ""}`}>
                                        {preview ? (
                                            // eslint-disable-next-line @next/next/no-img-element -- archivos de R2 o enlaces externos
                                            <img src={preview} alt={label} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
                                        ) : (
                                            <div className="absolute inset-0 grid place-items-center text-tinta-2">
                                                {kind === "audio" ? <Music aria-hidden className="size-10" /> : <Film aria-hidden className="size-10" />}
                                            </div>
                                        )}
                                        {kind !== "photo" && (
                                            <span className="absolute left-0 top-0 inline-flex items-center gap-1.5 bg-fondo px-2 py-1 text-sm text-tinta">
                                                {kind === "audio" ? <Music aria-hidden className="size-4" /> : <Film aria-hidden className="size-4" />}
                                                {kind === "audio" ? "Audio" : "Video"}
                                            </span>
                                        )}
                                    </div>
                                    <figcaption className="mt-2 flex min-h-10 items-center justify-between gap-2">
                                        {isConfirming ? (
                                            <>
                                                <span className="text-sm text-tinta">¿Eliminar de la galería?</span>
                                                <span className="flex shrink-0 gap-1">
                                                    <Button size="sm" variant="ghost" onClick={() => setConfirmingId(null)} disabled={isDeleting}>
                                                        Cancelar
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        disabled={isDeleting}
                                                        onClick={() => { setDeletingId(item.id); removeMutation.mutate(item.id); }}
                                                    >
                                                        {isDeleting ? "Eliminando…" : "Eliminar"}
                                                    </Button>
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <span className={`truncate text-sm ${item.title ? "text-tinta" : "text-tinta-2"}`}>{label}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirmingId(item.id)}
                                                    aria-label={`Eliminar ${label}`}
                                                    className="grid size-10 shrink-0 place-items-center text-tinta-2 transition-colors hover:bg-fondo-2 hover:text-tinta"
                                                >
                                                    <Trash2 aria-hidden className="size-4" />
                                                </button>
                                            </>
                                        )}
                                    </figcaption>
                                </figure>
                            </li>
                        );
                    })}
                </ul>
            )}

            {removeMutation.isError && (
                <Alert variant="destructive" className="mt-6">
                    <AlertDescription>No pudimos eliminar el archivo. Inténtalo de nuevo.</AlertDescription>
                </Alert>
            )}

            {isAdding && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-fondo/85 p-4" role="presentation" onClick={closeDialog}>
                    <div
                        ref={dialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                        onClick={(e) => e.stopPropagation()}
                        className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto bg-fondo-2 shadow-[0_24px_64px_-16px_var(--fondo)]"
                    >
                        <div className="flex items-center justify-between gap-4 px-6 pt-5">
                            <h3 id={titleId} className="type-heading text-2xl">Subir a la galería</h3>
                            <button type="button" onClick={closeDialog} aria-label="Cerrar" className="grid size-10 place-items-center text-tinta-2 transition-colors hover:bg-fondo-3 hover:text-tinta">
                                <X aria-hidden className="size-5" />
                            </button>
                        </div>
                        <form onSubmit={handleAddSubmit} className="space-y-5 px-6 pb-6 pt-3">
                            <div className="flex gap-6" role="group" aria-label="Cómo añadirlo">
                                <button type="button" aria-pressed={addMode === "upload"} onClick={() => { setAddMode("upload"); }} className={modeTab(addMode === "upload")}>
                                    Desde tu equipo
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={addMode === "url"}
                                    onClick={() => {
                                        setAddMode("url");
                                        fileRef.current = null;
                                        setFileSelectionLabel(null);
                                        setFileInputKey((k) => k + 1);
                                    }}
                                    className={modeTab(addMode === "url")}
                                >
                                    Con un enlace
                                </button>
                            </div>

                            {addMode === "upload" && (
                                <>
                                    <Input
                                        id="group-media-file"
                                        key={fileInputKey}
                                        type="file"
                                        label="Archivo"
                                        accept="image/*,video/*,audio/*"
                                        helperText={fileSelectionLabel ? `Elegido: ${fileSelectionLabel}` : "Imagen, video o audio, hasta 50 MB."}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            const f = e.target.files?.[0] ?? null;
                                            fileRef.current = f;
                                            setFileSelectionLabel(
                                                f
                                                    ? `${f.name} (${f.size > 0 ? Math.max(1, Math.round(f.size / 1024)) : 0} KB)`
                                                    : null
                                            );
                                        }}
                                        className={`${field} cursor-pointer py-0 text-sm text-tinta-2 file:mr-4 file:cursor-pointer file:rounded-[6px] file:bg-fondo-3 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-tinta`}
                                    />
                                    <p className="sr-only" aria-live="polite">{fileSelectionLabel ? `Elegido: ${fileSelectionLabel}` : ""}</p>
                                </>
                            )}

                            {addMode === "url" && (
                                <>
                                    <Select
                                        id="group-media-type"
                                        label="Tipo"
                                        value={newMedia.type}
                                        onValueChange={(type) => setNewMedia({ ...newMedia, type })}
                                        options={[
                                            { value: "photo", label: "Foto" },
                                            { value: "video", label: "Video" },
                                            { value: "audio", label: "Audio" },
                                        ]}
                                        className={field}
                                    />
                                    <Input
                                        id="group-media-url"
                                        label="Enlace"
                                        type="url"
                                        inputMode="url"
                                        value={newMedia.url}
                                        onChange={(e) => setNewMedia({ ...newMedia, url: e.target.value })}
                                        placeholder="https://"
                                        helperText="Un enlace directo al archivo o a YouTube."
                                        className={field}
                                    />
                                </>
                            )}

                            <Input
                                id="group-media-title"
                                label="Título (opcional)"
                                type="text"
                                value={newMedia.title}
                                onChange={(e) => setNewMedia({ ...newMedia, title: e.target.value })}
                                placeholder="Ej. Boda en Tlaquepaque, 2025"
                                className={field}
                            />

                            {addMutation.isError && (
                                <Alert variant="destructive" className="bg-fondo">
                                    <AlertDescription>
                                        {addMode === "upload"
                                            ? "No pudimos subir el archivo. Revisa que pese menos de 50 MB e inténtalo de nuevo."
                                            : "No pudimos guardar el enlace. Inténtalo de nuevo."}
                                    </AlertDescription>
                                </Alert>
                            )}

                            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                                <Button type="button" variant="ghost" onClick={closeDialog}>
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={
                                        addMutation.isPending ||
                                        (addMode === "upload" && !fileSelectionLabel) ||
                                        (addMode === "url" && !newMedia.url?.trim())
                                    }
                                >
                                    {addMutation.isPending && <span aria-hidden className="spinner !size-[1em] !border-2" />}
                                    {addMutation.isPending ? "Subiendo…" : "Subir a la galería"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
}
