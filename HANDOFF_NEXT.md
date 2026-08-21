# Handoff — start here (next session)

For the *why* behind decisions, read `CLAUDE.md`, `DESIGN.md`, `SHELL_SPEC.md`, and the
original `HANDOFF.md`. This file is the running "what do I do next" log — newest update first.

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
