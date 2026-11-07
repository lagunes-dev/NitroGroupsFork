"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateSelectArg, EventChangeArg, EventInput, DatesSetArg, EventClickArg } from "@fullcalendar/core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/** La API antepone "busy_" al id de los horarios ocupados (el resto son bloques de disponibilidad). */
const BUSY_ID_PREFIX = "busy_";
/** Marcador de un día con toque confirmado: no es un bloque del calendario y no se puede mover. */
const GIG_ID_PREFIX = "gig_";
import { groupAvailabilityService as schedulesService, type CreateBusyScheduleRequest, type UpdateAvailabilityRequest, type UpdateBusyScheduleRequest } from "../services/groupAvailability.service";

import esLocale from "@fullcalendar/core/locales/es";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { todayInMexico } from "@/lib/format";
import { formatRangeLabel } from "./formatRange";
import { BlockDayControl } from "./BlockDayControl";

export type GroupCalendarMode = "public" | "private";

interface GroupCalendarProps {
  groupId: number;
  mode?: GroupCalendarMode;
  /**
   * Días (`YYYY-MM-DD`) que ya tienen un toque confirmado. Se muestran como una ficha de día completo,
   * con su texto accesible, en vez de un punto: este calendario no tiene hoja de estilos propia, así que
   * una clase sobre la celda del día no se vería.
   */
  confirmedGigDays?: string[];
}

type PendingDelete = { id: string; title: string; kind: "avail" | "busy" };

export default function GroupCalendar({ groupId, mode = "public", confirmedGigDays }: GroupCalendarProps) {
  const isPrivate = mode === "private";
  const queryClient = useQueryClient();
  const calendarRef = useRef<FullCalendar>(null);

  const [pendingSelect, setPendingSelect] = useState<DateSelectArg | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const [dateRange, setDateRange] = useState({ 
    start: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString(), 
    end: new Date(new Date().setMonth(new Date().getMonth() + 2)).toISOString() 
  });

  const { data: serverEvents = [], isLoading } = useQuery({
    queryKey: ["schedules", groupId, dateRange.start, dateRange.end],
    queryFn: () => schedulesService.getGroupSchedules(groupId, dateRange.start, dateRange.end),
    enabled: !!groupId,
    /*
     * La clave de la consulta lleva el rango visible y `datesSet` la mueve al navegar. Sin datos
     * previos la consulta vuelve a "sin cargar", el aviso de carga sustituye al calendario y, al
     * volver, FullCalendar arranca otra vez en la semana de hoy: "Semana siguiente" alternaba dos
     * semanas y "Mes" no cambiaba de vista. Conservar la respuesta anterior mientras llega la nueva
     * deja el calendario montado, en el rango y en la vista que la persona acaba de elegir.
     */
    placeholderData: (previousData) => previousData,
  });

  const createBusy = useMutation({
    mutationFn: (req: CreateBusyScheduleRequest) => schedulesService.createBusySchedule(groupId, req),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["schedules", groupId] })
  });

  const updateAvailability = useMutation({
    mutationFn: (req: { id: string, data: UpdateAvailabilityRequest }) => schedulesService.updateAvailability(groupId, req.id, req.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["schedules", groupId] })
  });

  const updateBusy = useMutation({
    mutationFn: (req: { id: string, data: UpdateBusyScheduleRequest }) => schedulesService.updateBusySchedule(groupId, req.id, req.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["schedules", groupId] })
  });

  const deleteAvailability = useMutation({
    mutationFn: (id: string) => schedulesService.removeAvailability(groupId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["schedules", groupId] })
  });

  const deleteBusy = useMutation({
    mutationFn: (id: string) => schedulesService.removeBusySchedule(groupId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["schedules", groupId] })
  });

  // Los colores vienen fijos de la API; aquí se cambian por clases del sistema (globals.css → .fc).
  const events = useMemo<EventInput[]>(
    () =>
      (serverEvents as EventInput[]).map((ev) => ({
        ...ev,
        backgroundColor: undefined,
        borderColor: undefined,
        textColor: undefined,
        classNames: [String(ev.id ?? "").startsWith(BUSY_ID_PREFIX) ? "ng-busy" : "ng-available"],
      })),
    [serverEvents],
  );

  // Toques confirmados: fichas de día completo, no editables, para no confundirlas con la disponibilidad.
  const gigEvents = useMemo<EventInput[]>(
    () =>
      (confirmedGigDays ?? []).map((day) => ({
        id: `${GIG_ID_PREFIX}${day}`,
        title: "Toque confirmado",
        start: day,
        allDay: true,
        editable: false,
        startEditable: false,
        durationEditable: false,
        backgroundColor: "var(--ok)",
        borderColor: "var(--ok)",
        textColor: "var(--fondo)",
      })),
    [confirmedGigDays],
  );

  const calendarEvents = useMemo<EventInput[]>(() => [...events, ...gigEvents], [events, gigEvents]);

  // El aviso refleja solo el último cambio enviado: si el siguiente sale bien, desaparece.
  const lastMutation = [createBusy, updateAvailability, updateBusy, deleteAvailability, deleteBusy]
    .reduce((latest, m) => (m.submittedAt > latest.submittedAt ? m : latest));
  const mutationFailed = lastMutation.isError;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPendingSelect(null);
        setPendingDelete(null);
      }
    };
    if (pendingSelect || pendingDelete) {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [pendingSelect, pendingDelete]);

  const confirmMarkUnavailable = () => {
    if (!pendingSelect) return;
    createBusy.mutate(
      {
        title: "No disponible",
        start: pendingSelect.startStr,
        end: pendingSelect.endStr,
        source: "personal"
      },
      { onSuccess: () => setPendingSelect(null) }
    );
  };

  const handleSelect = (selection: DateSelectArg) => {
    if (!isPrivate) return;
    setPendingSelect(selection);
  };

  const handleEventChange = (changeInfo: EventChangeArg) => {
    if (!isPrivate) return;
    
    if (!changeInfo.event.start || !changeInfo.event.end) {
      changeInfo.revert();
      return;
    }

    if (changeInfo.event.id.startsWith("avail_")) {
      updateAvailability.mutate({
        id: changeInfo.event.id,
        data: {
          start: changeInfo.event.start.toISOString(),
          end: changeInfo.event.end.toISOString()
        }
      });
    } else if (changeInfo.event.id.startsWith("busy_")) {
      updateBusy.mutate({
        id: changeInfo.event.id,
        data: {
          start: changeInfo.event.start.toISOString(),
          end: changeInfo.event.end.toISOString()
        }
      });
    }
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    if (!isPrivate) return;
    const id = clickInfo.event.id;
    const title = clickInfo.event.title || "Evento";
    if (id.startsWith("avail_")) {
      setPendingDelete({ id, title, kind: "avail" });
    } else if (id.startsWith("busy_")) {
      setPendingDelete({ id, title, kind: "busy" });
    }
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    if (pendingDelete.kind === "avail") {
      deleteAvailability.mutate(pendingDelete.id);
    } else {
      deleteBusy.mutate(pendingDelete.id);
    }
    setPendingDelete(null);
  };

  const handleDatesSet = (arg: DatesSetArg) => {
    setDateRange({ start: arg.startStr, end: arg.endStr });
  };

  const dialogPanel =
    "w-full max-w-md bg-fondo-2 p-6 text-tinta shadow-[0_24px_64px_-16px_var(--fondo)]";

  return (
    <section aria-labelledby="calendario-titulo" className="py-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-[62ch]">
          <h2 id="calendario-titulo" className="sr-only">Calendario</h2>
          <p className="text-tinta-2">
            {isPrivate
              ? "Cuentas como disponible salvo en lo que marques. Arrastra sobre las horas para bloquearlas, mueve un bloque para ajustarlo o tócalo para quitarlo."
              : "El grupo está disponible salvo en los bloques marcados."}
          </p>
        </div>
        <ul aria-label="Leyenda" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-tinta-2">
          <li className="inline-flex items-center gap-2">
            <span aria-hidden className="size-3 bg-acento" />
            No disponible
          </li>
          <li className="inline-flex items-center gap-2">
            <span aria-hidden className="ng-swatch-available size-3" />
            Disponible (bloque marcado)
          </li>
          <li className="inline-flex items-center gap-2">
            <span aria-hidden className="size-3 bg-fondo-2" />
            Sin marcar: disponible
          </li>
          {(confirmedGigDays?.length ?? 0) > 0 && (
            <li className="inline-flex items-center gap-2">
              <span aria-hidden className="size-3 bg-ok" />
              Toque confirmado
            </li>
          )}
        </ul>
      </div>

      {/*
        S26: un día también se bloquea desde la agenda, sin arrastrar sobre la rejilla. Va aquí arriba,
        antes del calendario, porque un arrastre no se puede hacer con el teclado. Solo en la vista
        privada: la agenda pública del grupo no se edita. Ronda 10: el control recibe los mismos días con
        toque confirmado que el calendario ya marca, para avisar antes de bloquear uno de ellos.
      */}
      {isPrivate && (
        <BlockDayControl
          groupId={groupId}
          initialDay={todayInMexico()}
          confirmedGigDays={confirmedGigDays}
          className="mt-8"
        />
      )}

      {mutationFailed && (
        <Alert variant="destructive" className="mt-6">
          <AlertDescription>No pudimos guardar el último cambio del calendario. Recarga la página e inténtalo de nuevo.</AlertDescription>
        </Alert>
      )}

      {/*
        Ronda 9: a 390 px la celda del día medía 42 px y los botones de la barra (Hoy / Mes / Semana /
        Día) 43 px. FullCalendar inyecta su hoja en runtime y sin capa, así que sus medidas se suben
        desde acá, apuntando a sus clases. El `!` de la celda no es adorno: ese `min-height` choca con
        el `min-height: 100%` de FullCalendar, que al no estar en una capa gana contra `@layer
        utilities` (la misma trampa del anillo de foco, T50). Los botones no lo necesitan porque
        FullCalendar no les fija altura.
      */}
      <div className="ng-calendario mt-8 [&_.fc-button]:min-h-11 [&_.fc-daygrid-day-frame]:min-h-11!">
        {isLoading ? (
          <div aria-busy className="grid h-[480px] place-items-center bg-fondo-2">
            <p role="status" className="text-tinta-2">Cargando calendario…</p>
          </div>
        ) : (
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            locale={esLocale}
            initialView="timeGridWeek"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            height="auto"
            nowIndicator
            slotMinTime="08:00:00"
            slotMaxTime="23:00:00"
            editable={isPrivate}
            eventStartEditable={isPrivate}
            eventDurationEditable={isPrivate}
            eventResizableFromStart={isPrivate}
            selectable={isPrivate}
            selectMirror={isPrivate}
            select={handleSelect}
            events={calendarEvents}
            eventClick={handleEventClick}
            eventChange={handleEventChange}
            datesSet={handleDatesSet}
            dayMaxEvents
          />
        )}
      </div>

      {pendingSelect && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-fondo/85 p-4"
          role="presentation"
          onClick={() => setPendingSelect(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="select-interval-title"
            aria-describedby="select-interval-range"
            className={dialogPanel}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="select-interval-title" className="type-heading text-2xl">
              Bloquear este horario
            </h3>
            <p id="select-interval-range" className="mt-4 bg-fondo px-4 py-3 font-medium tabular">
              {formatRangeLabel(pendingSelect.startStr, pendingSelect.endStr)}
            </p>
            <p className="mt-3 text-sm text-tinta-2">
              Nadie podrá pedirte una fecha en ese horario. Puedes quitar el bloque cuando quieras.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPendingSelect(null)}
                disabled={createBusy.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={confirmMarkUnavailable}
                disabled={createBusy.isPending}
                autoFocus
              >
                {createBusy.isPending ? "Bloqueando…" : "Bloquear horario"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-fondo/85 p-4"
          role="presentation"
          onClick={() => setPendingDelete(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-event-title"
            className={dialogPanel}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-event-title" className="type-heading text-2xl">
              Quitar «{pendingDelete.title}»
            </h3>
            <p className="mt-3 text-tinta-2">
              {pendingDelete.kind === "busy"
                ? "Ese horario vuelve a contar como disponible."
                : "El bloque desaparece del calendario."}
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => setPendingDelete(null)} autoFocus>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" onClick={confirmDelete}>
                Quitar del calendario
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
