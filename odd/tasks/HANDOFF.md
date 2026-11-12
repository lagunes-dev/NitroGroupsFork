# Traspaso: NitroGroups, ola 3 y rondas de críticas

Documento de continuidad para retomar en otra sesión. Todo lo que sigue está verificado o marcado como
pendiente de verificar; nada está supuesto.

Repo: `/home/adminr/repos/NitroGroupsFork` · rama **`feat/membership-ux`** · 298 commits, ~77.000 líneas
sobre `origin/master` (ver "Entrega").

## 1. Dónde está todo

- Documento vivo: **`odd/tasks/ola-3-descubrimiento-y-logistica.md`** — specs S1–S27, tareas T1–T64 y un
  `## Log` con L1–L62. **Leerlo entero antes de tocar código**: cada decisión, su motivo y sus mediciones
  están ahí. El log es la memoria del proyecto; no lo reescribas, solo agregá.
- Otros documentos de olas anteriores: `odd/tasks/ola-1-usabilidad.md`, `ola-2-perfil-musico.md`,
  `ola-2b-agenda-gigs.md`, `membresias-grupo.md`, `ux-membresias.md`, `pulido-ui.md`, `mvp-arquitectura.md`.
- Andamiaje de QA **en el repo**: `scripts/qa/lib.mjs` (Playwright, sesiones por persona, **bloqueo de
  escrituras**) y `scripts/qa/rows.sh` (foto de filas para probar que nadie escribió). Vive en el repo
  porque `/tmp` se vacía en cada reinicio y ya se perdió dos veces.
- Seeds: `scripts/db/dev-seed.sql`, `demo-accounts.sql`, `dev-seed-reviews.sql`, y `dev-seed-round4..9.sql`
  + `dev-seed-round8b.sql`. Son idempotentes **por slug/email**, no por id (ver trampa 3).

## 2. Entorno (reglas que cuestan horas si se ignoran)

1. **Hay dos Postgres que se llaman igual.** `docker exec nitro_pg psql` y `psql -h 127.0.0.1 -p 5433` son
   servidores DISTINTOS en esta máquina. **La API y los tests leen el TCP del host**: usá siempre
   `psql -h 127.0.0.1 -p 5433 -U postgres -d nitrogroups` (password `postgres`).
2. Arranque: `docker start nitro_pg`; API `dotnet run --project Services/NitroGroups.Services.Api
   --launch-profile http` (puerto **5144**, `ASPNETCORE_ENVIRONMENT=Development`, `PATH` con
   `$HOME/.dotnet` y `$HOME/.dotnet/tools`, `DOTNET_ROOT=$HOME/.dotnet`); front
   `cd UI/nitro-groups && NODE_OPTIONS=--max-old-space-size=2048 npx next dev --webpack -p 3001`.
3. **Bajá la API vieja por PID**, nunca con `pkill -f` sobre la ruta (se mata a sí mismo y también al
   arranque nuevo): `ss -ltnp | grep :5144`.
4. `next dev` se muere por memoria a las ~9 h (`heap out of memory`). Reinicialo preventivamente.
5. Tests de integración: `NITRO_TEST_POSTGRES="Host=127.0.0.1;Port=5433;Username=postgres;Password=postgres"`.
6. **Nunca dos compilaciones de dotnet a la vez**: `dotnet ef`/`test` con `-m:1`, y no lances tests
   mientras otro agente compila.
7. Si hay que aplicar migraciones: `dotnet ef database update --context BookingsDbContext --project
   Core/Bookings/NitroGroups.Core.Bookings.Infrastructure --startup-project Services/NitroGroups.Services.Api`
   (igual para `UsersDbContext`, `GroupsDbContext`, `SchedulesDbContext`).

## 3. Estado de las rondas de críticas

Cuatro personas usan la app como usuarias reales (Playwright, sesiones propias). El prompt cambió en la
ronda 7: **"no opinen cómo se ve, usen la app de punta a punta, cuenten toques, recarguen, crucen datos
entre pantallas y separen FUNCIONA MAL de FALTA"**. Ese cambio es el que produce hallazgos útiles.

| Crítica | R5 | R6 | R7 | R8 |
|---|---|---|---|---|
| Camila (cliente) | 8 | 8,5 | 8,5 | **8,5** |
| Mateo (músico) | 8 | 8,5 | 6,5 | **7,5** |
| Mónica (manager) | 8 | 8,5 | 6,5 | **7,5** |
| Miguel (miembro) | 7 | 8 | 6 | **6** |

La bajada de la R7 no es un retroceso del producto: es que dejar de mirar y empezar a usar castiga los
controles que no responden. En la R8 se arreglaron los cuatro defectos que encontraron (T50–T53) y se
volvió a medir.

## 4. Qué está hecho

- **T1–T49**: directorio de músicos con filtros y ciudad, equipo con instrumento y ciudad, "Integrantes"
  calculado del equipo real, logística del toque (setlist, llegada, anticipo, pago por músico), reseñas
  reales con agregado, señales del hilo (choque de fecha + presupuesto vs tarifa), aviso de visita al
  perfil, saldo y próximo paso del cliente, estados vacíos honestos, y todos los arreglos de las rondas
  6, 7 y 8.
- **T50–T53**: anillo de foco (causa raíz: Tailwind 4 deja `--tw-outline-style: none` con
  `outline-none`; ahora hay una regla `:focus-visible` **sin capa** en `globals.css`), tope de 1000 en la
  reseña, un evento pasado ya no se cancela, y coherencia de membresías (no se invita a quien ya está).
- **T54–T57**: visitas compactadas a 44 px, "No respondiste" en un toque pasado, línea de aviso antes de
  responder con 16 px entre botones, titulares de los músicos demo.
- **T58**: aviso **"No me pagaron"** (tipo 6, migración `20261106141500_GigNoticeUnpaid`) en un toque
  pasado con pago pendiente. Medido en navegador.

## 5. Qué está SIN VERIFICAR en el árbol de trabajo (21 archivos, ~550 líneas)

Un worker estaba haciendo **T59** (teléfono del manager + compañeros del toque) y **murió por el
reinicio**, probablemente después de implementar y escribir tests. **No está verificado ni commiteado.**
Archivos tocados: `Core/Bookings/.../UseCases/Gigs/**`, `Core/Groups/.../Adapters/GroupsModuleApi.cs`,
`Shared/.../Modules/IGroupsModuleApi.cs`, `Shared/.../Bookings/Responses/**`, `Tests/.../Bookings/**`,
`UI/nitro-groups/src/features/gigs/**`.

También hay un cambio mío sin commitear: **T62** (sello "Contratación verificada" en cada reseña,
`features/groups/components/PublicGroupReviews.tsx` + test). Está verde en tests, sin medir en navegador.

**Primer paso del próximo agente**: `git status`, leer este documento y el log, y decidir si el trabajo de
T59 está completo (`./node_modules/.bin/vitest run src/features/gigs`, `tsc --noEmit`, y los tests de
Bookings con Postgres). Si está completo, medirlo en navegador y commitear; si está a medias, terminarlo.

## 6. Qué queda por hacer (T59–T64), con las decisiones ya tomadas

Las cuatro decisiones del usuario están en **S21–S27** y en L59, textuales:

- **S22 / T59** (en el árbol, sin verificar): compañeros del toque y **teléfono del manager**. El usuario
  eligió la opción con más exposición: visible **solo para miembros activos del grupo**, nunca para el
  cliente, nunca en la vista del manager, nunca en el perfil público, y **sin correos**. El teléfono sale
  del perfil del grupo y, si está vacío, el campo viaja nulo.
- **S23 / T60**: cuadre del toque para el manager (cachet total, suma a músicos, diferencia). Datos que ya
  existen; la app no mueve dinero (D1/D2).
- **S24 / T61**: fecha límite del anticipo y del saldo (columna nueva + input + vista del cliente).
- **S25 / T62**: sello de contratación verificada (hecho, sin medir ni commitear).
- **S26 / T63**: bloquear un día desde la agenda y desde la bandeja, no solo arrastrando en el calendario.
- **S27 / T64**: entrega en **5 PRs** encima del stack existente (ver abajo).

## 7. Entrega: no empieces un PR sin leer esto

`odd/tasks/mvp-arquitectura.md` registra la estrategia ya elegida antes: **12 PRs encadenadas** en
`lagunes-dev/NitroGroupsFork` (`stack/01-limpieza` … `stack/12-panel-reglas`). Ese plan cubre hasta el
commit `fb399da` (posición 100 de 298). Después crecieron **194 commits y 47.011 líneas** sin plan, y el
usuario decidió **extenderlo con 5 PRs** (S27/T64), una por tramo: UX de membresías (#152–#168), Ola 2a
(#169–#188), Ola 2b (#189–#206), Ola 3 (#207–#281) y arreglos de las rondas 6–8 (#282 en adelante).

**Nada de pushear ni abrir PRs sin orden expresa del usuario.** El push y el PR son decisiones suyas.

## 8. Trampas que ya costaron tiempo (no las repitas)

1. **Un arreglo de interfaz no está cerrado hasta que el número cambió en el navegador.** T31, T34 y T45
   pasaron sus tests y estaban rotos. El test evita la regresión; no prueba el arreglo.
2. **Un rojo de medición no es un defecto** hasta volcar qué ve el DOM: dos veces el fallo era mi selector
   (agarrar el enlace oculto de escritorio, buscar un botón por texto cuando su nombre estaba en
   `aria-label`).
3. **Un seed puede fabricar un estado que la app no produce** y después se lee como bug del producto (una
   solicitud pendiente de quien ya es miembro, pagos de músicos que no respondieron, un evento pasado que
   nadie podía reseñar). Antes de pedir una pantalla condicionada por datos, comprobá que exista un dato
   que la dispare.
4. **Los seeds con id fijo se rompen en una base nueva** (los grupos arrancan en otro id): hoy
   `demo-accounts.sql` falla en su primer INSERT de grupo porque el dueño se resuelve por email y las
   cuentas demo todavía no existen. **Recuperación**: levantar API y front, loguearse una vez con las
   cuatro cuentas demo (eso crea los usuarios por `auth/sync`), y **después** re-ejecutar
   `demo-accounts.sql`; verificar que el grupo `versatil-rock-y-pop` quede con **5 miembros activos**.
5. **El solo lectura no se pide, se impone.** Dos críticas escribieron pese a la regla en el prompt;
   `scripts/qa/lib.mjs` ahora aborta cualquier `POST/PUT/PATCH/DELETE` al API y lo registra en
   `blocked-writes.log`. Avisales a las críticas que un botón bloqueado va a fallar en pantalla, para que
   no lo reporten como bug.
6. **El ejecutor de subagentes se cae si lanzás las cuatro críticas a la vez** (murieron con 0 turnos). De a
   dos funciona. Si el proveedor responde `quota`, no insistas: esperá.
7. **Un apagado mata `nitro_pg`, la API y el front, y vacía `/tmp`.** Verificá los tres puertos antes de
   medir.

## 9. Cómo verificar (comandos exactos)

```bash
# backend (con Postgres del host)
cd /home/adminr/repos/NitroGroupsFork
export PATH="$HOME/.dotnet:$PATH" NITRO_TEST_POSTGRES="Host=127.0.0.1;Port=5433;Username=postgres;Password=postgres"
dotnet test Tests/NitroGroups.Tests.Endpoints/NitroGroups.Tests.Endpoints.csproj -m:1
dotnet test Tests/NitroGroups.Tests.Integration/NitroGroups.Tests.Integration.csproj -m:1

# frontend
cd UI/nitro-groups
./node_modules/.bin/vitest run --no-file-parallelism
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint src

# filas antes y después de una ronda (para probar el solo lectura)
/home/adminr/repos/NitroGroupsFork/scripts/qa/rows.sh > /tmp/ng-agents/baseline-rows.txt

# sesiones de las críticas (después de levantar API y front)
cd /home/adminr/repos/NitroGroupsFork/scripts/qa && node -e "import('./lib.mjs').then(async ({login}) => { for (const p of ['cliente','musico','manager','miembro']) console.log(p, await login(p)); })"
```

Última medición sana antes de la caída: backend **286 endpoints + 421 integración**, front **771 tests**,
`tsc` limpio, eslint en 0 errores.

## 10. Preguntas abiertas que son del usuario (no las decidas solo)

- Fecha límite del saldo: cómo se muestra si no hay fecha cargada (¿se omite o dice "a acordar"?).
- Teléfono del manager: ¿querés además un interruptor para que cada manager decida si lo muestra?
- Aviso "no me pagaron": hoy se rechaza si el músico había avisado que no podía ir. Si preferís lo
  contrario, es un cambio de una línea con su test.

## 11. La base puede volver distinta tras un reinicio (trampa 8, medida el 9 de noviembre)

Tras un reinicio, `docker start nitro_pg` puede levantar un Postgres con **otro contenido**: se midió uno de
16.15 con 13 usuarios, sin el pedido #25 y sin la columna `groups.music_groups.payment_instructions`. La API
habría respondido 500 contra esa base y una crítica habría reportado "defectos" que eran de entorno. Antes de
medir nada, tras CUALQUIER reinicio:

```bash
export PGPASSWORD=postgres
P="psql -h 127.0.0.1 -p 5433 -U postgres -d nitrogroups -tA"
$P -c "select count(*) from users.users"                                                        # 10 en la demo
$P -c "select count(*) from information_schema.columns where column_name='payment_instructions'"  # 1
```

Si no coincide: guardar lo encontrado con `pg_dump -Fc`, `DROP DATABASE`/`CREATE DATABASE` con la API caída y
`pg_restore --no-owner` del respaldo. **Los respaldos viven en `~/ng-backups`, nunca en `/tmp`**, que se vacía en
cada reinicio (se perdió dos veces). El único error esperable al restaurar es `unrecognized configuration
parameter "transaction_timeout"` (dump de `pg_dump` 18 contra servidor 16): es inocuo, y el resultado se verifica
comparando `scripts/qa/rows.sh` contra la foto de filas tomada al respaldar.
