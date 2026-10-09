-- pgTAP for 024_reports. Acceptance (W3 / Guideline 1.2): a signed-in user can flag a post they
-- can see; cannot flag their own post; cannot flag an invisible post; cannot flag as someone
-- else; one flag per (reporter, post); a report is private to its reporter (moderation is
-- service-role, out of band); the note length check holds; anon cannot report at all.

begin;
select plan(11);

-- owner of the posts, a reporter, and a third party.
insert into auth.users (id, instance_id, email) values
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'owner@getgo.test'),
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'reporter@getgo.test'),
  ('77777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000', 'third@getgo.test');

-- p1 public, p2 private — both owned by 4444.
insert into public.posts (id, user_id, visibility) values
  ('b1000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'public'),
  ('b2000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'private');

select has_table('public', 'reports', 'public.reports exists');

-- ── no self-reporting: the owner cannot report their own post ─────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"44444444-4444-4444-4444-444444444444"}';
select throws_ok(
  $$ insert into public.reports (post_id, reporter_id, reason)
     values ('b1000000-0000-0000-0000-000000000000',
             '44444444-4444-4444-4444-444444444444', 'spam') $$,
  '42501', null,
  'no self-reporting: the owner cannot report their own post'
);
reset role;

-- ── a valid report, then the same reporter again → one flag per person ────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"55555555-5555-5555-5555-555555555555"}';
select lives_ok(
  $$ insert into public.reports (post_id, reporter_id, reason, note)
     values ('b1000000-0000-0000-0000-000000000000',
             '55555555-5555-5555-5555-555555555555', 'nudity', 'not ok') $$,
  'a different account can report a visible post'
);
select throws_ok(
  $$ insert into public.reports (post_id, reporter_id, reason)
     values ('b1000000-0000-0000-0000-000000000000',
             '55555555-5555-5555-5555-555555555555', 'spam') $$,
  '23505', null,
  'one flag per person: a second report from the same reporter is rejected'
);
-- ── report-as-someone-else is blocked (reporter_id must be auth.uid()) ─────────────
select throws_ok(
  $$ insert into public.reports (post_id, reporter_id, reason)
     values ('b1000000-0000-0000-0000-000000000000',
             '77777777-7777-7777-7777-777777777777', 'spam') $$,
  '42501', null,
  'a reporter cannot file under someone else’s id'
);
-- ── cannot report an invisible (private, not owned) post ──────────────────────────
select throws_ok(
  $$ insert into public.reports (post_id, reporter_id, reason)
     values ('b2000000-0000-0000-0000-000000000000',
             '55555555-5555-5555-5555-555555555555', 'spam') $$,
  '42501', null,
  'cannot report an invisible post'
);
-- ── the note length check holds (empty string is not a valid note) ────────────────
select throws_ok(
  $$ insert into public.reports (post_id, reporter_id, reason, note)
     values ('b1000000-0000-0000-0000-000000000000',
             '55555555-5555-5555-5555-555555555555', 'other', '') $$,
  '23514', null,
  'an empty note violates the length check'
);
select throws_ok(
  $$ insert into public.reports (post_id, reporter_id, reason, note)
     values ('b1000000-0000-0000-0000-000000000000',
             '55555555-5555-5555-5555-555555555555', 'other', repeat('x', 501)) $$,
  '23514', null,
  'a note over 500 chars violates the length check'
);
reset role;

-- ── a report is private to its reporter ────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"55555555-5555-5555-5555-555555555555"}';
select is(
  (select count(*)::int from public.reports where post_id = 'b1000000-0000-0000-0000-000000000000'),
  1,
  'the reporter can read their own report'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"77777777-7777-7777-7777-777777777777"}';
select is(
  (select count(*)::int from public.reports),
  0,
  'a report is private to its reporter — another account sees none of it'
);
reset role;

-- ── anon cannot report ───────────────────────────────────────────────────────────
set local role anon;
select throws_ok(
  $$ insert into public.reports (post_id, reporter_id, reason)
     values ('b1000000-0000-0000-0000-000000000000',
             '55555555-5555-5555-5555-555555555555', 'spam') $$,
  '42501', null,
  'anon cannot report — reporting needs an identity'
);
reset role;

select * from finish();
rollback;
