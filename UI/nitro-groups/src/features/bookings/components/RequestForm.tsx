"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { todayInMexico } from "@/lib/format";
import {
    durationOptions,
    eventTypeOptions,
    firstInvalidField,
    startTimeOptions,
    validateRequestFields,
    type RequestFieldErrors,
} from "@/lib/requestForm";
import { bookingsService, apiErrorMessage } from "../bookings.service";
import { EVENT_TYPES } from "../types";

const MESSAGE_MIN = 10;
const MESSAGE_MAX = 2000;

interface RequestFormProps {
    groupId: number;
    groupName: string;
    minimumHours: number;
    defaultDate?: string;
}

/** Solicitud de fecha a un grupo. Todo lo que el grupo necesita para responder, en una pantalla. */
export function RequestForm({ groupId, groupName, minimumHours, defaultDate }: RequestFormProps) {
    const id = useId();
    const [message, setMessage] = useState("");
    const [errors, setErrors] = useState<RequestFieldErrors>({});
    const minHours = Math.min(Math.max(minimumHours || 1, 1), 12);
    const startTimes = useMemo(() => startTimeOptions(), []);
    const fieldIds = {
        eventDate: `${id}-fecha`,
        durationHours: `${id}-horas`,
        eventType: `${id}-tipo`,
        locationText: `${id}-lugar`,
    };

    const create = useMutation({ mutationFn: bookingsService.create });

    if (create.isSuccess) {
        return (
            <div role="status" className="max-w-[56ch]">
                <p className="type-heading text-[2rem]">Solicitud enviada</p>
                <p className="mt-3 text-lg text-tinta">
                    {groupName} recibió tu solicitud y te va a responder por escrito. Te avisamos por email cuando lo haga.
                </p>
                <Link href={`/solicitudes/${create.data.id}`} className="mt-6 inline-block text-tinta underline decoration-acento decoration-2 underline-offset-4">
                    Ver la solicitud
                </Link>
            </div>
        );
    }

    function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const num = (k: string) => (f.get(k) ? Number(f.get(k)) : null);
        const found = validateRequestFields(
            {
                eventDate: String(f.get("eventDate") ?? ""),
                durationHours: Number(f.get("durationHours")),
                eventType: String(f.get("eventType") ?? ""),
                locationText: String(f.get("locationText") ?? ""),
            },
            todayInMexico(),
            minHours
        );
        setErrors(found);
        const first = firstInvalidField(found);
        if (first) {
            // The date and select controls are buttons with an id, so focus lands on the control itself.
            document.getElementById(fieldIds[first])?.focus();
            return;
        }
        create.mutate({
            groupId,
            eventDate: String(f.get("eventDate")),
            startTime: f.get("startTime") ? `${f.get("startTime")}:00` : null,
            durationHours: Number(f.get("durationHours")),
            eventType: String(f.get("eventType")),
            locationText: String(f.get("locationText")).trim(),
            guestCount: num("guestCount"),
            budget: num("budget"),
            message: message.trim(),
        });
    }

    const clearError = (field: keyof RequestFieldErrors) =>
        setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));

    const tooShort = message.trim().length < MESSAGE_MIN;

    return (
        // noValidate: every rule is checked in onSubmit so custom controls and native inputs report errors the same way.
        <form onSubmit={onSubmit} noValidate className="grid max-w-4xl items-start gap-x-4 gap-y-6 md:grid-cols-6" aria-describedby={create.isError ? `${id}-error` : undefined}>
            <div className="md:col-span-2">
                <DatePicker
                    id={fieldIds.eventDate}
                    name="eventDate"
                    label="Fecha"
                    required
                    min={todayInMexico()}
                    defaultValue={defaultDate}
                    error={errors.eventDate}
                    onChange={() => clearError("eventDate")}
                />
            </div>
            <div className="md:col-span-2">
                <Select
                    id={`${id}-hora`}
                    name="startTime"
                    label="Hora de inicio (opcional)"
                    placeholder="Sin hora definida"
                    emptyOption="Sin hora definida"
                    options={startTimes}
                />
            </div>
            <div className="md:col-span-2">
                <Select
                    id={fieldIds.durationHours}
                    name="durationHours"
                    label="Horas de música"
                    required
                    defaultValue={String(minHours)}
                    options={durationOptions(minHours)}
                    error={errors.durationHours}
                    onValueChange={() => clearError("durationHours")}
                />
            </div>
            <div className="md:col-span-2">
                <Select
                    id={fieldIds.eventType}
                    name="eventType"
                    label="Qué celebras"
                    required
                    defaultValue="Boda"
                    options={eventTypeOptions(EVENT_TYPES)}
                    error={errors.eventType}
                    onValueChange={() => clearError("eventType")}
                />
            </div>
            <div className="md:col-span-4">
                <Input
                    id={fieldIds.locationText}
                    name="locationText"
                    label="Lugar"
                    required
                    maxLength={200}
                    placeholder="Salón Los Arcos, Zapopan"
                    error={errors.locationText}
                    onChange={() => clearError("locationText")}
                />
            </div>
            <div className="md:col-span-2">
                <Input id={`${id}-invitados`} name="guestCount" label="Invitados (opcional)" type="number" inputMode="numeric" min={1} max={5000} className="tabular" />
            </div>
            <div className="md:col-span-2">
                <Input id={`${id}-presupuesto`} name="budget" label="Presupuesto en MXN (opcional)" type="number" inputMode="numeric" min={0} step={500} className="tabular" />
            </div>
            <div className="md:col-span-6">
                <Textarea
                    id={`${id}-mensaje`}
                    label={`Mensaje para ${groupName}`}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    minLength={MESSAGE_MIN}
                    maxLength={MESSAGE_MAX}
                    rows={5}
                    placeholder="Es nuestra boda, queremos mariachi a la salida de la iglesia y una hora en la recepción."
                    helperText={tooShort ? `Al menos ${MESSAGE_MIN} caracteres.` : `${message.length} de ${MESSAGE_MAX}`}
                />
            </div>
            {create.isError && (
                <p id={`${id}-error`} role="alert" className="md:col-span-6 text-error">
                    {apiErrorMessage(create.error, "No pudimos enviar la solicitud. Revisa los datos e inténtalo de nuevo.")}
                </p>
            )}
            <div className="md:col-span-6">
                <Button type="submit" size="lg" disabled={create.isPending || tooShort} className="rounded-[8px] px-8">
                    {create.isPending ? "Enviando…" : "Enviar solicitud"}
                </Button>
            </div>
        </form>
    );
}
