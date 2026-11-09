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
import {
    REQUEST_LOCATION_MAX,
    REQUEST_MESSAGE_MAX,
    REQUEST_MESSAGE_MIN,
    belowBasePriceNote,
    limitRead,
    pastedLength,
    requestSendReason,
} from "../formNotes";
import { EVENT_TYPES } from "../types";

interface RequestFormProps {
    groupId: number;
    groupName: string;
    minimumHours: number;
    /**
     * El "desde $X" del grupo, para decirlo cuando la oferta queda por debajo (ronda 13, tarea 2). La
     * app no valida dinero (D1/S18): la nota informa y el envío sigue disponible. Sin dato, no hay nota.
     */
    basePrice?: number | null;
    /** La moneda del grupo: su precio nunca se cuenta en la del cliente (S15). */
    currency?: string;
    defaultDate?: string;
}

/** Solicitud de fecha a un grupo. Todo lo que el grupo necesita para responder, en una pantalla. */
export function RequestForm({ groupId, groupName, minimumHours, basePrice, currency = "MXN", defaultDate }: RequestFormProps) {
    const id = useId();
    const [message, setMessage] = useState("");
    const [eventDate, setEventDate] = useState(defaultDate ?? "");
    const [location, setLocation] = useState("");
    const [budget, setBudget] = useState("");
    // Distingue el freno del tope de un pegado que no cupo entero: los dos cortan, pero se dicen distinto.
    const [messageCut, setMessageCut] = useState(false);
    const [locationCut, setLocationCut] = useState(false);
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

    const tooShort = message.trim().length < REQUEST_MESSAGE_MIN;
    const messageLimit = limitRead(message, REQUEST_MESSAGE_MAX, messageCut);
    const locationLimit = limitRead(location, REQUEST_LOCATION_MAX, locationCut);
    const budgetNote = belowBasePriceNote(budget, basePrice, currency);
    // Ronda 13 (tarea 4): el botón apagado dice qué falta, con la frase que el formulario ya usa.
    const sendReason = requestSendReason({ eventDate, message });

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
                    value={eventDate}
                    onChange={(value) => {
                        setEventDate(value);
                        clearError("eventDate");
                    }}
                    error={errors.eventDate}
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
                    maxLength={REQUEST_LOCATION_MAX}
                    value={location}
                    onChange={(e) => {
                        const next = e.target.value.slice(0, REQUEST_LOCATION_MAX);
                        setLocation(next);
                        if (next.length < REQUEST_LOCATION_MAX) setLocationCut(false);
                        clearError("locationText");
                    }}
                    onPaste={(e) => {
                        if (pastedLength(e.currentTarget, e.clipboardData.getData("text")) > REQUEST_LOCATION_MAX) {
                            setLocationCut(true);
                        }
                    }}
                    placeholder="Salón Los Arcos, Zapopan"
                    error={errors.locationText}
                    helperText={locationLimit.note ?? undefined}
                />
            </div>
            <div className="md:col-span-2">
                <Input id={`${id}-invitados`} name="guestCount" label="Invitados (opcional)" type="number" inputMode="numeric" min={1} max={5000} className="tabular" />
            </div>
            <div className="md:col-span-2">
                <Input
                    id={`${id}-presupuesto`}
                    name="budget"
                    label="Presupuesto en MXN (opcional)"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={500}
                    className="tabular"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    helperText={budgetNote ?? undefined}
                />
            </div>
            <div className="md:col-span-6">
                <Textarea
                    id={`${id}-mensaje`}
                    label={`Mensaje para ${groupName}`}
                    value={message}
                    onChange={(e) => {
                        const next = e.target.value.slice(0, REQUEST_MESSAGE_MAX);
                        setMessage(next);
                        if (next.length < REQUEST_MESSAGE_MAX) setMessageCut(false);
                    }}
                    onPaste={(e) => {
                        if (pastedLength(e.currentTarget, e.clipboardData.getData("text")) > REQUEST_MESSAGE_MAX) {
                            setMessageCut(true);
                        }
                    }}
                    required
                    minLength={REQUEST_MESSAGE_MIN}
                    maxLength={REQUEST_MESSAGE_MAX}
                    rows={5}
                    placeholder="Es nuestra boda, queremos mariachi a la salida de la iglesia y una hora en la recepción."
                    helperText={
                        tooShort
                            ? `Al menos ${REQUEST_MESSAGE_MIN} caracteres.`
                            : [messageLimit.counter, messageLimit.note].filter(Boolean).join(" · ")
                    }
                />
            </div>
            {create.isError && (
                <p id={`${id}-error`} role="alert" className="md:col-span-6 text-error">
                    {apiErrorMessage(create.error, "No pudimos enviar la solicitud. Revisa los datos e inténtalo de nuevo.")}
                </p>
            )}
            <div className="md:col-span-6 flex flex-col items-start gap-2">
                <Button
                    type="submit"
                    size="lg"
                    disabled={create.isPending || Boolean(sendReason)}
                    /* La razón de estar apagado se lee como su descripción, no como un texto suelto. */
                    aria-describedby={sendReason ? `${id}-motivo` : undefined}
                    className="rounded-[8px] px-8"
                >
                    {create.isPending ? "Enviando…" : "Enviar solicitud"}
                </Button>
                {sendReason && (
                    <p id={`${id}-motivo`} className="text-sm text-tinta-2">
                        {sendReason}
                    </p>
                )}
            </div>
        </form>
    );
}
