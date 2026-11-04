# Membresías de grupo: invitaciones y solicitudes para unirse

Documento de feature con el protocolo ODD: Specs → Tasks → Log.
Rama de trabajo: `feat/group-membership` (a partir de `develop`). Entrega en dos PRs: backend (T1-T4) e interfaz (T5-T6).

## Specs

- **S1 — Los dos sentidos.** "Los dos sentidos": un manager puede invitar a un músico a su grupo, y un músico puede pedir unirse a un grupo. Quien recibe responde.
- **S2 — Búsqueda de músicos.** "Solo los abiertos a unirse, por nombre". "Respeta IsOpenToJoin del onboarding. Se busca por nombre y nunca se expone el email."
- **S3 — Rol inicial.** "Member; solo el Owner promueve a Manager". "Un Manager no puede crear otros Managers, así no se escalan permisos por invitación."
- **S4 — Varios grupos.** "Sí, a varios". "El modelo ya lo permite: GroupMember es una fila por usuario y grupo. Es habitual tocar en más de una banda." Un músico puede tener un grupo propio y además ser Member de otros.
- **S5 — Entrega.** "Dos PRs: backend y después interfaz". "PR 1: dominio, endpoints, avisos por email y tests. PR 2: pantallas de invitar, pedir unirse y bandeja. Cada commit queda bajo ~400 líneas."

## Diseño propuesto (derivado de S1-S5 y del mapa del repo; validar con el usuario)

- Agregado nuevo `GroupMembershipRequest` en el módulo Groups, separado de `GroupMember`. Motivo: `GET api/groups/{id}/members` es público y no filtra por `IsActive`, así que guardar pendientes como `GroupMember` los filtraría.
- Campos: `GroupId`, `MusicianUserId`, `InitiatedByUserId`, `Direction` (Invitation=0 | Request=1), `Status` (Pending=0 | Accepted=1 | Declined=2 | Cancelled=3), `ResolvedByUserId?`, `Message?`, token de concurrencia `xmin`. Enums como int, sin reordenar. Una sola solicitud pendiente por (grupo, músico).
- Quién actúa: invitar y responder solicitudes, Owner o Manager activo (`RequireGroupManager`); aceptar o rechazar una invitación, el músico invitado; pedir unirse, un usuario `Musician` a un grupo activo; cancelar, quien la inició. Los ajenos reciben 404.
- Al aceptar: se crea la fila `GroupMember` (o se reactiva si existe, por el índice único) con `Role = Member`, `JoinedVia = Invitation | Request`.
- Invitar exige que el músico tenga `IsOpenToJoin = true`. La búsqueda vive en el módulo Users (`GET api/musicians/open-to-join`) y devuelve un resumen sin email.
- Avisos por email vía outbox, como Bookings.
- Todos los endpoints nuevos son privados (no se toca la allowlist pública).

## No metas

- Acción de promover a Manager: hoy no existe; S3 solo fija que, cuando exista, es exclusiva del Owner.
- Bloqueo de pertenencia múltiple (S4 lo permite).
- Cambiar la forma del endpoint público `GET api/groups/{id}/members`.

## Tasks

- [x] T1 (S1, S3, S4) Agregado `GroupMembershipRequest` + EF config + migración + tests de transiciones del dominio.
- [x] T2 (S2) `IUsersModuleApi` (búsqueda de músicos abiertos y resumen sin email) + `GET api/musicians/open-to-join` + tests.
- [x] T3 (S1, S3, S4) Casos de uso y endpoints de Groups: invitar, pedir unirse, aceptar/rechazar, cancelar, bandejas; alta del `GroupMember` al aceptar; tests de integración y de endpoints (401, 404 a ajenos).
- [x] T4 (S5) Avisos por email vía outbox (invitación, solicitud, resolución).
- [x] T5 (S2, S5) Front: servicio y pestaña "Equipo" del manager (buscar, invitar, ver pendientes).
- [ ] T6 (S1, S5) Front: bandeja "Invitaciones" del músico y "Pedir unirse" en el perfil público del grupo.
- [ ] T7 (S5) Documentación (README) y decisión en Engram.

## Log

- L1 (usuario, verbatim): "es enegram es importante para lo que te voy a pedir, pasa que no se coomo funcionan las cuentas d emusicos, se supone deben poder ser llamados desde un manager ocn un grupo"
- L2 (usuario, elección): flujo "Los dos sentidos".
- L3 (usuario, elección): búsqueda "Solo los abiertos a unirse, por nombre (Recomendado)".
- L4 (usuario, elección): rol "Member; solo el Owner promueve a Manager (Recomendado)".
- L5 (usuario, elección): "Sí, a varios (Recomendado)".
- L6 (usuario, elección): "Dos PRs: backend y después interfaz (Recomendado)".
- Hallazgos de la exploración: `ApprovedBy` es `int` no nulo en una columna de ids `long`; existe un índice único (GroupId, UserId) en `GroupMemberConfiguration.cs:36` pero no se confirmó en la migración; un handler de Groups debe recibir `IUnitOfWorkGroups` (`ApplicationArchitectureTests`); `IntegrationTestFixture` construye `UnitOfWorkGroups` a mano, así que agregar un repositorio obliga a actualizarlo.
- L7 (T1): hecho en el commit `feat(groups): add GroupMembershipRequest aggregate` (hash en el reporte del agente; un commit no puede contener su propio hash). Cubre S1, S3 y S4 en el modelo: `GroupMembershipRequest` con dos sentidos, único Pending por (grupo, músico) y sin bloqueo de pertenencia múltiple; el rol inicial `Member` se asigna en T3. Pruebas: suite completa verde (Integration 143, Endpoints 108, con `NITRO_TEST_POSTGRES`). Migración `AddGroupMembershipRequests` aplicada a la base local; solo agrega la tabla y sus 3 índices.
- L8 (T1, verificación del hallazgo): el índice único (GroupId, UserId) de `group_members` SÍ existe: `unique: true` en `InitialModuleSchema`, `IsUnique()` en el snapshot y `IX_group_members_group_id_user_id UNIQUE` en la base local (`\d groups.group_members`). Queda confirmado; no requiere corrección.
- L9 (T2): hecho en el commit `feat(users): search musicians open to join without exposing email` (hash en el reporte del agente). Cubre S2. Suite completa verde con `NITRO_TEST_POSTGRES`: Integration 152, Endpoints 111.
  - Endpoint privado (deny-by-default del `FallbackPolicy`, sin `AllowAnonymous`): `GET api/musicians/open-to-join?query=&page=1&size=10` (query opcional, `size` se limita a 1..48). 401 sin token.
  - Respuesta: `PagedResult<OpenMusicianSummary>` → `{ items: [{ userId, fullName, profilePictureUrl, yearsExperience }], pageNumber, pageSize, totalCount, totalPages, hasPreviousPage, hasNextPage }`. `OpenMusicianSummary` es un tipo distinto de `UserSummary` y NO tiene email: la privacidad la garantiza el tipo.
  - Solo aparecen músicos con `IsOpenToJoin = true` cuyo usuario está `Active`; el filtro de nombre es insensible a mayúsculas y matchea nombre, apellido o "nombre apellido".
  - Para T3: `IUsersModuleApi.GetMusicianSummariesAsync(IEnumerable<long> userIds, CancellationToken)` devuelve `IReadOnlyDictionary<long, OpenMusicianSummary>` por `UserId` y NO filtra por `IsOpenToJoin` (una invitación pendiente debe seguir mostrando el nombre aunque el músico haya cerrado su perfil).
- L10 (T3): hecho en **dos commits** (el cambio pasa de ~400 líneas): `feat(groups): invite musicians and answer membership requests` (e198a4d) y `feat(groups): request to join a group and membership inboxes`. Cubre S1, S3 y S4, más S2 en la puerta de invitación. Suite completa verde con `NITRO_TEST_POSTGRES`: **Integration 178, Endpoints 149, 0 failed** (baseline de T2: 152 y 111).
  - **Decisión (S2, opción A aprobada por el usuario)**: la regla "solo los abiertos a unirse se pueden invitar" vive en el handler de invitación y consulta `IUsersModuleApi.IsMusicianOpenToJoinAsync(userId)`, miembro nuevo del contrato de Users implementado como `Musicians.AnyAsync(m => m.UserId == userId && m.IsOpenToJoin && m.User.UserType == Musician && m.User.Active)`. Se eligió sobre ampliar `OpenMusicianSummary` para no cambiar la forma del resumen de T2 (que a propósito no filtra por `IsOpenToJoin`, porque una invitación pendiente debe seguir mostrando el nombre de quien cerró su perfil). Un `Client` devuelve siempre `false`.
  - Rutas nuevas (todas privadas; no se tocó la allowlist pública):

    | Ruta | Quién | Éxito | Errores |
    |---|---|---|---|
    | `POST api/groups/{groupId:long}/membership-invitations` (`{ musicianUserId, message? }`) | Owner/Manager (`RequireGroupManager`) | 201 + `Location: api/membership-requests/{id}` | 400 body inválido · 401 sin token · 403 no administra · 404 grupo o músico inexistente · 409 grupo inactivo, músico no abierto a unirse, ya es miembro activo o ya hay una pendiente |
    | `POST api/groups/{groupId:long}/membership-requests` (`{ message? }`, body opcional) | usuario sincronizado que sea `Musician` | 201 + `Location` | 400 mensaje > 2000 · 401 sin token o sin sincronizar · 403 cuenta `Client` · 404 grupo o usuario inexistente · 409 grupo inactivo, ya es miembro o ya hay una pendiente |
    | `POST api/membership-requests/{id:long}/accept` \| `/decline` \| `/cancel` | aceptar/rechazar: el músico invitado (invitación) o Owner/Manager (solicitud); cancelar: quien la inició | 200 con la solicitud | 401 · 403 participa pero su papel no permite la acción · 404 ajeno (no se revela) o inexistente · 409 transición inválida o conflicto de concurrencia |
    | `GET api/groups/{groupId:long}/membership-requests?direction=&status=` | Owner/Manager (`RequireGroupManager`) | 200 lista | 401 · 403 no administra · 404 grupo inexistente |
    | `GET api/membership-requests/mine?direction=&status=` | el propio usuario | 200 lista de sus filas | 401 |

  - Mapeo error → HTTP (`GroupsErrorKind` → `ToHttp`, mismo patrón que `BookingResult` pero local a Groups): Validation 400, Unauthorized 401, Forbidden 403, NotFound 404, Conflict 409.
  - Respuesta `GroupMembershipRequestResponse`: ids, `direction`, `status`, `message`, `createdAt`/`updatedAt`, `musicianName`, `groupName`, `groupSlug` y `counterpartName` (el músico para el grupo; el grupo para el músico). El nombre del músico sale de `IUsersModuleApi.GetMusicianSummariesAsync`: nunca viaja un email.
  - Al aceptar: se inserta `GroupMember` con `Role = Member` (S3: nunca Manager), `IsActive = true`, `JoinedAt = UtcNow`, `JoinedVia = Invitation | Request` y `ApprovedBy` = quien resolvió. Si ya existe una fila (groupId, userId) —por ejemplo alguien que salió— **no se inserta otra**: se reactiva la misma (`IsActive = true`, `LeftAt = null`, `Role = Member`, `JoinedVia` y `JoinedAt` actualizados), respetando el índice único (group_id, user_id).
  - Una sola pendiente por (grupo, músico): se comprueba antes de insertar y, si dos peticiones se cruzan, la violación del índice único parcial (`IX_group_membership_requests_group_id_musician_user_id`, SQLSTATE 23505) se traduce a `false` en el repositorio y el endpoint responde 409, nunca 500.
  - `GET api/groups/{id}/members` no cambió de forma y no muestra pendientes (test: invitar no crea `GroupMember`).
  - Sin eventos de dominio ni outbox: los avisos por email son T4.
- L11 (T4): hecho en el commit `feat(groups): send membership notices through the outbox` (hash en el reporte del agente). Cubre S1 (los dos sentidos avisan a quien debe responder) y S5 (avisos por email dentro del PR backend), más la forma de Bookings. Suite: Integration 181 passed + 5 skipped (los `PostgresFact`, sin `NITRO_TEST_POSTGRES` en este entorno), Endpoints 149, 0 failed; con `NITRO_TEST_POSTGRES` los 3 `EventRequestConcurrencyPostgresTests` de Bookings fallan por `Failed to connect to 127.0.0.1:5433` (entorno, no este cambio).
  - Cuatro eventos de integración en `Shared.Domain.DomainEvents.Groups` con su envoltorio `INotification` en `Groups.Application.Events.GroupMembershipEvents` (el outbox los resuelve por el nombre de la clase base, igual que `BookingEvents`):

    | Evento | Se dispara cuando | Recibe | Asunto |
    |---|---|---|---|
    | `GroupMembershipInvitationCreatedEvent` | un manager invita a un músico | el músico invitado | `{grupo} te invitó a unirte` |
    | `GroupMembershipJoinRequestCreatedEvent` | un músico pide unirse | Owner + Managers activos (`GetManagerUserIdsAsync`) | `Nueva solicitud para unirse a {grupo}` |
    | `GroupMembershipInvitationResolvedEvent` | el músico acepta/rechaza (aviso al grupo) o el grupo retira la invitación (aviso al músico) | la parte que no actuó | `{músico} aceptó/rechazó tu invitación a {grupo}` · `{grupo} canceló su invitación para unirte` |
    | `GroupMembershipJoinRequestResolvedEvent` | el grupo acepta/rechaza (aviso al músico) o el músico retira la solicitud (aviso al grupo) | la parte que no actuó | `{grupo} aceptó/rechazó tu solicitud para unirte` · `{músico} canceló su solicitud para unirse a {grupo}` |

  - El agregado levanta los eventos (`RaiseCreatedEvent` después de guardar, cuando ya hay Id; `Resolve` levanta el de resolución) y los casos de uso los mandan al outbox: `PendingMembershipRequests.CreateAsync` (invitar y pedir unirse) y `RespondToMembershipRequestCommandHandler` (`SaveEventsAsync` → `ClearDomainEvents` → `CompleteAsync`, el mismo orden que `RespondToEventRequestCommand`). El camino de creación guarda dos veces porque `TryCreatePendingAsync` ya guardó para tener Id, igual que `CreateEventRequestCommand`.
  - Los cuerpos no llevan el texto del mensaje (queda en la plataforma) ni la dirección de nadie: solo el nombre del grupo o del músico y una invitación a entrar. `GroupMembershipEmailRecipients` resuelve direcciones con `IGroupsModuleApi`/`IUsersModuleApi` solo para entregar; la regla de T2 (contratos de grupo sin email) sigue intacta porque el email nunca sale de `IUsersModuleApi.GetUserAsync/GetUsersAsync`.
  - `RaiseCreatedEvent` cubre invite y request; la resolución cubre Accept/Decline/Cancel (el usuario listó las tres transiciones). Un manager que retira su propia invitación no recibe aviso de sí mismo: el aviso de una cancelación de invitación va al músico.
  - Sin SMTP (`Email:Smtp:Host` sin definir) sigue mandando `LoggingEmailSender`, que registra destinatario y asunto y nunca el cuerpo (test propio).
- L12 (T5): hecho en **dos commits** (hash en el reporte del agente): `feat(ui): add membership service, status and search helpers` y `feat(ui): add team tab to invite musicians and answer join requests`. Cubre S2 (búsqueda por nombre de músicos abiertos, sin email, e invitar) y la parte de interfaz del manager de S5 (pestaña "Equipo" del panel); S1 queda cubierto solo en el sentido grupo→músico y la bandeja del músico es T6.
  - Pruebas: `npx vitest run` 88 passed en 12 archivos (25 nuevas en `features/membership`: estados/direcciones/acciones, parámetros de búsqueda y debounce, mapeo de errores 409/403/404, URLs y cuerpos del servicio). RED observado antes de implementar: los 4 archivos fallaban con "Cannot find module". `npx eslint` sobre `features/membership` y la página: sin avisos. `npx tsc --noEmit`: limpio. El baseline real era 63 pruebas, no 83 como decía el encargo.
  - Campos del backend usados: búsqueda `items[{ userId, fullName, profilePictureUrl, yearsExperience }]` + paginación; bandeja `id, groupId, musicianUserId, musicianName, initiatedByUserId, direction, status, message, resolvedByUserId, createdAt, updatedAt, counterpartName`. Los enums viajan como **texto** (`JsonStringEnumConverter` en `Program.cs`), no como entero; el servicio acepta ambos y un valor desconocido cae a un estado neutro. Los errores del grupo llegan como ProblemDetails (`detail` en español); `membershipErrorMessage` también lee `{ error }` y da texto propio a 403/404.
  - Acciones: aceptar/rechazar solo solicitudes (Request) pendientes, cancelar solo invitaciones (Invitation) pendientes; el resto es historial sin botones.
  - **Decisión lista de miembros**: no se muestra. `GET api/groups/{id}/members` devuelve solo ids y el front no tiene otra fuente de nombres (el grupo solo trae `numMembers`); resolverlo exige un cambio de backend (nombres en esa respuesta o un endpoint nuevo), fuera del alcance de T5. Quienes ya aceptaron aparecen en el historial con su nombre.
  - **No verificado**: el renderizado (no hay login en este entorno, la pestaña no se vio en un navegador) ni un viaje real contra la API; solo hay pruebas de lógica pura y del servicio con `apiClient` simulado.
