# Pulido de UI: componentes sofisticados, selectores legibles y alineación

Documento de feature con el protocolo ODD: Specs → Tasks → Log.
Rama de trabajo: `feat/ui-polish` (a partir de `feat/group-membership-ui`, que ya trae las pestañas Equipo e Invitaciones).
La verificación visual la hace el orquestador con Playwright (los workers no tienen navegador); cada tarea se entrega con tests de lógica pura, `eslint` y `tsc`.

## Specs

- **S1 — Selectores legibles.** "algunos selectores se ven mal porque son blancos con letras blancas". Ningún desplegable puede quedar con texto claro sobre fondo claro, en ningún navegador.
- **S2 — Componentes sofisticados.** "quiero componente sofisticados". Selectores, fechas y horas dejan de ser controles nativos del navegador y pasan a componentes propios, accesibles y con la estética "Noche" (ver `UI/nitro-groups/DESIGN.md`).
- **S3 — Alineación y espaciado.** "textos alineados profesionalmente, nada pegado que se vea sucio". Una sola forma de campo (radio, alto, relleno, sangría del texto), botones del mismo alto en una misma fila y títulos alineados con su contenido.
- **S4 — Diseño profesional.** "mejores el diseño usando las mejores practicas de diseño y UX, necesito algo profesiona". Sin emojis como íconos, estados claros (carga, vacío, error, foco), jerarquía consistente.
- **S5 — Verificado en el navegador.** "debes usar playwrigth". Cada pantalla tocada se revisa renderizada a 1440 px y 390 px, y se reporta lo que no se pudo ver.

## Hallazgos de la auditoría (Playwright, 1440 px, sesión real)

- H1 Cuatro `<select>` nativos: género en `SearchForm.tsx`, moneda en `GroupProfileEdit.tsx`, duración y tipo de evento en `RequestForm.tsx`, tipo de archivo en `GroupGallery.tsx`. Sus `<option>` tienen fondo transparente y texto casi blanco (`rgb(244,242,247)`): dependen de que el navegador pinte el popup en oscuro.
- H2 Tres campos nativos de fecha y hora (`type="date"` en `SearchForm` y `RequestForm`, `type="time"` en `RequestForm`).
- H3 Dos estilos de campo en la app: redondeado en registro y asistente, de esquinas rectas (`fieldClass`) en el panel y el perfil (`MusicianSearch`, `GroupProfileEdit`).
- H4 Registro, paso Cuenta: "Confirmar contraseña" no lleva ícono de candado y su texto arranca 28 px más a la izquierda que los otros dos campos.
- H5 Registro, paso Perfil: el selector de país "MX +52" tiene esquinas rectas entre campos redondeados, y "MX" y "+52" no comparten tamaño ni línea base. "Atrás" mide 40 px de alto y "Siguiente" 48 px.
- H6 Registro, paso Tipo: los íconos son emojis (🎉 🎸 💼), que en este equipo salen como cuadros vacíos; el título "¿Qué vienes a hacer a NitroGroups?" va centrado mientras el resto va a la izquierda.
- H7 Registro, paso Cuenta: el placeholder dice "Mínimo 8 caracteres" pero el tenant de Auth0 exige 15 (política del tenant, decisión del usuario, no del código).
- H8 Cabecera: aparece un espacio vacío con forma de botón mientras carga la sesión; el menú de usuario repite "QA" (avatar y nombre).
- H9 Pestaña Equipo: el avatar de "Emmanuel Hernandez" muestra "MA" en vez de "EH".
- H10 Texto lateral (columna derecha de registro y asistente) flotando sin alinearse con ningún bloque del formulario.
- H11 En modo desarrollo cada pantalla nueva tarda varios segundos en compilar; es un problema del entorno, no del diseño, pero obliga a esperas al verificar.

## No metas

- Rediseñar la identidad ("Noche"): colores, tipografías y tokens de `DESIGN.md` se respetan.
- Cambiar el backend, el flujo de Auth0 ni la política de contraseñas del tenant.
- Reescribir pantallas que se ven bien (por ejemplo el paso "Revisar" del asistente).

## Tasks

- [x] T1 (S1, S2, S3) Cimientos en `components/ui/`: `Select` (Radix), `DatePicker` (react-day-picker en popover), `TimeSelect`, y unificar `Input`, `Textarea` y `Field` (radio, alto, sangría) con una red de seguridad en CSS para controles nativos restantes.
- [x] T2 (S1, S2) Reemplazar los 4 `<select>` y los 3 campos de fecha y hora (H1, H2) en `SearchForm`, `GroupProfileEdit`, `RequestForm` y `GroupGallery`.
- [x] T3 (S3, S4) Registro y asistente (H4 a H8, H10): candado, país, alto de botones, íconos en vez de emojis, títulos alineados, cabecera sin hueco.
- [x] T4 (S3, S4) Panel, Equipo e Invitaciones (H3, H9): campos unificados, filas como tarjetas, avatar con iniciales correctas, formulario de edición alineado.
- [x] T5 (S3, S4) Páginas públicas (`/groups`, perfil del grupo, inicio) y revisión a 390 px.
- [x] T6 (S5) Pasada final con Playwright a 1440 px y 390 px en todas las pantallas, con capturas y lista de lo que queda.

## Log

- L1 (usuario, verbatim): "peor el login si funciona, no se de que hablas, debes usar playwrigth, sobre todo porque necesito que mejores el diseño usando las mejores practicas de diseño y UX, necesito algo profesiona, ya que lagunos selectores se ven mal porque osn blancos con letras blancas, quiero componente sofisticados y textos alineados profesionalmente, nada pegado que se vea sucio"
- L2: el login sí funciona. Se comprobó registrando una cuenta de prueba (`qa.nitrogroups.audit@example.com`, creada en el tenant de Auth0 del usuario, se puede borrar) y siguiendo el asistente de manager hasta crear el grupo "QA Audit Group" (id 26). Se corrige la afirmación anterior de que el login "no estaba disponible": nunca se había probado.
- L3: la API que estaba corriendo era anterior a las membresías y había perdido la conexión a Postgres durante la caída de Docker; se reinició con el código de la rama. Con la API nueva las pestañas Equipo e Invitaciones funcionan contra datos reales: la búsqueda devolvió 2 músicos abiertos.
- L4: el README de membresías no se había commiteado (la edición y el commit corrieron en paralelo); se corrigió en `bab43b1`.

### T1 — Cimientos de `components/ui/` (S1, S2, S3)

- Commits: `379d73e feat(ui): add date and time slot helpers and picker dependencies`, `fff142c feat(ui): unify the field spec and add Select, TimeSelect and Textarea`, `251710b feat(ui): add DatePicker and a CSS safety net for native controls`.
- Dependencias: `@radix-ui/react-select` 2.4.1, `@radix-ui/react-popover` 1.3.1, `react-day-picker` 9.14.0 (la v10 era la última; se fijó la v9 pedida) y `date-fns` 4.4.0 (la usa el locale `es` de react-day-picker).
- Tests: RED con los módulos inexistentes (`dateField`, `timeSlots`); GREEN con 135 tests (117 de base + 18 nuevos). `eslint` y `tsc --noEmit` sin errores. `next build --webpack` en una copia temporal (el dev server usa `.next`): compila, incluida la importación de `react-day-picker/style.css` desde `globals.css`.
- Campo único (`components/ui/field.ts`, exportado también como `fieldClass` desde `Common.tsx`): alto 48 px, radio 8 px (DESIGN.md → Shapes; `Input` usaba `rounded-lg`, que en este tema son 16 px, y `fieldClass` 0 px), relleno lateral 16 px, relleno `fondo-2` con borde interior de 1 px `--linea` (más fuerte al pasar el cursor), anillo de foco `acento` de 2 px, error con borde y barra inferior `--error` vía `aria-invalid`. Con ícono a la izquierda el texto arranca a 44 px (`pl-11`); sin ícono, a 16 px. Select, DatePicker y TimeSelect llevan el ícono a la derecha, así que su texto siempre arranca a 16 px.
- Contrastes comprobados (WCAG): tinta/fondo-2 16.97:1; tinta/fondo-3 (opción resaltada) 15.40:1; tinta-2/fondo-2 7.19:1; acento-ink/acento (día seleccionado) 10.72:1; acento/fondo-2 (anillo de foco, hoy) 10.59:1; error/fondo-2 8.61:1. El placeholder a tinta-2 al 70 % daba 4.11:1, por debajo de 4.5, y pasó a tinta-2 completo (7.19:1) en el campo unificado.
- Sin verificar: nada se vio renderizado (los workers no tienen navegador). Pendiente con Playwright en `/dev/ui-kit`: posición y colisión de los paneles, foco inicial y devolución del foco en el calendario, `Select` y `DatePicker` dentro de modales (`z-50`; los paneles usan `z-[100]`), 390 px, validación `required` (el `DatePicker` y el `Select` con opción vacía solo marcan `aria-required`, el input oculto no valida).
- Fuera de alcance, anotado para T3: `PhoneInput` y `Button` (`rounded-lg` = 16 px aunque el comentario dice 8 px) conservan su forma actual. La galería `src/app/dev/ui-kit/` queda sin versionar.

- L5 (verificación con Playwright de T1-T4, 1440 px): el kit (`/dev/ui-kit`) y el registro de tres pasos se ven bien (textos de los tres campos en la misma x, botones de 48 px, tarjetas de rol con íconos). Login y pestaña Equipo también.
- L6 (regresión de T1, corregida en `8e96d77`): `Input.tsx` y `Textarea.tsx` usan hooks y no tenían `"use client"`; al importarlos `SearchForm` desde la portada (componente de servidor) la portada devolvía 500. Los tests, `tsc` y `eslint` no lo detectaron: solo se vio en el navegador.
- L7 (defecto de alineación, corregido en `c881092`): `FieldShell` usaba `space-y-2`, que añadía 8 px de margen bajo el botón de `Select` y `DatePicker` porque los controles ocultos de formulario van detrás; en la fila de búsqueda "Ciudad" quedaba 8 px más abajo. Ahora es una columna flex con `gap-2`. Medido: etiquetas en y=467, campos y botón en y=495.
- L8 (H9 aclarado): el avatar "MA" de "Emmanuel Hernandez" no era un bug de iniciales. Es la imagen por defecto de Gravatar/Auth0 (`cdn.auth0.com/avatars/ma.png`, dos primeras letras del correo), guardada en `profile_picture_url`. El helper `initials()` sí se corrigió y está probado.
- L9: la franja de datos del panel recortaba "Guadalajara, Jalisco" a 1440 px; la columna de la ciudad pasó a 1.5fr y ya no se recorta ningún valor.
- Pendiente de ver renderizado: `/groups`, formulario de solicitud y "Pedir unirse" en el perfil público, modal de la galería, edición del perfil, pestaña Invitaciones con datos, cabecera durante la carga y todo a 390 px.
- Observación para T5: el formulario del login arranca en x=229 y el del registro en x=128 (margen de la página); conviene unificarlo.
- L10 (verificación final con Playwright, 1440 px y 390 px, sesión real): portada y `/groups` (selector de género envía `?genero=mariachi`, etiquetas y campos en la misma línea), perfil público (solicitud con error por campo, foco a la fecha, días pasados deshabilitados; "Pedir unirse" envía y aparece en Invitaciones), modal de la galería (panel por encima del modal, Escape cierra solo el selector), edición del perfil (moneda), login y registro alineados a x=128, asistente de manager (nota lateral a la altura del stepper, y=313).
- L11 (membresías con datos reales): invitar a Luis Ramírez crea una tarjeta Pendiente con "Cancelar invitación"; cancelar la manda al historial; la solicitud del músico aparece en "Solicitudes enviadas (1)". Defecto corregido en `eca08d7`: el botón "Invitar" seguía activo con una invitación pendiente (habría respondido 409); ahora dice "Invitación pendiente" o "Pidió unirse".
- L12 (subida de imágenes): `feat/profile-image-upload` nunca se había unido a esta línea, por eso "Foto de perfil" y "Portada" solo pedían URL. Se trajo con `13b4fef` y se adaptó al campo unificado. Prueba real: un PNG de 121.746 bytes subió a R2, se sirvió como `image/png` y se borró del bucket (204 y luego 404).
- L13 (otros defectos corregidos): interruptor "Recibir solicitudes" cuadrado, ahora píldora (`c9d4090`); en celular la franja de datos recortaba valores y el enlace "Completar perfil" quedaba sangrado 20 px (`2ae3435`).
- L14 (entorno): el servidor de desarrollo llevaba 13 horas y 3,3 GB de memoria con la swap llena; eso colgaba `tsc` y el navegador. Se reinició con `--max-old-space-size=1536`.
- Totales finales: vitest 178 en 21 archivos, `tsc` limpio, `eslint` sin errores, cero `<select>` y `type="date|time"` nativos fuera de `src/app/dev`.
- No verificado: la cabecera durante la carga de sesión (H8), el asistente de manager a 390 px, una invitación *recibida* por un músico (el seed no tiene login real), y las fotos del grupo "Mariachi Sol de Jalisco" ("En vivo" se ve como un bloque vacío porque `picsum.photos` no carga en este entorno).
- Pendiente de decisión del usuario: la política de contraseñas del tenant exige 15 caracteres y el placeholder dice "Mínimo 8" (H7).
