-- 003_posts.sql — posts (= completed quests) and their photos.
--
-- A post IS a completed quest (CLAUDE.md → core decisions): there is no separate quest vs
-- completion entity for the feed, which is why the leaderboard is one query over posts +
-- ledger. A quest template exists only once someone saves/redoes it, so template_id is
-- nullable — a first-of-its-kind post has no template yet.
--
-- Decisions folded in: per-post visibility (D10), inline visibility predicate on this hot
-- table (C1), geog+city on posts so template-less posts still have a location for phase-2
-- city leaderboards (C4), completion_ordinal stamped at insert and NULL without a template
-- (C5), soft delete so a removed post leaves the feed but its ledger history survives.

-- Put extensions on the path (postgis was enabled in 002): the bare `geography` column and the
-- gist default-opclass below don't resolve under db push's login role otherwise. See 002 for the
-- full note; plain `set` because db push may not wrap each migration in a transaction.
set search_path = public, extensions;

create type post_visibility as enum ('public', 'private');

create table public.posts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users (id) on delete cascade,
  template_id        uuid references public.quest_templates (id),  -- NULL = no template yet
  caption            text,
  visibility         post_visibility not null default 'public',
  completion_ordinal integer,                       -- "you're the 4th ever"; stamped by create_post
  geog               geography(Point, 4326),        -- where it happened (C4)
  city               text not null default 'London',-- city-scoped leaderboards (C4)
  created_at         timestamptz not null default now(),
  deleted_at         timestamptz,                   -- soft delete; feed filters deleted_at is null

  -- C5 invariant: a template-less post has no ordinal. A template later born from a redo
  -- sets template_id AND the originating post's ordinal together, so this still holds. An
  -- ordinal, when present, is a positive rank.
  constraint posts_ordinal_needs_template
    check (completion_ordinal is null or template_id is not null),
  constraint posts_ordinal_positive
    check (completion_ordinal is null or completion_ordinal > 0)
);

-- Feed reads the newest live posts; rarity counts group by template_id.
create index posts_feed         on public.posts (created_at desc) where deleted_at is null;
create index posts_user         on public.posts (user_id);
create index posts_template     on public.posts (template_id) where template_id is not null;
create index posts_geog         on public.posts using gist (geog);

alter table public.posts enable row level security;

-- THE HOT PATH. Written inline, not through a helper: a SECURITY DEFINER function is never
-- inlined by the planner (C1), so a helper here would cost a per-row function call on the
-- feed. A post is visible when it's live and either public or the viewer's own. Soft-deleted
-- posts are invisible to everyone, including their owner, on the feed path.
create policy posts_visible on public.posts
  for select using (
    deleted_at is null
    and (visibility = 'public' or user_id = auth.uid())
  );

-- Clients read; writes go through the create_post RPC (SECURITY DEFINER, T8), so no client
-- INSERT/UPDATE/DELETE policy here. anon reads public posts (cold web funnel), authenticated
-- additionally sees its own private posts via the policy above.
grant select on public.posts to anon, authenticated;

-- ── post_photos — 1:N, a post can carry several ─────────────────────────────────
create table public.post_photos (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts (id) on delete cascade,
  storage_path text not null,                       -- object key in the photos bucket
  idx          integer not null default 0,          -- display order within the post
  created_at   timestamptz not null default now(),

  constraint post_photos_idx_unique unique (post_id, idx)
);

create index post_photos_post on public.post_photos (post_id);

-- RLS enabled here; the read policy + grant live in 004_visibility, where they go through
-- can_view_post() — the bounded child path (C1). Until then the table denies all reads,
-- which is the safe default for a table that ships in the very next migration.
alter table public.post_photos enable row level security;
