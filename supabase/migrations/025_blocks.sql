-- 025_blocks.sql — user blocks (App Store Guideline 1.2, the block half; 024 was the report half).
--
-- Guideline 1.2 requires a UGC app to let users BOTH flag content (024_reports) AND block abusive
-- users. This is the block. A block is one row a signed-in user files against another user: "I no
-- longer want to see this person." It hides the blocked author's posts from the blocker across
-- every surface that reads `posts` (feed, nearby, a user's profile, quest detail) — see the
-- posts_visible extension below.
--
-- Deliberately ONE-DIRECTIONAL and viewer-scoped, which fits the app's shape:
--   * There are no comments and no DMs. The only way one user's content reaches another is by
--     being seen in a feed/profile. Severing that one channel — "I don't see them" — is the whole
--     of what blocking can mean here, so hiding the blocked user FROM the blocker is sufficient;
--     there's no harassment surface left to close in the other direction. (Ratings are anonymous
--     two-button aggregates — the blocker never learns who rated — so they aren't a vector.)
--   * It's a viewer preference computed per auth.uid(), NOT a follower relationship graph, so it
--     stays consistent with "privacy is per-post, no follows in v1" (CLAUDE.md). A blocked post is
--     still public to everyone else; block is a hide, not a privacy/security boundary. That's also
--     why the block filter lives only on the posts read path and NOT in can_view_post() (the child
--     helper stays lean, C1) — the content isn't secret, and every app surface reads posts first.
--
-- Same own-row RLS shape as saves (005): a user only ever sees and manages their own block rows.

create table public.blocks (
  blocker_id uuid not null references public.users (id) on delete cascade,
  blocked_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),

  -- one block per (blocker, blocked); blocking twice is idempotent (client upserts).
  primary key (blocker_id, blocked_id),
  -- you can't block yourself.
  constraint blocks_no_self check (blocker_id <> blocked_id)
);

-- The feed filter probes "who has THIS viewer blocked?" — the PK's (blocker_id, blocked_id)
-- prefix already indexes that lookup, so no extra index is needed.

alter table public.blocks enable row level security;

-- A block is personal, exactly like a save: you only see and manage your own. No anon — blocking
-- needs an identity. Moderation never reads this table (blocks are a user preference, not a report).
create policy blocks_own_read   on public.blocks for select using (blocker_id = auth.uid());
create policy blocks_own_insert on public.blocks for insert with check (blocker_id = auth.uid());
create policy blocks_own_delete on public.blocks for delete using (blocker_id = auth.uid());

grant select, insert, delete on public.blocks to authenticated;

-- ── extend the hot-path posts visibility ─────────────────────────────────────────
-- Add one clause to the inline feed predicate (003): a post is hidden if the viewer has blocked
-- its author. Kept inline (not via a SECURITY DEFINER helper) because this is the hot path and a
-- helper is never inlined by the planner (C1); a plain correlated subquery is. For an anon viewer
-- auth.uid() is null, the subquery matches nothing, and nothing is filtered — anon is unaffected.
drop policy posts_visible on public.posts;
create policy posts_visible on public.posts
  for select using (
    deleted_at is null
    and (visibility = 'public' or user_id = auth.uid())
    and not exists (
      select 1 from public.blocks b
      where b.blocker_id = auth.uid() and b.blocked_id = posts.user_id
    )
  );
