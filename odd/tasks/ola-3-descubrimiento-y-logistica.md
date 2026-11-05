# Ola 3: descubrir músicos y logística del toque

Documento ODD: Specs → Tasks → Log. Rama `feat/membership-ux`. Verificación visual con Playwright por el orquestador.

## Specs (decisiones del usuario, textuales)

- **S1 (D4).** "D4: tu recomendacion". Los perfiles de músico son públicos por defecto, con un interruptor para no aparecer, y hay un directorio con filtros por instrumento y ciudad.
- **S2 (D5).** "EL cliente no contrata musicos, solo grupos, los grupos contratan musicos". No existe contacto cliente → músico. El canal es grupo → músico: el manager invita desde el directorio o desde el perfil. Se corrige cualquier texto que diga que el músico se "contrata".
- **S3 (D1).** "tu recomendación". La app no cobra: el anticipo se registra como dato (monto, fecha, recibido). Sin pasarela ni comisión.
- **S4 (D3).** "Tu recomendación". Una lista de texto (setlist) por evento, editable por el manager y visible para los miembros. Se agrega también la hora de llamado.
- **S5 (D7).** "Tu recomendación". Solo escribe una reseña el cliente de un evento aceptado cuya fecha ya pasó, una por evento.
- **S6 (ronda 3).** "Estado vacío honesto: cuando el manager todavía no cargó llegada, setlist o pago, decirlo." Hoy la tarjeta del músico omite el campo en silencio.
- **S7 (ronda 3).** "El equipo con oficio: instrumento y ciudad por renglón, y que 'Integrantes 4' del perfil público salga del equipo real, que dice 5."
- **S8 (ronda 3).** "Cerrar el trato del cliente: saldo ('falta pagar $14,000'), próximo paso, y el anticipo también en la lista de pedidos."
- **S9 (ronda 3).** "Avisarle al músico: que sepa que un grupo lo miró."
- **S10 (ronda 3).** El copy "No disponible por ahora" del perfil público se lee como rechazo; debe describir el estado real.
- **Pendiente.** D2 (paga por músico): el usuario pidió "Explica con ejemplos"; se decide después. D6 (señales de decisión en el hilo): "tu recomendación después de que resolvamos D2".

## Contrato del directorio (fijado)

- `GET api/musicians?query=&instrument=&city=&page=1&size=12` — público (AllowAnonymous, entra en la lista de `SecurityEndpointsTests`). Solo músicos con `isOpenToJoin = true` y cuenta activa. Filtros por texto contenido, sin distinguir mayúsculas. Respuesta paginada con `items: [{ userId, fullName, headline, instruments, city, yearsExperience, profilePictureUrl }]`, sin emails.
- `city` pasa a ser un campo opcional del perfil: `users.musicians.city varchar(80)`, incluido en `GET api/musicians/{id}` y en `PUT api/musicians/me`.
- El interruptor existente "Disponible para unirse" pasa a significar "Aparecer en el directorio y aceptar invitaciones".

## Tasks

- [ ] T1 (S1, S2) Backend Users: columna `city`, directorio público y perfil con ciudad.
- [ ] T2 (S1, S2) Frontend: página `/musicians` con filtros, "Invitar a mi grupo" en perfil y directorio para managers, campo ciudad en "Mi perfil", y corregir el texto que habla de contratar a un músico.
- [ ] T3 (S3, S4) Backend Bookings: setlist, hora de llamado y anticipo en el evento aceptado.
- [ ] T4 (S3, S4) Frontend: setlist y hora de llamado en la agenda, anticipo visible al manager y al cliente.
- [x] T5 (S5) Reseñas: según lo que ya exista en el modelo. `3f2dfe9` (backend), `073b90b` (perfil público + agregado), `dev-seed-reviews.sql`.
- [x] T6 (S6) Front: estados vacíos honestos en la agenda del músico y del miembro (llegada, setlist y pago sin cargar). `15939b1`; 74 tests en `features/gigs`.
- [x] T7 (S7) Equipo con oficio: instrumento y ciudad por renglón en "Equipo", e "Integrantes" del perfil público tomado del equipo real. `d9a8b90`; 10 tests de integración + 167 de front.
- [x] T8 (S8) Front: cerrar el trato del cliente — saldo, próximo paso y anticipo en la lista de pedidos. `0f20aae`; 48 tests en `features/bookings`.
- [x] T9 (S9) Avisarle al músico que un grupo miró su perfil. `254d9be`; tabla `groups.group_profile_visits`, `POST api/groups/{groupId}/profile-visits/{musicianUserId}` y `GET api/me/profile-visits`; 8 tests de endpoint + 6 de integración con Postgres + 14 de front.
- [x] T10 (S10) Copy del interruptor: dejar de decir "No disponible por ahora" y alinear el seed. `162a7fb`; 66 tests en `features/musicians`.

## Log

- L1 (usuario, verbatim): "D4: tu recomendacion, D5: EL cliente no contrata musicos, solo grupos, los grupos contratan musicos, D1: tu recomendación, D2: Explica con ejemplos, D6: tu recomendación despues de que resolvamos D2, D3: Tu recomendación, D7:Tu recomendación"
- L2: la decisión D5 cambia el diseño: no se construye contacto cliente → músico. La invitación grupo → músico ya existe en el backend y solo falta exponerla desde el directorio y el perfil.
- L3 (exploración de reseñas): no existe tabla, entidad ni endpoint de reseñas. `Group.AverageRating` y `TotalReviews` (`Group.cs:23-24`) solo se inicializan en 0 y nada los actualiza; los "4,7 (18 reseñas)" del seed son literales (`dev-seed.sql:54-60`), sin filas detrás. `EventRequest.IsSelfBooked` ya avisa que esos eventos no deben contar en métricas públicas.
- L4 (decisión técnica tomada sin consultar, para S5): las reseñas viven en **Bookings**, que es dueño del evento. Tabla `bookings.event_reviews` con `event_request_id` único, `client_user_id`, `group_id`, `rating` 1 a 5, comentario opcional (máx. 1000) y fecha. Regla al escribir: el llamante es el cliente del evento, el evento está Aceptado, su fecha (zona de México) ya pasó, no es autorreserva y no tiene reseña. Si el evento se cancela después de aceptado ya no se puede reseñar; una reseña existente se conserva.
- L5 (decisión técnica): el agregado del grupo se actualiza por el outbox de Bookings con un evento `GroupReviewPostedEvent(groupId, rating)` que consume un handler de Groups (ya hay precedente de Groups consumiendo eventos de otro módulo). Como solo se crean reseñas, la actualización es incremental. El listado público `GET api/groups/{id}/reviews` devuelve calificación, comentario, fecha, tipo de evento y el autor como "Nombre A." (sin apellido completo ni email).
- L6 (seed): los agregados escritos a mano se reemplazan por filas de reseña reales, y se agrega un evento aceptado y ya pasado para poder probar el flujo.
- Orden: primero el worker de logística en Bookings (setlist, hora de llamado, anticipo) y después el de reseñas, porque ambos tocan el mismo módulo y la misma máquina no soporta dos compilaciones a la vez.
- L7 (usuario, verbatim): "para el ejemplo que me diste si es mejor B, adelante". **D2 decidida: opción B**, un monto por músico y por toque, solo informativo. La app no suma, no valida el total ni mueve dinero.
- L9 (usuario, verbatim): "Seguimos con NitroGroups en /home/adminr/repos/NitroGroupsFork, rama feat/membership-ux. Leé odd/tasks/ola-3-descubrimiento-y-logistica.md completo, y después los pendientes de la ronda 3. API en :5144, front en :3001, Postgres en el contenedor nitro_pg (puerto 5433). Los subagentes usan DeepSeek."
- L10 (cierre de la ronda 3, verbatim del informe anterior): Camila 6 → 7, Mateo 5 → 6, Mónica 5 → 6, Miguel 5 → 6; promedio 2,25 → 5,25 → 6,25. El único bug (`b3c79fb`, el formulario de contratación que parpadeaba dentro del grupo propio) ya está corregido. Los pendientes que quedaron, verbatim: (1) "Estado vacío honesto: cuando el manager todavía no cargó llegada, setlist o pago, decirlo. Hoy Mateo y Miguel creen que la app los perdió." (2) "El equipo con oficio: instrumento y ciudad por renglón, y que 'Integrantes 4' del perfil público salga del equipo real, que dice 5." (3) "Cerrar el trato del cliente: saldo ('falta pagar $14,000'), próximo paso, y el anticipo también en la lista de pedidos." (4) "Avisarle al músico: que sepa que un grupo lo miró. Mateo lo resumió bien: 'el directorio es un cartel colgado en el desierto'." Más el quinto del tablero: "copy 'No disponible por ahora'".
- L11 (mapa del código, explorado): (a) `GigCard.tsx:68/104/70` omite en silencio llegada, setlist y pago cuando vienen nulos; no hay estado vacío por campo. (b) `GroupTeamMemberResponse` tiene solo `UserId/FullName/Role/ProfilePictureUrl/JoinedAt`: instrumento y ciudad no viajan. `PublicGroupProfile.tsx:47` muestra `group.numMembers`, un número que el dueño escribe a mano en `GroupProfileEdit.tsx:157`, mientras que "El equipo (N)" cuenta filas reales de `GET api/groups/{id}/team`: dos fuentes distintas que pueden discrepar. (c) `deposit.ts:39` solo muestra el anticipo al cliente y solo si el evento está Aceptado; nadie calcula `budget - deposit.amount`. (d) no existe ningún concepto de visita al perfil: ni tabla, ni evento, ni campanita; el canal de aviso existente es el outbox de correo. (e) el copy vive en `PublicMusicianProfile.tsx:70` y `:151-153`.
- L12 (decisión técnica, T9): el aviso al músico se resuelve dentro de la app, no por correo: una tabla de visitas en el módulo Groups registra al manager que abre el perfil desde el directorio, y el músico ve "N grupos miraron tu perfil" con los nombres de los grupos que ya son públicos. No se expone el correo de nadie y no se avisa por email mientras no haya SMTP.
- L13 (cierre de T6–T10, esta sesión): los cinco pendientes de la ronda 3 quedaron implementados y verificados. Commits: `15939b1` (T6), `162a7fb` (T10), `0f20aae` (T8), `d9a8b90` (T7), `254d9be` (T9), más `e20d17d` (el test de endpoint que fijaba las cinco propiedades del equipo), `31d375f` (seed con instrumento y ciudad) y `c591c74` (arreglo de compilación: `b3c79fb` desestructuraba `membershipsPending`, que el hook nunca expuso; `tsc` fallaba en la rama). Verificación: backend 235 endpoints + 335 integración con Postgres, 0 fallos; frontend 503 tests en 53 archivos, `tsc` limpio y eslint sin errores (queda un warning previo de `<img>` en `UserProfile.tsx`). En el navegador, con datos reales: `GET api/groups/slug/versatil-rock-y-pop` devuelve `numMembers: 5` real (antes 4 escrito a mano) y el perfil público muestra "Integrantes 5" y las reseñas reales (3,5 · 2 reseñas); `/musicians/13` dice "Sin invitaciones por ahora", "Instrumentos: Bajo, coros", "Ciudad: Zapopan, Jalisco" y el panel "no está recibiendo invitaciones de grupos. Su perfil sigue siendo público", sin rastro del copy viejo. No verificado en navegador: las pantallas que exigen sesión (equipo, agenda, trato del cliente y bloque de visitas), porque la contraseña de las cuentas demo vive en Auth0 y no está en el repo; esas superficies quedan cubiertas por 503 tests de front y por los tests de endpoint e integración de backend. La caché de 60 s de `serverGetResult` hace que un cambio de API tarde hasta un minuto en verse en el servidor de Next.
- L8 (D6, decidida por recomendación del usuario "después de que resolvamos D2"): el hilo del manager muestra dos señales calculables con datos que ya existen: **choque de fecha** (el grupo ya tiene un toque aceptado ese día) y **presupuesto contra tarifa base** (lo que ofrece el cliente frente al "desde $X" del grupo). La **distancia** contra el radio no entra en esta ola: el grupo solo guarda su ciudad como texto y no hay coordenadas, así que calcularla exige un catálogo de ciudades o geocodificación. Se anota como D8.

## Contrato de la logística del toque (fijado)

Se agregan columnas al evento aceptado y una tabla de pagos por músico, en el esquema `bookings`:

- `bookings.event_requests`: `setlist varchar(4000)`, `call_time time`, `deposit_amount numeric(12,2)`, `deposit_received_at timestamptz`, todas opcionales.
- `bookings.gig_pay`: `event_request_id`, `user_id`, `amount numeric(12,2)` con `amount >= 0`, único por `(event_request_id, user_id)`.

Endpoints, todos privados:

- `PUT api/groups/{groupId}/gigs/{id}/details` con `RequireGroupManager`: `{ setlist?, callTime?, depositAmount?, depositReceived? }`; actualiza solo lo enviado. `depositReceived: true` fija la fecha en este momento y `false` la limpia. 404 si el toque no es del grupo o no está aceptado.
- `PUT api/groups/{groupId}/gigs/{id}/pay` con `RequireGroupManager`: `{ payments: [{ userId, amount }] }`; reemplaza el conjunto. Solo miembros activos del grupo, monto mayor o igual a cero.
- `GET api/me/gigs` suma por fila `callTime`, `setlist` y `myPay` (solo el pago del propio llamante, o null).
- `GET api/groups/{groupId}/gigs` suma `setlist`, `callTime`, `deposit: { amount, receivedAt }` y, en cada asistente, `pay`.
- Las solicitudes del cliente suman `deposit: { amount, receivedAt }` (el cliente no ve el setlist ni los pagos a los músicos).
- Señales del hilo (D6): `GET api/groups/{groupId}/event-requests/{id}/signals` con `RequireGroupManager` devuelve `{ dateClash: { clashes: bool, withGig: { id, eventType, locationText } | null }, budget: { offered, baseRate, status: "Above" | "Below" | "Equal" | "Unknown" } }`.

## Contrato de reseñas (fijado, D7)

Regla del usuario: solo escribe una reseña el cliente de un evento aceptado cuya fecha ya pasó, una por evento.

- Tabla `bookings.event_reviews`: `id`, `event_request_id` (FK con cascada, ÚNICO), `client_user_id`, `group_id`, `rating smallint` con CHECK entre 1 y 5, `comment varchar(1000)` opcional y columnas de auditoría como `gig_attendance`.
- `POST api/event-requests/{id}/review`, autenticado: cuerpo `{ rating, comment? }`. Solo el cliente del evento, con el evento Aceptado, fecha anterior a hoy (zona de México), sin ser autorreserva y sin reseña previa. 201 con la reseña; 404 si el evento no es del llamante; 409 con mensaje en español si todavía no se puede reseñar (no aceptado, fecha futura o autorreserva) o si ya existe; 400 si la calificación no está entre 1 y 5 o el comentario pasa de 1000.
- `GET api/groups/{groupId}/reviews?page=1&size=10`, público (AllowAnonymous, entra en la lista de `SecurityEndpointsTests`): `{ summary: { average, count }, items: [{ rating, comment, createdAt, eventType, authorName }], totalCount, pageNumber, pageSize, hasNextPage, hasPreviousPage }`, de la más reciente a la más antigua. `authorName` es "Nombre A." (nombre y inicial del apellido, sin correo).
- Las solicitudes del cliente (`GET api/event-requests/mine` y el detalle) suman `canReview: bool` y `review: { rating, comment, createdAt } | null`.
- Agregado del grupo: al crearse una reseña, Bookings publica por su outbox `GroupReviewPostedEvent(groupId, rating)` y un handler de Groups actualiza `average_rating` y `total_reviews` de forma incremental. Si la entrega entre módulos no funciona como con los eventos de Usuarios, se detiene y se reporta.
- Datos de demostración: archivo nuevo `scripts/db/dev-seed-reviews.sql`, idempotente, que agrega eventos aceptados y ya pasados con reseñas reales para los seis grupos y recalcula `average_rating` y `total_reviews` desde `event_reviews`, para que los números del perfil tengan filas detrás.
