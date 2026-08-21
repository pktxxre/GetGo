-- pgTAP for 009_quest_axes. The stamp-block axes exist, keep tier/cost sane, allow NULL
-- (a redo-minted template has none yet), and stay anon-readable on the public catalog.

begin;
select plan(7);

-- ── shape ─────────────────────────────────────────────────────────────────────
select has_column('public', 'quest_templates', 'effort',     'quest_templates has effort');
select has_column('public', 'quest_templates', 'nerve',      'quest_templates has nerve');
select has_column('public', 'quest_templates', 'cost_pence', 'quest_templates has cost_pence');

-- ── constraints ─────────────────────────────────────────────────────────────────
select lives_ok(
  $$ insert into public.quest_templates (slug, title, origin, effort, nerve, cost_pence)
     values ('axes-ok', 't', 'curated', 3, 1, 0) $$,
  'valid tiers + free cost insert'
);
select throws_ok(
  $$ insert into public.quest_templates (slug, title, origin, effort)
     values ('axes-bad-tier', 't', 'curated', 4) $$,
  '23514', null,
  'an effort tier above 3 is rejected'
);
select throws_ok(
  $$ insert into public.quest_templates (slug, title, origin, cost_pence)
     values ('axes-bad-cost', 't', 'curated', -1) $$,
  '23514', null,
  'a negative cost is rejected'
);

-- ── anon reads the axes on the public catalog (policy unchanged) ─────────────────
set local role anon;
select is(
  (select effort from public.quest_templates where slug = 'axes-ok'),
  3::smallint,
  'anon reads a template effort tier'
);
reset role;

select * from finish();
rollback;
