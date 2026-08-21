-- pgTAP for 008_photo_dimensions. The columns the masonry reserves geometry from must
-- exist, reject nonsense dimensions, and — since they ride an existing table — stay
-- readable through post_photos' unchanged can_view_post() policy for a cold anon visitor.

begin;
select plan(6);

insert into auth.users (id, instance_id, email) values
  ('88888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000000', 'dims@getgo.test');
insert into public.quest_templates (id, slug, title, origin)
  values ('99999999-9999-9999-9999-999999999999', 't-dims', 'x', 'curated');
insert into public.posts (id, user_id, template_id, completion_ordinal, visibility)
  values ('c1000000-0000-0000-0000-000000000000', '88888888-8888-8888-8888-888888888888',
          '99999999-9999-9999-9999-999999999999', 1, 'public');

-- ── shape ─────────────────────────────────────────────────────────────────────
select has_column('public', 'post_photos', 'width',  'post_photos has width');
select has_column('public', 'post_photos', 'height', 'post_photos has height');

-- ── dimensions, when present, are positive; NULL stays legal ────────────────────
select lives_ok(
  $$ insert into public.post_photos (post_id, storage_path, idx, width, height)
     values ('c1000000-0000-0000-0000-000000000000', 'seed/a.jpg', 0, 600, 800) $$,
  'a photo with positive dimensions inserts'
);
select lives_ok(
  $$ insert into public.post_photos (post_id, storage_path, idx)
     values ('c1000000-0000-0000-0000-000000000000', 'seed/b.jpg', 1) $$,
  'a photo with NULL dimensions still inserts (pre-RPC-threading)'
);
select throws_ok(
  $$ insert into public.post_photos (post_id, storage_path, idx, width, height)
     values ('c1000000-0000-0000-0000-000000000000', 'seed/c.jpg', 2, 0, 800) $$,
  '23514', null,
  'a non-positive dimension is rejected'
);

-- ── anon reads the dimensions on a public post (policy unchanged) ────────────────
set local role anon;
select is(
  (select width from public.post_photos
     where post_id = 'c1000000-0000-0000-0000-000000000000' and idx = 0),
  600,
  'anon reads photo width through the unchanged post_photos policy'
);
reset role;

select * from finish();
rollback;
