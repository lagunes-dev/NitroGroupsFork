-- =============================================================================
-- NitroGroups local development seed: real reviews behind the group ratings (D7).
--
-- Run AFTER scripts/db/dev-seed.sql and after the Bookings migrations
-- (dotnet ef database update --context BookingsDbContext ...):
--   psql -h localhost -p 5433 -U postgres -d nitrogroups -f scripts/db/dev-seed-reviews.sql
--
-- What it does, for the six groups created by dev-seed.sql:
--   1. Adds two accepted events per group whose date has ALREADY PASSED (that is the
--      only kind of event a client can review: accepted + past date + not self-booked).
--      They are tagged with a '[reviews] <slug> <event type> <days ago>' message so the
--      script can find them again.
--   2. Adds one real review per one of those events (bookings.event_reviews).
--   3. Recomputes groups.music_groups.average_rating and total_reviews FROM those rows,
--      replacing the hand-written "4,7 (18 reseñas)" numbers that had nothing behind them.
--
-- Idempotent: safe to run repeatedly. Events are matched by their tag message, reviews by
-- the UNIQUE (event_request_id) index (ON CONFLICT DO NOTHING) and the aggregate is a plain
-- recomputation, so a second run changes nothing.
--
-- Enum values are stored as integers:
--   event status: 0 Pending, 1 Accepted, 2 Declined, 3 Cancelled
-- =============================================================================

BEGIN;

-- Datos de demostración de esta corrida (temporal, se borra al hacer COMMIT).
CREATE TEMP TABLE seed_review_events (
    slug           text,
    client_auth0   text,
    days_ago       int,
    start_time     time,
    duration_hours int,
    event_type     text,
    location_text  text,
    guests         int,
    budget         numeric(12, 2),
    rating         smallint,
    comment        text
) ON COMMIT DROP;

INSERT INTO seed_review_events
    (slug, client_auth0, days_ago, start_time, duration_hours, event_type, location_text, guests, budget, rating, comment)
VALUES
    ('mariachi-sol-de-jalisco',    'auth0|seed-sofia',  24,  time '20:00', 3, 'Wedding',     'Hacienda Los Arcos, Tlaquepaque',   150, 14000.00, 5, 'Llegaron temprano, sonaron impecables y se quedaron a la foto final.'),
    ('mariachi-sol-de-jalisco',    'auth0|seed-carlos', 61,  time '19:00', 2, 'Birthday',    'Casa Díaz, Zapopan',                 60,  9000.00, 5, 'La serenata fue el momento de la noche; mi mamá no lo podía creer.'),
    ('cuarteto-de-cuerdas-aurora', 'auth0|seed-sofia',  33,  time '17:00', 2, 'Ceremony',    'Jardín Botánico, Guadalajara',       80,  8000.00, 5, 'El repertorio para la ceremonia fue exactamente lo que pedimos.'),
    ('cuarteto-de-cuerdas-aurora', 'auth0|seed-diego',  96,  time '18:30', 2, 'Corporate',   'Hotel Demetria, Guadalajara',        70,  9500.00, 4, 'Muy profesionales; el montaje tardó un poco más de lo acordado.'),
    ('trio-nostalgia',             'auth0|seed-carlos', 40,  time '21:00', 2, 'Anniversary', 'Restaurante El Sacromonte, Zapopan', 40,  4500.00, 4, 'Bonito repertorio de boleros, con un sonido algo bajo al inicio.'),
    ('trio-nostalgia',             'auth0|seed-sofia',  110, time '19:30', 2, 'Birthday',    'Terraza Las Flores, Zapopan',        35,  4200.00, 4, 'Voces muy bonitas y trato cálido con los invitados.'),
    ('los-norte-nos-del-valle',    'auth0|seed-diego',  25,  time '18:00', 4, 'Quinceañera', 'Salón Real, Monterrey',              200, 11000.00, 5, 'Tocaron sin parar y la pista nunca se vació.'),
    ('los-norte-nos-del-valle',    'auth0|seed-carlos', 84,  time '20:00', 3, 'Posada',      'Rancho El Mirador, Apodaca',         120,  8500.00, 4, 'Excelente ambiente; nos avisaron tarde del cambio de horario.'),
    ('sonido-cumbia-express',      'auth0|seed-sofia',  17,  time '21:00', 3, 'Graduation',  'Salón Juárez, Monterrey',            180,  6500.00, 4, 'El show de luces fue lo mejor de la fiesta.'),
    ('sonido-cumbia-express',      'auth0|seed-diego',  130, time '20:30', 3, 'Birthday',    'Casa de la Cultura, Guadalupe',      150,  6000.00, 3, 'Buen sonido, aunque empezaron media hora después de lo acordado.'),
    ('versatil-rock-y-pop',        'auth0|seed-carlos', 55,  time '21:00', 3, 'Corporate',   'Hotel Habita, Monterrey',            120, 15000.00, 5, 'Se adaptaron a todo lo que les pedimos, incluso a última hora.'),
    ('versatil-rock-y-pop',        'auth0|seed-sofia',  70,  time '20:00', 3, 'Wedding',     'Quinta Los Encinos, San Pedro',      160, 14000.00, 2, 'El repertorio prometido no coincidió con lo que tocaron.');

-- 1. Eventos aceptados y ya pasados (la única materia prima de una reseña).
INSERT INTO bookings.event_requests (
    group_id, client_user_id, event_date, start_time, duration_hours, event_type, location_text,
    guest_count, budget, currency, message, status, responded_at, response_message, created_by, created_at)
SELECT g.id, c.id, current_date - s.days_ago, s.start_time, s.duration_hours, s.event_type, s.location_text,
       s.guests, s.budget, 'MXN',
       '[reviews] ' || s.slug || ' ' || s.event_type || ' ' || s.days_ago, 1,
       now() - make_interval(days => s.days_ago), 'Con gusto, ahí estaremos.', c.id,
       now() - make_interval(days => s.days_ago + 20)
FROM seed_review_events s
JOIN groups.music_groups g ON g.slug = s.slug
JOIN users.users c ON c.auth0_id = s.client_auth0
WHERE NOT EXISTS (
    SELECT 1 FROM bookings.event_requests e
    WHERE e.message = '[reviews] ' || s.slug || ' ' || s.event_type || ' ' || s.days_ago);

-- 2. Una reseña real por cada uno de esos eventos (una por evento: el índice único lo exige).
INSERT INTO bookings.event_reviews (
    event_request_id, client_user_id, group_id, rating, comment, created_by, created_at)
SELECT e.id, e.client_user_id, e.group_id, s.rating, s.comment, e.client_user_id,
       (e.event_date + time '21:00') AT TIME ZONE 'America/Mexico_City'
FROM seed_review_events s
JOIN groups.music_groups g ON g.slug = s.slug
JOIN bookings.event_requests e
    ON e.group_id = g.id
   AND e.message = '[reviews] ' || s.slug || ' ' || s.event_type || ' ' || s.days_ago
ON CONFLICT (event_request_id) DO NOTHING;

-- 3. El perfil del grupo se calcula con esas filas, no con números escritos a mano.
UPDATE groups.music_groups g
SET average_rating = r.average_rating,
    total_reviews  = r.total_reviews
FROM (
    SELECT sg.id,
           round(avg(er.rating)::numeric, 2) AS average_rating,
           count(er.id)::int                 AS total_reviews
    FROM groups.music_groups sg
    LEFT JOIN bookings.event_reviews er ON er.group_id = sg.id
    WHERE sg.slug IN ('mariachi-sol-de-jalisco', 'cuarteto-de-cuerdas-aurora', 'trio-nostalgia',
                      'los-norte-nos-del-valle', 'sonido-cumbia-express', 'versatil-rock-y-pop')
    GROUP BY sg.id
) r
WHERE g.id = r.id;

COMMIT;
