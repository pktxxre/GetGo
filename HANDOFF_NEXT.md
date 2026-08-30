# Handoff — start here (next session)

For the *why* behind decisions, read `CLAUDE.md`, `DESIGN.md`, `SHELL_SPEC.md`, and the
original `HANDOFF.md`. This file is the running "what do I do next" log — newest update first.

## ▶ START HERE — current state (2026-08-30, end of session)

**PR #4 is OPEN, not yet merged** (`https://github.com/pktxxre/GetGo/pull/4`), on branch
`pktxxre/keep-building` — three commits (48ba3f5 fonts/version · df76c34 app features · 22c8be5
backend), cut as **v0.4.0.0**. `main` is still at `b188e51` (PR #3), so this work only lives on
the branch until #4 lands. **If you want a clean base, merge #4 first**, then build on `main`;
otherwise keep going on this branch.

**What #4 ships (all built + tested this session):** the **nearby feed tab**, a **user-quests
profile** (tap a byline), **post-time location capture**, **cross-restart session persistence**,
**effort/nerve/cost axes capture in compose**, and **real fonts finally loading**
(Fraunces/Schibsted/Martian Mono). Migrations through **022**. Verified: **pgTAP 160 · Jest 81 ·
tsc clean · web build (6 routes)**, plus an iOS-Simulator design pass (report + before/after shots
in `~/.gstack/projects/pktxxre-GetGo/ios-design-review-20260828/`).

**Recommended next (all unblocked except the last):**
1. **Image grade (T11)** — DESIGN.md's `+3 warmth / −6 saturation / 4% grain` on every photo is
   specified and still unimplemented. Technical choice open (RN `filter` style prop on 0.86 New
   Arch, or a color-matrix lib; grain needs a noise overlay asset). DESIGN itself flags it needs
   validating against real London photos.
2. **`delete_account` (T9)** — App-Store/compliance gate. **Must anonymise/soft-delete, not
   cascade** (a hard delete of a user's posts would shift others' rarity/ordinals — CLAUDE.md
   invariant). Check the `users → auth.users` FK before designing; worth a `/spec` pass.
3. **The Validation Gate** — T18 web funnel + T19 analytics. The launch instrument.
4. **Hosted-backend migration (blocker for any public link)** — hosted project still has **no
   migrations applied** (now through 022). Needs the hosted DB password or a Supabase access
   token; only the publishable key is on hand, which can't push. This gates everything user-facing.

**Design polish left from the iOS pass (optional):** the pinned pill still floats over mid-scroll
content (a bone scrim behind it is the fix); longer neighbourhoods (`212TH · HOLLAND…`) still clip
a little; muted-text contrast on bone (F5) unverified. `nearby` loaded-state and compose's
below-fold rows were Jest-verified, not eyeballed (no on-device tap automation).

**To run locally:** `colima start && npx supabase start` (both crashed on a full disk this session
— watch disk space), `.env` points at local, OTP codes land in Mailpit (`:54324`), `npx expo start`.
Simulator review path: Expo Go + deep-link `exp://<lan-ip>:8081/--/<route>` (all app native modules
are in Expo Go SDK 57, and `127.0.0.1` reaches the host Supabase from the sim).

## Update — 2026-08-30: iOS design review on the simulator — fonts now load (uncommitted)

Ran `/ios-design-review` on the iOS Simulator (iPhone 16e) via Expo Go against the local stack,
deep-linking to each screen. Colour discipline, loading/empty/error, and AI-slop all scored high;
the app is genuinely on-brand. **The one big finding: the custom fonts were never loaded** — tokens
named Fraunces/Schibsted/Martian Mono but nothing loaded them, so every screen rendered in system
SF, losing the identity (worst for the mono fact-lines DESIGN calls load-bearing). Fixed all four
findings the user approved:

- **Fonts (F1)** — `expo-font` + `@expo-google-fonts/{fraunces,schibsted-grotesk,martian-mono}`,
  loaded in `app/_layout.tsx` (`useFonts` + splash hold, degrades to system on failure).
  `theme/tokens.ts` now uses weight-specific family names and drops `fontWeight`. Verified on-device:
  Fraunces titles, Martian Mono fact-lines/stamp labels, Schibsted body.
- **Fact-line truncation (F2)** — `QuestTile` drops `EVER` (uses `ordinalize`); `4TH · TWICKENHAM`
  no longer clips. `front-door.test` updated (`4TH EVER` → `4TH`).
- **Pill occlusion (F3)** — feed bottom padding tripled so the last tile clears the pinned pill.
- **Sticky-bar clearance (F4)** — compose + quest `scrollContent` padding 96→120.
- **Verified** — `tsc` clean, Jest **81**, web export builds all 6 routes, on-device screenshots.
  Full report + before/after shots: `~/.gstack/projects/pktxxre-GetGo/ios-design-review-20260828/`.
- **Env note:** the disk hit 100% mid-review and crashed colima/Supabase; freed space, `colima start`
  + `supabase start` brought it back. A local Metro + a booted sim may still be running.

## Update — 2026-08-21 (cont.): the "nearby" feed tab is wired (uncommitted)

The `nearby` tab was a label in `TABS` that showed the time feed like every other unwired tab
(DESIGN.md lists it; only "what's new" was live). Now that posts capture geog (020), it sorts
the feed by distance from the viewer. Dogfoods the location work and reuses the exact masonry —
no new visual component.

- **`022_feed_nearby.sql`** — `feed_nearby(lon, lat, limit)` returns `setof posts` ordered by
  the PostGIS `<->` KNN operator against the gist index (003). **SECURITY INVOKER on purpose**:
  the body's select runs as the caller, so `posts_visible` RLS hides private posts by distance
  exactly as on the feed — a definer here would leak them. pgTAP **+5** (nearest-first ordering;
  a stranger doesn't get a nearby private post; the owner does).
- **Client** — `lib/location.getCoords()` (position only, no reverse geocode), `lib/feed.fetchNearby(coords)`
  (rpc → `.select(FEED_SELECT)` embed, same mapper as the time feed), `hooks/useNearby.ts` (lazy —
  no fetch and no location prompt until the tab is selected; `needsLocation` is its own state, not
  an error).
- **`app/index.tsx`** — nearby is *layered alongside* `useFeed`, not replacing it, so the default
  path keeps its focus-refresh. Nearby's `needsLocation`/`error` render **inline** (reusing the
  empty-state styles + a mono "try again"), so the tabs stay reachable instead of a full-screen
  takeover. popular/rarest stay inert (they need phase-2 median-relative reception XP).
- **Verified** — `tsc` clean, Jest **81** (+2: nearby location-prompt inline + retry wiring, and
  nearby renders its own tiles), pgTAP **160** (+5, `022_feed_nearby_test`), web export builds all
  6 routes.

## Update — 2026-08-21 (cont.): a user's quests — the first profile surface (uncommitted)

There was no way to see one person's history — after posting, your quests vanished into the
feed. Tapping any byline (yours or anyone's) now opens **their** completed quests, newest first.
Pure client over existing RLS — no backend, no migration.

- **Built entirely from approved components** — the feed's `Masonry` + `QuestTile`, the shell's
  `StateScreen`/`TilePlaceholder`/`BackLink`. No new visual language; it reads as the same
  product scoped to one author. ⚠️ **The screen itself has no DESIGN.md spec** — it composes
  existing primitives rather than inventing any, but a `/design-review` pass is worth doing
  before it ships (the one judgment call this session).
- **RLS is the visibility branch** — `lib/feed.fetchUserPosts(userId)` is the feed query filtered
  by `user_id`; `posts_visible` already means *your own* page shows your private posts while a
  stranger's shows only public ones. No "is this me?" special case.
- **`app/user/[id].tsx` (new)** + `hooks/useUserPosts.ts` (new, same tiny shape as `useFeed`).
  Titled `@handle` from the route param, falling back to a fetched post's author on a cold deep
  link. Entry point: the quest-detail **byline is now a link** (`lib/quest` gained `authorId`);
  the front-door chrome is untouched.
- **Verified** — `tsc` clean, Jest **79** (+5: profile screen states/titling ×4, byline-links
  ×1), web export builds all 6 routes (`/user/[id]` registered). pgTAP unchanged (**155**).

## Update — 2026-08-21 (cont.): post-time location capture — the fact line fills in (uncommitted)

The `ORDINAL · NEIGHBOURHOOD` fact line stops reading "—" for user posts. The author opts in to
device location at compose time; it's reverse-geocoded to an area name, stored on the post, and
copied onto the template on mint — the same post→mint→template flow as the axes (016–018), and
the same shape as title. Coordinates also land on the post's geog, feeding the phase-2 nearby/
city-leaderboard work (C4). `expo-location` was already a dependency (and its permission string
already in app.json), so no new native module.

- **`019_post_neighbourhood.sql`** — `posts.neighbourhood text` (1..60 CHECK — a label, not
  prose). Nullable, rides posts RLS.
- **`020_create_post_neighbourhood.sql`** — `create_post` gains `p_neighbourhood` (appended after
  017's axes; `p_lon`/`p_lat`/`p_city` were already params since 007 — the client just didn't send
  them before, now it does).
- **`021_mint_neighbourhood.sql`** — the mint copies `neighbourhood` onto the template alongside
  geog/axes. Pure column-copy.
- **Client** — `lib/location.ts` (new: pure `pickNeighbourhood` picks the most-local area label
  and falls outward to the city, Jest-proven; `captureLocation` is the permission+GPS+geocode
  glue, returns null on denial — a quiet skip). `lib/posts.ts` (lon/lat/neighbourhood → RPC).
  `app/compose.tsx` (a WHERE row in the classify block: "add location" → "SHOREDITCH", tap to
  clear; fresh posts only — a redo inherits the template's location). `lib/feed.ts` + `lib/quest.ts`
  now fall back to the post's own neighbourhood before a template is minted (mirrors the title
  fallback).
- **Verified** — pgTAP **155** (+7: 019 ×4, 007 +2, 015 +1), Jest **74** (+7: `pickNeighbourhood`
  ×3, feed/quest fallback ×2, compose location ×2), `tsc` clean, web export builds all 5 routes.
  DB path (create_post stores it, mint copies it) and client wiring both covered.

## Update — 2026-08-21 (cont.): session persists across restarts (uncommitted)

The "logged out on every reload" bug is gone — the longest-standing open item. The OTP auth
decision was long settled, so the only thing missing was a storage adapter; the session was
held in memory and evaporated on restart. Now the Supabase client persists it via AsyncStorage,
so `getSession()` rehydrates a prior sign-in on cold start.

- **`@react-native-async-storage/async-storage`** — installed via `npx expo install` (SDK-57
  compatible, 2.2.0). Backed by native storage on device and localStorage on web, so one
  adapter covers both platforms. (Noticed in passing: `expo-location`/`expo-camera` are already
  deps, so the deferred location-capture task needs no new native module either.)
- **`lib/supabase.ts`** — `persistSession: true` + `storage: AsyncStorage` (was
  `persistSession: false`). `detectSessionInUrl` stays false (typed OTP codes, no magic-link
  redirect). Added AppState `start/stopAutoRefresh` per Supabase's RN guidance (refresh only
  while foregrounded). **SSR guard:** Expo's web build statically prerenders routes in Node,
  where AsyncStorage's localStorage access throws `window is not defined`; `isWebSSR`
  (`Platform.OS === 'web' && typeof window === 'undefined'`) swaps in a no-op storage and skips
  the AppState listener during prerender only — device and browser still persist. This was the
  real snag and is what the web-export failure surfaced.
- **`lib/auth.tsx`** — the "session is in-memory / persistence is a follow-up" comment corrected.
- **`jest.setup.js` (new) + package.json** — AsyncStorage is a native module (null under Jest);
  wired the library's official in-memory mock via `setupFiles` so any test importing the client
  constructs cleanly.
- **Verified** — `tsc` clean, Jest **67** (+2: new `supabase.test.ts` locks the persistence
  contract — persistSession true, storage present, detectSessionInUrl false), web export builds
  all 5 routes (the SSR guard proven by that build passing). pgTAP unchanged (**148**, no DB
  touched). **Not yet confirmed on a real device/browser reload** — that's the final check
  (sign in → hard-reload → still signed in); the config + build prove the wiring.

**Next open:** ~~location capture~~ (done — see the location entry above), multi-photo compose + a
detail gallery (design decision — DESIGN is single-hero, "nothing floats on a photograph", so a
carousel/indicator needs approval),
a **quest-log / "you" surface** (no way yet to see your own posts/saves — the promised "quest
log"; no DESIGN spec exists, so worth an `/office-hours` or `/spec` pass), `delete_account` (T9 —
must anonymise/soft-delete, not cascade, so stamped ordinals + rarity counts survive per CLAUDE.md),
and the **hosted-backend migration** (still un-migrated, now through 018; needs the hosted DB
password or an access token — only the publishable key is on hand, which can't push).

## Update — 2026-08-21 (cont.): axes capture in compose — minted templates aren't axis-less (uncommitted)

The stamp block's top gap closed. A minted template used to show "—" for effort/nerve/cost
forever, because nothing captured them: the author classifies the quest, but a first-of-its-kind
post had nowhere to hold that until the template was minted (on someone else's save). Now the
author classifies at post time, it's stored on the post, and the mint copies it onto the
template — exactly how `title` and `geog` already flow (post carries it → mint copies it → the
stamp block reads it off the template).

- **`016_post_axes.sql`** — `posts.effort`/`nerve` (smallint 1..3) + `cost_pence` (integer, 0=free),
  same bounds/CHECKs as 009's template axes, all nullable (classifying is optional). Rides the
  existing posts RLS (like 013's title). A redo post may carry them too but the detail reads axes
  off the template, so a redo's post-level axes are inert.
- **`017_create_post_axes.sql`** — `create_post` gains `p_effort`/`p_nerve`/`p_cost_pence`,
  appended after 014's `p_title` (same additive-tail discipline as 012/014), stored on the post.
- **`018_mint_axes.sql`** — `mint_template_from_post` copies effort/nerve/cost_pence onto the
  minted template alongside title/geog. Pure column-copy; idempotency/lock/visibility unchanged.
- **Client** — `lib/posts.ts` (`CreatePostInput.effort/nerve/costPence` → RPC; pure
  `poundsToPence` maps the £ field → pence, Jest-proven), `app/compose.tsx` (a "classify" block —
  low/mid/high tap-picks for effort & nerve, a £ cost field — fresh post only; a redo inherits the
  quest's axes so the block is hidden). Detail screen unchanged — it already reads axes off the
  template, so minted templates now render real values.
- **Scope note:** location capture (create_post already takes lon/lat/city; mint already copies
  geog) is still deferred — it needs `expo-location` + reverse-geocode for the neighbourhood name.
  Neighbourhood stays "—" on minted templates until then.
- **Verified** — pgTAP **148** (+11: 016 ×6, 007 +3, 015 +2), Jest **65** (+5: `poundsToPence` ×3,
  compose axes ×2), `tsc` clean, web build OK. DB path (create_post stores axes, mint copies them)
  and client wiring (what compose hands createPost) both covered.

**Next open:** location capture (expo-location + neighbourhood reverse-geocode), multi-photo
compose, `delete_account` (T9), the **hosted-backend migration** (hosted project still has no
migrations applied — now through 018), and cross-restart session persistence (async-storage).

## ▶ Earlier state (PR #3, merged)

**What now works, end to end (the whole loop):**
- **Onboarding handle claim** — first sign-in picks a handle (no more `@null` bylines).
- **Post** a first-of-its-kind sidequest — camera/library photo + optional quest name + caption
  + per-post public/private → `create_post`. Pinned "post a sidequest" pill on the feed.
- **Save** any post — a first-of-its-kind **mints** a `quest_templates` row (`origin='user'`) on
  first save and backfills the origin post as the 1st ever, so user quests propagate.
- **Redo** ("i did this too") — post your own completion of an existing quest; rarity climbs.
- Photo dimensions flow through `create_post` (no masonry reflow); feed refreshes on return.

**Verified at ship:** pgTAP **137**, Jest **60**, `tsc` clean, web build OK, plus live e2e for
the post / mint / redo loops against the local stack. Migrations through **015**.

**Recommended next (all unblocked):** effort/nerve/cost + location capture in compose (minted
templates currently show "—" for axes), multi-photo compose, `delete_account` (T9), then the
**hosted-backend migration** (hosted project still has no migrations applied) and cross-restart
session persistence (`@react-native-async-storage/async-storage`). Full detail in the dated log
below. **To run locally:** `colima start && npx supabase start`, `.env` points at local, OTP
codes land in Mailpit (`:54324`), `npx expo start`.

## Update — 2026-08-21 (cont.): redo — the second verb, loop is now two-sided (uncommitted)

"I did this too" — a user can now post their own completion of an existing quest, so rarity
climbs and the same quest accumulates posts. Pure client wiring: the backend (`create_post`
with `p_template_id` → next ordinal, template-keyed XP) was already built and pgTAP-proven, so
no new migration.

- **`lib/posts.ts`** — `CreatePostInput.templateId`; `createPost` passes `p_template_id`.
- **`app/compose.tsx`** — two modes, one screen. Fresh (`/compose`): name your quest.
  Redo (`/compose?templateId=…&questTitle=…`): the name is fixed by the template, so the
  screen shows it ("you did this too" + the quest name) and hides the name field, passing the
  templateId so `create_post` stamps the next ordinal.
- **`app/quest/[id].tsx`** — an "i did this too" secondary link in the action bar, shown only
  when the quest has a template (a first-of-its-kind is saved first, which mints, then it's
  redoable). Routes to compose in redo mode.
- **Verified** — Jest **60** (+4: redo-link shown/hidden + routes with params; compose fresh
  vs redo → what it hands `createPost`), `tsc` clean, web build OK. Live e2e: two users redo a
  seeded quest → ordinals climb (2, 3), rarity → 3, each earns the 50 XP post award. ✓

**Next open:** location + effort/nerve/cost capture in compose (so minted templates aren't
axis-less), multi-photo compose, delete_account (T9), hosted-backend migration, async-storage
session persistence, feed refresh already lands but the new redo/first posts show on return.

## Update — 2026-08-21 (cont.): mint-template on first save — the loop propagates (uncommitted)

Specced (**issue #2**, `/spec`) and built. A first-of-its-kind post is no longer a dead end: the
first time someone saves it, a `quest_templates` row is minted (`origin='user'`) and the origin
post is backfilled as the 1st ever, so user quests now propagate — the "community is the content
engine" thesis holds. Decisions taken in the spec: author names the quest at post time (D1=A),
save triggers the mint (D2=A, redo deferred), mint is a standalone RPC (D3=A).

- **`013_post_title.sql`** — `posts.title` (nullable, 1..80 CHECK). A post carries its own quest
  name; the mint copies it into the template.
- **`014_create_post_title.sql`** — appends `p_title` to `create_post` (positional-compatible,
  same additive-tail rule as 012).
- **`015_mint_template.sql`** — `mint_template_from_post(uuid)`: SECURITY DEFINER, inline
  `can_view_post` guard (can't mint a private post you can't see), advisory-locked on post id
  (concurrent saves mint exactly once), idempotent (returns existing template_id), title
  fallback chain `post.title → left(caption,60) → 'untitled sidequest'`, slug
  `kebab(title)+postid-fragment`, backfills origin post to `completion_ordinal = 1`. No XP (the
  post's award already landed at create_post).
- **Client** — `lib/posts.ts` (`p_title`), `app/compose.tsx` (optional "name your quest" field),
  `lib/quest.ts` (detail title = `coalesce(template.title, post.title)`), `lib/saves.ts`
  (`mintTemplateFromPost`), `app/quest/[id].tsx` (`doSave` mints-then-saves when `templateId`
  null; the save button is now enabled for template-less posts — no more "can't save this one yet").
- **Scope note:** the feed tile shows caption, not title, so no feed change (spec's "feed tile
  likewise" didn't apply). Minted templates carry NULL neighbourhood + NULL axes (no source
  yet) — the stamp shows "—" until a later location/axes-capture spec.
- **Verified** — pgTAP **137** (+22: 013 ×5, 015 ×15, 007 +2), Jest **56** (+1), `tsc` clean,
  web build OK. Live e2e: author posts a first-of-its-kind → a *different* user saves →
  template minted (`origin='user'`, `created_by`=saver, title copied), post backfilled to
  ordinal 1, save row present, second mint idempotent, rarity=1. All ✓.

**Next open:** **redo** (posting your own completion against an existing template — the second
verb, deferred from this spec), location + effort/nerve/cost capture in compose (so minted
templates aren't axis-less), multi-photo compose, hosted-backend migration, async-storage
session persistence.

## Update — 2026-08-21 (cont.): finish T13-post — photo dims + feed refresh (uncommitted)

Two polish pieces that close gaps the post flow opened:

- **`supabase/migrations/012_photo_dims_in_create_post.sql`** — `create_post` now takes
  `p_photo_widths`/`p_photo_heights` (appended, defaulted, so every existing positional caller
  stays valid) and stores them on `post_photos`. This was 008's flagged "later task": before it,
  RPC-made photos had NULL dims → the feed fell back to a default aspect → the masonry
  **reflowed** when the real image loaded, which DESIGN.md forbids. `lib/posts.ts` + `compose.tsx`
  now pass the picker's asset dims through. pgTAP **115** (+3 in `007_create_post_test.sql`:
  dims stored, zipped by position, and NULL-safe when omitted).
- **`hooks/useFeed.ts` + `app/index.tsx`** — a quiet `refresh` (re-fetch without flipping to
  `loading`) wired to `useFocusEffect`, skipping the first focus. Returning to the feed after
  posting now shows the new post with no placeholder flash. (This resolves the "feed
  refresh-on-return" gap noted below.)
- **Verified** — pgTAP **115**, Jest **55**, `tsc` clean, web build OK. Live e2e re-run:
  `create_post` with dims → `post_photos` row carries width/height (1080×1350). ✓

## Update — 2026-08-21 (cont.): post-creation flow — the create side of the loop (uncommitted)

A signed-in user can now **post** a sidequest, not just save one. The loop is now two-sided:
browse → save AND browse → post. Built a *first-of-its-kind* post (no template) — `create_post`
already handles a NULL template (NULL ordinal, source-keyed XP), so the mint-template RPC was
**not** a blocker; it's still the follow-up for making a posted quest redoable by others.

- **`supabase/migrations/011_photos_storage.sql`** — the `photos` storage bucket (public read)
  + storage.objects RLS: a user may only write under their own uuid prefix
  (`{user_id}/{post_id}/{idx}.{ext}`), plus owner-delete for orphan cleanup. This was the real
  missing prerequisite — nothing gave uploads a home before (the feed only worked because seed
  rows store full picsum URLs). pgTAP **112** (+6: `011_photos_storage_test.sql`).
- **`lib/posts.ts`** — `createPost` (upload photos → `create_post` RPC, client-generated post
  id for idempotency) + pure `photoObjectKey`/`extFromUri`/`uuidv4` (Jest-proven).
- **`app/compose.tsx`** — the compose screen: photo (camera or library via **expo-image-picker**,
  newly added + plugin in app.json), caption, per-post PUBLIC/PRIVATE toggle, sticky `post it`.
  Auth-gated at the action (reuses AuthSheet, same shape as save). On success it lands on the
  new quest's detail, so the poster sees their own post live through the feed RLS.
- **`app/index.tsx`** — a pinned ink `post a sidequest` pill (always reachable; ink, not a
  red/green FAB per DESIGN colour rules).
- **Verified** — pgTAP **112**, Jest **55** (+4: `posts.test.ts`), `tsc` clean, web build OK
  (`/compose` route). A throwaway node e2e proved the whole loop live: OTP sign-in → handle
  claim → upload under own prefix → `create_post` (+50 XP, level 2) → post visible via feed RLS
  with photo + byline → cross-prefix upload blocked. All ✓.

**Next / still open:** the **mint-template RPC** (so a first-of-its-kind post becomes redoable —
noted in 005_social.sql), multi-photo posts (the RPC + masonry already support N; compose takes
one), threading photo **dimensions** through create_post (masonry falls back to a default aspect
until then), post-time **location** capture (create_post takes lon/lat/city; compose doesn't
send them yet), and feed **refresh-on-return** (compose lands on detail, but a plain back to the
feed won't show the new post until reload). Plus the still-open items below (async-storage
session persistence, hosted backend not migrated, image grade, S7–S11 shell).

## Update — 2026-08-21: onboarding handle claim (uncommitted)

A first-time user is now asked to pick a handle right after their first sign-in, so quests get
a real byline instead of `@null`. Small, self-contained; unblocks bylines for the post flow.

- **`supabase/migrations/010_handle_format.sql`** — a `users_handle_format` CHECK (3–20 of
  `[a-z0-9_]`, NULL still allowed). The DB is the real guard: RLS lets a user write their own
  row, so handle format can't be trusted to the client. Lowercase-only keeps the existing
  UNIQUE index effectively case-insensitive. `001_users_test.sql`'s fixture handle changed
  `scenic-route` → `scenic_route` (the hyphen now violates the check).
- **`lib/profile.ts`** — pure `normalizeHandle`/`validateHandle` (mirror the CHECK) + async
  `fetchMyHandle`/`claimHandle`; `claimHandle` maps a 23505 to `HandleTakenError` so the UI can
  say "taken" specifically.
- **`components/auth/AuthSheet.tsx`** — a third step folded into the one auth surface:
  email → code → **handle** (first time only; a returning user with a handle skips straight to
  `onAuthed`, so the save still fires immediately). No new screen/route, no app-wide gate.
- **Tests** — pgTAP **106** (+8: new `010_handle_format_test.sql`), Jest **51** (+7:
  `profile.test.ts` pure validators, AuthSheet returning/first-time/invalid/taken paths). `tsc`
  clean. Not yet committed; not applied to the hosted project.

**Next:** the **post-creation flow (T13-post)** is now fully unblocked — image-picker/camera →
the tested `create_post` RPC, with the mint-template RPC decision still open (see below). This
was flagged in the plan as the pairing for the handle claim; recommend running `/spec` on it
before building given the schema decision.

## ▶ Current state (2026-08-21) and the next move

**The core loop is built and shipped:** browse feed (T12) → quest detail (T13) → email-OTP
sign-in → the real `save it` stamp. It's in **PR #1** (`https://github.com/pktxxre/GetGo/pull/1`),
**OPEN / not yet merged**, on branch `pktxxre/gstack-setup-claude-md`. Because it isn't merged,
`main` doesn't have this work — keep building on **this branch / this workspace**, not a fresh
branch off main. Land PR #1 first if you want a clean base.

Verified at ship: **98 pgTAP · 44 Jest · tsc clean · web build (all routes)**, plus the
auth+save loop proven live against the local stack.

**Do next — the post-creation flow (T13-post):** an image-picker/camera capture feeding the
already-tested `create_post` RPC, so a signed-in user can post a quest (not just save one).
Pair it with an **onboarding handle claim** (`users.handle` is NULL until claimed; bylines
currently render `@null` for a brand-new user). Auth (built this session) unblocks both.

Also open, all non-blocking: cross-restart session persistence (needs
`@react-native-async-storage/async-storage`), a mint-template RPC for saving template-less
posts, the hosted backend (migrations + OTP email template not applied there), the detail
location-map strip, the system-wide image grade, S7/S8/S10/S11 shell, and the feed fact-line
truncation nit. Full detail in the dated log below.

**Run it:** local Supabase must be up (`colima start && npx supabase start`); `.env` already
points at `http://127.0.0.1:54321`; OTP codes land in Mailpit (`http://127.0.0.1:54324`);
`npx expo start` then `i`/`w`. Email-template edits in `supabase/config.toml` need
`supabase stop && supabase start`, not `db reset`.

---

## Update — 2026-08-20: T12 feed is wired end-to-end (uncommitted)

The app now reads real posts from the backend and renders the masonry. Changed/added this
session (not yet committed):

- **`.env` → local stack** (`http://127.0.0.1:54321` + local publishable key). Hosted values
  kept commented for when the hosted schema is live.
- **`supabase/migrations/008_photo_dimensions.sql`** — nullable `width`/`height` on
  `post_photos` so the masonry reserves geometry and never reflows. `create_post` is
  **unchanged** (its signature is the locked D14 contract); RPC-made photos get NULL dims and
  the client falls back to a default aspect until a later task threads dims through the RPC.
- **`supabase/seed.sql`** — 3 demo authors, 10 curated London quests, 10 public posts (+1
  private, to prove the anon feed hides it), photos as picsum URLs with real dimensions. Runs
  on `supabase db reset`.
- **Client data layer** — `lib/photos.ts` (URL resolver: http→passthrough, else bucket
  `getPublicUrl`), `lib/feed.ts` (`fetchFeed` + the pure `toFeedItem` mapper), `hooks/useFeed.ts`.
- **Feed UI** — `components/feed/QuestTile.tsx` + `components/feed/Masonry.tsx` (pre-computed
  greedy columns). `app/index.tsx` rewritten to render loading (`TilePlaceholder` grid +
  `developing…`), empty (`nothing here yet`), error (`StateScreen kind="failed"` + retry),
  and the real masonry. **S6 done** — loading and empty no longer share copy.
- **Tests** — pgTAP **91 green** (+6; test 002 de-fragilised to not assert an absolute
  catalog count). Jest **29 green** (+12: mapper, layout, `formatOrdinal`, all four feed
  states). `tsc` clean. `npx expo export --platform web` builds (828 modules).

**Fact-line decision made:** DESIGN's `ORDINAL · POSTCODE · COST` has no postcode/cost in
the locked schema, so the tile shows `ORDINAL · NEIGHBOURHOOD` (ordinal red). Ordinal reads
`4TH EVER` for all posts (consistent, no invented rarity threshold). Revisit if the
effort/nerve/cost axes decision below lands and adds columns.

## Update — 2026-08-20 (cont.): auth + real `save it` — the core loop closes

A signed-out visitor can now tap `save it`, get a 6-digit email code, and land the save
stamp — proven end-to-end against the real backend. Added (uncommitted):

- **`lib/auth.tsx`** — `SessionProvider` + `useSession()`. **Email OTP** (6-digit code) was
  the auth decision: lowest-friction for the cold TikTok→save funnel, identical web/native,
  no social SDK, no deep-link dance. Session is **in-memory** (the client injects the bearer
  token, so authed PostgREST calls work for the session's life); cross-restart persistence
  needs `@react-native-async-storage/async-storage` — deliberate follow-up, no native module
  added mid-flight. Wired into `app/_layout.tsx`.
- **`components/auth/AuthSheet.tsx`** — the one auth surface: email → code → in, inline
  errors (never a toast). Opens when a stranger taps save.
- **`lib/saves.ts`** (`saveQuest`/`isSaved`, idempotent upsert), **`components/quest/SaveStamp.tsx`**
  (the vermilion `SAVED · 12 AUG`, seeded −6..+6° tilt, 1.06→1.00 scale, 140ms, reduced-motion
  aware), **`hooks/useReducedMotion.ts`** (S9). `lib/format.ts` gained `seededAngle`/`formatStampDate`.
- **`app/quest/[id].tsx`** save flow: signed-in → save + stamp; signed-out → AuthSheet → save.
  Reflects an existing save on open. `fetchQuest` now returns `templateId` (the save target).
- **Local email config** — `supabase/config.toml` + `supabase/templates/{magic_link,confirmation}.html`
  make the OTP email show `{{ .Token }}` (the default is a bare magic link, which the typed-code
  UI can't use). **Requires `supabase stop && supabase start`** (config, not a migration).
  The hosted project will need the same template set in its dashboard.
- **Tests** — pgTAP **98** (unchanged), Jest **44** (+5: auth-sheet flow, save wiring,
  seeded-angle/stamp-date). `tsc` clean, web build OK. **An e2e script** (throwaway) verified
  the live loop: signInWithOtp → code from Mailpit → verifyOtp(type email) → save under RLS →
  isSaved=1 → idempotent re-save → anon can't read the save. All ✓.

**Next:** post-creation flow (**T13-post** — camera/image-picker + the tested `create_post`
RPC; now unblocked by auth) is the natural follow-on, and `delete_account` (T9) + an
onboarding **handle** claim (users.handle is NULL until claimed; the byline shows `@handle`).
Still open/unblocked: detail location-map strip, image grade, S7/S8/S10/S11 shell, the
fact-line truncation polish, and **cross-restart session persistence** (async-storage).

## Update — 2026-08-20 (cont.): T13 quest detail is built (read-only)

Tapping a feed tile now opens a real quest-detail screen. Added:

- **`supabase/migrations/009_quest_axes.sql`** — `effort`/`nerve` (1..3 tiers) + `cost_pence`
  on `quest_templates`. **This resolves the thrice-flagged open decision** (option A from
  above): the DESIGN stamp block is 2×2 EFFORT/NERVE/COST/RARITY and can't ship without the
  axes. Nullable (redo-minted templates have none → stamp shows `—`). Reversible in one
  migration if the representation should change; recorded in the migration + DESIGN log.
- **Seed** now sets the axes on all 10 curated quests and adds 9 ratings (only non-authors
  rate), so the reception sentence renders real numbers.
- **`lib/format.ts`** — `ordinalize`/`formatOrdinal`/`tierLabel`/`costLabel`/
  `receptionSentence` (pure). `lib/quest.ts` (`fetchQuest` + `toQuestDetail`), `hooks/useQuest.ts`.
- **`components/quest/StampBlock.tsx`** + **`app/quest/[id].tsx`** — hero 4:5, `← BACK` on
  bone, title, stamp block (RARITY red = ordinal), caption, byline, reception sentence,
  sticky `save it` bar. `notFound`/`error`/`loading` states via the shell. `QuestTile` now
  navigates (`router.push('/quest/:id')`).
- **Tests** — pgTAP **98 green** (+7), Jest **39 green** (+10: detail mapper, stamp
  formatting, reception, detail screen states). `tsc` clean. Web build registers `/quest/[id]`.

**`save it` is deliberately a stub** — it shows "save needs an account — coming soon" instead
of faking the save stamp. Persisting a save needs auth **and** the mint-template RPC that
`005_social.sql` says lives "with T12's save flow" (never built). Deferred on purpose: the
save stamp is the whole delight budget and must not be spent on a lie.

**Next:** **auth** is now the true unblocker — it gates the real save, the post-creation flow
(T13-post), and delete_account. `lib/supabase.ts` still has `persistSession:false` and the
magic-link-vs-social decision is open (HANDOFF.md). Also unbuilt: the location map strip on
detail (needs map tiles), the image grade (warmth/sat/grain) on all photos, S7–S11 shell
(OfflineBanner/InlineError/reduced-motion — all unblocked and can go anytime), and the
fact-line truncation polish noted below.

Cosmetic nit observed on-device: the feed fact line (`4TH EVER · TWICKENH…`) truncates the
neighbourhood in a narrow column — drop the `EVER` suffix on the tile or let the name shrink.

---

## Where things stand (all committed, all verified)

**Backend — 7 migrations, 85 pgTAP tests green** (`supabase/migrations/001…007`):
users → quest_templates → posts+post_photos → visibility helper → ratings+saves → xp
ledger → `create_post`. Every ★ critical path is tested as real Postgres roles: private-post
leak, child-photo leak, XP double-award (`nulls not distinct`), delete-repost farming,
transactional rollback, the level boundary. `create_post` returns
`{ post, xp_total, level, leveled_up }` — the contract both clients build on (D14).

**Client — Expo + expo-router + TS, web-capable, 17 Jest tests green.** Front-door chrome
(`app/index.tsx`), design tokens (`theme/tokens.ts`), Supabase client (`lib/supabase.ts`),
and the **S1–S5 shell baseline** (`components/shell/`, `hooks/`, `app/+not-found.tsx`):
StateScreen, BackLink, Placeholder/TilePlaceholder + useDelayedLoading, ErrorBoundary.

**Runs on the iOS simulator** (confirmed earlier via `npm run ios`). The feed shows an empty
state because **the feed query isn't wired yet** — that's T12.

## How to run it

```bash
# Local Postgres (Docker via colima — installed this build):
colima start                # if the VM isn't up
npx supabase start          # local stack: API :54321, DB :54322, Studio :54323
npx supabase db reset       # replay migrations (DESTRUCTIVE: wipes local data)
npx supabase test db        # the 85 pgTAP tests

npm test                    # 17 Jest tests
npx tsc --noEmit            # typecheck (clean)
npx expo start              # dev server; `i` iOS sim, `w` web
```

Local stack keys (from `npx supabase start` output): anon/publishable
`sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH`, DB
`postgresql://postgres:postgres@127.0.0.1:54322/postgres`.

---

## ▶ Recommended next step: wire the app to a real backend, then build T12 (feed)

Everything above is proven in isolation but **nothing is wired end-to-end** — the app's
`.env` points at the hosted project, which has **no migrations applied**, while the *local*
stack has them but the app isn't pointed at it. Closing that gap is the highest-value move:
it turns the verified backend + shell into something you can actually open and use, and it's
the prerequisite for T12.

Concretely, in order:

1. **Point the app at the local stack** for development. Set `.env`:
   ```
   EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
   ```
   (On a physical device use the LAN IP, not 127.0.0.1.)
2. **Seed a few rows** so the feed has content — insert a handful of `quest_templates`
   and call the tested `create_post` RPC for a few posts+photos. Photos: upload a couple
   of images to a local Storage bucket, or stub `storage_path` for layout-only. This
   replaces `content/sample-quests.ts` (which is a throwaway UI mock, not the seed).
3. **T12 — feed + save.** Build the 2-column masonry from `DESIGN.md` (photo → caption →
   mono `ORDINAL · POSTCODE · COST`, ordinal in red), reading public posts through the
   `posts` RLS. Render loading via the shell's `TilePlaceholder` + `useDelayedLoading`,
   empty via a StateBlock, error via `StateScreen kind="failed"`. Wire the `save it` action
   (the save-stamp is the app's whole delight budget — see DESIGN.md → Motion).
   Do **S6** here too: free `developing…` for *loading* and give the empty state its own
   `nothing here yet` (currently the front door overloads `developing…`).

Alternative if you'd rather not run local for the client: get the **hosted DB password or a
Supabase access token** so migrations can be pushed to the hosted project
(`supabase link` + `supabase db push`) — I only had the publishable key, which can't push.

## Two decisions still open (don't invent — decide)

1. **Effort / nerve / cost axes.** The `DESIGN.md` stamp block shows `EFFORT / NERVE / COST /
   RARITY`, but the **locked v1 data model has no such columns** (only rarity is computed).
   Decide before the quest-detail screen (T13-ish): add them to `quest_templates` (populated
   from curated `content/quests.json`), or ship the stamp block rarity-only for now. I left
   the schema matching the locked plan — no invented columns.
2. **Local vs hosted backend** — see step 1 above.

## Remaining build order (from HANDOFF.md, updated)

```
[T12 feed+save] ← next   ·   T13 post flow   ·   T11 image resize
S6–S11 shell (P2/P3, non-blocking): OfflineBanner(+netinfo), InlineError,
     useReducedMotion, web/native split, focus+contrast test
T18 web funnel + T19 analytics → VALIDATION GATE (web-first, per CEO addendum)
T21 EAS build → TESTFLIGHT   ·   T9 delete_account · W3 compliance · T16 Maestro → APP STORE
```
Launch is **web-first** (the CEO addendum supersedes the three-gate split): the web client
on the shared backend is both the TikTok landing page and the validation instrument; native
is sequenced *behind* the funnel gate.

## Gotchas for the next session

- **Shared working tree.** `…/getgo/gstack-setup-claude-md` is a **symlink** to `…/zagreb` —
  one git dir, one branch, possibly another session editing the same files. **Re-Read**
  `DESIGN.md`/`HANDOFF.md`/`SHELL_SPEC.md` before editing; don't Write from a stale copy.
- **Never `git add -A`.** Stage by explicit path (some things are intentionally untracked;
  `.env`, `.gstack/` are gitignored).
- **RLS fails open and silent** — every new table/policy ships with a pgTAP test; an RLS test
  in Jest is worthless (service key bypasses policies).
- **`nulls not distinct`** on the XP index and **`set search_path = ''`** on every SECURITY
  DEFINER function — both silent if wrong.
- **Credentials** live in `.env` and in project memory (`getgo-supabase-project.md`) — the
  hosted URL + publishable key; a service-role/secret key was never provided.
- Run `/plan-eng-review` before the client data-layer work if the architecture shifts; it's
  12 days stale but only docs changed since, so T12 doesn't need a fresh pass to start.
