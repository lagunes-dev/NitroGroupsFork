-- =============================================================================
-- NitroGroups local development seed data (manual testing only).
--
-- Run AFTER all four module migrations (Users, Groups, Schedules, Bookings):
--   psql -h localhost -p 5433 -U postgres -d nitrogroups -f scripts/db/dev-seed.sql
--
-- Idempotent: safe to run repeatedly.
--   * users, groups, members, genres links: keyed by auth0_id / slug / unique indexes.
--   * event requests and messages: keyed by (group, client, message) / (request, body).
--   * availability and busy schedules are RELATIVE TO now(); rows tagged '[seed]' are
--     deleted and regenerated on every run so the next ~60 days never go stale.
-- Music genres come from the SeedMusicGenres migration and are only referenced here.
--
-- !! LOGIN NOTE !!
-- Seed users have fake identities (auth0|seed-<name>, <name>@seed.local).
-- To log in as one of them, replace users.users.auth0_id / email with the real
-- Auth0 user's `sub` / email. The platform admin role lives in Auth0 ("admin" role),
-- not in this database, so "admin" below is only an ordinary account to be promoted there.
--
-- Enum values are stored as integers:
--   user_type: 0 Client, 1 Musician        group role: 0 Owner, 1 Member, 2 Manager
--   joined_via: 0 Request, 1 Invitation, 2 Manual
--   event status: 0 Pending, 1 Accepted, 2 Declined, 3 Cancelled; party: 0 Client, 1 Group
--   busy source: 0 Contract, 1 Rehearsal, 2 Maintenance, 3 Personal, 4 Travel
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------- users ------
INSERT INTO users.users (auth0_id, email, first_name, last_name, phone, user_type, location_text, email_verified, active)
SELECT v.auth0_id, v.email, v.first_name, v.last_name, v.phone, v.user_type, v.location_text, true, true
FROM (VALUES
    ('auth0|seed-admin',  'admin@seed.local',  'Ada',     'Admin',    '5550000001', 0, 'Ciudad de México'),
    ('auth0|seed-maria',  'maria@seed.local',  'María',   'Hernández','5550000002', 1, 'Guadalajara, Jalisco'),
    ('auth0|seed-luis',   'luis@seed.local',   'Luis',    'Ramírez',  '5550000003', 1, 'Monterrey, Nuevo León'),
    ('auth0|seed-carlos', 'carlos@seed.local', 'Carlos',  'Mendoza',  '5550000004', 0, 'Ciudad de México'),
    ('auth0|seed-sofia',  'sofia@seed.local',  'Sofía',   'Torres',   '5550000005', 0, 'Guadalajara, Jalisco'),
    ('auth0|seed-diego',  'diego@seed.local',  'Diego',   'Vargas',   '5550000006', 0, 'Puebla, Puebla')
) AS v(auth0_id, email, first_name, last_name, phone, user_type, location_text)
WHERE NOT EXISTS (SELECT 1 FROM users.users u WHERE u.auth0_id = v.auth0_id);

INSERT INTO users.musicians (user_id, years_experience, short_bio, is_open_to_join)
SELECT u.id, v.years, v.bio, v.open_to_join
FROM (VALUES
    ('auth0|seed-maria', 12, 'Violinist and bandleader, 12 years playing weddings and festivals.', false),
    ('auth0|seed-luis',  8,  'Keyboardist and arranger, loves cumbia and rock en español.',       true)
) AS v(auth0_id, years, bio, open_to_join)
JOIN users.users u ON u.auth0_id = v.auth0_id
ON CONFLICT (user_id) DO NOTHING;

-- --------------------------------------------------------------- groups ------
-- active=false / is_accepting_bookings=false groups are included on purpose.
INSERT INTO groups.music_groups (
    owner_user_id, slug, group_name, description, biography, num_members, years_experience,
    phone, email, location_text, service_radius_km, currency, base_price, hourly_rate,
    minimum_duration_hours, setup_time_minutes, average_rating, total_reviews,
    is_verified, is_featured, is_accepting_bookings, active, created_by)
SELECT o.id, v.slug, v.group_name, v.description, v.biography, v.num_members, v.years,
       v.phone, v.email, v.location_text, v.radius, 'MXN', v.base_price, v.hourly_rate,
       v.min_hours, v.setup, v.rating, v.reviews, v.verified, v.featured, v.accepting, v.active, o.id
FROM (VALUES
    ('auth0|seed-maria', 'mariachi-sol-de-jalisco', 'Mariachi Sol de Jalisco',
        'Traditional mariachi for weddings, quinceañeras and serenades.',
        'Founded in Guadalajara, Mariachi Sol de Jalisco has played over 600 events across western Mexico.',
        8, 15, '3310000001', 'sol@seed.local', 'Guadalajara, Jalisco', 120, 9500.00, 2500.00, 2, 30, 4.80, 54, true,  true,  true,  true),
    ('auth0|seed-maria', 'cuarteto-de-cuerdas-aurora', 'Cuarteto de Cuerdas Aurora',
        'String quartet for ceremonies and elegant dinners.',
        'Classical and contemporary arrangements, from Vivaldi to Coldplay.',
        4, 10, '3310000002', 'aurora@seed.local', 'Guadalajara, Jalisco', 80, 7000.00, 1800.00, 2, 45, 4.90, 31, true,  false, true,  true),
    ('auth0|seed-maria', 'trio-nostalgia', 'Trío Nostalgia',
        'Romantic trio, boleros and classics (currently on pause).',
        'Three voices and guitars playing the great boleros since 2008.',
        3, 17, '3310000003', 'nostalgia@seed.local', 'Zapopan, Jalisco', 60, 4500.00, 1200.00, 1, 20, 4.50, 12, false, false, false, false),
    ('auth0|seed-luis',  'los-norte-nos-del-valle', 'Los Norteños del Valle',
        'Norteño and banda for parties and ranch events.',
        'Accordion, bajo sexto and tololoche. Weekend party specialists in the northeast.',
        5, 9, '8110000001', 'norte@seed.local', 'Monterrey, Nuevo León', 200, 8000.00, 2000.00, 3, 30, 4.60, 40, true,  true,  true,  true),
    ('auth0|seed-luis',  'sonido-cumbia-express', 'Sonido Cumbia Express',
        'Cumbia sonidera with full light and sound show.',
        'DJ plus live percussion and keys, perfect for big dance floors.',
        6, 6, '8110000002', 'cumbia@seed.local', 'Monterrey, Nuevo León', 150, 6500.00, 1500.00, 3, 60, 4.30, 22, false, false, true,  true),
    ('auth0|seed-luis',  'versatil-rock-y-pop', 'Versátil Rock y Pop',
        'Versatile cover band: rock en español, pop and dance hits.',
        'Four-piece band with a repertoire of 200 songs, for corporate events and weddings.',
        4, 7, '8110000003', 'versatil@seed.local', 'San Pedro Garza García, Nuevo León', 100, 12000.00, 3000.00, 3, 60, 4.70, 18, true,  false, true,  true)
) AS v(owner_auth0, slug, group_name, description, biography, num_members, years, phone, email,
       location_text, radius, base_price, hourly_rate, min_hours, setup, rating, reviews,
       verified, featured, accepting, active)
JOIN users.users o ON o.auth0_id = v.owner_auth0
ON CONFLICT (slug) DO NOTHING;

-- Genres (existing rows from SeedMusicGenres are referenced by slug, never inserted).
INSERT INTO groups.group_genres (group_id, genre_id, is_primary)
SELECT g.id, mg.id, v.is_primary
FROM (VALUES
    ('mariachi-sol-de-jalisco',   'mariachi',         true),
    ('mariachi-sol-de-jalisco',   'son-jarocho',      false),
    ('cuarteto-de-cuerdas-aurora','musica-de-camara', true),
    ('cuarteto-de-cuerdas-aurora','pop',              false),
    ('trio-nostalgia',            'trio-romantico',   true),
    ('los-norte-nos-del-valle',   'norteno',          true),
    ('los-norte-nos-del-valle',   'banda-sinaloense', false),
    ('sonido-cumbia-express',     'cumbia-sonidera',  true),
    ('sonido-cumbia-express',     'cumbia',           false),
    ('versatil-rock-y-pop',       'grupo-versatil',   true),
    ('versatil-rock-y-pop',       'rock-en-espanol',  false),
    ('versatil-rock-y-pop',       'pop',              false)
) AS v(group_slug, genre_slug, is_primary)
JOIN groups.music_groups g ON g.slug = v.group_slug
JOIN groups.music_genres mg ON mg.slug = v.genre_slug
ON CONFLICT (group_id, genre_id) DO NOTHING;

-- Memberships: owners, plus Luis as manager of a mariachi group and Maria as plain member of another.
INSERT INTO groups.group_members (group_id, user_id, role, is_active, joined_via, approved_by)
SELECT g.id, u.id, v.role, true, 2, 0
FROM (VALUES
    ('mariachi-sol-de-jalisco',   'auth0|seed-maria', 0),
    ('cuarteto-de-cuerdas-aurora','auth0|seed-maria', 0),
    ('trio-nostalgia',            'auth0|seed-maria', 0),
    ('los-norte-nos-del-valle',   'auth0|seed-luis',  0),
    ('sonido-cumbia-express',     'auth0|seed-luis',  0),
    ('versatil-rock-y-pop',       'auth0|seed-luis',  0),
    ('mariachi-sol-de-jalisco',   'auth0|seed-luis',  2),   -- manager of a group he does not own
    ('versatil-rock-y-pop',       'auth0|seed-maria', 1)    -- plain member
) AS v(group_slug, auth0_id, role)
JOIN groups.music_groups g ON g.slug = v.group_slug
JOIN users.users u ON u.auth0_id = v.auth0_id
ON CONFLICT (group_id, user_id) DO NOTHING;

-- Media: public placeholder photos only (no R2 storage needed).
INSERT INTO groups.group_media (group_id, type, url, thumbnail_url, title, is_primary, display_order, created_by)
SELECT g.id, 0, 'https://picsum.photos/seed/' || g.slug || '-' || n || '/1200/800',
       'https://picsum.photos/seed/' || g.slug || '-' || n || '/300/200',
       g.group_name || ' photo ' || n, n = 1, n, g.owner_user_id
FROM groups.music_groups g
CROSS JOIN generate_series(1, 2) AS n
WHERE g.slug IN ('mariachi-sol-de-jalisco','cuarteto-de-cuerdas-aurora','trio-nostalgia',
                 'los-norte-nos-del-valle','sonido-cumbia-express','versatil-rock-y-pop')
  AND NOT EXISTS (SELECT 1 FROM groups.group_media m
                  WHERE m.group_id = g.id AND m.display_order = n AND m.title = g.group_name || ' photo ' || n);

-- ------------------------------------------------------------ schedules ------
-- Regenerated on each run so the window always covers today .. today + 60 days.
DELETE FROM schedules.group_availability WHERE note LIKE '[seed]%';
DELETE FROM schedules.busy_schedules     WHERE title LIKE '[seed]%';

-- Days are interpreted in Mexico City time (the platform's event time zone).
-- Fri/Sat/Sun are open ("available"); every 9th day (offset per group) is blocked.
INSERT INTO schedules.group_availability (group_id, start_at, end_at, available, note, timezone, "CreatedBy", "CreatedAt")
SELECT g.id,
       d::timestamp AT TIME ZONE 'America/Mexico_City',
       (d + 1)::timestamp AT TIME ZONE 'America/Mexico_City',
       false, '[seed] blocked day', 'America/Mexico_City', g.owner_user_id, now()
FROM groups.music_groups g
CROSS JOIN generate_series(1, 60) AS s(n)
CROSS JOIN LATERAL (SELECT current_date + s.n) AS gs(d)
WHERE g.slug IN ('mariachi-sol-de-jalisco','cuarteto-de-cuerdas-aurora','trio-nostalgia',
                 'los-norte-nos-del-valle','sonido-cumbia-express','versatil-rock-y-pop')
  AND (gs.d::date - current_date + (g.id % 9)) % 9 = 0;

INSERT INTO schedules.group_availability (group_id, start_at, end_at, available, custom_price, note, timezone, "CreatedBy", "CreatedAt")
SELECT g.id,
       d::timestamp AT TIME ZONE 'America/Mexico_City',
       (d + 1)::timestamp AT TIME ZONE 'America/Mexico_City',
       true, CASE WHEN extract(dow FROM d) = 6 THEN g.base_price * 1.2 END,
       '[seed] open weekend day', 'America/Mexico_City', g.owner_user_id, now()
FROM groups.music_groups g
CROSS JOIN generate_series(1, 60) AS s(n)
CROSS JOIN LATERAL (SELECT current_date + s.n) AS gs(d)
WHERE g.slug IN ('mariachi-sol-de-jalisco','cuarteto-de-cuerdas-aurora','trio-nostalgia',
                 'los-norte-nos-del-valle','sonido-cumbia-express','versatil-rock-y-pop')
  AND extract(dow FROM d) IN (0, 5, 6)
  AND (gs.d::date - current_date + (g.id % 9)) % 9 <> 0;

-- A few busy slots per group (rehearsals / travel / personal).
INSERT INTO schedules.busy_schedules (group_id, title, description, source, start_at, end_at, "CreatedBy", "CreatedAt")
SELECT g.id, '[seed] ' || v.title, v.description, v.source,
       (current_date + v.day_offset)::timestamp AT TIME ZONE 'America/Mexico_City' + v.start_time,
       (current_date + v.day_offset)::timestamp AT TIME ZONE 'America/Mexico_City' + v.end_time,
       g.owner_user_id, now()
FROM groups.music_groups g
CROSS JOIN (VALUES
    (3,  'Rehearsal', 'Weekly rehearsal',          1, interval '17 hours', interval '20 hours'),
    (10, 'Rehearsal', 'Weekly rehearsal',          1, interval '17 hours', interval '20 hours'),
    (17, 'Tour trip', 'Out of town',               4, interval '0 hours',  interval '24 hours'),
    (25, 'Personal',  'Day off',                   3, interval '0 hours',  interval '24 hours')
) AS v(day_offset, title, description, source, start_time, end_time)
WHERE g.slug IN ('mariachi-sol-de-jalisco','cuarteto-de-cuerdas-aurora','trio-nostalgia',
                 'los-norte-nos-del-valle','sonido-cumbia-express','versatil-rock-y-pop');

-- -------------------------------------------------------------- bookings -----
INSERT INTO bookings.event_requests (
    group_id, client_user_id, event_date, start_time, duration_hours, event_type, location_text,
    guest_count, budget, currency, message, status, responded_at, response_message, created_by, created_at)
SELECT g.id, c.id, current_date + v.day_offset, v.start_time, v.duration_hours, v.event_type, v.location_text,
       v.guests, v.budget, 'MXN', v.message, v.status,
       CASE WHEN v.status IN (1, 2) THEN now() - interval '1 day' END,
       v.response_message, c.id, now() - v.age
FROM (VALUES
    ('mariachi-sol-de-jalisco',   'auth0|seed-sofia',  21, time '20:00', 3, 'Wedding',     'Hacienda Los Arcos, Tlaquepaque', 150, 14000.00,
        '[seed] Hi! We would love a mariachi for our wedding reception.', 0, NULL, interval '2 days'),
    ('mariachi-sol-de-jalisco',   'auth0|seed-carlos', 28, time '19:00', 2, 'Birthday',    'Casa Díaz, Zapopan',               60,  9000.00,
        '[seed] Surprise serenade for my mother''s 60th birthday.', 1, 'Happy to play! See you there.', interval '5 days'),
    ('los-norte-nos-del-valle',   'auth0|seed-diego',  35, time '18:00', 4, 'Quinceañera', 'Salón Real, Monterrey',            200, 11000.00,
        '[seed] Looking for norteño music for a quinceañera.', 2, 'Sorry, we are already booked that day.', interval '6 days'),
    ('versatil-rock-y-pop',       'auth0|seed-carlos', 14, time '21:00', 3, 'Corporate',   'Hotel Habita, Monterrey',          120, 15000.00,
        '[seed] Annual company party, need a cover band for 3 hours.', 3, NULL, interval '8 days'),
    ('cuarteto-de-cuerdas-aurora','auth0|seed-sofia',  42, time '17:00', 2, 'Ceremony',    'Jardín Botánico, Guadalajara',      80,  8000.00,
        '[seed] Civil ceremony with live strings, please share a repertoire.', 0, NULL, interval '1 day')
) AS v(group_slug, client_auth0, day_offset, start_time, duration_hours, event_type, location_text,
       guests, budget, message, status, response_message, age)
JOIN groups.music_groups g ON g.slug = v.group_slug
JOIN users.users c ON c.auth0_id = v.client_auth0
WHERE NOT EXISTS (SELECT 1 FROM bookings.event_requests e
                  WHERE e.group_id = g.id AND e.client_user_id = c.id AND e.message = v.message);

-- Accepted request blocks the date for the group (mirrors what the app creates).
INSERT INTO schedules.busy_schedules (group_id, title, description, source, start_at, end_at, "CreatedBy", "CreatedAt")
SELECT e.group_id, '[seed] Confirmed event', e.event_type, 0,
       (e.event_date::timestamp + e.start_time) AT TIME ZONE 'America/Mexico_City',
       (e.event_date::timestamp + e.start_time + make_interval(hours => e.duration_hours)) AT TIME ZONE 'America/Mexico_City',
       e.created_by, now()
FROM bookings.event_requests e
WHERE e.status = 1 AND e.message LIKE '[seed]%';

-- Messages (sender_party: 0 Client, 1 Group).
INSERT INTO bookings.event_request_messages (event_request_id, sender_user_id, sender_party, body, created_at)
SELECT e.id,
       CASE WHEN v.party = 0 THEN e.client_user_id ELSE g.owner_user_id END,
       v.party, v.body, e.created_at + v.delay
FROM (VALUES
    ('[seed] Hi! We would love a mariachi for our wedding reception.', 1, 'Congratulations! Do you need the full eight-piece ensemble?', interval '3 hours'),
    ('[seed] Hi! We would love a mariachi for our wedding reception.', 0, 'Yes, the full ensemble please, and two extra songs for the first dance.', interval '5 hours'),
    ('[seed] Surprise serenade for my mother''s 60th birthday.',        1, 'Accepted! We will arrive 30 minutes early to set up.', interval '1 day'),
    ('[seed] Annual company party, need a cover band for 3 hours.',     0, 'Sorry, the party was moved to another date. Cancelling.', interval '2 days')
) AS v(request_message, party, body, delay)
JOIN bookings.event_requests e ON e.message = v.request_message
JOIN groups.music_groups g ON g.id = e.group_id
WHERE NOT EXISTS (SELECT 1 FROM bookings.event_request_messages m
                  WHERE m.event_request_id = e.id AND m.body = v.body);

COMMIT;
