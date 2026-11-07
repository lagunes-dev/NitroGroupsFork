-- Correcciones de datos de demostración de la ronda 6 (log L28 de odd/tasks/ola-3-descubrimiento-y-logistica.md).
--
-- Miguel desenmascaró que la ficha del grupo se contradecía: decía "Four-piece band" con cinco
-- integrantes, la bio y la descripción estaban en inglés en un sitio en español, y la ciudad del
-- grupo (San Pedro Garza García) no era la del equipo (Guadalajara/Zapopan).
--
-- OJO, trampa de entorno: en esta máquina `docker exec nitro_pg psql` y `psql -h 127.0.0.1 -p 5433`
-- NO son el mismo servidor. La API lee el TCP del host, así que este archivo se aplica así:
--   PGPASSWORD=postgres psql -h 127.0.0.1 -p 5433 -U postgres -d nitrogroups -v ON_ERROR_STOP=1 \
--     < scripts/db/dev-seed-round6.sql
--
-- Idempotente: se apoya en el slug, nunca en ids autoincrementales.

BEGIN;

UPDATE groups.music_groups
SET biography = 'Banda de covers con un repertorio de 200 canciones, para eventos corporativos y bodas.',
    description = 'Banda versátil: rock en español, pop y éxitos bailables.',
    location_text = 'Guadalajara, Jalisco'
WHERE slug = 'versatil-rock-y-pop';

-- Los demás grupos demo tenían el mismo problema: bio en inglés y ciudades del norte.
UPDATE groups.music_groups
SET biography = 'DJ con percusión y teclados en vivo, para pistas de baile grandes.',
    location_text = 'Guadalajara, Jalisco'
WHERE slug = 'sonido-cumbia-express';

UPDATE groups.music_groups
SET biography = 'Acordeón, bajo sexto y tololoche. Especialistas en fiestas de fin de semana.',
    location_text = 'Guadalajara, Jalisco'
WHERE slug = 'los-norte-nos-del-valle';

UPDATE groups.music_groups
SET biography = 'Tres voces y guitarras tocando los grandes boleros desde 2008.'
WHERE slug = 'trio-nostalgia';

COMMIT;
