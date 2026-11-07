-- Titulares de los músicos demo (log L53, T57 de odd/tasks/ola-3-descubrimiento-y-logistica.md).
--
-- Miguel abrió su perfil y el formulario decía "Titular 0 de 120": con el titular vacío un perfil
-- público demo se lee como abandonado, aunque tenga instrumentos, ciudad y biografía. Mateo ya tenía
-- el suyo; el resto de los músicos demo no.
--
-- OJO, trampa de entorno: `docker exec nitro_pg psql` y `psql -h 127.0.0.1 -p 5433` NO son el mismo
-- servidor en esta máquina. La API lee el TCP del host:
--   PGPASSWORD=postgres psql -h 127.0.0.1 -p 5433 -U postgres -d nitrogroups -v ON_ERROR_STOP=1 \
--     < scripts/db/dev-seed-round8b.sql
--
-- Idempotente y conservador: solo llena el titular cuando está vacío, nunca pisa uno escrito a mano.

BEGIN;

UPDATE users.musicians m
SET headline = v.headline
FROM users.users u
JOIN (VALUES
    ('miembro.demo@example.com',  'Bajista de bodas y eventos corporativos — Zapopan'),
    ('manager.demo@example.com',  'Voz y dirección musical de Versátil Rock y Pop — GDL'),
    ('maria@seed.local',          'Violinista y directora de grupo para bodas y festivales'),
    ('luis@seed.local',           'Tecladista y arreglista, cumbia y rock en español')
) AS v(email, headline) ON v.email = u.email
WHERE m.user_id = u.id
  AND (m.headline IS NULL OR btrim(m.headline) = '');

COMMIT;
