-- 009_quest_axes.sql — the classification axes behind the stamp block (T13).
--
-- RECORDED DECISION (the 002 comment forbids adding these "without a recorded decision" —
-- this is it). DESIGN.md → Quest detail specs a 2×2 stamp block of EFFORT / NERVE / COST /
-- RARITY, and it "replaces every badge, chip, XP counter, level and progress ring in the
-- product" — so the detail screen cannot ship without these three axes (RARITY is computed).
-- HANDOFF_NEXT.md offered exactly this as option A: add them to quest_templates, populated
-- from the curated catalog. Reversible in one migration if the representation changes.
--
-- Representation, deliberately minimal so the display copy can evolve without a migration:
--   effort, nerve  → smallint tier 1..3 (the client maps to low / mid / high)
--   cost_pence     → integer pennies, 0 = free (the client renders "free" / "£4")
-- All nullable: curated rows carry values (see seed.sql); a template minted from a redo has
-- none yet, and the stamp block renders an em-dash for an unset axis rather than inventing a
-- number. CLAUDE.md → "Quests are classified on axes, not one good/bad line" — these are
-- three of those axes; spontaneity and comfort-zone-stretch stay out of v1's stamp block.

alter table public.quest_templates
  add column effort     smallint,
  add column nerve      smallint,
  add column cost_pence integer,
  add constraint quest_templates_effort_tier check (effort is null or effort between 1 and 3),
  add constraint quest_templates_nerve_tier  check (nerve  is null or nerve  between 1 and 3),
  add constraint quest_templates_cost_nonneg check (cost_pence is null or cost_pence >= 0);

-- No RLS change: the axes ride the existing quest_templates public-read policy (the catalog
-- is world-readable, incl. cold anon). No new grant needed.
