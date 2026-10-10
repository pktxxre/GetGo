-- pgTAP for 025_blocks. Acceptance (Guideline 1.2, block half): a signed-in user can block
-- another; cannot block themselves; cannot file a block as someone else; blocking is idempotent
-- (one row per pair); a blocked author's post disappears from the blocker's feed while everyone
-- else (and the author) still sees it; unblocking restores it; blocks are private to the blocker;
-- anon cannot block.

begin;
select plan(12);

-- an author, a blocker, and an uninvolved third party.
insert into auth.users (id, instance_id, email) values
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'author@getgo.test'),
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'blocker@getgo.test'),
  ('77777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000', 'third@getgo.test');

-- one public post owned by the author.
insert into public.posts (id, user_id, visibility) values
  ('b1000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'public');

select has_table('public', 'blocks', 'public.blocks exists');

-- ── no self-block: the check constraint rejects blocking yourself ──────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"55555555-5555-5555-5555-555555555555"}';
select throws_ok(
  $$ insert into public.blocks (blocker_id, blocked_id)
     values ('55555555-5555-5555-5555-555555555555',
             '55555555-5555-5555-5555-555555555555') $$,
  '23514', null,
  'no self-block: blocker_id <> blocked_id is enforced'
);

-- ── block-as-someone-else is blocked (blocker_id must be auth.uid()) ───────────────
select throws_ok(
  $$ insert into public.blocks (blocker_id, blocked_id)
     values ('77777777-7777-7777-7777-777777777777',
             '44444444-4444-4444-4444-444444444444') $$,
  '42501', null,
  'a user cannot file a block under someone else’s id'
);

-- ── a valid block, then the same block again → one row per pair ────────────────────
select lives_ok(
  $$ insert into public.blocks (blocker_id, blocked_id)
     values ('55555555-5555-5555-5555-555555555555',
             '44444444-4444-4444-4444-444444444444') $$,
  'a user can block another user'
);
select throws_ok(
  $$ insert into public.blocks (blocker_id, blocked_id)
     values ('55555555-5555-5555-5555-555555555555',
             '44444444-4444-4444-4444-444444444444') $$,
  '23505', null,
  'one block per pair: a duplicate block is rejected'
);

-- ── the blocked author's public post is now hidden from the blocker's feed ─────────
select is(
  (select count(*)::int from public.posts where id = 'b1000000-0000-0000-0000-000000000000'),
  0,
  'the blocker no longer sees the blocked author’s post'
);
reset role;

-- ── but it's viewer-scoped: a third party still sees that public post ──────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"77777777-7777-7777-7777-777777777777"}';
select is(
  (select count(*)::int from public.posts where id = 'b1000000-0000-0000-0000-000000000000'),
  1,
  'an uninvolved user still sees the post — a block is not a takedown'
);
reset role;

-- ── and the author still sees their own post ──────────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"44444444-4444-4444-4444-444444444444"}';
select is(
  (select count(*)::int from public.posts where id = 'b1000000-0000-0000-0000-000000000000'),
  1,
  'being blocked doesn’t hide the author’s post from the author'
);
reset role;

-- ── blocks are private: the third party can't read the blocker's block rows ────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"77777777-7777-7777-7777-777777777777"}';
select is(
  (select count(*)::int from public.blocks),
  0,
  'a block is private to its blocker — another account sees none of it'
);
reset role;

-- ── the blocker can read their own block ──────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"55555555-5555-5555-5555-555555555555"}';
select is(
  (select count(*)::int from public.blocks),
  1,
  'the blocker can read their own block'
);

-- ── unblocking restores the post to the blocker's feed ────────────────────────────
delete from public.blocks
  where blocker_id = '55555555-5555-5555-5555-555555555555'
    and blocked_id = '44444444-4444-4444-4444-444444444444';
select is(
  (select count(*)::int from public.posts where id = 'b1000000-0000-0000-0000-000000000000'),
  1,
  'unblocking restores the post to the blocker’s feed'
);
reset role;

-- ── anon cannot block ─────────────────────────────────────────────────────────────
-- Clear the JWT claims too: `reset role` above drops the role but NOT request.jwt.claims, so
-- auth.uid() would otherwise still resolve to the previous test's user. A real anon request has
-- no sub, so the insert's blocker_id can't equal auth.uid() (null) and RLS rejects it.
set local request.jwt.claims to '';
set local role anon;
select throws_ok(
  $$ insert into public.blocks (blocker_id, blocked_id)
     values ('55555555-5555-5555-5555-555555555555',
             '44444444-4444-4444-4444-444444444444') $$,
  '42501', null,
  'anon cannot block — blocking needs an identity'
);
reset role;

select * from finish();
rollback;
