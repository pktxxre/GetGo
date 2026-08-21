-- pgTAP for 006_xp. Acceptance (HANDOFF T7): duplicate insert rejected; level correct
-- EXACTLY ON a threshold; curve_adjustment counted in the sum. Plus the nulls-not-distinct
-- trap itself, and revocation counted.

begin;
select plan(13);

insert into auth.users (id, instance_id, email) values
  ('88888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000000', 'a@getgo.test'),
  ('99999999-9999-9999-9999-999999999999', '00000000-0000-0000-0000-000000000000', 'b@getgo.test');

select has_table('public', 'xp_ledger', 'public.xp_ledger exists');
select has_view('public', 'user_xp', 'public.user_xp view exists');

-- ── THE TRAP: nulls not distinct. A v1 post row has NULL template_id/period, so two
--    identical inserts MUST collide. Without `nulls not distinct` they would both succeed
--    and XP would silently double. ───────────────────────────────────────────────
insert into public.xp_ledger (user_id, kind, source_id, template_id, period, delta)
  values ('88888888-8888-8888-8888-888888888888', 'post', null, null, null, 50);
select throws_ok(
  $$ insert into public.xp_ledger (user_id, kind, source_id, template_id, period, delta)
     values ('88888888-8888-8888-8888-888888888888', 'post', null, null, null, 50) $$,
  '23505', null,
  'nulls not distinct: an identical all-null-key row is rejected (no silent double-award)'
);

-- Different source_id (two distinct template-less posts) each earn.
select lives_ok(
  $$ insert into public.xp_ledger (user_id, kind, source_id, delta)
     values ('88888888-8888-8888-8888-888888888888', 'post',
             'a1111111-1111-1111-1111-111111111111', 50) $$,
  'a post with a distinct source_id earns'
);
select throws_ok(
  $$ insert into public.xp_ledger (user_id, kind, source_id, delta)
     values ('88888888-8888-8888-8888-888888888888', 'post',
             'a1111111-1111-1111-1111-111111111111', 50) $$,
  '23505', null,
  'the same source_id twice (a retry) is rejected'
);

-- ── level_for_xp: correct AT a threshold and just below it ──────────────────────
select is(public.level_for_xp(0),   1, 'level 1 at 0 xp');
select is(public.level_for_xp(150), 3, 'level correct EXACTLY on the level-3 threshold (150)');
select is(public.level_for_xp(149), 2, 'one XP below the threshold is still level 2');
select is(public.level_for_xp(9999), 10, 'caps at the top defined level');

-- ── curve_adjustment and revocation both count in the sum ───────────────────────
insert into public.xp_ledger (user_id, kind, source_id, delta) values
  ('99999999-9999-9999-9999-999999999999', 'post', 'b1111111-1111-1111-1111-111111111111', 50);
insert into public.xp_ledger (user_id, kind, delta) values
  ('99999999-9999-9999-9999-999999999999', 'curve_adjustment', 100);
select is(
  (select xp_total from public.user_xp where user_id = '99999999-9999-9999-9999-999999999999'),
  150,
  'curve_adjustment is counted in the XP sum'
);
select is(
  (select level from public.user_xp where user_id = '99999999-9999-9999-9999-999999999999'),
  3,
  'the derived level reflects the ledger sum (150 → level 3)'
);
select is(
  (select xp_for_next from public.user_xp where user_id = '99999999-9999-9999-9999-999999999999'),
  150,
  'xp_for_next = next threshold (300) − current total (150)'
);

-- a revocation is a negative row, not an UPDATE; it lowers the derived total.
insert into public.xp_ledger (user_id, kind, source_id, delta) values
  ('99999999-9999-9999-9999-999999999999', 'revocation', 'b1111111-1111-1111-1111-111111111111', -50);
select is(
  (select level from public.user_xp where user_id = '99999999-9999-9999-9999-999999999999'),
  2,
  'a revocation row lowers the total (150 → 100 → level 2)'
);

select * from finish();
rollback;
