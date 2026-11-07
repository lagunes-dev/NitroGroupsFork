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

COMMIT;
