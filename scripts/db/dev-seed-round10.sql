-- Datos de demostración de la ronda 9 (S22, S23, S24 de odd/tasks/ola-3-descubrimiento-y-logistica.md).
--
-- La base se reconstruyó y con ella se perdió el estado que sembraban las rondas 4 a 9: `gig_pay` y
-- `gig_attendance` quedaron vacías. Los seeds de esas rondas se apoyaban en ids fijos (evento 8, evento 9)
-- que en la base nueva son eventos de otros grupos, así que volver a correrlos escribiría datos falsos.
-- Este archivo siembra el mismo estado **por clave** (mensaje del pedido, email del usuario, slug del
-- grupo) para que funcione en cualquier base.
--
-- Qué habilita cada cosa:
--   * Compañeros del toque y teléfono del manager (S22): un toque futuro y aceptado con tres respuestas
--     confirmadas. Sin dos confirmados el bloque "Con quién tocás" no se puede ver.
--   * Cuadre del toque (S23): deuda a músicos contra el cachet del pedido en el mismo toque.
--   * Fecha límite (S24): anticipo cargado y sin recibir, para que el cliente tenga algo pendiente.
--
-- OJO, trampa de entorno: `docker exec nitro_pg psql` y `psql -h 127.0.0.1 -p 5433` NO son el mismo
-- servidor en esta máquina. La API lee el TCP del host:
--   PGPASSWORD=postgres psql -h 127.0.0.1 -p 5433 -U postgres -d nitrogroups -v ON_ERROR_STOP=1 \
--     < scripts/db/dev-seed-round10.sql
--
-- Idempotente: correrlo dos veces no duplica nada.

BEGIN;

-- ------------------------------------------------------------------ logística ------
-- El evento corporativo del 4 de diciembre (aceptado, futuro) es el que Mónica abre en su editor:
-- setlist y hora de llamado cargados, anticipo de $4,000 todavía sin recibir.
UPDATE bookings.event_requests r
SET setlist             = COALESCE(r.setlist, 'Set 1: rock en español · Set 2: pop bailable · Cierre: La Chona'),
    call_time           = COALESCE(r.call_time, TIME '18:00'),
    deposit_amount      = COALESCE(r.deposit_amount, 4000.00),
    deposit_received_at = r.deposit_received_at
WHERE r.message = '[demo] Evento de fin de año de la empresa.'
  AND r.status = 1;

-- ------------------------------------------------------------- compañeros (S22) ------
-- Tres miembros activos del grupo confirman el toque. Miguel es la cuenta del miembro, así que su
-- agenda es la que tiene que mostrar "Con quién tocás" con María y Luis.
INSERT INTO bookings.gig_attendance (event_request_id, user_id, status, created_by, created_at)
SELECT r.id, u.id, 0, u.id, TIMESTAMPTZ '2026-11-06 18:00+00'
FROM bookings.event_requests r
JOIN users.users u ON u.email IN ('miembro.demo@example.com', 'maria@seed.local', 'luis@seed.local')
WHERE r.message = '[demo] Evento de fin de año de la empresa.'
  AND NOT EXISTS (SELECT 1 FROM bookings.gig_attendance a WHERE a.event_request_id = r.id AND a.user_id = u.id);

-- ------------------------------------------------------------- cuadre (S23) ------
-- $14,000 de cachet contra $7,800 comprometidos con tres músicos: la diferencia que el manager tiene
-- que poder leer. Ningún pago está marcado como pagado todavía: el toque es futuro.
INSERT INTO bookings.gig_pay (event_request_id, user_id, amount, created_by, created_at)
SELECT r.id, u.id, v.amount, m.id, TIMESTAMPTZ '2026-11-06 18:00+00'
FROM bookings.event_requests r
JOIN users.users m ON m.email = 'manager.demo@example.com'
JOIN (VALUES
    ('miembro.demo@example.com', 2800.00::numeric),
    ('maria@seed.local',         2500.00::numeric),
    ('luis@seed.local',          2500.00::numeric)
) AS v(email, amount) ON TRUE
JOIN users.users u ON u.email = v.email
WHERE r.message = '[demo] Evento de fin de año de la empresa.'
  AND NOT EXISTS (SELECT 1 FROM bookings.gig_pay p WHERE p.event_request_id = r.id AND p.user_id = u.id);

COMMIT;
