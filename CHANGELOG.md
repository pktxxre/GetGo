# Changelog

All notable changes to GetGo are recorded here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions are `MAJOR.MINOR.PATCH.MICRO`.

## [0.4.0.0] - 2026-08-30

Fills in the parts a posted quest was missing and adds the first ways to browse by person and by
place. A post can now carry its effort/nerve/cost and where it happened, those flow onto the
minted template, the feed sorts by distance, you can see any user's quests, and — visible on
every screen — the real typefaces finally load. Still pre-launch (London-only), local Supabase.

### Added
- **Classify a quest at post time** — compose captures effort/nerve (low/mid/high) and cost;
  stored on the post and copied onto the template when it's first saved, so the stamp block shows
  real axes instead of "—".
- **Post-time location** — opt-in device location is reverse-geocoded to a neighbourhood, stored
  on the post and copied to the template, so the `ORDINAL · NEIGHBOURHOOD` fact line fills in.
- **Nearby feed tab** — the `nearby` tab sorts the feed by distance from you via a `feed_nearby`
  RPC (PostGIS `<->`, SECURITY INVOKER so RLS still hides private posts by distance).
- **A user's quests** — tap any byline to see that person's completed quests; RLS shows your own
  private posts on your page and only public ones on a stranger's.
- **Session persists across restarts** — the Supabase client now stores the session in
  AsyncStorage (SSR-guarded for web export), so signing in survives a reload.

### Changed
- **Typography now renders as designed** — Fraunces / Schibsted Grotesk / Martian Mono load via
  `expo-font` with the splash held until ready; before this the whole app fell back to system SF
  and lost the mono fact-line identity.
- **Feed fact line** drops the `EVER` suffix on the tile so the neighbourhood stops truncating
  (`4TH · TWICKENHAM`); detail still spells it out.
- Sticky action bars and the pinned pill no longer crowd/occlude the last row of content.

### Tested
- 160 pgTAP (+23: post axes, create_post axes/neighbourhood, mint copies axes+neighbourhood,
  `feed_nearby` ordering + RLS) and 81 Jest (+21: cost/neighbourhood parsers, compose axes +
  location wiring, mapper fallbacks, profile + nearby screens, session-persistence contract).
  `tsc` clean, web export builds all 6 routes, verified on the iOS Simulator against the local
  stack (fonts, stamp block, feed, quest detail, profile).

## [0.3.0.0] - 2026-08-21

Closes the loop both ways: you can now **post** your own sidequests, not just browse and save
them, and a user's post can spread — saved, minted into a real quest, and redone by others.
The "community is the content engine" thesis is live end to end. Still pre-launch (London-only),
local Supabase backend.

### Added
- **Post a sidequest** — a signed-in user photographs a quest (camera or library), names it,
  captions it, sets per-post public/private, and posts it through the tested `create_post` RPC.
  Reached from a pinned ink `post a sidequest` pill on the feed; lands on the new quest's detail.
- **Onboarding handle claim** — first sign-in picks a handle, so bylines read `@you` instead of
  `@null`. Folded into the one auth surface (email → code → handle), returning users skip it.
- **Quest templates are born from a save** — the first time someone saves a first-of-its-kind
  post, a `quest_templates` row is minted (`origin='user'`) and the origin post is backfilled as
  the 1st ever, so user quests propagate and rarity counts start working. Lazy, idempotent,
  concurrency-safe (advisory-locked), with a server-side visibility guard.
- **Redo ("i did this too")** — post your own completion of an existing quest; the ordinal
  climbs and rarity grows. Compose runs in a redo mode that inherits the quest's name.
- **Photo geometry** — photo dimensions flow through `create_post`, so the masonry reserves
  space and never reflows for real uploads. The feed refreshes quietly on return.
- **Photo storage** — a `photos` bucket with row-level security: a user can only write under
  their own id prefix; public read for the feed.

### Changed
- The `save it` button is enabled for first-of-its-kind posts (it mints, then saves) instead of
  showing "can't save this one yet".

### Tested
- 137 pgTAP tests (+39: handle-format CHECK, storage RLS, photo dims, post title, mint
  idempotency/concurrency/visibility-guard/title-fallback) and 60 Jest tests (+16: handle claim,
  post/mint/redo wiring, compose fresh-vs-redo). `tsc` clean, web build OK, and the post / mint /
  redo loops proven live against the local stack.

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
