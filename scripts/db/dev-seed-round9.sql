-- Datos de demostración de T48: la plata como dato (decisión S18 de odd/tasks/ola-3-descubrimiento-y-logistica.md).
--
-- Cada estado nuevo tiene que existir en la demo para poder verse y medirse (L43):
--   * cliente:  "Saldo recibido el <fecha>"   -> un evento aceptado con balance_received_at
--   * músico:   "pagado el <fecha>"            -> una fila de gig_pay con paid_at
--   * músico:   "pendiente"                    -> una fila de gig_pay sin paid_at (ya existen las del 19/nov y el 3/dic)
--   * manager:  los dos controles en un toque con ambos estados
--
-- Se apoya en el evento pasado y aceptado de Camila que sembró dev-seed-round8.sql (24 de octubre).
--
-- OJO, trampa de entorno: `docker exec nitro_pg psql` y `psql -h 127.0.0.1 -p 5433` NO son el mismo
-- servidor en esta máquina. La API lee el TCP del host:
--   PGPASSWORD=postgres psql -h 127.0.0.1 -p 5433 -U postgres -d nitrogroups -v ON_ERROR_STOP=1 \
--     < scripts/db/dev-seed-round9.sql
--
-- Requiere la migración 20261106094132_GigBalanceAndPaid. Idempotente.

BEGIN;

-- El aniversario de Camila ya pasó y se pagó completo: anticipo y saldo recibidos.
UPDATE bookings.event_requests r
SET deposit_amount      = COALESCE(r.deposit_amount, 3000.00),
    deposit_received_at = COALESCE(r.deposit_received_at, TIMESTAMPTZ '2026-10-03 18:00+00'),
    balance_received_at = COALESCE(r.balance_received_at, TIMESTAMPTZ '2026-10-25 02:00+00')
WHERE r.message = 'Celebramos veinte años de casados y queremos música para bailar toda la noche.'
  AND r.status = 1;

-- Mateo ya cobró ese toque; Miguel todavía no.
INSERT INTO bookings.gig_pay (event_request_id, user_id, amount, paid_at, created_by, created_at)
SELECT r.id, u.id, v.amount, v.paid_at, m.id, TIMESTAMPTZ '2026-10-25 02:00+00'
FROM bookings.event_requests r
JOIN users.users m ON m.email = 'manager.demo@example.com'
JOIN (VALUES
    ('musico.demo@example.com',  1500.00::numeric, TIMESTAMPTZ '2026-10-26 17:00+00'),
    ('miembro.demo@example.com', 1500.00::numeric, NULL::timestamptz)
) AS v(email, amount, paid_at) ON TRUE
JOIN users.users u ON u.email = v.email
WHERE r.message = 'Celebramos veinte años de casados y queremos música para bailar toda la noche.'
  AND NOT EXISTS (SELECT 1 FROM bookings.gig_pay p WHERE p.event_request_id = r.id AND p.user_id = u.id);

-- Los dos respondieron que sí. El editor del manager solo ofrece cobro a quien respondió en la app, así
-- que un pago sembrado para alguien sin respuesta (el estado anterior de este seed) no se podía ver ni
-- editar, y además es un estado que la app real no produce.
INSERT INTO bookings.gig_attendance (event_request_id, user_id, status, created_by, created_at)
SELECT r.id, u.id, 0, u.id, TIMESTAMPTZ '2026-10-03 18:00+00'
FROM bookings.event_requests r
JOIN users.users u ON u.email IN ('musico.demo@example.com', 'miembro.demo@example.com')
WHERE r.message = 'Celebramos veinte años de casados y queremos música para bailar toda la noche.'
  AND NOT EXISTS (SELECT 1 FROM bookings.gig_attendance a WHERE a.event_request_id = r.id AND a.user_id = u.id);

-- Un aviso de ayer para que el manager tenga algo que leer ("Mateo avisa que llega tarde"). Va con fecha
-- de ayer a propósito: la tarjeta del músico solo cuenta los avisos de HOY, así que a él se le sigue
-- ofreciendo el botón y el manager igual ve el aviso (su lectura no tiene ventana de fecha).
INSERT INTO bookings.gig_notices (event_request_id, user_id, kind, sent_on, created_by, created_at)
SELECT r.id, u.id, 4, (now() AT TIME ZONE 'America/Mexico_City')::date - 1, u.id, now() - interval '1 day'
FROM bookings.event_requests r
JOIN users.users u ON u.email = 'musico.demo@example.com'
WHERE r.status = 1 AND r.group_id = (SELECT id FROM groups.music_groups WHERE slug = 'versatil-rock-y-pop')
  AND r.event_date = DATE '2026-11-19'
  AND NOT EXISTS (SELECT 1 FROM bookings.gig_notices n WHERE n.event_request_id = r.id AND n.user_id = u.id AND n.kind = 4);

COMMIT;
