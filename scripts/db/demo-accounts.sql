-- Demo data for the four demo accounts (client, free musician, manager, member).
-- Run AFTER dev-seed.sql and AFTER each account has logged in once (the login creates the users.users row):
--   docker exec -i nitro_pg psql -U postgres -d nitrogroups -v ON_ERROR_STOP=1 < scripts/db/demo-accounts.sql
-- Idempotent: safe to run more than once. Passwords live in Auth0, not here.
BEGIN;

UPDATE users.users SET user_type = 0, first_name = 'Camila', last_name = 'Cliente' WHERE email = 'cliente.demo@example.com';
UPDATE users.users SET user_type = 1, first_name = 'Mateo',  last_name = 'Músico'  WHERE email = 'musico.demo@example.com';
UPDATE users.users SET user_type = 1, first_name = 'Mónica', last_name = 'Manager' WHERE email = 'manager.demo@example.com';
UPDATE users.users SET user_type = 1, first_name = 'Miguel', last_name = 'Miembro' WHERE email = 'miembro.demo@example.com';

INSERT INTO users.musicians (user_id, years_experience, short_bio, is_open_to_join, instruments, city)
SELECT u.id, v.years, v.bio, v.open_to_join, v.instruments, v.city
FROM (VALUES
    ('musico.demo@example.com',  4, 'Guitarrista y vocalista, busco un grupo estable para bodas y eventos.', TRUE,  'Guitarra, requinto, voz, coros', 'Guadalajara, Jalisco'),
    ('manager.demo@example.com', 8, 'Represento a Versátil Rock y Pop.', TRUE,  'Voz, dirección musical', 'Guadalajara, Jalisco'),
    ('miembro.demo@example.com', 6, 'Bajista con experiencia en bodas y eventos corporativos.', FALSE, 'Bajo, coros', 'Zapopan, Jalisco')
) AS v(email, years, bio, open_to_join, instruments, city)
JOIN users.users u ON u.email = v.email
ON CONFLICT (user_id) DO UPDATE
    SET years_experience = EXCLUDED.years_experience, short_bio = EXCLUDED.short_bio, is_open_to_join = EXCLUDED.is_open_to_join,
        instruments = EXCLUDED.instruments, city = EXCLUDED.city;

-- Manager: owner of "Versátil Rock y Pop" (group 1). The previous owner stays as Manager.
UPDATE groups.music_groups SET owner_user_id = (SELECT id FROM users.users WHERE email = 'manager.demo@example.com') WHERE id = 1;
UPDATE groups.group_members SET role = 2 WHERE group_id = 1 AND user_id = 1;  -- 0 Owner, 1 Member, 2 Manager
INSERT INTO groups.group_members (group_id, user_id, role, is_active, joined_via, approved_by)
SELECT 1, id, 0, TRUE, 2, 0 FROM users.users WHERE email = 'manager.demo@example.com'
ON CONFLICT (group_id, user_id) DO UPDATE SET role = 0, is_active = TRUE;

-- Member: plain Member of group 1, joined by invitation (joined_via 1).
INSERT INTO groups.group_members (group_id, user_id, role, is_active, joined_via, approved_by)
SELECT 1, id, 1, TRUE, 1, 0 FROM users.users WHERE email = 'miembro.demo@example.com'
ON CONFLICT (group_id, user_id) DO UPDATE SET role = 1, is_active = TRUE;

-- Free musician: one invitation received (from group 2) and one join request sent (to group 1).
-- direction: 0 Invitation, 1 Request; status: 0 Pending.
INSERT INTO groups.group_membership_requests (group_id, musician_user_id, initiated_by_user_id, direction, status, message, created_by)
SELECT 2, m.id, 1, 0, 0, 'Nos falta una guitarra para la temporada de bodas.', 1
FROM users.users m WHERE m.email = 'musico.demo@example.com'
  AND NOT EXISTS (SELECT 1 FROM groups.group_membership_requests r WHERE r.group_id = 2 AND r.musician_user_id = m.id AND r.status = 0);

-- Solo si NO está ya en el equipo: un miembro activo no puede estar pidiendo unirse a su propio grupo
-- (los handlers lo rechazan con 409). El seed no debe fabricar un estado que la app no produce.
INSERT INTO groups.group_membership_requests (group_id, musician_user_id, initiated_by_user_id, direction, status, message, created_by)
SELECT 1, m.id, m.id, 1, 0, 'Toco guitarra y canto; me encantaría sumarme a Versátil.', m.id
FROM users.users m WHERE m.email = 'musico.demo@example.com'
  AND NOT EXISTS (SELECT 1 FROM groups.group_membership_requests r WHERE r.group_id = 1 AND r.musician_user_id = m.id AND r.status = 0)
  AND NOT EXISTS (SELECT 1 FROM groups.group_members gm
                  WHERE gm.group_id = 1 AND gm.user_id = m.id AND gm.is_active)
  AND NOT EXISTS (SELECT 1 FROM groups.music_groups g WHERE g.id = 1 AND g.owner_user_id = m.id);

-- Client: date orders in different states (event_requests.status: 0 Pending, 1 Accepted, 2 Declined, 3 Cancelled).
INSERT INTO bookings.event_requests
    (group_id, client_user_id, event_date, start_time, duration_hours, event_type, location_text, guest_count, budget, currency, message, status, responded_at, response_message, created_by)
SELECT v.group_id, c.id, CURRENT_DATE + v.days, v.start_time::time, v.hours, v.event_type, v.place, v.guests, v.budget, 'MXN', v.msg, v.status,
       CASE WHEN v.status IN (1, 2) THEN now() END, v.reply, c.id
FROM (VALUES
    (1, 14, '20:00', 3, 'Wedding',   'Hacienda San Gabriel, Tlaquepaque', 120, 18000, '[demo] Queremos rock y pop para la fiesta después de la cena.', 0, NULL),
    (1, 28, '19:00', 2, 'Corporate', 'Hotel Fiesta Americana, Guadalajara', 80, 14000, '[demo] Evento de fin de año de la empresa.', 1, 'Confirmado, llegamos una hora antes para la prueba de sonido.'),
    (1, 40, '21:00', 3, 'Birthday',  'Salón Los Arcos, Zapopan', 60, 12000, '[demo] Cumpleaños 40, queremos repertorio de los 90.', 2, 'Esa fecha ya está reservada, ¿te sirve otra?'),
    (6, 21, '18:00', 2, 'Wedding',   'Jardín Botánico, Guadalajara', 90, 16000, '[demo] Mariachi a la salida de la ceremonia.', 0, NULL)
) AS v(group_id, days, start_time, hours, event_type, place, guests, budget, msg, status, reply)
CROSS JOIN (SELECT id FROM users.users WHERE email = 'cliente.demo@example.com') c
WHERE NOT EXISTS (SELECT 1 FROM bookings.event_requests e WHERE e.client_user_id = c.id AND e.message = v.msg);

-- A short conversation on the accepted one (sender_party: 0 Client, 1 Group).
INSERT INTO bookings.event_request_messages (event_request_id, sender_user_id, sender_party, body, created_at)
SELECT e.id, e.client_user_id, 0, '¿Podemos pasar la lista de canciones por aquí?', now() - interval '2 hours'
FROM bookings.event_requests e WHERE e.message = '[demo] Evento de fin de año de la empresa.'
  AND NOT EXISTS (SELECT 1 FROM bookings.event_request_messages x WHERE x.event_request_id = e.id);

INSERT INTO bookings.event_request_messages (event_request_id, sender_user_id, sender_party, body, created_at)
SELECT e.id, (SELECT id FROM users.users WHERE email = 'manager.demo@example.com'), 1, 'Claro, mándala y la revisamos con el grupo.', now() - interval '1 hour'
FROM bookings.event_requests e WHERE e.message = '[demo] Evento de fin de año de la empresa.'
  AND (SELECT count(*) FROM bookings.event_request_messages x WHERE x.event_request_id = e.id) = 1;

COMMIT;
