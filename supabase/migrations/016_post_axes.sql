-- 016_post_axes.sql — the author classifies their quest at post time.
--
-- Why axes live on posts too (009 put them on quest_templates). A first-of-its-kind post has
-- no template yet — the template is minted later, on someone else's first save (015) — so the
-- author's effort/nerve/cost had nowhere to live between post time and mint time. That's why a
-- minted template showed "—" for every axis: nothing captured them. These columns are that
-- home. The mint (018) copies them onto the template, exactly as it already copies title and
-- geog: post carries it → mint copies it → the stamp block reads it off the template.
--
-- Representation mirrors 009 exactly (smallint tier 1..3, cost in pennies, 0 = free) so the
-- copy at mint time is a straight column-to-column move and the display code is unchanged.
-- All nullable: naming and classifying stay optional at compose, and an unset axis renders an
-- em-dash rather than an invented number. CLAUDE.md → "Quests are classified on axes, not one
-- good/bad line" — these are three of those axes.
--
-- A redo post (template already set) may also carry these, but the detail screen reads axes
-- off the template, so a redo's post-level axes are simply inert — the quest is already
-- classified by whoever first posted it. No RLS change: the columns ride the existing posts
-- policies (003), the same way 013's title column did.

alter table public.posts
  add column effort     smallint,
  add column nerve      smallint,
  add column cost_pence integer,
  add constraint posts_effort_tier check (effort is null or effort between 1 and 3),
  add constraint posts_nerve_tier  check (nerve  is null or nerve  between 1 and 3),
  add constraint posts_cost_nonneg check (cost_pence is null or cost_pence >= 0);
