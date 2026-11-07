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
SET payment_instructions = 'Transferencia a la CLABE 0121 8000 1234 5678, BBVA, a nombre de Mónica Salinas. También aceptamos efectivo el día del evento.',
    payment_instructions_updated_at = TIMESTAMPTZ '2026-11-05 18:00+00'
WHERE slug = 'versatil-rock-y-pop'
  AND (payment_instructions IS NULL OR btrim(payment_instructions) = '');

COMMIT;
