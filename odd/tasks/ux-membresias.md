# UX de membresías: que invitar y pedir unirse sea evidente

Documento de feature con el protocolo ODD: Specs → Tasks → Log.
Rama de trabajo: `feat/membership-ux` (a partir de `feat/ui-polish`). La verificación visual la hace el orquestador con Playwright, con dos cuentas reales (un manager y un músico).

## Specs

- **S1 — El problema, textual.** "no se como está el flujo para envair solicitudes a musicos o como musico enviar solicitudes a grupos para formar parte, no e snada intuitivo".
- **S2 — Un músico sin grupo ve cómo unirse.** El panel de un músico sin grupo ofrece dos caminos de igual peso: crear su grupo o unirse a uno existente, cada uno con un botón.
- **S3 — Pedir unirse se ve en el perfil.** En el encabezado del perfil público de un grupo, un músico (que no es miembro) ve un botón "Pedir unirse" junto a "Pedir una fecha", no solo al final de la página.
- **S4 — Lo pendiente se nota.** Un músico con invitaciones recibidas y un manager con solicitudes para unirse pendientes ven un contador en el menú y en la pestaña, sin tener que buscarlas.
- **S5 — Un solo nombre por cosa.** Los pedidos de fecha de clientes se llaman "Pedidos de fecha". Las membresías usan "invitación" (del grupo al músico) y "solicitud para unirse" (del músico al grupo). Ninguna palabra significa dos cosas.
- **S6 — Entrar a un grupo tiene resultado.** Al aceptar una invitación o ser aceptado, el músico ve el grupo en "Mis grupos" con su rol (Dueño, Manager o Miembro) y un enlace a su perfil público. Solo Dueño y Manager ven las herramientas de gestión.
- **S7 — Los vacíos explican y llevan a la acción.** Cada pantalla vacía dice qué hacer y trae un botón (por ejemplo "Buscar grupos para unirme").

## Hallazgos (Playwright, cuenta real de músico sin grupo)

- H1 El panel sin grupo solo ofrece "Crear mi grupo"; unirse a uno existente es un párrafo gris sin enlace.
- H2 El menú de un músico sin grupo muestra "Explorar grupos" y "Mis solicitudes" (que son de clientes); no hay entrada para invitaciones.
- H3 "Solicitudes" nombra a la vez los pedidos de fecha de clientes y los pedidos para unirse.
- H4 En el perfil público "Pedir unirse" está al final, tras el formulario de fecha.
- H5 `GetGroupByUserId` toma cualquier fila de `group_members` (activa o no) sin orden: un Member vería el panel de gestión y, con varios grupos, vería uno al azar. Quien no es Dueño ni Manager no puede escribir (403).
- H6 No existe ningún endpoint para listar los grupos de los que un usuario es miembro.

## No metas

- Rediseño visual: se usan los componentes y tokens existentes (`DESIGN.md`).
- Promover a Manager (sigue sin existir; solo el Owner podrá, decisión previa).
- Lista de miembros con nombres de un grupo (sigue siendo un cambio de backend aparte).

## Tasks

- [x] T1 (S6) Backend: `GET api/users/me/memberships` (grupos activos del usuario con rol) y `GetGroupByUserId` que solo considera membresías activas de Dueño o Manager (Dueño primero). Con tests.
- [ ] T2 (S2, S3, S4, S5, S7) Frontend de navegación: dos caminos en el panel sin grupo, botón en el encabezado del perfil, contadores en menú y pestañas, renombrar pestañas y textos, vacíos con acción.
- [ ] T3 (S6) Frontend: pestaña "Mis grupos" con membresías, rol y enlace, y herramientas de gestión solo para Dueño y Manager.
- [ ] T4 (S1) Verificación con Playwright de todo el recorrido con dos cuentas reales, a 1440 px y 390 px.

## Log

- L1 (usuario, verbatim): "no se como está el flujo para envair solicitudes a musicos o como musico enviar solicitudes a grupos para formar parte, no e snada intuitivo"
- L2: la base de datos local se perdió al reiniciarse la máquina (Docker sin el contenedor ni el volumen); se recreó con migraciones y seed. La cuenta de prueba de Auth0 (`qa.nitrogroups.audit@example.com`) quedó sin grupo, que es justo el caso del músico nuevo.

### T1 (S6, H5, H6): backend
- Commit: `feat(groups): list the caller's memberships and scope the managed group`.
- Tests: Integration 193 (was 186), Endpoints 155 (was 149), 0 failed. RED observed first: 6 of 7 integration and 4 endpoint tests failed against a stub handler and a missing route.
- New route `GET api/users/me/memberships`: private, identity from the token (`ICurrentUserService`), 401 when not synced. Returns 200 with `[{ groupId, groupName, slug, profilePictureUrl, role, joinedAt }]`, `role` as text (`Owner` | `Manager` | `Member`), `[]` when there are none. Order: Owner, Manager, Member, then `joinedAt` ascending. Only `group_members.IsActive = true`; member rows are the source of truth (`CreateGroupCommandHandler` and `SoloMusicianCreatedEventHandler` both create the Owner row).
- Behavior change in `GetGroupByUserId` (`GET api/users/{userId}/groups`): it now considers only active Owner/Manager rows (Owner first, then earliest `JoinedAt`); a plain Member, an inactive row or no row gives the existing 404. Response shape unchanged.
- No migration, no repository change (uses `GroupMembers`/`Groups` `FindAsync`).
