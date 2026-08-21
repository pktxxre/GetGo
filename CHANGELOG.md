# Changelog

All notable changes to GetGo are recorded here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions are `MAJOR.MINOR.PATCH.MICRO`.

## [0.2.0.0] - 2026-08-21

The first working slice of the product: browse real London sidequests, open one, sign in, and
save it. Pre-launch (London-only), on a local Supabase backend.

### Added
- **Browse feed** — a 2-column masonry of real posts read through row-level security: photo,
  full-ink caption, and a mono fact line with the rarity ordinal in red (`4TH EVER`). Loading,
  empty (`nothing here yet`), and error states come from the shell; the grid lays out once and
  never reflows.
- **Quest detail** — tap a tile for the full quest: hero photo, the `EFFORT / NERVE / COST /
  RARITY` stamp block (rarity in red), caption, byline, and reception as a sentence
  ("2 said awesome. 1 said could be cooler.").
- **Sign in + save** — a signed-out visitor who taps `save it` gets a 6-digit email code, then
  the vermilion `SAVED` stamp lands crooked on the stamp block. Email OTP auth, saves persisted
  under RLS, idempotent.
- **Backend** — 9 Postgres migrations (users, quest templates, posts + photos, visibility
  helper, ratings + saves, XP ledger, `create_post` RPC, photo dimensions, quest axes), all
  with row-level security. Seed data of 10 curated London quests.
- **Design system + app shell** — `DESIGN.md` tokens, the state screens (loading / not-found /
  failed / crashed), one `← BACK` control, and an error boundary.

### Tested
- 98 pgTAP tests (RLS, the XP paths, `create_post`) and 44 Jest tests (feed/detail mapping,
  masonry layout, stamp formatting, the four feed states, the auth sheet, save wiring). The
  live auth+save round-trip verified end-to-end against the local stack.

### Known follow-ups
- Auth session is in-memory (no cross-restart persistence yet); saving a template-less post
  needs a mint-template RPC; the hosted backend still needs migrations + the OTP email template.
