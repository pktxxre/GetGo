-- pgTAP for 004_visibility. Acceptance (HANDOFF T5): the 5 role cases pass
-- (public/anon, public/owner, private/owner, private/other → false, private/anon → false),
-- and search_path is pinned. Plus the child path (post_photos) through can_view_post().

begin;
select plan(12);

-- owner + a different account; the trigger mirrors both.
insert into auth.users (id, instance_id, email) values
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'owner@getgo.test'),
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'other@getgo.test');

-- one public post, one private post — both owned by 4444 — each with a photo.
insert into public.posts (id, user_id, visibility) values
  ('b1000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'public'),
  ('b2000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'private');
insert into public.post_photos (post_id, storage_path, idx) values
  ('b1000000-0000-0000-0000-000000000000', 'photos/pub.jpg',  0),
  ('b2000000-0000-0000-0000-000000000000', 'photos/priv.jpg', 0);

-- ── the helper's shape ──────────────────────────────────────────────────────────
select has_function('public', 'can_view_post', array['uuid'], 'can_view_post(uuid) exists');
select is(
  (select prosecdef from pg_proc where proname = 'can_view_post'),
  true,
  'can_view_post is SECURITY DEFINER'
);
select ok(
  (select proconfig from pg_proc where proname = 'can_view_post') @> array['search_path=""'],
  'can_view_post pins search_path to empty'
);

-- ── the 5 role cases on the posts feed policy ───────────────────────────────────
set local role anon;
select is((select count(*)::int from public.posts where id = 'b1000000-0000-0000-0000-000000000000'),
          1, 'public / anon  → visible');
select is((select count(*)::int from public.posts where id = 'b2000000-0000-0000-0000-000000000000'),
          0, 'private / anon → not visible');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"44444444-4444-4444-4444-444444444444"}';
select is((select count(*)::int from public.posts where id = 'b1000000-0000-0000-0000-000000000000'),
          1, 'public / owner  → visible');
select is((select count(*)::int from public.posts where id = 'b2000000-0000-0000-0000-000000000000'),
          1, 'private / owner → visible');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"55555555-5555-5555-5555-555555555555"}';
select is((select count(*)::int from public.posts where id = 'b2000000-0000-0000-0000-000000000000'),
          0, 'private / other → not visible');
reset role;

-- ── the child path: post_photos through can_view_post() ─────────────────────────
set local role anon;
select is((select count(*)::int from public.post_photos where post_id = 'b1000000-0000-0000-0000-000000000000'),
          1, 'anon sees a photo on a public post');
select is((select count(*)::int from public.post_photos where post_id = 'b2000000-0000-0000-0000-000000000000'),
          0, 'anon cannot see a photo on a private post');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"55555555-5555-5555-5555-555555555555"}';
select is((select count(*)::int from public.post_photos where post_id = 'b2000000-0000-0000-0000-000000000000'),
          0, 'a different account cannot see a private post’s photo');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"44444444-4444-4444-4444-444444444444"}';
select is((select count(*)::int from public.post_photos where post_id = 'b2000000-0000-0000-0000-000000000000'),
          1, 'the owner sees their private post’s photo');
reset role;

select * from finish();
rollback;
