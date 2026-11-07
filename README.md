# NitroGroups

NitroGroups es una plataforma web diseñada para conectar músicos y grupos independientes con clientes que buscan talento para sus eventos. La plataforma permite a los artistas crear perfiles detallados, 
mostrar su trabajo a través de fotos y videos, y gestionar su disponibilidad y tarifas, mientras que los clientes pueden buscar, contactar y contratar talento de manera sencilla.

## Características Principales

- **Perfiles para Músicos y Grupos**: Cada músico puede tener un perfil individual y/o pertenecer a un grupo. Los perfiles muestran información clave, biografía y material multimedia.
- **Búsqueda y Contratación**: Los clientes pueden buscar artistas por género, ubicación y otros filtros para encontrar el talento perfecto para sus eventos.
- **Gestión de Disponibilidad y Precios**: Los grupos pueden configurar su calendario de disponibilidad y establecer rangos de precios para facilitar el proceso de contratación.
- **Galería Multimedia**: Los artistas pueden subir un número limitado de fotos y videos para mostrar su estilo y actuaciones pasadas.
- **Chat Integrado**: Un sistema de mensajería directa para que clientes y artistas puedan comunicarse, negociar y cerrar tratos de forma segura.

## Arquitectura del Proyecto

El proyecto sigue una **Arquitectura Hexagonal (Puertos y Adaptadores)** combinada con **Vertical Slice Architecture** para garantizar un alto desacoplamiento, cohesión y mantenibilidad.

- La **Arquitectura Hexagonal** organiza la solución a alto nivel, aislando el núcleo de la aplicación (dominio y lógica de aplicación) de las preocupaciones externas como la interfaz de usuario, la base de datos o las APIs de terceros.
- La **Arquitectura de Cortes Verticales (Vertical Slice)** organiza el código *dentro* del núcleo. En lugar de agrupar el código por capas técnicas (ej. `servicios`, `controladores`), se agrupa por funcionalidad completa o "corte vertical" (ej. `RegistrarUsuario`, `ObtenerPerfilDeGrupo`).

Estructura principal:

- **`NitroGroups.slnx`**: Archivo de solución que agrupa los proyectos .NET.
- **`UI/nitro-groups`**: Frontend en **Next.js 16** (React 19, TypeScript). Actúa como adaptador primario.
- **`Services/NitroGroups.Services.Api`**: API backend en ASP.NET Core que expone los endpoints consumidos por el frontend.
- **`AppHost`**: Proyecto de orquestación con **.NET Aspire** para levantar la API en local (el front se ejecuta en otra consola; ver abajo).
- **`Core/`**: Lógica de negocio por contexto delimitado usando vertical slices:
  - **`Domain`**: Entidades, agregados y reglas de negocio.
  - **`Application`**: Casos de uso (comandos/consultas) y puertos.
  - **`Infrastructure`**: Adaptadores secundarios por contexto.
- **`Shared/`**: Código reutilizable y transversal (abstracciones, contratos, endpoints, paginación y utilidades). La infraestructura compartida incluye la **persistencia** (EF Core) dentro de `Shared/NitroGroups.Shared.Infrastructure/Context` y `Repository`.

## Stack Tecnológico

- **Backend**: .NET 10, ASP.NET Core, C#
- **Frontend**: Next.js 16 (React 19, TypeScript)
- **Orquestación**: .NET Aspire
- **Arquitectura**: Hexagonal Architecture, Vertical Slice
- **Base de Datos**: Entity Framework Core con PostgreSQL

## Cómo Empezar

- Lee nuestra guía de contribución [aquí](CONTRIBUTION.md).

### Requisitos previos
- **.NET 10 SDK** y workload de **.NET Aspire**.
- **Node.js 18.18+** (o superior) y **npm**.

### Ejecución con Aspire (API) + front aparte
El AppHost **solo** arranca la API (puerto **5144** en HTTP) para evitar cierres del proceso al usar el diálogo de archivos del navegador bajo Windows/Visual Studio con el host Aspire ([detalle](https://github.com/dotnet/aspire/issues/7998)). Luego levanta Next en otra consola.
```bash
cd AppHost/AppHost.AppHost
dotnet run
```
En otra terminal:
```bash
cd UI/nitro-groups
npm run dev
```
Asegúrate de que `BACKEND_API_URL` en `UI/nitro-groups/.env.local` apunte a `http://localhost:5144` (o el host/puerto que muestre el dashboard de Aspire).

### Backend (.NET) por separado
1. Clona el repositorio.
2. Configura la cadena de conexión en `appsettings` de `Services/NitroGroups.Services.Api`.
3. Ejecuta solo la API:
   ```bash
   cd Services/NitroGroups.Services.Api
   dotnet run
   ```

### Frontend (Next.js) por separado
1. Instala dependencias y levanta el dev server:
   ```bash
   cd UI/nitro-groups
   npm install
   npm run dev
   ```

## Autenticación y permisos (Auth0)

La API es **deny-by-default**: todo endpoint exige un access token válido de Auth0, salvo los públicos declarados con `.AllowAnonymous()` (perfil de grupo, galería, disponibilidad, géneros, salud). `Tests/NitroGroups.Tests.Endpoints/Security` fija esa lista: un endpoint público nuevo hace fallar el test hasta que se declara.

- La identidad **siempre** sale del token. `ownerUserId` o `auth0Id` en el body se ignoran.
- Las escrituras sobre un grupo exigen ser **Owner o Manager** del grupo (`RequireGroupManager`).
- El **admin** de la plataforma es el rol `admin` de Auth0.

Los access tokens de Auth0 no traen email ni roles por defecto. Agrega esta Action (*Login / Post Login*):

```js
exports.onExecutePostLogin = async (event, api) => {
  const ns = 'https://nitrogroups.com';
  // Solo emails verificados: un email sin verificar no identifica a nadie.
  if (event.user.email_verified) {
    api.accessToken.setCustomClaim(`${ns}/email`, event.user.email);
  }
  api.accessToken.setCustomClaim(`${ns}/roles`, event.authorization?.roles ?? []);
};
```

Si cambias el namespace de los roles, configura `Auth0:RolesClaim` en la API.

**Frontend:** `AUTH0_SECRET` firma la cookie de sesión y es obligatorio, con al menos 32 caracteres (`openssl rand -hex 32`). Sin él no se emite ni se acepta ninguna sesión.

## Tests

```bash
dotnet test NitroGroups.slnx
```

Los tests de concurrencia necesitan PostgreSQL real (InMemory no los reproduce). Corren cuando existe `NITRO_TEST_POSTGRES`, una cadena de conexión a un servidor: cada test crea su propia base y la borra al terminar. En CI siempre está definida; en local, sin la variable, se saltan con su motivo visible.

```bash
NITRO_TEST_POSTGRES="Host=localhost;Username=postgres;Password=postgres" dotnet test Tests/NitroGroups.Tests.Integration
```

## Base de datos y migraciones

Cada módulo tiene su propio `DbContext`, su esquema de PostgreSQL (`users`, `groups`, `schedules`, `bookings`), su tabla de historial `__ef_migrations_history` y su `outbox_events`. Las migraciones viven en `Core/<Modulo>/NitroGroups.Core.<Modulo>.Infrastructure/Persistence/Migrations`.

Para aplicar las migraciones de todos los módulos:

```bash
for m in Users Groups Schedules Bookings; do
  dotnet ef database update --context ${m}DbContext \
    --project Core/$m/NitroGroups.Core.$m.Infrastructure \
    --startup-project Services/NitroGroups.Services.Api
done
```

Para crear una migración en un módulo:

```bash
dotnet ef migrations add <Nombre> --context GroupsDbContext \
  --project Core/Groups/NitroGroups.Core.Groups.Infrastructure \
  --startup-project Services/NitroGroups.Services.Api \
  --output-dir Persistence/Migrations
```

**Bases creadas antes de noviembre de 2026** (con la migración única `Init` en `public`): ejecuta una vez `scripts/db/2026-11-upgrade-to-module-schemas.sql` antes de aplicar las migraciones. El script mueve las tablas con sus datos a su esquema, es transaccional y no hace nada si la base ya está migrada.

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/db/2026-11-upgrade-to-module-schemas.sql
```

## Emails

Los avisos de las solicitudes de evento (`api/event-requests`: nueva solicitud, aceptada, rechazada, cancelada y mensajes nuevos) salen del outbox del módulo Bookings. Si un envío falla, el outbox reintenta el evento más tarde. Los emails no incluyen el texto de los mensajes.

Sin configuración, los emails **no se envían**: solo se registran en el log el destinatario y el asunto (útil en desarrollo y tests). Para enviarlos por SMTP, define `Email:Smtp:Host`:

| Clave | Por defecto | Descripción |
| --- | --- | --- |
| `Email:From` | `NitroGroups <no-reply@nitrogroups.com>` | Remitente |
| `Email:Smtp:Host` | (vacío: solo log) | Servidor SMTP; activa el envío real |
| `Email:Smtp:Port` | `587` | Puerto |
| `Email:Smtp:Username` / `Email:Smtp:Password` | (vacíos) | Credenciales; guárdalas en User Secrets o variables de entorno (`Email__Smtp__Password`) |
| `Email:Smtp:EnableSsl` | `true` | TLS |

## Membresías de grupo (invitaciones y solicitudes)

Un manager puede invitar a un músico a su grupo y un músico puede pedir unirse. Quien recibe responde. Cada pedido es un `GroupMembershipRequest` del módulo Groups (esquema `groups`, tabla `group_membership_requests`), separado de `GroupMember` a propósito: `GET api/groups/{id}/members` es público y no debe mostrar pendientes.

| Ruta | Quién | Resultado |
| --- | --- | --- |
| `GET api/musicians/open-to-join?query=&page=&size=` | usuario autenticado | Músicos con `IsOpenToJoin`, buscados por nombre. Nunca devuelve email. |
| `POST api/groups/{groupId}/membership-invitations` | Owner o Manager | Invita a un músico (`{ musicianUserId, message? }`). 201. |
| `POST api/groups/{groupId}/membership-requests` | músico | Pide unirse (`{ message? }` opcional). 201. |
| `POST api/membership-requests/{id}/accept`, `/decline`, `/cancel` | según el sentido | Acepta o rechaza quien recibe; cancela quien inició. |
| `GET api/groups/{groupId}/membership-requests?direction=&status=` | Owner o Manager | Bandeja del grupo. |
| `GET api/membership-requests/mine?direction=&status=` | quien consulta | Sus propias invitaciones y solicitudes. |

Reglas:

- Solo se puede invitar a músicos con `IsOpenToJoin` activado. Un cliente o un músico cerrado responde 409.
- Al aceptar se crea el `GroupMember` con rol `Member` (nunca `Manager`). Si el músico ya había salido, se reactiva su fila en vez de crear otra: existe un índice único `(group_id, user_id)`.
- Solo puede haber una solicitud pendiente por grupo y músico. Un índice parcial lo garantiza y el segundo intento responde 409.
- Un músico puede estar en varios grupos.
- Quien no participa recibe 404, no 403, para no revelar que la solicitud existe.
- Los avisos por email salen por el outbox del módulo Groups (ver [Emails](#emails)) en cuatro momentos: invitación recibida, solicitud recibida y cada una resuelta. Los cuerpos no incluyen el texto de los mensajes ni direcciones de correo.
- Promover a un miembro a Manager todavía no existe. Cuando se agregue, debe ser una acción exclusiva del Owner.

En el frontend, el panel del grupo (`/dashboard/musician`) tiene la pestaña **Equipo** (buscar e invitar, responder solicitudes) y la pestaña **Invitaciones** para el músico. El perfil público del grupo muestra **Pedir unirse** solo a músicos que no son miembros. El detalle de la feature está en `odd/tasks/membresias-grupo.md`.

## Tailwind CSS

El frontend usa **Tailwind CSS 4** integrado en el flujo de build de Next.js. Para ver los estilos en caliente basta con ejecutar `npm run dev` en `UI/nitro-groups`; para builds de producción se ejecuta automáticamente con `npm run build`.
