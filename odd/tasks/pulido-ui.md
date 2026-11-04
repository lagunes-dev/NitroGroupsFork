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

- [ ] T1 (S1, S2, S3) Cimientos en `components/ui/`: `Select` (Radix), `DatePicker` (react-day-picker en popover), `TimeSelect`, y unificar `Input`, `Textarea` y `Field` (radio, alto, sangría) con una red de seguridad en CSS para controles nativos restantes.
- [ ] T2 (S1, S2) Reemplazar los 4 `<select>` y los 3 campos de fecha y hora (H1, H2) en `SearchForm`, `GroupProfileEdit`, `RequestForm` y `GroupGallery`.
- [ ] T3 (S3, S4) Registro y asistente (H4 a H8, H10): candado, país, alto de botones, íconos en vez de emojis, títulos alineados, cabecera sin hueco.
- [ ] T4 (S3, S4) Panel, Equipo e Invitaciones (H3, H9): campos unificados, filas como tarjetas, avatar con iniciales correctas, formulario de edición alineado.
- [ ] T5 (S3, S4) Páginas públicas (`/groups`, perfil del grupo, inicio) y revisión a 390 px.
- [ ] T6 (S5) Pasada final con Playwright a 1440 px y 390 px en todas las pantallas, con capturas y lista de lo que queda.

## Log

- L1 (usuario, verbatim): "peor el login si funciona, no se de que hablas, debes usar playwrigth, sobre todo porque necesito que mejores el diseño usando las mejores practicas de diseño y UX, necesito algo profesiona, ya que lagunos selectores se ven mal porque osn blancos con letras blancas, quiero componente sofisticados y textos alineados profesionalmente, nada pegado que se vea sucio"
- L2: el login sí funciona. Se comprobó registrando una cuenta de prueba (`qa.nitrogroups.audit@example.com`, creada en el tenant de Auth0 del usuario, se puede borrar) y siguiendo el asistente de manager hasta crear el grupo "QA Audit Group" (id 26). Se corrige la afirmación anterior de que el login "no estaba disponible": nunca se había probado.
- L3: la API que estaba corriendo era anterior a las membresías y había perdido la conexión a Postgres durante la caída de Docker; se reinició con el código de la rama. Con la API nueva las pestañas Equipo e Invitaciones funcionan contra datos reales: la búsqueda devolvió 2 músicos abiertos.
- L4: el README de membresías no se había commiteado (la edición y el commit corrieron en paralelo); se corrigió en `bab43b1`.
