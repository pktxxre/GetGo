-- pgTAP for 011_photos_storage. Run with `supabase test db` (local stack, real roles).
-- The photos bucket exists and is public; the storage RLS lets a user write only under their
-- own uuid prefix, blocks writing under another's, and lets anyone read.

begin;
select plan(6);

\set owner '61616161-6161-6161-6161-616161616161'
\set other '62626262-6262-6262-6262-626262626262'

-- ── the bucket ──────────────────────────────────────────────────────────────────
select is(
  (select public from storage.buckets where id = 'photos'),
  true,
  'the photos bucket exists and is public'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'storage.objects'::regclass),
  'RLS is enabled on storage.objects'
);

-- two real accounts (the mirror trigger fires on auth.users insert).
insert into auth.users (id, instance_id, email) values
  ('61616161-6161-6161-6161-616161616161', '00000000-0000-0000-0000-000000000000', 'sowner@getgo.test'),
  ('62626262-6262-6262-6262-626262626262', '00000000-0000-0000-0000-000000000000', 'sother@getgo.test');

-- ── owner writes under their own prefix ─────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"61616161-6161-6161-6161-616161616161"}';
select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('photos', '61616161-6161-6161-6161-616161616161/p1/0.jpg') $$,
  'owner can upload under their own uuid prefix'
);

-- ── owner cannot write under someone else's prefix ──────────────────────────────
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('photos', '62626262-6262-6262-6262-626262626262/p1/0.jpg') $$,
  '42501', null,
  'writing under another user''s prefix is denied by RLS'
);
reset role;

-- ── a different user likewise cannot plant a photo in the owner's folder ─────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"62626262-6262-6262-6262-626262626262"}';
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('photos', '61616161-6161-6161-6161-616161616161/p2/0.jpg') $$,
  '42501', null,
  'a stranger cannot write into the owner''s prefix'
);
reset role;

-- ── public read: anon sees the owner's uploaded object ──────────────────────────
set local role anon;
select is(
  (select count(*)::int from storage.objects
     where bucket_id = 'photos' and name = '61616161-6161-6161-6161-616161616161/p1/0.jpg'),
  1,
  'anon can read objects in the public photos bucket'
);
reset role;

select * from finish();
rollback;
