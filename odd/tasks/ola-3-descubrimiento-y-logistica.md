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
