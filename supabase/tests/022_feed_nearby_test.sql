-- pgTAP for 022_feed_nearby. Nearest-first ordering, and — the load-bearing part — RLS still
-- hides a private post from a stranger, because the function is SECURITY INVOKER.

begin;
select plan(5);

insert into auth.users (id, instance_id, email) values
  ('d1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', '00000000-0000-0000-0000-000000000000', 'near1@getgo.test'),
  ('d2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2', '00000000-0000-0000-0000-000000000000', 'near2@getgo.test');

-- Three public posts at spread-out points, plus one private near the query point.
--   A ≈ Shoreditch (-0.078, 51.526)   B ≈ Peckham (-0.069, 51.474)   C ≈ Richmond (-0.301, 51.461)
insert into public.posts (id, user_id, caption, visibility, geog) values
  ('a0000000-0000-0000-0000-000000000000', 'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', 'A shoreditch', 'public',
     extensions.st_setsrid(extensions.st_makepoint(-0.078, 51.526), 4326)::extensions.geography),
  ('b0000000-0000-0000-0000-000000000000', 'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', 'B peckham', 'public',
     extensions.st_setsrid(extensions.st_makepoint(-0.069, 51.474), 4326)::extensions.geography),
  ('c0000000-0000-0000-0000-000000000000', 'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', 'C richmond', 'public',
     extensions.st_setsrid(extensions.st_makepoint(-0.301, 51.461), 4326)::extensions.geography),
  ('e0000000-0000-0000-0000-000000000000', 'd2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2', 'secret near shoreditch', 'private',
     extensions.st_setsrid(extensions.st_makepoint(-0.079, 51.527), 4326)::extensions.geography);

select has_function('public', 'feed_nearby', array['double precision','double precision','integer'],
  'feed_nearby(lon,lat,limit) exists');
select is((select prosecdef from pg_proc where proname = 'feed_nearby'), false,
  'feed_nearby is SECURITY INVOKER (so RLS applies to the caller)');

-- ── nearest-first from a point next to Shoreditch: A, then B, then C ──────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"d1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1"}';
select is(
  (select array_agg(id order by ord)
   from (select id, row_number() over () as ord
         from public.feed_nearby(-0.078, 51.526, 10)
         where user_id = 'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1') t),
  array['a0000000-0000-0000-0000-000000000000',
        'b0000000-0000-0000-0000-000000000000',
        'c0000000-0000-0000-0000-000000000000']::uuid[],
  'public posts come back nearest-first (Shoreditch → Peckham → Richmond)');
reset role;

-- ── RLS: a stranger querying the same spot does NOT get the private post ──────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"d1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1"}';
select is(
  (select count(*)::int from public.feed_nearby(-0.079, 51.527, 10)
     where id = 'e0000000-0000-0000-0000-000000000000'),
  0, 'a private post is hidden from another user even when it is the nearest');
reset role;

-- ── the owner DOES see their own private post nearby ─────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"d2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2"}';
select is(
  (select count(*)::int from public.feed_nearby(-0.079, 51.527, 10)
     where id = 'e0000000-0000-0000-0000-000000000000'),
  1, 'the owner sees their own private post in nearby');
reset role;

select * from finish();
rollback;
