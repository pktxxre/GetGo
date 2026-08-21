-- pgTAP for 015_mint_template. Run with `supabase test db` (local stack, real roles).
-- Minting a template from a first-of-its-kind post: shape + security, the mint itself,
-- idempotency, the title fallback chain, the visibility guard, and rarity.
--
-- auth.uid() resolves from request.jwt.claims (same technique as 007) — mint and can_view_post
-- are both SECURITY DEFINER, so the acting identity comes from the claim, not the role.

begin;
select plan(15);

\set author 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1'
\set saver  '55555555-5555-5555-5555-555555555555'
\set strang '99999999-9999-9999-9999-999999999999'

insert into auth.users (id, instance_id, email) values
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '00000000-0000-0000-0000-000000000000', 'author@getgo.test'),
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'saver@getgo.test'),
  ('99999999-9999-9999-9999-999999999999', '00000000-0000-0000-0000-000000000000', 'stranger@getgo.test');

-- Template-less posts by the author (no create_post needed; we test the mint in isolation).
insert into public.posts (id, user_id, title, caption, visibility) values
  ('e1000000-0000-0000-0000-000000000000', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'night market crawl', 'ate everything in sight', 'public'),
  ('e2000000-0000-0000-0000-000000000000', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', null, 'wandered borough market til 2am', 'public'),
  ('e3000000-0000-0000-0000-000000000000', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', null, null, 'public'),
  ('e4000000-0000-0000-0000-000000000000', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'secret quest', null, 'private');

-- ── shape + security ────────────────────────────────────────────────────────────
select has_function('public', 'mint_template_from_post', array['uuid'], 'mint_template_from_post(uuid) exists');
select is((select prosecdef from pg_proc where proname = 'mint_template_from_post'), true,
          'mint is SECURITY DEFINER');
select ok((select proconfig from pg_proc where proname = 'mint_template_from_post') @> array['search_path=""'],
          'mint pins search_path to empty');

-- ── the mint: saver mints a template from the author's public post ──────────────
set local request.jwt.claims to '{"sub":"55555555-5555-5555-5555-555555555555"}';
create temporary table m1 as
  select public.mint_template_from_post('e1000000-0000-0000-0000-000000000000') as tid;

select is((select origin::text from public.quest_templates where id = (select tid from m1)),
          'user', 'minted template is origin=user');
select is((select created_by from public.quest_templates where id = (select tid from m1)),
          :'saver'::uuid, 'created_by is the saver who triggered the mint');
select is((select title from public.quest_templates where id = (select tid from m1)),
          'night market crawl', 'title is copied from the post name');
select is((select template_id from public.posts where id = 'e1000000-0000-0000-0000-000000000000'),
          (select tid from m1), 'the origin post now points at the minted template');
select is((select completion_ordinal from public.posts where id = 'e1000000-0000-0000-0000-000000000000'),
          1, 'the origin post is stamped the 1st ever');
select ok((select slug from public.quest_templates where id = (select tid from m1)) like 'night-market-crawl-%',
          'slug is kebab(title) + a post-id fragment');

-- ── idempotency: a second save returns the same template, mints nothing new ──────
create temporary table m2 as
  select public.mint_template_from_post('e1000000-0000-0000-0000-000000000000') as tid;
select is((select tid from m2), (select tid from m1), 'a second mint returns the same template');
select is((select count(*)::int from public.quest_templates where created_by = :'saver'::uuid),
          1, 'no second template was created');

-- ── title fallback chain ────────────────────────────────────────────────────────
-- Materialize the minted id first, then read the row: calling the mint inside a
-- `where id = mint(...)` subquery would race the outer SELECT's snapshot (the new row
-- isn't visible to a scan that started before the insert).
create temporary table m3 as
  select public.mint_template_from_post('e2000000-0000-0000-0000-000000000000') as tid;
select is((select title from public.quest_templates where id = (select tid from m3)),
          'wandered borough market til 2am', 'no name → title falls back to the caption');
create temporary table m4 as
  select public.mint_template_from_post('e3000000-0000-0000-0000-000000000000') as tid;
select is((select title from public.quest_templates where id = (select tid from m4)),
          'untitled sidequest', 'no name and no caption → generic title');

-- ── visibility guard: a stranger cannot mint from a private post they can't see ──
set local request.jwt.claims to '{"sub":"99999999-9999-9999-9999-999999999999"}';
select throws_ok(
  $$ select public.mint_template_from_post('e4000000-0000-0000-0000-000000000000') $$,
  '42501', null, 'minting a private post you cannot see is denied');

-- ── rarity: a freshly minted, never-redone quest has exactly one post ────────────
select is(
  (select count(*)::int from public.posts where template_id = (select tid from m1)),
  1, 'rarity = count(posts on template) reads 1 for a fresh mint');

select * from finish();
rollback;
