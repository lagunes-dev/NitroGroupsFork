-- Limpieza de datos de demostración de la ronda 7 (log L32 de odd/tasks/ola-3-descubrimiento-y-logistica.md).
--
-- Mónica abrió el hilo de un pedido y encontró un mensaje del grupo dirigido a la clienta que decía
-- "Ah bueno me vale vrg". En una demo eso se lee como si la banda le hablara así a un cliente.
-- También había un "quieor rebaja" que parecía una errata de la app y no lo era.
--
-- OJO, trampa de entorno: `docker exec nitro_pg psql` y `psql -h 127.0.0.1 -p 5433` NO son el mismo
-- servidor en esta máquina. La API lee el TCP del host:
--   PGPASSWORD=postgres psql -h 127.0.0.1 -p 5433 -U postgres -d nitrogroups -v ON_ERROR_STOP=1 \
--     < scripts/db/dev-seed-round7.sql
--
-- Idempotente: se apoya en el texto exacto, así que correrlo dos veces no cambia nada más.

BEGIN;

UPDATE bookings.event_request_messages
SET body = 'Gracias, quedamos atentos a los detalles de la celebración.'
WHERE body = 'Ah bueno me vale vrg';

UPDATE bookings.event_request_messages
SET body = 'Quisiera saber si hay margen para ajustar el presupuesto.'
WHERE body = 'quieor rebaja';

COMMIT;
