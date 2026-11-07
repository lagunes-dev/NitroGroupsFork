-- Datos de demostración de la ronda 8 (log L40-L41 de odd/tasks/ola-3-descubrimiento-y-logistica.md).
--
-- El formulario de reseña del cliente (T49) solo aparece en un evento ACEPTADO que ya pasó y que
-- todavía no tiene reseña. Camila, la clienta demo, no tenía ninguno: sus bodas son del 19 de
-- noviembre y el 3 de diciembre. Sin este dato la función existe y no se puede ver ni medir.
--
-- OJO, trampa de entorno: `docker exec nitro_pg psql` y `psql -h 127.0.0.1 -p 5433` NO son el mismo
-- servidor en esta máquina. La API lee el TCP del host:
--   PGPASSWORD=postgres psql -h 127.0.0.1 -p 5433 -U postgres -d nitrogroups -v ON_ERROR_STOP=1 \
--     < scripts/db/dev-seed-round8.sql
--
-- Idempotente: se apoya en el mensaje exacto, nunca en ids autoincrementales.

BEGIN;

INSERT INTO bookings.event_requests (
    group_id, client_user_id, event_date, start_time, duration_hours, event_type,
    location_text, guest_count, budget, currency, message, status, is_self_booked,
    responded_at, created_by, created_at)
SELECT g.id, c.id, DATE '2026-10-24', TIME '19:00', 3, 'Aniversario',
       'Terraza Los Arcos, Guadalajara', 60, 9000.00, 'MXN',
       'Celebramos veinte años de casados y queremos música para bailar toda la noche.',
       1, false, TIMESTAMPTZ '2026-10-02 18:00+00', c.id, TIMESTAMPTZ '2026-10-01 18:00+00'
FROM groups.music_groups g
JOIN users.users c ON c.email = 'cliente.demo@example.com'
WHERE g.slug = 'versatil-rock-y-pop'
  AND NOT EXISTS (
    SELECT 1 FROM bookings.event_requests r
    WHERE r.group_id = g.id AND r.client_user_id = c.id
      AND r.message = 'Celebramos veinte años de casados y queremos música para bailar toda la noche.'
  );

COMMIT;
