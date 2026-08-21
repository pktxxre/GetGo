-- pgTAP for 003_posts. Acceptance (HANDOFF T4): soft-deleted posts absent from the feed;
-- visibility defaults to public. Plus the C5 ordinal invariant and a first look at the
-- inline visibility policy (the exhaustive 5-role matrix lives in 004's test, T5).

begin;
select plan(13);

-- Two accounts (the trigger mirrors them into public.users) and one template.
insert into auth.users (id, instance_id, email) values
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'owner@getgo.test'),
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'other@getgo.test');
insert into public.quest_templates (id, slug, title, origin)
  values ('66666666-6666-6666-6666-666666666666', 't-feed', 'x', 'curated');

-- ── shape ─────────────────────────────────────────────────────────────────────
select has_table('public', 'posts', 'public.posts exists');
select has_table('public', 'post_photos', 'public.post_photos exists');
select has_column('public', 'posts', 'geog', 'posts has geog (C4)');
select has_column('public', 'posts', 'city', 'posts has city (C4)');
select has_column('public', 'posts', 'completion_ordinal', 'posts has completion_ordinal');

-- ── visibility defaults to public ───────────────────────────────────────────────
insert into public.posts (id, user_id, caption)
  values ('a0000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'no visibility given');
select is(
  (select visibility::text from public.posts where id = 'a0000000-0000-0000-0000-000000000000'),
  'public',
  'visibility defaults to public'
);

-- ── C5 ordinal invariant ────────────────────────────────────────────────────────
select throws_ok(
  $$ insert into public.posts (user_id, completion_ordinal)
     values ('44444444-4444-4444-4444-444444444444', 5) $$,
  '23514', null,
  'a completion_ordinal without a template is rejected (C5)'
);
select throws_ok(
  $$ insert into public.posts (user_id, template_id, completion_ordinal)
     values ('44444444-4444-4444-4444-444444444444',
             '66666666-6666-6666-6666-666666666666', 0) $$,
  '23514', null,
  'a non-positive completion_ordinal is rejected'
);

-- ── seed posts for the visibility + soft-delete checks ──────────────────────────
insert into public.posts (id, user_id, template_id, completion_ordinal, visibility, deleted_at) values
  ('b1000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444',
     '66666666-6666-6666-6666-666666666666', 1, 'public',  null),      -- public, live
  ('b2000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444',
     null, null, 'private', null),                                     -- private, live
  ('b3000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444',
     null, null, 'public',  now());                                    -- public, soft-deleted

-- ── as anon (cold web visitor) ──────────────────────────────────────────────────
set local role anon;
select is((select count(*)::int from public.posts where id = 'b1000000-0000-0000-0000-000000000000'),
          1, 'anon sees a public live post');
select is((select count(*)::int from public.posts where id = 'b2000000-0000-0000-0000-000000000000'),
          0, 'anon cannot see a private post');
select is((select count(*)::int from public.posts where id = 'b3000000-0000-0000-0000-000000000000'),
          0, 'a soft-deleted post is absent from the feed for anon');
reset role;

-- ── as the owner ────────────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"44444444-4444-4444-4444-444444444444"}';
select is((select count(*)::int from public.posts where id = 'b2000000-0000-0000-0000-000000000000'),
          1, 'the owner sees their own private post');
select is((select count(*)::int from public.posts where id = 'b3000000-0000-0000-0000-000000000000'),
          0, 'a soft-deleted post is absent even for its owner');
reset role;

select * from finish();
rollback;
