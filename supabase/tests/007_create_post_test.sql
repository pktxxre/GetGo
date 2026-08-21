-- pgTAP for 007_create_post. Acceptance (HANDOFF T8): 1 photo and N photos each award
-- exactly one XP row; a retry awards nothing extra; delete-then-repost awards nothing extra;
-- a partial failure rolls back fully. Plus photos-required and the RPC-driven leveled_up.
--
-- We call create_post as postgres but set request.jwt.claims so auth.uid() resolves to the
-- acting user — the function is SECURITY DEFINER, so this exercises the same code path a
-- real authenticated caller hits, while letting the test capture the returned jsonb.

begin;
select plan(21);

insert into auth.users (id, instance_id, email) values
  ('88888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000000', 'u1@getgo.test'),
  ('99999999-9999-9999-9999-999999999999', '00000000-0000-0000-0000-000000000000', 'u2@getgo.test'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'u3@getgo.test');
insert into public.quest_templates (id, slug, title, origin)
  values ('66666666-6666-6666-6666-666666666666', 't-post', 'x', 'curated');

select has_function('public', 'create_post', 'create_post RPC exists');

-- ── single photo on a template quest: one post, one photo, exactly one XP row ────
set local request.jwt.claims to '{"sub":"88888888-8888-8888-8888-888888888888"}';
create temporary table r_a as
  select public.create_post(
    'c1000000-0000-0000-0000-000000000000', array['photos/1.jpg'],
    '66666666-6666-6666-6666-666666666666') as j;

select is((select (j->>'xp_total')::int   from r_a), 50,   'first post awards the flat 50 xp');
select is((select (j->>'level')::int      from r_a), 2,    'level derived from the RPC response (50 → 2)');
select is((select (j->>'leveled_up')::bool from r_a), true, 'leveled_up comes from the RPC, not client math');
select is((select count(*)::int from public.post_photos
             where post_id = 'c1000000-0000-0000-0000-000000000000'), 1, 'one photo stored');
select is((select count(*)::int from public.xp_ledger
             where user_id = '88888888-8888-8888-8888-888888888888'), 1, 'exactly one XP row (1 photo)');

-- ── N photos: still exactly one XP row; ordinal increments per template ──────────
set local request.jwt.claims to '{"sub":"99999999-9999-9999-9999-999999999999"}';
select public.create_post(
  'c2000000-0000-0000-0000-000000000000',
  array['photos/a.jpg','photos/b.jpg','photos/c.jpg'],
  '66666666-6666-6666-6666-666666666666');
select is((select count(*)::int from public.post_photos
             where post_id = 'c2000000-0000-0000-0000-000000000000'), 3, 'three photos stored');
select is((select count(*)::int from public.xp_ledger
             where user_id = '99999999-9999-9999-9999-999999999999'), 1, 'exactly one XP row (N photos)');
select is((select completion_ordinal from public.posts
             where id = 'c2000000-0000-0000-0000-000000000000'), 2, 'ordinal is stamped 2nd-ever for the template');

-- ── retry (same post id) awards nothing extra ───────────────────────────────────
set local request.jwt.claims to '{"sub":"88888888-8888-8888-8888-888888888888"}';
create temporary table r_retry as
  select public.create_post(
    'c1000000-0000-0000-0000-000000000000', array['photos/1.jpg'],
    '66666666-6666-6666-6666-666666666666') as j;
select is((select (j->>'leveled_up')::bool from r_retry), false, 'a retry does not level up again');
select is((select count(*)::int from public.xp_ledger
             where user_id = '88888888-8888-8888-8888-888888888888'), 1, 'retry adds no XP row');
select is((select count(*)::int from public.post_photos
             where post_id = 'c1000000-0000-0000-0000-000000000000'), 1, 'retry adds no duplicate photo');

-- ── delete-then-repost the same template awards nothing extra (C2) ───────────────
update public.posts set deleted_at = now() where id = 'c1000000-0000-0000-0000-000000000000';
select public.create_post(
  'c3000000-0000-0000-0000-000000000000', array['photos/again.jpg'],
  '66666666-6666-6666-6666-666666666666');   -- new post id, same template
select is((select coalesce(sum(delta),0)::int from public.xp_ledger
             where user_id = '88888888-8888-8888-8888-888888888888'), 50,
          'reposting the same quest after deleting awards no new XP');

-- ── a partial failure rolls back fully (bad template FK → nothing persists) ──────
set local request.jwt.claims to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';
select throws_ok(
  $$ select public.create_post(
       'c9000000-0000-0000-0000-000000000000', array['photos/z.jpg'],
       'deadbeef-dead-dead-dead-deaddeaddead') $$,
  '23503', null,
  'a create_post that fails partway raises (FK violation)'
);
select is((select count(*)::int from public.posts
             where id = 'c9000000-0000-0000-0000-000000000000'), 0,
          'nothing persists after a failed create_post');

-- ── photos are required ─────────────────────────────────────────────────────────
select throws_ok(
  $$ select public.create_post(
       'c8000000-0000-0000-0000-000000000000', array[]::text[],
       '66666666-6666-6666-6666-666666666666') $$,
  '23514', null,
  'a post with no photos is rejected'
);

-- ── photo dimensions are stored when supplied, so the masonry reserves geometry (012) ──
set local request.jwt.claims to '{"sub":"88888888-8888-8888-8888-888888888888"}';
select public.create_post(
  p_post_id       => 'c5000000-0000-0000-0000-000000000000',
  p_photo_paths   => array['photos/dim1.jpg','photos/dim2.jpg'],
  p_template_id   => '66666666-6666-6666-6666-666666666666',
  p_photo_widths  => array[1200, 800],
  p_photo_heights => array[1500, 800]
);
select is(
  (select width::int  from public.post_photos where post_id = 'c5000000-0000-0000-0000-000000000000' and idx = 0),
  1200, 'first photo width is stored');
select is(
  (select height::int from public.post_photos where post_id = 'c5000000-0000-0000-0000-000000000000' and idx = 1),
  800,  'second photo height is stored, zipped by position');

-- ── omitting dims still works and leaves them NULL (pre-012 behaviour preserved) ────
select public.create_post(
  p_post_id     => 'c6000000-0000-0000-0000-000000000000',
  p_photo_paths => array['photos/nodim.jpg'],
  p_template_id => '66666666-6666-6666-6666-666666666666'
);
select is(
  (select width from public.post_photos where post_id = 'c6000000-0000-0000-0000-000000000000' and idx = 0),
  null, 'a post without dims stores NULL width (feed falls back to default aspect)');

-- ── the quest name (p_title) is stored, and NULL when omitted (013/014) ─────────────
set local request.jwt.claims to '{"sub":"88888888-8888-8888-8888-888888888888"}';
select public.create_post(
  p_post_id     => 'c7000000-0000-0000-0000-000000000000',
  p_photo_paths => array['photos/named.jpg'],
  p_template_id => '66666666-6666-6666-6666-666666666666',
  p_title       => 'swim the ponds at dawn'
);
select is(
  (select title from public.posts where id = 'c7000000-0000-0000-0000-000000000000'),
  'swim the ponds at dawn', 'p_title is stored on the post');
select is(
  (select title from public.posts where id = 'c5000000-0000-0000-0000-000000000000'),
  null, 'a post created without p_title has NULL title');

select * from finish();
rollback;
