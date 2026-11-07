#!/bin/sh
# Foto de las tablas que una crítica podría escribir. Correr antes y después de cada ronda: si cambia,
# alguien escribió. Ojo: `docker exec nitro_pg psql` y `psql -h 127.0.0.1 -p 5433` son DOS servidores
# distintos en esta máquina, y la API lee el TCP del host.
PGPASSWORD=postgres psql -h 127.0.0.1 -p 5433 -U postgres -d nitrogroups -t -A -F ' | ' -c "
select 'gig_pay', count(*), coalesce(sum(amount),0) from bookings.gig_pay
union all select 'gig_notices', count(*), 0 from bookings.gig_notices
union all select 'gig_attendance', count(*), coalesce(sum(status),0) from bookings.gig_attendance
union all select 'event_requests', count(*), coalesce(sum(status),0) from bookings.event_requests
union all select 'event_request_messages', count(*), 0 from bookings.event_request_messages
union all select 'event_reviews', count(*), coalesce(sum(rating),0) from bookings.event_reviews
union all select 'membership_requests', count(*), 0 from groups.group_membership_requests
union all select 'profile_visits', count(*), 0 from groups.group_profile_visits
union all select 'musicians', count(*), coalesce(sum(case when is_open_to_join then 1 else 0 end),0) from users.musicians
order by 1;"
