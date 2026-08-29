-- pgTAP for 016_post_axes. The author's classification lives on posts too, keeps tier/cost
-- sane (same bounds as 009's template axes), and allows NULL (classifying is optional).

begin;
select plan(6);

insert into auth.users (id, instance_id, email) values
  ('b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', '00000000-0000-0000-0000-000000000000', 'axesu@getgo.test');

-- ── shape ─────────────────────────────────────────────────────────────────────
select has_column('public', 'posts', 'effort',     'posts has effort');
select has_column('public', 'posts', 'nerve',      'posts has nerve');
select has_column('public', 'posts', 'cost_pence', 'posts has cost_pence');

-- ── constraints ─────────────────────────────────────────────────────────────────
select lives_ok(
  $$ insert into public.posts (id, user_id, caption, effort, nerve, cost_pence)
     values ('d1000000-0000-0000-0000-000000000000',
             'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', 'ok', 3, 1, 0) $$,
  'valid tiers + free cost on a post'
);
select throws_ok(
  $$ insert into public.posts (id, user_id, caption, nerve)
     values ('d2000000-0000-0000-0000-000000000000',
             'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', 'bad', 0) $$,
  '23514', null,
  'a nerve tier below 1 is rejected'
);
select throws_ok(
  $$ insert into public.posts (id, user_id, caption, cost_pence)
     values ('d3000000-0000-0000-0000-000000000000',
             'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', 'bad', -1) $$,
  '23514', null,
  'a negative cost is rejected'
);

select * from finish();
rollback;
