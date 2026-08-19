# Handoff — start here (next session)

Written 2026-08-19. This is the "what do I do next" note that follows the build in commits
`f147269` (backend) and `e714cb1` (client scaffold + shell). For the *why* behind decisions,
read `CLAUDE.md`, `DESIGN.md`, `SHELL_SPEC.md`, and the original `HANDOFF.md` — this file
does not restate them.

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
