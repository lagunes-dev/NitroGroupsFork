-- Datos de demostración de la ronda 10: el calendario del manager mostraba etiquetas internas del seed.
--
-- Mónica abrió su calendario y leyó "[seed] Tour trip", "[seed] Rehearsal" y "[seed] Personal": en
-- inglés, con el prefijo que usa el seed para reconocer sus propias filas, dentro de un producto en
-- español. Un usuario no debe ver nunca la etiqueta con la que fabricamos los datos.
--
-- OJO, trampa de entorno: `docker exec nitro_pg psql` y `psql -h 127.0.0.1 -p 5433` NO son el mismo
-- servidor en esta máquina. La API lee el TCP del host:
--   PGPASSWORD=postgres psql -h 127.0.0.1 -p 5433 -U postgres -d nitrogroups -v ON_ERROR_STOP=1 \
--     < scripts/db/dev-seed-round12.sql
--
-- Idempotente: se apoya en el título exacto, así que correrlo dos veces no cambia nada más.

BEGIN;

UPDATE schedules.busy_schedules
SET title = 'Ensayo'
WHERE title = '[seed] Rehearsal';

UPDATE schedules.busy_schedules
SET title = 'Gira'
WHERE title = '[seed] Tour trip';

UPDATE schedules.busy_schedules
SET title = 'Asunto personal'
WHERE title = '[seed] Personal';

-- Ronda 11, leído por la clienta: (a) el texto del grupo ofrecía "efectivo el día del evento" para
-- un anticipo que vence 24 días antes, y (b) el aniversario quedó aceptado en $9,000 con el piso del
-- grupo en $12,000, un 25% por debajo de su propia ficha. Los dos son datos de demostración que se
-- leen como defectos del producto.
UPDATE groups.music_groups
SET payment_instructions = 'Transferencia a la CLABE 0121 8000 1234 5678 90, BBVA, a nombre de Mónica Salinas. Manda el comprobante por WhatsApp al 33 1234 5678 con el concepto que te da la app. Si prefieres efectivo, acuérdalo antes conmigo por ese mismo WhatsApp.'
WHERE slug = 'versatil-rock-y-pop';

UPDATE bookings.event_requests r
SET budget = 12000.00
FROM groups.music_groups g
WHERE r.group_id = g.id
  AND g.slug = 'versatil-rock-y-pop'
  AND r.status = 1
  AND r.budget < g.base_price;

COMMIT;
