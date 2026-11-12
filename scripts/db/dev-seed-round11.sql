-- Datos de demostración de la ronda 9 (S3/S18, "cómo pagar": la app nunca cobra ni mueve dinero).
--
-- El campo "Cómo pagar" del grupo nace vacío, y con el campo vacío la nota de transferencia no se
-- dibuja a propósito. Sin un texto cargado, la función existe y no se puede ver: la misma trampa de
-- L43 que ya nos costó tres veces. Este archivo carga el texto del grupo demo.
--
-- OJO, trampa de entorno: `docker exec nitro_pg psql` y `psql -h 127.0.0.1 -p 5433` NO son el mismo
-- servidor en esta máquina. La API lee el TCP del host:
--   PGPASSWORD=postgres psql -h 127.0.0.1 -p 5433 -U postgres -d nitrogroups -v ON_ERROR_STOP=1 \
--     < scripts/db/dev-seed-round11.sql
--
-- Idempotente y conservador: solo escribe cuando el grupo no tiene texto, nunca pisa uno escrito a mano.

BEGIN;

UPDATE groups.music_groups
SET payment_instructions = 'Transferencia a la CLABE 0121 8000 1234 5678 90, BBVA, a nombre de Mónica Salinas. Manda el comprobante por WhatsApp al 33 1234 5678 con el concepto "boda 19 dic". También aceptamos efectivo el día del evento.',
    payment_instructions_updated_at = TIMESTAMPTZ '2026-11-05 18:00+00'
WHERE slug = 'versatil-rock-y-pop'
  AND (payment_instructions IS NULL OR btrim(payment_instructions) = '');

-- Coherencia de la ficha: el grupo declara 3 h de contratación mínima y el pedido corporativo del
-- 4 de diciembre venía sembrado con 2 h. Un usuario lo leyó como que el grupo se contradice con su
-- propia ficha. (Que la app no impida pedir menos del mínimo es un hueco aparte, anotado en L74.)
UPDATE bookings.event_requests r
SET duration_hours = 3
FROM groups.music_groups g
WHERE r.group_id = g.id
  AND g.slug = 'versatil-rock-y-pop'
  AND r.message = '[demo] Evento de fin de año de la empresa.'
  AND r.duration_hours < g.minimum_duration_hours;

COMMIT;
