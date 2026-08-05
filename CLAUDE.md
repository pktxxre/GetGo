# GetGo

A social quest diary — "Pinterest/Instagram for sidequests." Users post sidequests they
actually went on (photo + caption), others rate them, save them to their own quest log,
and get inspired to do them. The community is the content engine; the app never assigns
quests. A post **is** a completed quest, which is why the leaderboard falls out of a single
query. London-only at launch.

> This file documents decisions and conventions that aren't obvious from the code. It is
> intentionally lean. Standard React Native / Expo / Supabase conventions are assumed —
> don't restate them here.

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
- **All profiles are public.** No private accounts. (Saved collections *can* be private —
  see the profile mockup.)
- **In-app camera is required for the photo multiplier** and doubles as quiet anti-cheat
  verification. Uploaded-from-roll photos still post but don't earn the multiplier.
- **Leaderboards are city-scoped** (launch: London). Two axes: Top Quests (best-rated posts)
  and Top Questers (XP ranking).

## Data model (intent)

Six core tables + the XP ledger. When you touch schema, keep it to this shape unless there's
a decision recorded above:

`users`, `posts` (= completed quests), `saves`, `ratings`, `follows`, `quest_templates`
(the "inspired by" lineage / rarity counter), and `xp_ledger` (append-only).

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

## Gotchas

- **Leaderboard queries can't trust a stored XP column** — there isn't one. Aggregate the
  ledger. If you see a `users.xp` field, that's a caching bug, not a source of truth.
- **Median-relative scoring needs the week's median first**, so reception XP is finalized on
  a schedule (weekly), not at post time. Post-time XP = the flat + camera-multiplier portion
  only.

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
