-- 002_quest_templates.sql — the quest catalog (CLAUDE.md → Data model; eng plan D5).
--
-- This one table is BOTH the curated seed index and the store of templates born from a
-- redo. Curated London quests are rows with origin='curated'; a template minted when
-- someone redoes a post carries origin='user'. Same table, two origins — which is why
-- rarity is just COUNT(posts WHERE template_id = X) and needs no separate counter, and
-- why there's never a later "merge curated into templates" migration.
--
-- Columns match the LOCKED eng-plan data model exactly (id, slug, title, neighbourhood,
-- geog, origin). The effort/nerve/cost axes shown in the DESIGN.md stamp block are NOT
-- in the v1 model — do not add them here without a recorded decision.

-- PostGIS lives in the `extensions` schema (Supabase convention); that schema is on the
-- search_path for postgres/anon/authenticated, so `geography`, ST_* and the `<->` KNN
-- operator resolve unqualified. First use of geography in the schema, so enable it here.
create extension if not exists postgis with schema extensions;

create type quest_origin as enum ('curated', 'user');

create table public.quest_templates (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,             -- stable human key; seed upserts key on it
  title         text not null,
  neighbourhood text,
  geog          geography(Point, 4326),           -- where the quest is; drives nearest-first
  origin        quest_origin not null,
  created_by    uuid references public.users (id),-- NULL for curated; the redoer for 'user'
  created_at    timestamptz not null default now(),

  -- Origin and authorship are coupled: curated quests are authorless catalog seed; a
  -- user-minted template must name the person whose redo created it.
  constraint quest_templates_origin_author check (
    (origin = 'curated' and created_by is null)
    or (origin = 'user' and created_by is not null)
  )
);

-- GiST index for the nearest-first (`<->`) quest list. At 50-100 rows the planner will
-- correctly seq-scan (C8) — the index earns its keep as the catalog grows, and costs
-- nothing now. Do NOT gate CI on EXPLAIN picking it.
create index quest_templates_geog on public.quest_templates using gist (geog);

alter table public.quest_templates enable row level security;

-- The catalog is public: curated and user-minted templates are browseable by anyone,
-- including cold anon web visitors. There are no private templates (privacy is per-post).
create policy quest_templates_public_read on public.quest_templates
  for select using (true);

-- No client INSERT/UPDATE policy: curated rows come from the seed upsert (service role),
-- user rows are minted inside a SECURITY DEFINER redo RPC. Clients only read.
grant select on public.quest_templates to anon, authenticated;
