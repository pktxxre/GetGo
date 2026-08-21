-- 006_xp.sql — the append-only XP ledger, the level curve, and the derived totals view.
--
-- XP is append-only (CLAUDE.md): every XP event is a row. Balances and levels are computed
-- by aggregating the ledger, NEVER by mutating a running total. Ratings can only add XP;
-- a correction is a new row (curve_adjustment / revocation), never an UPDATE.
--
-- The phase-2 kinds are declared now so the enum never has to be ALTERed under live data
-- (altering an enum used by a column can't run in the same txn as its use, and is a
-- migration hazard once rows exist). v1 only ever writes: post, curve_adjustment, revocation.

create type xp_kind as enum (
  'post', 'curve_adjustment', 'revocation',
  -- phase 2, declared now, unused in v1:
  'awesome_received', 'save_received', 'inspired_by',
  'streak', 'spontaneity', 'group', 'live_capture_multiplier'
);

create table public.xp_ledger (
  id          bigserial primary key,
  user_id     uuid not null references public.users (id) on delete cascade,
  kind        xp_kind not null,
  source_id   uuid,        -- the post that caused it, or NULL
  template_id uuid,        -- the quest template, or NULL
  period      date,        -- ISO week start for phase-2 reception XP, or NULL in v1
  delta       integer not null,
  created_at  timestamptz not null default now()
);

-- ⚠️ NULLS NOT DISTINCT IS LOAD-BEARING. Postgres treats NULLs as distinct in a unique
-- index by default, so without this clause the constraint enforces NOTHING whenever
-- template_id or period is NULL — which is every v1 row — and XP silently double-awards on
-- every retry. Each column earns its place (CLAUDE.md gotchas): source_id stops a retried
-- insert double-awarding; template_id stops delete-then-repost farming (a re-post has a new
-- post_id, so source_id alone wouldn't catch it); period lets the phase-2 weekly job re-run
-- safely.
create unique index xp_ledger_idem
  on public.xp_ledger (user_id, kind, source_id, template_id, period)
  nulls not distinct;

create index xp_ledger_user on public.xp_ledger (user_id);

alter table public.xp_ledger enable row level security;

-- A user may read their own ledger detail; nobody writes from the client (append-only via
-- the SECURITY DEFINER create_post RPC and scheduled jobs). Aggregate totals for
-- leaderboards come from user_xp, not from raw rows.
create policy xp_own_read on public.xp_ledger
  for select using (user_id = auth.uid());

grant select on public.xp_ledger to authenticated;

-- ── level curve ─────────────────────────────────────────────────────────────────
-- Levels are DERIVED, never stored (CLAUDE.md gotchas). A gentle curve (D8): cheap early
-- levels, widening gaps. Retuning is a designed grandfather migration via curve_adjustment
-- rows, so no user is ever de-levelled by a curve change.
create table public.level_thresholds (
  level         integer primary key,
  cumulative_xp integer not null unique
);

insert into public.level_thresholds (level, cumulative_xp) values
  (1, 0), (2, 50), (3, 150), (4, 300), (5, 500),
  (6, 750), (7, 1050), (8, 1400), (9, 1800), (10, 2250);

alter table public.level_thresholds enable row level security;
create policy level_thresholds_public_read on public.level_thresholds
  for select using (true);
grant select on public.level_thresholds to anon, authenticated;

-- Pure function: the level for a given XP total is the highest threshold at or below it,
-- floored at 1. STABLE, no side effects. Used by the view and the create_post RPC so the
-- client never computes a level.
create function public.level_for_xp(xp integer) returns integer
  language sql stable as $$
    select coalesce(max(level), 1)
    from public.level_thresholds
    where cumulative_xp <= xp
  $$;

-- ── derived totals ────────────────────────────────────────────────────────────────
-- One row per user: total XP, level, progress into the current level, and XP to the next.
-- Runs as the view owner (not security_invoker) so it computes true totals for leaderboards
-- regardless of per-row ledger RLS. Granted to authenticated only — never anon, because no
-- XP surface may be reachable by a logged-out visitor (DESIGN.md).
create view public.user_xp as
select
  s.user_id,
  s.xp_total,
  public.level_for_xp(s.xp_total) as level,
  s.xp_total - coalesce(
    (select t.cumulative_xp
       from public.level_thresholds t
      where t.level = public.level_for_xp(s.xp_total)), 0) as xp_into_level,
  (select min(t.cumulative_xp) - s.xp_total
     from public.level_thresholds t
    where t.cumulative_xp > s.xp_total) as xp_for_next   -- NULL at the max level
from (
  select u.id as user_id,
         coalesce(sum(l.delta), 0)::int as xp_total
  from public.users u
  left join public.xp_ledger l on l.user_id = u.id
  group by u.id
) s;

grant select on public.user_xp to authenticated;
