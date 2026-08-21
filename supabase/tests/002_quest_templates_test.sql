-- pgTAP for 002_quest_templates. Acceptance (HANDOFF T3): a `<->` ordered query returns
-- nearest-first over the seed set. Plus slug uniqueness, the origin/author invariant, and
-- the public-read RLS policy.

begin;
select plan(9);

-- A real user so the "curated must not have an author" test fails on the CHECK, not on a
-- dangling FK.
insert into auth.users (id, instance_id, email)
values ('33333333-3333-3333-3333-333333333333',
        '00000000-0000-0000-0000-000000000000', 'curator@getgo.test');

-- ── shape ─────────────────────────────────────────────────────────────────────
select has_table('public', 'quest_templates', 'public.quest_templates exists');
select has_column('public', 'quest_templates', 'geog', 'has a geog column');
select has_column('public', 'quest_templates', 'origin', 'has an origin column');
select col_is_pk('public', 'quest_templates', 'id', 'id is the primary key');

-- ── seed three curated London quests at known coordinates ───────────────────────
insert into public.quest_templates (slug, title, neighbourhood, origin, geog) values
  ('near-bigben', 'clock thing',  'Westminster', 'curated',
     st_setsrid(st_makepoint(-0.1240, 51.5010), 4326)::geography),
  ('camden',      'market maze',  'Camden',      'curated',
     st_setsrid(st_makepoint(-0.1426, 51.5390), 4326)::geography),
  ('greenwich',   'prime meridian','Greenwich',  'curated',
     st_setsrid(st_makepoint( 0.0000, 51.4826), 4326)::geography);

-- ── nearest-first: order by distance from a point next to Big Ben ───────────────
select is(
  (select slug from public.quest_templates
     order by geog <-> st_setsrid(st_makepoint(-0.1246, 51.5007), 4326)::geography
     limit 1),
  'near-bigben',
  'a <-> ordered query returns nearest-first'
);

-- ── slug uniqueness ─────────────────────────────────────────────────────────────
select throws_ok(
  $$ insert into public.quest_templates (slug, title, origin)
     values ('camden', 'dup', 'curated') $$,
  '23505', null,
  'a duplicate slug is rejected'
);

-- ── origin/author invariant ─────────────────────────────────────────────────────
select throws_ok(
  $$ insert into public.quest_templates (slug, title, origin, created_by)
     values ('u-no-author', 't', 'user', null) $$,
  '23514', null,
  'a user-origin template must name an author'
);
select throws_ok(
  $$ insert into public.quest_templates (slug, title, origin, created_by)
     values ('curated-with-author', 't', 'curated',
             '33333333-3333-3333-3333-333333333333') $$,
  '23514', null,
  'a curated template must not have an author'
);

-- ── RLS: the catalog is publicly readable ───────────────────────────────────────
-- Scoped to this test's own slugs, not an absolute catalog count: seed.sql (and the
-- growing curated catalog) legitimately add rows, and the policy under test is "anon may
-- read curated templates", which a count of the fixture's three rows proves exactly — a
-- blocked read would return 0, not 3.
set local role anon;
select is(
  (select count(*)::int from public.quest_templates
     where slug in ('near-bigben', 'camden', 'greenwich')),
  3,
  'anon can read curated templates'
);
reset role;

select * from finish();
rollback;
