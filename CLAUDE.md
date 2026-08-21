# GetGo

A social quest diary — "Pinterest/Instagram for sidequests." Users post sidequests they
actually went on (photo + caption), others rate them, save them to their own quest log,
and get inspired to do them. The community is the content engine; the app never assigns
quests. A post **is** a completed quest, which is why the leaderboard falls out of a single
query. London-only at launch.

> This file documents decisions and conventions that aren't obvious from the code. It is
> intentionally lean. Standard React Native / Expo / Supabase conventions are assumed —
> don't restate them here.

> **Continuing the build? Read `HANDOFF_NEXT.md` first** — it holds the current state and the
> recommended next step, newest entry at the top.

## Stack

- **App:** React Native via **Expo** (managed workflow), TypeScript.
- **Backend:** **Supabase** — auth, Postgres, storage (photos). No custom server; business
  logic lives in Postgres (RPCs, triggers, RLS) and the client.
- **XP / leaderboards:** an append-only **XP ledger** table. Balances and rankings are
  computed by aggregating the ledger, never by mutating a running total.

## Core architectural decisions

These are deliberate and load-bearing — don't "simplify" them away without checking here first.

- **A post is a completed quest.** There is no separate "quest" vs "completion" entity for
  the feed. A quest template exists only once someone else saves/redoes it. This is why the
  leaderboard is one query over posts + ledger.
- **XP is append-only.** Every XP event is a row in the ledger (post, awesome-received,
  camera-multiplier, save-received, inspired-by, streak, spontaneity, group). Ratings can
  only **add** XP, never subtract. Never `UPDATE` a user's XP total.
- **Reception XP is scored relative to the weekly median, not raw counts.** A post's
  reception XP is a function of how it performed vs. the median post that week. This
  self-normalizes as the app grows and stops big accounts from out-earning newcomers on
  boring quests. Do not switch to absolute like-counts.
- **Rarity is computed, never voted.** Show "3,412 people have done this" / "you're the 4th
  ever" — a count, not an opinion. No one votes a quest good/bad.
- **Quests are classified on axes, not one good/bad line.** Effort, nerve, cost,
  spontaneity, plus computed rarity (and, later, a per-person comfort-zone-stretch score).
  Multiple leaderboards ("most beautiful," "most unhinged," "rarest") — everyone can top
  something. Never collapse this to a single difficulty ladder.
- **Ratings are two buttons: `Awesome` / `Could Be Cooler`.** They critique the quest,
  never the person.
- **Privacy is per-post, not per-account.** Every post carries a `visibility` of `public`
  or `private`; there are no private *accounts* and no follower-approval graph. This is
  why `follows` isn't in v1 — an account-level private mode is the only thing that needs
  it. (Saved collections *can* be private too.)
- **Photos are required on every post, and the bonus for them is folded into the flat
  post award.** A universal bonus isn't a multiplier, so there's only one `post` ledger
  kind, one amount. The real multiplier arrives later with BeReal-style live capture,
  which is genuinely differentiating and can be server-verified by a capture token. The
  in-app camera is *not* anti-cheat — a camera cannot prove what was in front of it.
- **Leaderboards are city-scoped** (launch: London). Two axes: Top Quests (best-rated posts)
  and Top Questers (XP ranking). **Phase 2** — they depend on median-relative reception XP,
  which needs weekly volume that doesn't exist at launch.
- **Anything a user is told becomes a stamped fact; anything that's a live total is
  computed.** Stamped and append-only: XP ledger rows, `posts.completion_ordinal` ("you're
  the 4th ever"), future achievement unlocks. Computed fresh and never stored: levels,
  rarity counts ("3,412 have done this"), leaderboard rank. This is what stops one user's
  later actions — including deleting their account — from rewriting another user's history.

## Data model (intent)

Six core tables + the XP ledger. When you touch schema, keep it to this shape unless there's
a decision recorded above:

`users`, `posts` (= completed quests), `post_photos` (1:N — a post can carry several),
`saves`, `ratings`, `quest_templates`, and `xp_ledger` (append-only).

- **`quest_templates` is also the curated seed index.** The 50–100 hand-curated London
  quests are template rows with `origin='curated'`; templates born from a redo carry
  `origin='user'`. Same table, two origins — which is why rarity is just
  `COUNT(posts WHERE template_id = X)` and needs no separate counter.
- **`users` is a `public` mirror of `auth.users`**, keyed to the same uuid and populated by
  a trigger on signup. `handle` is user-chosen and therefore `NULL` until an onboarding
  screen claims it — it can't exist at trigger time.
- **`follows` is not in v1.** See the privacy decision above.

## Conventions

- **Migrations:** all schema changes go through Supabase migrations in `supabase/migrations/`.
  Never edit the hosted schema by hand — it won't survive a reset.
- **RLS is not optional.** Every new table ships with row-level security policies in the same
  migration. A table without policies is a bug.
- **Money/XP math lives in Postgres** (RPC or trigger), not the client, so it can't be
  spoofed. The client displays; the DB decides.
- **Copy/voice:** lowercase, playful, blunt-but-kind (see mockups: "what's new",
  "could be cooler", "taking the scenic route!"). Match it in UI strings.

## Commands

> Fill in exact scripts once the Expo app is scaffolded. Non-obvious ones go here; anything
> discoverable from `package.json` does not.

- Local Supabase + apply migrations: `supabase start` then `supabase db reset` (reset is
  destructive — it wipes local data and replays migrations from scratch).
- Env vars the app needs (put in `.env`, never commit): `EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`. The `EXPO_PUBLIC_` prefix is required or Expo won't expose
  them to the client bundle.

## Testing

Every RLS policy and every XP path ships with a test. Non-negotiable.

- **Postgres — pgTAP via `supabase test db`.** This is where RLS, the XP trigger, the
  `create_post` RPC, and the level curve are tested.
- **Client — Jest (`jest-expo`) + React Native Testing Library**, via `npm test`.
- **E2E — Maestro.** App Store gate, not launch.

- **RLS cannot be tested from Jest.** A Node test using the service key bypasses every
  policy and passes cheerfully while private posts are world-readable. RLS is only
  meaningful when a query runs as a real role with a real `auth.uid()`, which is what
  pgTAP does and a JavaScript runner structurally cannot. If you see an RLS "test" in
  Jest, it is testing nothing.

## Gotchas

- **Leaderboard queries can't trust a stored XP column** — there isn't one. Aggregate the
  ledger. If you see a `users.xp` field, that's a caching bug, not a source of truth. The
  same applies to **level**: it's derived from the ledger via `level_for_xp()`, never
  stored. The one sanctioned cache is a `pg_cron`-refreshed materialized view *derived
  from* the ledger — never a column that replaces it.
- **Median-relative scoring needs the week's median first**, so reception XP is finalized on
  a schedule (weekly), not at post time. Post-time XP = the flat post award only.
- **The XP ledger's uniqueness key is `(user_id, kind, source_id, template_id, period)`.**
  Each part earns its place: `source_id` stops a retried insert double-awarding,
  `template_id` stops delete-then-repost farming (a re-post has a new `post_id`, so
  `source_id` alone doesn't catch it), and `period` is what lets the phase-2 weekly
  reception job be re-run or corrected safely.
- **`SECURITY DEFINER` functions are never inlined by the planner.** So the visibility
  predicate is written inline on `posts` (the hot path) and only the child tables
  (`post_photos`, `ratings`, `saves`, storage) go through the `can_view_post()` helper,
  where the row count is already bounded. A helper on the feed table would cost a
  per-row function call and degrade non-linearly.
- **Supabase free-tier projects auto-pause after 7 days of inactivity.** A quiet week
  between posting a TikTok and the cohort arriving takes the backend down. Keep a
  `pg_cron` heartbeat or be on a paid plan before any public link goes out.

## Design System

Always read `DESIGN.md` before making any visual or UI decision. Fonts, colors, spacing,
layout, motion and the aesthetic direction are defined there. Do not deviate without
explicit user approval. In QA and review modes, flag code that doesn't match it.

Three rules from it get broken most often, so they're repeated here:

- **Green `#2C5545` is the brand; red `#D6472A` is the rarity mark.** Red is never a
  button, link, border, fill, or error. If you want red for a CTA, the answer is ink.
- **Mono (Martian Mono) is for stamped facts only** — counts, postcodes, cost, dates,
  tabs. Never prose.
- **No XP counters, streaks, levels, badges or progress rings on any surface a
  logged-out visitor can reach.** The stamp block on quest detail is the only place
  quest attributes appear.

## gstack

This repo uses **gstack** skills (installed globally). Route work through them instead of
reinventing:

- `/office-hours` — brainstorm / pressure-test the idea or a feature before building.
- `/spec` — turn a vague feature into an executable spec.
- `/qa`, `/browse` — QA-test flows and dogfood the app.
- `/ship` — run tests, review the diff, bump version, commit, push, open a PR.
- `/review`, `/security-review` — pre-land code and security review.
- `/design-consultation`, `/design-review` — design system + designer's-eye QA.

Repo mode is **solo**. Type `gstack` to route an ambiguous request to the right skill.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
