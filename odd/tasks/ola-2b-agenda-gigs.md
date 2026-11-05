# Ola 2b: agenda de gigs (manager y miembro)

Documento ODD. Rama `feat/membership-ux`. Contrato de API fijado abajo para que backend y frontend trabajen en paralelo.

## Specs

- **S1.** "No hay fechas, ni setlist, ni lo que nos pagan" (Miguel). Un miembro ve sus próximos toques con fecha, lugar, hora de inicio, duración y grupo.
- **S2.** "Quiero saber si ya tengo ese día" (Mónica). El manager ve en su panel los toques confirmados de su grupo, ordenados por fecha, con cuántos miembros confirmaron.
- **S3.** El miembro responde "Confirmo" o "No puedo" desde la app, y su respuesta se guarda y se ve al volver.
- **S4.** Solo se ven los toques de grupos donde la persona es miembro activo; el manager solo ve los de su grupo (403 si no lo gestiona).

## Contrato de API

- `GET api/me/gigs` — autenticado: toques aceptados (`event_requests.status = Accepted`) de grupos donde el llamante tiene membresía activa, desde 30 días atrás, ordenados por fecha. Fila:
  `{ id, groupId, groupName, groupSlug, eventDate, startTime, durationHours, eventType, locationText, role, attendance }`, con `attendance` = `"Confirmed" | "Declined" | null`.
- `POST api/gigs/{id}/attendance` — cuerpo `{ "status": "Confirmed" | "Declined" }`: guarda la respuesta del llamante (upsert). 404 si no es miembro activo del grupo de ese toque; 400 si el estado no es válido; 200 con `{ id, attendance }`.
- `GET api/groups/{groupId}/gigs` — `RequireGroupManager`: las mismas filas del grupo más `attendees: [{ userId, fullName, status }]`.

## Tasks

- [ ] T1 (S1-S4) Backend: tabla `bookings.gig_attendance` (migración), consulta de mis toques, upsert de respuesta y vista del manager, con tests.
- [ ] T2 (S1-S3) Frontend: pestaña "Mi agenda" del músico (lista + Confirmo/No puedo + estado) y sección "Agenda" del manager con asistencias; los días confirmados se marcan en el calendario del grupo si sale barato.
- [ ] T3 Verificación con Playwright: Mateo confirma un toque, Mónica ve la asistencia, celular.

## Log

- L1 (usuario, verbatim): "prosigue, me parece que se detuvo en worker porque s eme cerró la sesion".
- L2: la API local se había caído con el cierre de sesión; se reinicia antes de verificar.

## Autorización de trabajo autónomo (2026-11-05, 03:05)

- L3 (usuario, verbatim): "voy a dormir, mientras sigue con lo que falta, si hay que tomar decisiones las vas anotando y skipeas lo que tenga que ver con esa decisión y continúas con lo demás, yo espero que no se necesiten decisiones, lo que sea ligero tómalo tú, te doy el permiso para tomar decisiones profesionales. Después de terminar todo lo pendiente vuelve a lanzar los agentes para que usen la app y vuelvan a dar retroalimentación siendo muy críticos, hasta tenerlos feliz".
- Regla adoptada: las decisiones técnicas livianas (nombres, estructura de carpetas, estados de UI, textos, orden) se toman acá y quedan registradas en este Log. Las decisiones de producto o de dinero (precios, contratos, pagos, política de cancelación) NO se implementan: se anotan en `## Decisiones pendientes` y se continúa con el resto.
- Al cerrar la agenda se repite la ronda de los cuatro críticos (Camila, Mateo, Mónica, Miguel) con el mismo método (navegan la app real, sin editar el repo) y se corrigen los hallazgos de causa propia con impacto alto, hasta dos rondas más.

## Decisiones pendientes (producto; no implementadas)

- D1 Pagos y anticipos: quién cobra, con qué comisión y con qué política de cancelación. Requiere definición del negocio.
- D2 Paga por miembro: hoy el modelo no guarda cuánto gana cada músico por toque; implementarlo exige una decisión de producto.
- D3 Setlist y rider técnico: contenido y permisos a definir.
- L4 (decisión técnica tomada en la noche, sin consultar): faltaban los rewrites de `/api/me` y `/api/gigs` en `UI/nitro-groups/next.config.ts` y en la lista `BACKEND_API_PREFIXES` de `src/proxy.ts`. Sin ellos, la agenda solo funciona si `NEXT_PUBLIC_API_BASE_URL` está definida y, sin esa variable, ambas llamadas dan 404 en Next. Se agregaron ambas entradas; no cambia ninguna ruta existente.
