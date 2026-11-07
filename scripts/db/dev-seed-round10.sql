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

-- Fecha límite del anticipo y del saldo (S24): el ejemplo de la spec dice "Saldo: falta pagar
-- $14,000 · para el 15 de noviembre", así que el saldo del evento corporativo vence ese día.
UPDATE bookings.event_requests r
SET deposit_due_date = COALESCE(r.deposit_due_date, DATE '2026-11-10'),
    balance_due_date = COALESCE(r.balance_due_date, DATE '2026-11-15')
WHERE r.message = '[demo] Evento de fin de año de la empresa.'
  AND r.status = 1;

-- La línea del saldo del cliente (S24) solo existe cuando el anticipo YA se recibió: el saldo se
-- calcula contra un anticipo que entró. Los dos estados conviven: el corporativo con el anticipo
-- pendiente y este con el anticipo recibido y el saldo con fecha límite.
INSERT INTO bookings.event_requests (
    group_id, client_user_id, event_date, start_time, duration_hours, event_type,
    location_text, guest_count, budget, currency, message, status, is_self_booked,
    responded_at, created_by, created_at)
SELECT g.id, c.id, DATE '2026-12-19', TIME '20:00', 3, 'Wedding',
       'Casa de campo, Zapopan', 90, 12000.00, 'MXN',
       '[demo] Boda en el jardín: queremos que se baile toda la noche.',
       1, false, TIMESTAMPTZ '2026-11-04 18:00+00', c.id, TIMESTAMPTZ '2026-11-03 18:00+00'
FROM groups.music_groups g
JOIN users.users c ON c.email = 'cliente.demo@example.com'
WHERE g.slug = 'versatil-rock-y-pop'
  AND NOT EXISTS (
    SELECT 1 FROM bookings.event_requests r
    WHERE r.group_id = g.id AND r.client_user_id = c.id
      AND r.message = '[demo] Boda en el jardín: queremos que se baile toda la noche.'
  );

UPDATE bookings.event_requests r
SET deposit_amount      = COALESCE(r.deposit_amount, 3000.00),
    deposit_received_at = COALESCE(r.deposit_received_at, TIMESTAMPTZ '2026-11-05 18:00+00'),
    deposit_due_date    = COALESCE(r.deposit_due_date, DATE '2026-11-10'),
    balance_due_date    = COALESCE(r.balance_due_date, DATE '2026-11-15')
WHERE r.message = '[demo] Boda en el jardín: queremos que se baile toda la noche.'
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
