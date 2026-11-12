"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateSelectArg, EventChangeArg, EventInput, DatesSetArg, EventClickArg } from "@fullcalendar/core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { groupAvailabilityService as schedulesService, type CreateBusyScheduleRequest, type ScheduleEventDto } from "../services/groupAvailability.service";
import { useGroupGigs } from "@/features/gigs/gigs.queries";
import { blockKindOf, planBlockDrag } from "../blockMove";
import { gigDayList, gigHourBlocks, GIG_BLOCK_TITLE } from "../gigBlocks";
import { useBlockMove } from "../hooks/useBlockMove";
import { MoveBlockDialog } from "./MoveBlockDialog";

import esLocale from "@fullcalendar/core/locales/es";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { todayInMexico } from "@/lib/format";
import { keepWholeDayBlocksInTheirColumn, withoutAvailabilityOnBookedDays } from "../bookedDays";
import { availabilityChips } from "../availabilityChips";
import { BlockDayControl } from "./BlockDayControl";
import { BlockSlotDialog } from "./BlockSlotDialog";
import {
  CALENDAR_DAY_END,
  CALENDAR_DAY_START,
  CALENDAR_GRID_MIN_WIDTH_CLASS,
  CALENDAR_LATE_NIGHT_HINT,
  CALENDAR_SCROLLER_CLASS,
  CALENDAR_SWIPE_HINT,
} from "./calendarLayout";

/**
 * Ronda 13: el tinte de una marca de disponibilidad. FullCalendar pinta los eventos de fondo con
 * `opacity: .3` y el título en cursiva, tan tenue que "Disponible" no se leía sobre el tema oscuro. El
 * color lleva su propia transparencia y la clase sube la opacidad a 1; los `!` ganan contra la hoja de
 * FullCalendar, que no está en una capa (la misma trampa del anillo de foco, L50). Es verde como el
 * resto de lo "libre" y distinto del bloque ocupado (acento), sin tocar `globals.css`.
 */
const AVAILABILITY_TINT = "color-mix(in srgb, var(--ok) 20%, transparent)";
const AVAILABILITY_TINT_CLASSES = [
  "ng-available",
  "opacity-100!",
  "[&_.fc-event-title]:not-italic!",
  "[&_.fc-event-title]:text-tinta!",
];

/** Marcador de un día con toque confirmado: no es un bloque del calendario y no se puede mover. */
const GIG_ID_PREFIX = "gig_";

function toCalendarEvent(ev: ScheduleEventDto): EventInput {
  const isBusy = blockKindOf(String(ev.id ?? "")) === "busy";
  if (isBusy) {
    return { ...ev, backgroundColor: undefined, borderColor: undefined, textColor: undefined, classNames: ["ng-busy"] };
  }
  /*
   * Ronda 13: un día marcado como disponible se pintaba como UN bloque de 08:00 a 00:00, y el arrastre que
   * empezaba encima movía la marca en vez de elegir horas para bloquear. Bloquear horas es lo común y mover
   * una marca lo raro, así que la marca es un evento de fondo: FullCalendar deja empezar una selección sobre
   * él (`isValidDateDownEl` ignora `.fc-bg-event`) y nunca lo hace arrastrable. Como tampoco entrega su
   * `eventClick`, quitarla se hace desde la ficha de día completo (`availabilityChips`). Un bloque ocupado
   * sigue siendo un evento normal: se mueve con confirmación y se quita al tocarlo.
   */
  return {
    ...ev,
    display: "background",
    backgroundColor: AVAILABILITY_TINT,
    borderColor: undefined,
    textColor: undefined,
    classNames: AVAILABILITY_TINT_CLASSES,
  };
}

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

  /*
   * Ronda 12: mover un bloque ya no escribe. `useBlockMove` guarda la pregunta y es el único que escribe,
   * y solo cuando el manager confirma. Las dos mutaciones que antes vivían acá escribían al soltar el
   * arrastre; ahora no hay una segunda puerta de escritura que se pueda saltar la pregunta.
   */
  const blockMove = useBlockMove(groupId);
  const { pending: pendingMove, cancel: cancelMove } = blockMove;

  const deleteAvailability = useMutation({
    mutationFn: (id: string) => schedulesService.removeAvailability(groupId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["schedules", groupId] })
  });

  const deleteBusy = useMutation({
    mutationFn: (id: string) => schedulesService.removeBusySchedule(groupId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["schedules", groupId] })
  });

  // Los colores vienen fijos de la API; aquí se cambian por clases del sistema (globals.css → .fc).
  /*
   * Ronda 12: la rejilla solo sabía el día del toque, así que sus horas no se veían y el manager podía
   * arrastrar sobre su propio toque sin enterarse hasta el diálogo. La agenda se lee acá —la misma
   * consulta y la misma clave que abre la pestaña de la agenda, así que no cuesta un pedido más— y aporta
   * las horas reales. Solo la vista privada la lee: la agenda del grupo es del manager.
   */
  const gigAgenda = useGroupGigs(isPrivate ? groupId : null);
  const gigRows = useMemo(() => gigAgenda.data ?? [], [gigAgenda.data]);
  const gigDays = useMemo(() => gigDayList(confirmedGigDays ?? [], gigRows), [confirmedGigDays, gigRows]);

  const bookedDays = useMemo(() => new Set(gigDays), [gigDays]);
  const events = useMemo<EventInput[]>(
    () => {
      /*
       * Ronda 10: un día con toque confirmado no está disponible. La semana del 30 nov al 6 dic pintaba
       * el 4 dic como "Toque confirmado" y además como "0:00 Disponible", y un manager la leía libre. La
       * marca de disponibilidad se calla en ese día; el marcador del toque se queda, porque es el dato que
       * explica por qué el día no está libre.
       *
       * Ronda 12: el día se extiende hasta la madrugada, así que un bloqueo de día entero se pintaba también
       * como una franja al final de la columna anterior. `keepWholeDayBlocksInTheirColumn` lo deja en su día.
       */
      const shown = keepWholeDayBlocksInTheirColumn(withoutAvailabilityOnBookedDays(serverEvents, bookedDays));
      return [
        ...shown.map(toCalendarEvent),
        /*
         * Ronda 13: FullCalendar no entrega `eventClick` de un evento de fondo, así que el tinte solo no se
         * puede quitar con el dedo. La misma marca tiene una segunda forma en primer plano, una ficha por
         * día en la franja de día completo (donde ya vive y se toca "Toque confirmado"), que no se arrastra.
         */
        ...availabilityChips(shown),
      ];
    },
    [serverEvents, bookedDays],
  );

  /*
   * Toques confirmados, en las dos formas que el calendario ya tenía que saber pintar: la ficha del día,
   * que no se toca, y desde la ronda 12 el bloque de sus horas reales.
   *
   * El bloque no se puede arrastrar —`editable: false`, y FullCalendar no le pone la clase que marca lo
   * arrastrable— porque esas horas no son del manager para editar acá: son un dato que explica por qué el
   * día no está libre. El borde discontinuo lo dice sin palabras. Los `!` de las clases no son adorno:
   * FullCalendar inyecta su hoja sin capa y su `.fc-h-event { border: 1px solid }` gana contra
   * `@layer utilities`, la misma trampa del anillo de foco (L50).
   */
  const gigEvents = useMemo<EventInput[]>(
    () => [
      ...gigDays.map((day) => ({
        id: `${GIG_ID_PREFIX}${day}`,
        title: GIG_BLOCK_TITLE,
        start: day,
        allDay: true,
        editable: false,
        startEditable: false,
        durationEditable: false,
        backgroundColor: "var(--ok)",
        borderColor: "var(--ok)",
        textColor: "var(--fondo)",
      })),
      ...gigHourBlocks(gigRows).map((block) => ({
        id: block.id,
        title: GIG_BLOCK_TITLE,
        start: block.start,
        end: block.end,
        editable: false,
        startEditable: false,
        durationEditable: false,
        backgroundColor: "var(--fondo-2)",
        borderColor: "var(--ok)",
        textColor: "var(--tinta)",
        classNames: ["ng-gig-block", "border-2!", "border-dashed!"],
      })),
    ],
    [gigDays, gigRows],
  );

  const calendarEvents = useMemo<EventInput[]>(() => [...events, ...gigEvents], [events, gigEvents]);

  // El aviso refleja solo el último cambio enviado: si el siguiente sale bien, desaparece.
  const lastMutation = [createBusy, deleteAvailability, deleteBusy]
    .reduce((latest, m) => (m.submittedAt > latest.submittedAt ? m : latest));
  const mutationFailed = lastMutation.isError || blockMove.failed;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPendingSelect(null);
        setPendingDelete(null);
        cancelMove();
      }
    };
    if (pendingSelect || pendingDelete || pendingMove) {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [pendingSelect, pendingDelete, pendingMove, cancelMove]);

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

    /*
     * Ronda 12: soltar un bloque escribía de inmediato. Ahora la rejilla vuelve a donde estaba y lo que
     * queda es la pregunta del diálogo: nada se escribe hasta que el manager confirma.
     */
    const move = planBlockDrag(changeInfo);
    if (move) blockMove.request(move);
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    if (!isPrivate) return;
    /* La ficha de día completo de una marca de disponibilidad quita la marca, no a sí misma. */
    const removes = clickInfo.event.extendedProps?.removes as { id: string; title: string } | undefined;
    const id = removes?.id ?? clickInfo.event.id;
    const title = (removes?.title ?? clickInfo.event.title) || "Evento";
    const kind = blockKindOf(id);
    if (!kind) return;
    setPendingDelete({ id, title, kind });
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
              ? "Cuentas como disponible salvo en lo que marques. Arrastra sobre las horas para bloquearlas, incluso en un día marcado como disponible; mueve un bloque ocupado y confirma a dónde va, o tócalo para quitarlo."
              : "El grupo está disponible salvo en los bloques marcados."}
            {isPrivate && ` ${CALENDAR_LATE_NIGHT_HINT}`}
            {isPrivate && (gigDays.length > 0) && " Los días con un toque confirmado no se marcan como disponibles."}
          </p>
        </div>
        <ul aria-label="Leyenda" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-tinta-2">
          <li className="inline-flex items-center gap-2">
            <span aria-hidden className="size-3 bg-acento" />
            No disponible
          </li>
          <li className="inline-flex items-center gap-2">
            <span aria-hidden className="ng-swatch-available size-3" style={{ backgroundColor: AVAILABILITY_TINT }} />
            Disponible (bloque marcado)
          </li>
          <li className="inline-flex items-center gap-2">
            <span aria-hidden className="size-3 bg-fondo-2" />
            Sin marcar: disponible
          </li>
          {(gigDays.length > 0) && (
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
        privada: la agenda pública del grupo no se edita. Ronda 10: el control lee por su cuenta los días
        con toque confirmado, así que la bandeja —que monta este mismo control desde otra pestaña— avisa
        igual que el calendario.
      */}
      {isPrivate && (
        <BlockDayControl groupId={groupId} initialDay={todayInMexico()} className="mt-8" />
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
        {/* Solo donde la rejilla no entra: abajo de `lg` la semana mide más que la pantalla. */}
        <p className="mb-3 text-sm text-tinta-2 lg:hidden">{CALENDAR_SWIPE_HINT}</p>
        {isLoading ? (
          <div aria-busy className="grid h-[480px] place-items-center bg-fondo-2">
            <p role="status" className="text-tinta-2">Cargando calendario…</p>
          </div>
        ) : (
          /*
            Ronda 11: arriba de estas dos capas se veía la ficha partida. La rejilla deja de encogerse
            por debajo del ancho que necesita su ficha más larga y el desborde se queda acá adentro: el
            que scrollea es este contenedor, así que la página no se mueve y ningún día queda lejos de
            la mano.
          */
          <div className={CALENDAR_SCROLLER_CLASS}>
            <div className={CALENDAR_GRID_MIN_WIDTH_CLASS}>
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
                slotMinTime={CALENDAR_DAY_START}
                slotMaxTime={CALENDAR_DAY_END}
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
            </div>
          </div>
        )}
      </div>

      {/*
        El diálogo del arrastre vive en su propio componente porque es la otra puerta del mismo bloqueo y
        ahora lee la misma agenda que el formulario del día (ronda 11).
      */}
      {pendingSelect && (
        <BlockSlotDialog
          groupId={groupId}
          start={pendingSelect.startStr}
          end={pendingSelect.endStr}
          isSaving={createBusy.isPending}
          onCancel={() => setPendingSelect(null)}
          onConfirm={confirmMarkUnavailable}
        />
      )}

      {/*
        Ronda 12: la pregunta que deja un arrastre. El bloque solo se mueve cuando se confirma acá; hasta
        entonces la rejilla lo muestra donde estaba.
      */}
      {pendingMove && (
        <MoveBlockDialog
          title={pendingMove.title}
          from={pendingMove.from}
          to={pendingMove.to}
          isSaving={blockMove.isSaving}
          onCancel={cancelMove}
          onConfirm={blockMove.confirm}
        />
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
              <Button type="button" variant="ghost" className="min-h-11" onClick={() => setPendingDelete(null)} autoFocus>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" className="min-h-11" onClick={confirmDelete}>
                Quitar del calendario
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
