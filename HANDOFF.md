# GetGo — Build Handoff

Start here. This is the "what do I do Monday morning" doc; `CLAUDE.md` holds the
decisions and `DESIGN.md` holds the visual system.

**Status:** plan locked, zero code. Four review passes done (eng, CEO, design,
outside voice). Everything below is decided — you are implementing, not choosing.

**Full artifacts** (outside the repo, readable from any workspace):

```
~/.gstack/projects/pktxxre-GetGo/
  alexb-...-eng-plan-20260806.md          ← the locked plan, all 17 decisions + 9 corrections
  alexb-...-design-20260805-163522.md     ← office-hours: problem, premises, cold read
  alexb-...-eng-review-test-plan-...md    ← what to test and where (feeds /qa)
  tasks-eng-review-20260806-144019.jsonl  ← 25 tasks, machine-readable
```

---

## The three gates

Don't conflate them. Each has a different audience and a different bar.

| Gate | Audience | Bar |
|---|---|---|
| **Web funnel** | TikTok reach, hundreds of cold visitors | ≥25% save, ≥8% of savers post, ≥20 real posts / 7d |
| **TestFlight** | ~10 people you know | Zero crashes, full loop completes, honest feedback |
| **App Store** | Public | Guideline 1.2 + 5.1.1(v) complete, funnel cleared |

10 TestFlight users cannot produce a conversion rate — that gate is a dogfood, not
a measurement. The numbers come from the web funnel.

---

## Week one — start before you write code

These are latency and legal. They don't need a working app, and three of them
gate everything.

- [ ] **Apple Developer Program enrolment** — `developer.apple.com/programs/enroll`.
      Days to weeks for identity verification. Do it first, against a
      hello-world build. Get the bundle ID, certs, and App Store Connect record made.
- [ ] **Photo licensing decision** — the design doc says source seed photos from
      TikTok/IG. Don't. Shoot your own, or get written permission with credit.
      This changes the shape of the curation task, so decide before curating.
- [ ] **Seed content curation** — 50–100 London quests: photo, one-line title,
      neighbourhood, coordinates. 15–30 hours of human work nobody can do for you,
      and it gates all three gates. Start now, in parallel with the build.
- [ ] **Auth decision** — magic link / OTP means deep-link config (multi-day yak
      shave on Expo); any third-party social login forces Sign in with Apple
      (Guideline 4.8). Pick one and spike it before T2.
- [ ] **UGC compliance kit** — Guideline 1.2 requires all of this *at review*, not
      after: content filtering, report-content, block-user, published developer
      contact. Plus privacy policy URL, EULA, age rating, App Privacy labels.
- [ ] **Free-tier keepalive** — Supabase pauses a project after 7 days idle. A quiet
      week between the TikTok and the cohort arriving takes the backend down.
      `pg_cron` heartbeat, or be on a paid plan before any public link goes out.

---

## Build order

Serialized — this is one person. The only real parallelism is week-one work
running alongside the build.

```
T1  scaffold
     ↓
T2  001_users          T3  002_quest_templates
     ↓                      ↓
T4  003_posts + post_photos + visibility + geog/city
     ↓
T5  004_visibility     (inline on posts, helper for children)
     ↓
T6  005_social         T7  006_xp
     ↓
T8  007_create_post    ← the contract everything else waits on
     ↓
S1-S5 shell baseline   ← loading/error/back/404, see SHELL_SPEC.md
     ↓
T10 pgTAP  ·  T11 image resize  ·  T12 list+save  ·  T13 post flow
     ↓
T18 web funnel  +  T19 analytics    → VALIDATION GATE
     ↓
T21 EAS build                        → TESTFLIGHT GATE
     ↓
T9 delete_account · W3 compliance · T16 Maestro → APP STORE GATE
```

**Fix the `create_post` return shape before you start the client.** It's
`{ post, xp_total, level, leveled_up }` (D14) and both lanes depend on it.

### T1 — scaffold

```bash
npx create-expo-app@latest . --template blank-typescript
npx expo install expo-router react-native-web react-dom @expo/metro-runtime
npx expo install expo-camera expo-image expo-image-manipulator expo-location
npm install @supabase/supabase-js
npm install -D jest-expo @testing-library/react-native
supabase init
```

`react-native-web` + `@expo/metro-runtime` are what make `npx expo export --platform web`
work. That's the funnel — same codebase, same design system, no fork.

`.env` (never commit):
```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

Local loop: `supabase start` → `supabase db reset` (destructive: wipes local data,
replays migrations from scratch) → `supabase test db`.

---

## Schema — enough to start writing 001

### `001_users.sql`

```sql
create table public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  handle        text unique,              -- NULL until onboarding claims it (C6)
  bio           text,
  avatar_path   text,
  tombstoned_at timestamptz,
  created_at    timestamptz not null default now()
);

alter table public.users enable row level security;

create policy users_public_read on public.users
  for select using (tombstoned_at is null);

create policy users_self_write on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

create function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users (id) values (new.id)
  on conflict (id) do nothing;   -- idempotent: re-firing must not error
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

`handle` is nullable on purpose — it's user-chosen and doesn't exist at trigger
time. The onboarding screen claims it with a uniqueness check and a retry path.

### `006_xp.sql` — the one with a trap

```sql
create type xp_kind as enum (
  'post', 'curve_adjustment', 'revocation',
  -- phase 2, declared now so the enum never needs altering under live data:
  'awesome_received', 'save_received', 'inspired_by',
  'streak', 'spontaneity', 'group', 'live_capture_multiplier'
);

create table public.xp_ledger (
  id          bigserial primary key,
  user_id     uuid not null references public.users(id),
  kind        xp_kind not null,
  source_id   uuid,          -- post id, or NULL
  template_id uuid,          -- quest template, or NULL
  period      date,          -- ISO week start for phase-2 reception XP, or NULL
  delta       integer not null,
  created_at  timestamptz not null default now()
);

-- ⚠️ NULLS NOT DISTINCT is load-bearing. Postgres treats NULLs as distinct in a
-- unique index by default, so without this the constraint silently enforces
-- nothing whenever template_id or period is NULL — which is every v1 row.
create unique index xp_ledger_idem
  on public.xp_ledger (user_id, kind, source_id, template_id, period)
  nulls not distinct;

create index xp_ledger_user on public.xp_ledger (user_id);

create table public.level_thresholds (
  level         integer primary key,
  cumulative_xp integer not null unique
);

create function public.level_for_xp(xp integer) returns integer
  language sql stable as $$
    select coalesce(max(level), 1) from public.level_thresholds
    where cumulative_xp <= xp
  $$;

create view public.user_xp as
  select u.id as user_id,
         coalesce(sum(l.delta), 0)::int as xp_total,
         public.level_for_xp(coalesce(sum(l.delta), 0)::int) as level
  from public.users u
  left join public.xp_ledger l on l.user_id = u.id
  group by u.id;
```

That `nulls not distinct` line is the single easiest thing to get wrong in this
schema, and it fails silently — XP just quietly double-awards.

### Visibility (C1)

Inline on the hot table, helper for the rest:

```sql
-- posts: inline. No function call, index-friendly, no recursion.
create policy posts_visible on public.posts
  for select using (
    deleted_at is null
    and (visibility = 'public' or user_id = auth.uid())
  );

-- children: SECURITY DEFINER helper, row count already bounded.
create function public.can_view_post(p_post_id uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
    select exists (
      select 1 from public.posts p
      where p.id = p_post_id
        and p.deleted_at is null
        and (p.visibility = 'public' or p.user_id = auth.uid())
    )
  $$;
```

`SECURITY DEFINER` functions are **never inlined by the planner** — that's why the
helper stays off the feed query and only serves `post_photos`, `ratings`, `saves`,
and the storage policy. `set search_path = ''` is not optional: without it, a
security-definer function is a privilege-escalation vector.

---

## Acceptance criteria per task

Don't mark done without these.

| Task | Done when |
|---|---|
| T2 users | pgTAP: signup creates a row; duplicate handle rejected; trigger re-fire is a no-op |
| T3 templates | A `<->` ordered query returns nearest-first over the seed set |
| T4 posts | pgTAP: soft-deleted posts absent from feed; `visibility` defaults to `public` |
| T5 visibility | pgTAP: 5 role cases pass (public/anon, public/owner, private/owner, **private/other → false**, private/anon → false); `search_path` pinned |
| T6 social | Cannot rate an invisible post; no self-rating; no double-rating |
| T7 xp | Duplicate insert rejected; level correct **exactly on** a threshold; `curve_adjustment` counted in the sum |
| T8 create_post | 1 photo and N photos each award exactly one XP row; retry awards nothing extra; delete-then-repost awards nothing extra; partial failure rolls back fully |
| T10 pgTAP | `supabase test db` green, all 9 ★ critical paths covered |
| T11 resize | 12MB in → <500KB out, long edge ≤1600 |
| T13 post flow | Level-up animation driven by the mocked RPC response, **not** by local arithmetic |
| T18 web | Cold visitor with no account can browse and save |
| T19 analytics | All three kill/continue numbers queryable with a real visitor denominator |

---

## Things that will bite you if you forget

- **RLS fails open and silent.** A policy typo doesn't error — it leaks. This is
  why pgTAP is non-negotiable and why an RLS test written in Jest is worthless
  (the service key bypasses every policy and the test passes green).
- **`nulls not distinct`** on the ledger index. See above.
- **`set search_path = ''`** on every `SECURITY DEFINER` function.
- **Soft delete means every feed and profile query needs `deleted_at is null`.**
  Easy to forget on the seventh query. Consider a view.
- **Levels are derived, never stored.** Same rule as XP (`CLAUDE.md` gotchas). The
  only sanctioned cache is a `pg_cron`-refreshed materialized view *derived from*
  the ledger.
- **`completion_ordinal` is stamped once at insert**, and is NULL for posts with no
  template. The one documented exception: when a template is later born from a
  redo, the originating post gets ordinal 1 at template-creation time.
- **Content is not schema.** The 60 curated quests live in `content/quests.json`
  and go in via an idempotent upsert script — never a migration.
- **Don't gate CI on `EXPLAIN` picking the GiST index.** Over 100 rows the planner
  will correctly seq-scan and the gate fails. Dropped deliberately (C8).

---

## Model and effort

Opus 5 for anything under `supabase/` — the failure modes there are silent, which
is exactly where reasoning pays. Sonnet 5 for the mechanical client work (screens,
test scaffolding once the pattern is set) at roughly 60% of the cost. Start effort
at `xhigh` for agentic work and sweep down; on Opus 5, `low` and `medium` are
stronger than you'd expect.

## Ship loop

`/review` before landing a slice → `/ship` to land it. Re-run `/plan-eng-review`
only if the architecture changes, not for ordinary feature work.
