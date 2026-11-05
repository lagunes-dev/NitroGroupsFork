"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { Alert, AlertDescription, Button, Input, Textarea } from "@/components/ui";
import { musicianProfileHref } from "../links";
import {
    CITY_MAX,
    HEADLINE_MAX,
    INSTRUMENTS_MAX,
    SHORT_BIO_MAX,
    firstInvalidField,
    profileFormValues,
    toUpdateRequest,
    validateProfileForm,
    type ProfileErrors,
    type ProfileField,
    type ProfileFormValues,
} from "../profileForm";
import { naturalList, profileGaps, toMusicianProfile } from "../profileView";
import { musicianProfileService } from "../services/musicianProfile.service";

/** Public profile of one musician, shared by the form and the "Ver mi perfil público" link. */
export const musicianProfileKey = (userId: number) => ["musician-profile", userId];

const SAVED = "Guardamos tu perfil. Ya se ve así en tu perfil público.";
const SAVE_FAILED = "No pudimos guardar tu perfil. Revisa tu conexión y vuelve a intentarlo.";
const LOAD_FAILED = "No pudimos cargar tu perfil. Vuelve a intentarlo en un momento.";

/**
 * "Mi perfil": el músico edita lo que un grupo necesita para decidir y ve el resultado en su
 * perfil público. Los valores salen del GET público y se guardan con el PUT de su propio perfil.
 */
export function MusicianProfileForm({ userId }: { userId: number }) {
    const uid = useId();
    const id = (name: string) => `${uid}-${name}`;
    const queryClient = useQueryClient();

    const profileQuery = useQuery({
        queryKey: musicianProfileKey(userId),
        queryFn: () => musicianProfileService.getPublic(userId),
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: 1,
    });

    const [values, setValues] = useState<ProfileFormValues | null>(null);
    const [errors, setErrors] = useState<ProfileErrors>({});
    // La última lectura que sembró el formulario: sin efectos, se compara en el render.
    const [seeded, setSeeded] = useState<typeof profileQuery.data>(undefined);
    if (profileQuery.data && profileQuery.data !== seeded) {
        setSeeded(profileQuery.data);
        setValues(profileFormValues(toMusicianProfile(profileQuery.data)));
        setErrors({});
    }

    const headlineRef = useRef<HTMLInputElement>(null);
    const instrumentsRef = useRef<HTMLInputElement>(null);
    const cityRef = useRef<HTMLInputElement>(null);
    const yearsRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLInputElement>(null);
    const bioRef = useRef<HTMLTextAreaElement>(null);

    const [notice, setNotice] = useState("");
    const [saveError, setSaveError] = useState("");

    const save = useMutation({
        mutationFn: (request: ReturnType<typeof toUpdateRequest>) => musicianProfileService.updateMine(request),
        onMutate: () => {
            setNotice("");
            setSaveError("");
        },
        onSuccess: (data) => {
            setNotice(SAVED);
            // El formulario y el perfil público leen la misma respuesta del PUT.
            queryClient.setQueryData(musicianProfileKey(userId), data);
            queryClient.invalidateQueries({ queryKey: musicianProfileKey(userId) });
        },
        onError: () => {
            setNotice("");
            setSaveError(SAVE_FAILED);
        },
    });

    /** Un campo inválido se enfoca: el teclado y el lector de pantalla caen en él, no en el botón. */
    const focusField = (field: ProfileField) => {
        if (field === "headline") headlineRef.current?.focus();
        else if (field === "instruments") instrumentsRef.current?.focus();
        else if (field === "city") cityRef.current?.focus();
        else if (field === "yearsExperience") yearsRef.current?.focus();
        else if (field === "videoUrl") videoRef.current?.focus();
        else bioRef.current?.focus();
    };

    const set = <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) => {
        setValues((previous) => (previous ? { ...previous, [key]: value } : previous));
        // El error de un campo desaparece en cuanto la persona lo corrige.
        if (key !== "isOpenToJoin") setErrors((previous) => ({ ...previous, [key]: undefined }));
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!values) return;
        const found = validateProfileForm(values);
        setErrors(found);
        const first = firstInvalidField(found);
        if (first) {
            setNotice("");
            setSaveError("");
            focusField(first);
            return;
        }
        save.mutate(toUpdateRequest(values));
    };

    if (profileQuery.isPending) {
        return (
            <div aria-busy className="py-6">
                <span role="status" className="sr-only">Cargando tu perfil…</span>
                <div aria-hidden className="max-w-2xl space-y-4">
                    <div className="h-5 w-40 rounded bg-fondo-3 motion-safe:animate-pulse" />
                    <div className="h-12 w-full rounded-[8px] bg-fondo-3 motion-safe:animate-pulse" />
                    <div className="h-12 w-full rounded-[8px] bg-fondo-3 motion-safe:animate-pulse" />
                    <div className="h-28 w-full rounded-[8px] bg-fondo-3 motion-safe:animate-pulse" />
                </div>
            </div>
        );
    }

    if (profileQuery.isError || !values) {
        return (
            <div className="py-6">
                <Alert variant="destructive">
                    <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        {LOAD_FAILED}
                        <Button variant="outline" className="h-11 shrink-0 sm:h-10" onClick={() => profileQuery.refetch()}>
                            Reintentar
                        </Button>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    const profile = toMusicianProfile(profileQuery.data);
    const gaps = profileGaps(profile);

    return (
        // noValidate: los avisos son los de esta forma (en español y con el foco en el primer campo
        // inválido), no la burbuja nativa del navegador.
        <form onSubmit={handleSubmit} aria-labelledby={id("title")} noValidate className="py-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="max-w-[56ch]">
                    <h3 id={id("title")} className="type-heading text-2xl">Mi perfil</h3>
                    <p className="mt-2 text-tinta-2">
                        Es lo que ve un grupo cuando abre tu perfil. Se publica al guardar.
                    </p>
                    {gaps.complete ? (
                        <p className="mt-2 text-sm text-tinta-2">Tu perfil público está completo.</p>
                    ) : (
                        <p className="mt-2 text-sm text-tinta-2">
                            Para que se lea completo, agrega {naturalList(gaps.missing)}.
                        </p>
                    )}
                </div>
                <Button asChild variant="outline" className="h-11 shrink-0 sm:h-10">
                    <Link href={musicianProfileHref(profile.userId)}>
                        Ver mi perfil público
                        <ExternalLink aria-hidden />
                    </Link>
                </Button>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Input
                    ref={headlineRef}
                    id={id("headline")}
                    label="Titular"
                    value={values.headline}
                    onChange={(e) => set("headline", e.target.value)}
                    maxLength={HEADLINE_MAX}
                    placeholder="Ej. Guitarrista de bodas y eventos"
                    helperText={`${values.headline.length} de ${HEADLINE_MAX}`}
                    error={errors.headline}
                />
                <Input
                    ref={instrumentsRef}
                    id={id("instruments")}
                    label="Instrumentos"
                    value={values.instruments}
                    onChange={(e) => set("instruments", e.target.value)}
                    maxLength={INSTRUMENTS_MAX}
                    placeholder="Ej. Guitarra, bajo, voz"
                    helperText={`Sepáralos con comas. ${values.instruments.length} de ${INSTRUMENTS_MAX}`}
                    error={errors.instruments}
                />
                <Input
                    ref={cityRef}
                    id={id("city")}
                    label="Ciudad (opcional)"
                    value={values.city}
                    onChange={(e) => set("city", e.target.value)}
                    maxLength={CITY_MAX}
                    autoComplete="address-level2"
                    placeholder="Ej. Guadalajara"
                    helperText={`Así te encuentran por ciudad en el directorio. ${values.city.length} de ${CITY_MAX}`}
                    error={errors.city}
                />
                <Input
                    ref={yearsRef}
                    id={id("years")}
                    label="Años de experiencia (opcional)"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={values.yearsExperience}
                    onChange={(e) => set("yearsExperience", e.target.value)}
                    className="tabular"
                    helperText="Déjalo vacío para no cambiarlo."
                    error={errors.yearsExperience}
                />
                <Input
                    ref={videoRef}
                    id={id("video")}
                    label="Video (opcional)"
                    type="url"
                    inputMode="url"
                    value={values.videoUrl}
                    onChange={(e) => set("videoUrl", e.target.value)}
                    placeholder="https://…"
                    helperText="Un enlace a una grabación tuya. Se abre en otra pestaña."
                    error={errors.videoUrl}
                />
            </div>

            <div className="mt-6">
                <Textarea
                    ref={bioRef}
                    id={id("bio")}
                    label="Biografía corta (opcional)"
                    rows={5}
                    value={values.shortBio}
                    onChange={(e) => set("shortBio", e.target.value)}
                    maxLength={SHORT_BIO_MAX}
                    placeholder="Tu estilo, tus influencias y el tipo de eventos donde tocas…"
                    helperText={`${values.shortBio.length} de ${SHORT_BIO_MAX}`}
                    error={errors.shortBio}
                />
            </div>

            {/* El interruptor ocupa toda la fila: en el celular el objetivo táctil pasa de 44px. */}
            <button
                type="button"
                role="switch"
                aria-checked={values.isOpenToJoin}
                aria-labelledby={id("open-label")}
                aria-describedby={id("open-hint")}
                onClick={() => set("isOpenToJoin", !values.isOpenToJoin)}
                className="mt-6 flex min-h-14 w-full items-start justify-between gap-6 rounded-xl bg-fondo-2 px-4 py-4 text-left transition-colors duration-150 hover:bg-fondo-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento"
            >
                <span className="min-w-0">
                    <span id={id("open-label")} className="block font-medium text-tinta">Aparecer en el directorio y aceptar invitaciones</span>
                    <span id={id("open-hint")} className="mt-1 block text-sm text-tinta-2">
                        {values.isOpenToJoin
                            ? "Sí: sales en el directorio de músicos y los grupos pueden invitarte."
                            : "No: tu perfil conserva su enlace, pero no sales en el directorio ni recibes invitaciones."}
                    </span>
                </span>
                <span
                    aria-hidden
                    className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors duration-150 ${values.isOpenToJoin ? "bg-acento" : "bg-fondo-3"}`}
                >
                    <span
                        className={`absolute left-0 top-1 size-5 rounded-full transition-transform duration-150 ${values.isOpenToJoin ? "translate-x-6 bg-fondo" : "translate-x-1 bg-tinta-2"}`}
                    />
                </span>
            </button>

            <div className="mt-10 flex flex-col gap-4 border-t border-linea pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    {saveError ? (
                        <Alert variant="destructive" className="bg-transparent p-0">
                            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                {saveError}
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-11 shrink-0 sm:h-10"
                                    onClick={() => values && save.mutate(toUpdateRequest(values))}
                                >
                                    Reintentar
                                </Button>
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <p role="status" aria-live="polite" className="text-sm text-tinta-2">
                            {notice || (save.isPending ? "Guardando…" : "Nada se publica hasta que guardes.")}
                        </p>
                    )}
                </div>
                <Button type="submit" disabled={save.isPending} className="h-11 shrink-0 sm:h-10">
                    {save.isPending && <span aria-hidden className="spinner !size-[1em] !border-2" />}
                    {save.isPending ? "Guardando…" : "Guardar cambios"}
                </Button>
            </div>
        </form>
    );
}
