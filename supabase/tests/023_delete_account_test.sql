-- pgTAP for 023_delete_account. The load-bearing property: after A deletes their account, B's
-- history is untouched — B's stamped ordinal, the template, the rarity count, and A's rating on
-- B's post all survive. Plus the teardown itself: profile tombstoned + scrubbed, posts
-- soft-deleted, auth login banned + email scrubbed, ledger left alone, and signed-in-only.

begin;
select plan(15);

\set a 'aaaa0000-0000-0000-0000-000000000000'
\set b 'bbbb0000-0000-0000-0000-000000000000'

insert into auth.users (id, instance_id, email) values
  ('aaaa0000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'a@getgo.test'),
  ('bbbb0000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'b@getgo.test');
-- the mirror trigger made public.users rows; claim A's handle so we can prove it's freed
update public.users set handle = 'deleter' where id = :'a'::uuid;
update public.users set handle = 'bystander' where id = :'b'::uuid;

insert into public.quest_templates (id, slug, title, origin)
  values ('7e000000-0000-0000-0000-000000000000', 't-del', 'shared quest', 'curated');

-- A and B both completed the same quest; ordinals stamped 1 and 2.
insert into public.posts (id, user_id, template_id, caption, visibility, completion_ordinal) values
  ('a1000000-0000-0000-0000-000000000000', :'a'::uuid, '7e000000-0000-0000-0000-000000000000', 'A did it', 'public', 1),
  ('b1000000-0000-0000-0000-000000000000', :'b'::uuid, '7e000000-0000-0000-0000-000000000000', 'B did it', 'public', 2);

-- A rated B's post (part of B's reception) and A has a ledger row (append-only history).
insert into public.ratings (post_id, rater_id, value)
  values ('b1000000-0000-0000-0000-000000000000', :'a'::uuid, 'awesome');
insert into public.xp_ledger (user_id, kind, template_id, delta)
  values (:'a'::uuid, 'post', '7e000000-0000-0000-0000-000000000000', 50);

-- ── shape + security ────────────────────────────────────────────────────────────
select has_function('public', 'delete_account', 'delete_account() exists');
select is((select prosecdef from pg_proc where proname = 'delete_account'), true, 'delete_account is SECURITY DEFINER');
select ok((select proconfig from pg_proc where proname = 'delete_account') @> array['search_path=""'],
          'delete_account pins search_path to empty');

-- ── A deletes their own account ───────────────────────────────────────────────────
set local request.jwt.claims to '{"sub":"aaaa0000-0000-0000-0000-000000000000"}';
select public.delete_account();

-- teardown of A
select isnt((select tombstoned_at from public.users where id = :'a'::uuid), null, 'A profile is tombstoned');
select is((select handle from public.users where id = :'a'::uuid), null, 'A handle is scrubbed (freed for reuse)');
select isnt((select deleted_at from public.posts where id = 'a1000000-0000-0000-0000-000000000000'), null,
            'A post is soft-deleted (leaves the feed)');

-- ── the invariant: B's history is untouched ───────────────────────────────────────
select is((select completion_ordinal from public.posts where id = 'b1000000-0000-0000-0000-000000000000'),
          2, 'bystander ordinal is unchanged');
select is((select deleted_at from public.posts where id = 'b1000000-0000-0000-0000-000000000000'), null,
          'bystander post is still live');
select is((select count(*)::int from public.posts where template_id = '7e000000-0000-0000-0000-000000000000'),
          2, 'rarity count (posts on template, incl. soft-deleted) does not move');
select is((select count(*)::int from public.ratings
             where post_id = 'b1000000-0000-0000-0000-000000000000' and rater_id = :'a'::uuid),
          1, 'the rating on the bystander post survives (reception not rewritten)');
select is((select count(*)::int from public.xp_ledger where user_id = :'a'::uuid), 1,
          'the append-only ledger is left intact');

-- ── auth login is disabled + PII scrubbed (row kept, so no cascade) ────────────────
select is((select banned_until from auth.users where id = :'a'::uuid), 'infinity'::timestamptz,
          'auth login is banned (cannot sign back in)');
select ok((select email from auth.users where id = :'a'::uuid) like 'deleted-%@getgo.invalid',
          'auth email is scrubbed to a tombstone');

-- ── anon cannot see the tombstoned profile ─────────────────────────────────────────
set local request.jwt.claims to '';
set local role anon;
select is((select count(*)::int from public.users where id = :'a'::uuid), 0,
          'the tombstoned profile is hidden from reads');
reset role;

-- ── must be signed in ──────────────────────────────────────────────────────────────
set local request.jwt.claims to '{}';
select throws_ok($$ select public.delete_account() $$, '42501', null, 'deleting while signed out is denied');

select * from finish();
rollback;
