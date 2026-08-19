-- 005_social.sql — ratings and saves.
--
-- Ratings are two buttons that critique the QUEST, never the person: awesome /
-- could_be_cooler (CLAUDE.md). Three invariants, all enforced here so no client can spoof
-- them: you can't rate a post you can't see, you can't rate your own post, and you can't
-- rate the same post twice. XP from ratings is append-only and can only ADD (that lives in
-- the ledger, 006 + create_post) — nothing here mutates a score.
--
-- Saves add a quest to your own log. A save targets a quest TEMPLATE, not a post (eng-plan
-- data model): saving a template-less post first mints a template — that minting is a
-- SECURITY DEFINER RPC (with T12's save flow), not a client insert, so this migration only
-- provides the table + own-row policies. Saved collections are private to their owner.

create type rating_value as enum ('awesome', 'could_be_cooler');

create table public.ratings (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  rater_id   uuid not null references public.users (id) on delete cascade,
  value      rating_value not null,
  created_at timestamptz not null default now(),

  -- no double-rating: at most one rating per (post, rater).
  constraint ratings_one_per_rater unique (post_id, rater_id)
);

create index ratings_post on public.ratings (post_id);

alter table public.ratings enable row level security;

-- Reception is public reportage on posts you can see ("31 said awesome") — including for a
-- cold anon visitor on a public post. Child path, so it goes through the helper (C1).
create policy ratings_visible on public.ratings
  for select using (public.can_view_post(post_id));

-- Casting a rating: as yourself (rater_id = auth.uid()), only on a post you can see
-- (blocks rating an invisible post), and never on your own post (no self-rating). The
-- self-rating guard reads the post's owner; that read only resolves for a post the rater
-- can already see, which is exactly the posts we permit rating on.
create policy ratings_insert on public.ratings
  for insert with check (
    rater_id = auth.uid()
    and public.can_view_post(post_id)
    and auth.uid() <> (select p.user_id from public.posts p where p.id = post_id)
  );

-- A rater may change or retract their own rating (still their own row on both sides).
create policy ratings_update on public.ratings
  for update using (rater_id = auth.uid()) with check (rater_id = auth.uid());
create policy ratings_delete on public.ratings
  for delete using (rater_id = auth.uid());

grant select on public.ratings to anon;                          -- read counts on public posts
grant select, insert, update, delete on public.ratings to authenticated;

-- ── saves ───────────────────────────────────────────────────────────────────────
create table public.saves (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  template_id uuid not null references public.quest_templates (id) on delete cascade,
  created_at  timestamptz not null default now(),

  constraint saves_one_per_user unique (user_id, template_id)    -- saving twice is idempotent
);

create index saves_user     on public.saves (user_id);
create index saves_template on public.saves (template_id);

alter table public.saves enable row level security;

-- Saves are personal — a user only ever sees and manages their own. No anon: a save needs
-- an identity (the web funnel captures one at save time).
create policy saves_own_read   on public.saves for select using (user_id = auth.uid());
create policy saves_own_insert on public.saves for insert with check (user_id = auth.uid());
create policy saves_own_delete on public.saves for delete using (user_id = auth.uid());

grant select, insert, delete on public.saves to authenticated;
