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
