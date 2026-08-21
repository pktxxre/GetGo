-- pgTAP for 005_social. Acceptance (HANDOFF T6): cannot rate an invisible post; no
-- self-rating; no double-rating. Plus rate-as-yourself enforcement, public read of
-- reception counts, and saves being private to their owner.

begin;
select plan(11);

-- owner of the posts, a rater, and a third party.
insert into auth.users (id, instance_id, email) values
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'owner@getgo.test'),
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'rater@getgo.test'),
  ('77777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000', 'third@getgo.test');
insert into public.quest_templates (id, slug, title, origin)
  values ('66666666-6666-6666-6666-666666666666', 't-social', 'x', 'curated');

-- p1 public, p2 private — both owned by 4444.
insert into public.posts (id, user_id, visibility) values
  ('b1000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'public'),
  ('b2000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'private');

select has_table('public', 'ratings', 'public.ratings exists');
select has_table('public', 'saves',   'public.saves exists');

-- ── no self-rating: the owner cannot rate their own post ────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"44444444-4444-4444-4444-444444444444"}';
select throws_ok(
  $$ insert into public.ratings (post_id, rater_id, value)
     values ('b1000000-0000-0000-0000-000000000000',
             '44444444-4444-4444-4444-444444444444', 'awesome') $$,
  '42501', null,
  'no self-rating: the owner cannot rate their own post'
);
reset role;

-- ── a valid rating, then the same rater again → no double-rating ─────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"55555555-5555-5555-5555-555555555555"}';
select lives_ok(
  $$ insert into public.ratings (post_id, rater_id, value)
     values ('b1000000-0000-0000-0000-000000000000',
             '55555555-5555-5555-5555-555555555555', 'awesome') $$,
  'a different account can rate a visible post'
);
select throws_ok(
  $$ insert into public.ratings (post_id, rater_id, value)
     values ('b1000000-0000-0000-0000-000000000000',
             '55555555-5555-5555-5555-555555555555', 'could_be_cooler') $$,
  '23505', null,
  'no double-rating: a second rating from the same rater is rejected'
);
-- ── rate-as-someone-else is blocked (rater_id must be auth.uid()) ────────────────
select throws_ok(
  $$ insert into public.ratings (post_id, rater_id, value)
     values ('b1000000-0000-0000-0000-000000000000',
             '77777777-7777-7777-7777-777777777777', 'awesome') $$,
  '42501', null,
  'a rater cannot post a rating under someone else’s id'
);
-- ── cannot rate an invisible (private, not owned) post ──────────────────────────
select throws_ok(
  $$ insert into public.ratings (post_id, rater_id, value)
     values ('b2000000-0000-0000-0000-000000000000',
             '55555555-5555-5555-5555-555555555555', 'awesome') $$,
  '42501', null,
  'cannot rate an invisible post'
);
reset role;

-- ── reception counts are readable by anon on a public post ──────────────────────
set local role anon;
select is(
  (select count(*)::int from public.ratings where post_id = 'b1000000-0000-0000-0000-000000000000'),
  1,
  'anon can read reception on a public post'
);
reset role;

-- ── saves: create, dedupe, and privacy ──────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"55555555-5555-5555-5555-555555555555"}';
select lives_ok(
  $$ insert into public.saves (user_id, template_id)
     values ('55555555-5555-5555-5555-555555555555',
             '66666666-6666-6666-6666-666666666666') $$,
  'a user can save a quest template'
);
select throws_ok(
  $$ insert into public.saves (user_id, template_id)
     values ('55555555-5555-5555-5555-555555555555',
             '66666666-6666-6666-6666-666666666666') $$,
  '23505', null,
  'saving the same template twice is rejected'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"77777777-7777-7777-7777-777777777777"}';
select is(
  (select count(*)::int from public.saves),
  0,
  'a save is private to its owner — another account sees none of it'
);
reset role;

select * from finish();
rollback;
