-- Datos de demostración de la ronda 4 (log L19 de odd/tasks/ola-3-descubrimiento-y-logistica.md).
--
-- Dos funciones existen y estaban invisibles por falta de filas:
--   1. El pago por músico ("Tu pago: $2,000"): ningún toque tenía `gig_pay`.
--   2. El choque de fecha del hilo del manager: no había ningún pedido pendiente el mismo día
--      de un toque aceptado, así que la señal siempre decía "no tienes otro toque".
--
-- Idempotente: se puede correr más de una vez sin duplicar nada.
-- Uso: docker exec -i nitro_pg psql -U postgres -d nitrogroups -v ON_ERROR_STOP=1 < scripts/db/dev-seed-round4.sql

BEGIN;

-- ------------------------------------------------------------------ pagos ------
-- Toque aceptado del 19 de noviembre (evento 8): Mateo cobra $2,000.
-- Toque aceptado del 3 de diciembre (evento 9): Miguel cobra $1,800 y sigue sin llegada ni setlist,
-- para que el aviso "Avisar que falta" tenga qué decir.
INSERT INTO bookings.gig_pay (event_request_id, user_id, amount, created_by, created_at)
SELECT v.event_request_id, v.user_id, v.amount, v.user_id, now()
FROM (VALUES
    (8::bigint, 11::bigint, 2000.00::numeric),
    (9::bigint, 13::bigint, 1800.00::numeric)
) AS v(event_request_id, user_id, amount)
WHERE NOT EXISTS (
    SELECT 1 FROM bookings.gig_pay p
    WHERE p.event_request_id = v.event_request_id AND p.user_id = v.user_id
);

-- --------------------------------------------------- choque de fecha (D6) ------
-- Un pedido pendiente el mismo 19 de noviembre en que el grupo ya tiene una boda aceptada.
-- El hilo del manager tiene que decir "Ese día ya tienes un toque: Boda en Hacienda San Gabriel".
INSERT INTO bookings.event_requests (
    group_id, client_user_id, event_date, start_time, duration_hours, event_type,
    location_text, guest_count, budget, currency, message, status, is_self_booked,
    created_by, created_at)
SELECT 1, 4, DATE '2026-11-19', TIME '21:00', 3, 'Cumpleaños',
       'Salón Jardín Real, Zapopan', 80, 15000.00, 'MXN',
       'Somos dos familias que celebran el mismo día y buscamos banda para la noche.',
       0, false, 4, now()
WHERE NOT EXISTS (
    SELECT 1 FROM bookings.event_requests
    WHERE group_id = 1
      AND event_date = DATE '2026-11-19'
      AND status = 0
      AND message = 'Somos dos familias que celebran el mismo día y buscamos banda para la noche.'
);

COMMIT;
