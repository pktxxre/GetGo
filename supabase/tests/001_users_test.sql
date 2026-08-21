-- pgTAP for 001_users. Run with `supabase test db` (local stack, real roles).
-- Acceptance (HANDOFF T2): signup creates a row; duplicate handle rejected; trigger
-- re-fire is a no-op. Plus the users RLS read policy (every policy ships with a test).

begin;
select plan(11);

-- Fixed ids so assertions can reference them.
\set user_one '11111111-1111-1111-1111-111111111111'
\set user_two '22222222-2222-2222-2222-222222222222'

-- ── shape ─────────────────────────────────────────────────────────────────────
select has_table('public', 'users', 'public.users exists');
select has_column('public', 'users', 'handle', 'users.handle exists');
select col_is_pk('public', 'users', 'id', 'users.id is the primary key');

-- ── the trigger mirrors auth.users → public.users ───────────────────────────────
select lives_ok(
  $$ insert into auth.users (id, instance_id, email)
     values ('11111111-1111-1111-1111-111111111111',
             '00000000-0000-0000-0000-000000000000', 'one@getgo.test') $$,
  'a signup insert into auth.users succeeds'
);
select is(
  (select count(*)::int from public.users where id = :'user_one'),
  1,
  'signup created exactly one public.users row'
);
select is(
  (select handle from public.users where id = :'user_one'),
  null,
  'handle is NULL until onboarding claims it (C6)'
);

-- ── handle uniqueness ───────────────────────────────────────────────────────────
update public.users set handle = 'scenic_route' where id = :'user_one';

insert into auth.users (id, instance_id, email)
values ('22222222-2222-2222-2222-222222222222',
        '00000000-0000-0000-0000-000000000000', 'two@getgo.test');

select throws_ok(
  $$ update public.users set handle = 'scenic_route'
     where id = '22222222-2222-2222-2222-222222222222' $$,
  '23505',
  null,
  'a duplicate handle is rejected (unique violation)'
);

-- ── the mirror insert is idempotent — a re-fired trigger is a no-op, not an error ─
select lives_ok(
  $$ insert into public.users (id)
     values ('11111111-1111-1111-1111-111111111111')
     on conflict (id) do nothing $$,
  're-inserting an existing mirror row is a no-op'
);
select is(
  (select count(*)::int from public.users where id = :'user_one'),
  1,
  'still exactly one row after the re-fire'
);

-- ── RLS read policy: live profiles visible, tombstoned ones hidden ──────────────
set local role anon;
select is(
  (select count(*)::int from public.users where id = :'user_one'),
  1,
  'anon can read a live profile'
);
reset role;

update public.users set tombstoned_at = now() where id = :'user_two';

set local role anon;
select is(
  (select count(*)::int from public.users where id = :'user_two'),
  0,
  'anon cannot see a tombstoned profile'
);
reset role;

select * from finish();
rollback;
