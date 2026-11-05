# Ola 3: descubrir músicos y logística del toque

Documento ODD: Specs → Tasks → Log. Rama `feat/membership-ux`. Verificación visual con Playwright por el orquestador.

## Specs (decisiones del usuario, textuales)

- **S1 (D4).** "D4: tu recomendacion". Los perfiles de músico son públicos por defecto, con un interruptor para no aparecer, y hay un directorio con filtros por instrumento y ciudad.
- **S2 (D5).** "EL cliente no contrata musicos, solo grupos, los grupos contratan musicos". No existe contacto cliente → músico. El canal es grupo → músico: el manager invita desde el directorio o desde el perfil. Se corrige cualquier texto que diga que el músico se "contrata".
- **S3 (D1).** "tu recomendación". La app no cobra: el anticipo se registra como dato (monto, fecha, recibido). Sin pasarela ni comisión.
- **S4 (D3).** "Tu recomendación". Una lista de texto (setlist) por evento, editable por el manager y visible para los miembros. Se agrega también la hora de llamado.
- **S5 (D7).** "Tu recomendación". Solo escribe una reseña el cliente de un evento aceptado cuya fecha ya pasó, una por evento.
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
- [ ] T5 (S5) Reseñas: según lo que ya exista en el modelo.

## Log

- L1 (usuario, verbatim): "D4: tu recomendacion, D5: EL cliente no contrata musicos, solo grupos, los grupos contratan musicos, D1: tu recomendación, D2: Explica con ejemplos, D6: tu recomendación despues de que resolvamos D2, D3: Tu recomendación, D7:Tu recomendación"
- L2: la decisión D5 cambia el diseño: no se construye contacto cliente → músico. La invitación grupo → músico ya existe en el backend y solo falta exponerla desde el directorio y el perfil.
- L3 (exploración de reseñas): no existe tabla, entidad ni endpoint de reseñas. `Group.AverageRating` y `TotalReviews` (`Group.cs:23-24`) solo se inicializan en 0 y nada los actualiza; los "4,7 (18 reseñas)" del seed son literales (`dev-seed.sql:54-60`), sin filas detrás. `EventRequest.IsSelfBooked` ya avisa que esos eventos no deben contar en métricas públicas.
- L4 (decisión técnica tomada sin consultar, para S5): las reseñas viven en **Bookings**, que es dueño del evento. Tabla `bookings.event_reviews` con `event_request_id` único, `client_user_id`, `group_id`, `rating` 1 a 5, comentario opcional (máx. 1000) y fecha. Regla al escribir: el llamante es el cliente del evento, el evento está Aceptado, su fecha (zona de México) ya pasó, no es autorreserva y no tiene reseña. Si el evento se cancela después de aceptado ya no se puede reseñar; una reseña existente se conserva.
- L5 (decisión técnica): el agregado del grupo se actualiza por el outbox de Bookings con un evento `GroupReviewPostedEvent(groupId, rating)` que consume un handler de Groups (ya hay precedente de Groups consumiendo eventos de otro módulo). Como solo se crean reseñas, la actualización es incremental. El listado público `GET api/groups/{id}/reviews` devuelve calificación, comentario, fecha, tipo de evento y el autor como "Nombre A." (sin apellido completo ni email).
- L6 (seed): los agregados escritos a mano se reemplazan por filas de reseña reales, y se agrega un evento aceptado y ya pasado para poder probar el flujo.
- Orden: primero el worker de logística en Bookings (setlist, hora de llamado, anticipo) y después el de reseñas, porque ambos tocan el mismo módulo y la misma máquina no soporta dos compilaciones a la vez.
- L7 (usuario, verbatim): "para el ejemplo que me diste si es mejor B, adelante". **D2 decidida: opción B**, un monto por músico y por toque, solo informativo. La app no suma, no valida el total ni mueve dinero.
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
