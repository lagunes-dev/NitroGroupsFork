# Ola 2a: perfil público de músico (con campos editables)

Documento ODD: Specs → Tasks → Log. Rama `feat/membership-ux`. Verificación visual con Playwright por el orquestador; los workers leen `devalion-ux-product-designer` y `DESIGN.md` antes de construir.

## Specs

- **S1.** "Intenté buscar mi perfil y todo lo que probé me dio 404; ahí no existo" (Mateo). Un músico tiene una página pública propia, con enlace compartible, que se puede abrir sin sesión.
- **S2.** El perfil muestra lo que un grupo necesita para decidir: nombre, titular (headline), biografía corta, instrumentos, años de experiencia, foto, video o audio y los grupos en los que toca.
- **S3.** El músico edita sus datos desde su panel (titular, biografía, instrumentos, años, video, disponible para unirse) y ve el resultado en su perfil público.
- **S4.** Un músico no puede editar el perfil de otro: la identidad sale del token, nunca del cuerpo.
- **S5.** Se respeta el sistema de diseño "Noche" y los componentes unificados; el perfil es legible en celular.

## Contrato de API (fijado; ambos lados lo respetan)

- `GET api/musicians/{userId:long}` — **público** (AllowAnonymous, debe declararse en la lista de `SecurityEndpointsTests`). 200 con:
  `{ userId, fullName, headline, shortBio, instruments, yearsExperience, profilePictureUrl, videoUrl, isOpenToJoin, groups: [{ groupId, groupName, slug, role }] }`; 404 si no es músico. `role` como texto (Owner | Manager | Member).
- `PUT api/musicians/me` — autenticado, solo músicos: cuerpo `{ headline?, shortBio?, instruments?, yearsExperience?, videoUrl?, isOpenToJoin? }`. 200 con el mismo objeto que el GET; 403 si el usuario no es músico; la identidad sale del token.
- Migración: tres columnas nuevas y opcionales en `users.musicians`: `headline varchar(120)`, `instruments varchar(120)`, `video_url varchar(300)`.

## Tasks

- [ ] T1 (S1, S2, S4) Backend: columnas + migración, consulta pública y actualización del propio perfil, con tests (404 no músico, 403 no músico en PUT, identidad desde el token, grupos del músico con su rol).
- [ ] T2 (S1, S2, S3, S5) Frontend: página pública `/musicians/[userId]`, pestaña "Mi perfil" en el panel del músico con formulario y enlace "Ver mi perfil público".
- [ ] T3 (S1-S5) Verificación con Playwright: perfil sin sesión, edición como Mateo y lectura del cambio, celular.

## Log

- L1 (usuario, verbatim): "si" — aprueba continuar con la Ola 2 (perfil de músico y agenda de gigs), y recuerda usar las skills y 21st.dev para las mejoras gráficas.
- L2: se empieza por el perfil de músico; la agenda de gigs va en `odd/tasks/ola-2-agenda-gigs.md` después.
- L3 (entregado): backend en `bd20a47`, `cb6cf86`, `7de788d` (migración `20261105085110_AddMusicianPublicProfileFields` aplicada; Endpoints 168 e Integration 205 en verde) y frontend en `0982fc5`, `908175e`, `eb5f5a4`, `0263c5c` (vitest 321). El puente entre módulos quedó como `IGroupsModuleApi.GetUserGroupMembershipsAsync`, solo membresías activas, orden Dueño, Manager, Miembro.
- L4 (verificado con Playwright): `GET api/musicians/11` sin token devuelve el perfil con sus grupos y roles; `GET api/musicians/10` (cliente) da 404; `PUT` sin token da 401. La página `/musicians/11` se abre sin sesión, muestra grupos con rol y CTA de invitación, y no desborda a 390 px. Editando como Mateo (titular, instrumentos, video) el guardado escribe en la base y el perfil público lo refleja.
- L5 (defecto encontrado y corregido en `e96f997`): la página pedía el perfil con `revalidate: 60`, así que tras guardar seguía mostrando los valores viejos hasta un minuto. Ahora se lee sin ventana de caché.
- Pendiente de decisión: infraestructura de tests de componente (jsdom + testing-library), que hoy no existe y por eso el formulario solo tiene probadas sus reglas.
