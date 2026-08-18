# Shell Spec — the states that aren't a screen

The implementation half of `DESIGN.md → Shell States`. That section decides what the user
sees; this one decides what gets built, where it lives, and what proves it works.

**Why this exists:** every screen T12–T19 in `HANDOFF.md` needs loading, empty, error and
back. Built once here, no screen has to decide. Built ad hoc, three screens solve the same
problem three ways and the app stops feeling like one product.

Produced by `/plan-design-review` on 2026-08-18 against `pktxxre/gstack-setup-claude-md`.
Visual reference: `~/.gstack/projects/pktxxre-GetGo/designs/shell-states-20260818/shell-states.html`.

---

## What already exists — reuse, don't rebuild

| Asset | State | Use it for |
|---|---|---|
| `theme/tokens.ts` | Complete, faithful to `DESIGN.md` | Every value in this spec. **The shell adds zero new tokens.** |
| `app/index.tsx:45-52` | Working empty state, in voice | The reference implementation `<StateBlock>` is extracted from |
| `app/index.tsx:34` | `hitSlop={8}` on tabs | The touch-target pattern `<BackLink>` copies |
| `app/_layout.tsx:12` | `contentStyle` set to bone | Already prevents white flash between routes. Don't undo it. |
| `color.error` `#8A3B2E` | Defined, never used | First use is the shell's error stamp labels |
| `DESIGN.md` voice list | `developing…`, `taking the scenic route!` | Two of six state copy lines already written |

---

## State matrix

What the user sees. Not backend behavior.

| Surface | Loading | Empty | Error | Partial |
|---|---|---|---|---|
| Quest list | `<TilePlaceholder>` ×4 at true aspect + `developing…` | `nothing here yet` + "no sidequests in this corner of london. yet." | `<StateScreen kind="failed">` | Content + `<OfflineBanner>` |
| Quest detail | Hero placeholder 4:5, stamp block frame drawn, 4 values placeheld | n/a | `kind="notFound"` (404 from query) or `kind="failed"` (network) | Photo failed → bone block, text renders |
| Save action | Button label → `saving…`, disabled, no spinner | n/a | `<InlineError>` above the sticky bar, retry attached | n/a |
| Post flow | Per-photo upload progress as a mono fraction (`2 / 3`) | n/a | `<InlineError>` on the failed photo, others keep | 2 of 3 uploaded — keep them, retry the third only |
| Auth / onboarding | Button disabled + `checking…` | n/a | `<InlineError>` under the field | n/a |
| Any route | n/a | n/a | `<ErrorBoundary>` → `kind="crashed"` | n/a |
| Unmatched route | n/a | n/a | `app/+not-found.tsx` → `kind="notFound"` | n/a |

**Two invariants that outrank any screen's preference:**

1. A failed refresh never destroys content that already loaded. Failure is additive.
2. Retry is only offered where retrying can work. `notFound` and `crashed` have no retry.

---

## Components — `components/shell/`

### `<StateScreen kind body? onPrimary? onEscape? />`

Full-page message state. Three configurations, one component.

```ts
type StateKind = 'notFound' | 'failed' | 'crashed';
```

| kind | stamp | title | primary | escape | stamp color |
|---|---|---|---|---|---|
| `notFound` | `no such quest` | this one isn't in the archive | `browse london` → `/` | — | `inkMuted` |
| `failed` | `didn't load` | taking the scenic route | `try again` → `onPrimary` | `browse london` → `/` | `error` |
| `crashed` | `something broke` | that's on us | `back to london` → `/` | — | `error` |

Layout: `<BackLink>` top, then the five slots ragged-left in a 34ch column, `space.md`
between slots, `space.xxl` above the primary. Top-aligned above 720px, vertically centered
below. `accessibilityLiveRegion="polite"` / `role="alert"` on web.

Default `body` copy per kind; overridable. Primary is `color.ink` background, `color.ground`
label, `layout.radiusButton`, min height 48. Escape is mono underlined, `inkMuted`.

### `<BackLink fallback="/" label="back" />`

```tsx
const router = useRouter();
const onPress = () => router.canGoBack() ? router.back() : router.replace(fallback);
```

`router.canGoBack()` is the whole point — a TikTok deep link into a quest detail has no
history, and that is the **common** arrival path, not an edge case. Renders `← back` in
`type.dataLine` uppercase, full `color.ink`, `hitSlop={{top:12,bottom:12,left:12,right:12}}`
for a ≥44pt target, `accessibilityRole="button"`, `accessibilityLabel="go back"`. Never
positioned over an image.

### `<Placeholder width height aspectRatio? />` and `<TilePlaceholder>`

Bone `#E9E2D5` block. **No animation, no gradient, no `Animated` import at all** — if this
file imports `Animated`, the review failed. `accessibilityElementsHidden`,
`importantForAccessibility="no-hide-descendants"`.

`<TilePlaceholder>` composes: photo block at a supplied aspect ratio, two caption lines,
one fact line — matching the real tile's geometry so nothing reflows on paint.

Timing, in the hook not the component: don't render below 150ms; once rendered, hold ≥300ms.

### `<OfflineBanner />`

Subscribes to `@react-native-community/netinfo` (web: `navigator.onLine` + `online`/
`offline` events). Full-width `color.error` strip, `color.ground` mono 10/.12em uppercase,
`no connection`, `space.sm` vertical. Mounted once in `_layout.tsx` above the `Stack`.
Renders `null` when connected. Announces once via live region; does not re-announce on
flapping (debounce 2s).

### `<ErrorBoundary>`

Class component — hooks cannot catch render errors. Wraps the `Stack` in `_layout.tsx`.
On catch: log, render `<StateScreen kind="crashed" />`. Resets its error state on route
change so `back to london` produces a working front door rather than a stuck boundary.

### `<InlineError message onRetry? />`

`color.surface` background, 1px `color.rule` top and bottom, message in `color.error` at
`type.secondary`, `retry` as mono underlined ink on the right. Sits in the layout where the
failed action was. Not a toast, not absolutely positioned, never auto-dismisses.

### `app/+not-found.tsx`

```tsx
export default function NotFound() {
  return <StateScreen kind="notFound" />;
}
```

Without this file, expo-router serves its own unstyled dev screen — a system-font white page
on the exact surface the funnel gate depends on.

### `hooks/useReducedMotion.ts`

Wraps `AccessibilityInfo.isReduceMotionEnabled()` + change subscription; web falls back to
`matchMedia('(prefers-reduced-motion: reduce)')`. **Every motion in `DESIGN.md → Motion`
reads this one hook** — the 320ms shared-element transition, the 200ms underline slide, and
the save stamp's overshoot and haptic. Reduced motion: transitions become instant, the save
stamp appears at final position and opacity with no scale and no haptic. The stamp still
lands crooked — the seeded angle is identity, not motion.

---

## Accessibility requirements

Non-negotiable, and cheap now versus a retrofit across every screen later.

- **Contrast, measured:** `inkMuted` on `ground` = **5.00:1**; `error` on `ground` =
  **6.62:1**. Both pass AA. Re-measure if either token changes.
- **Error meaning never lives only in a 10px mono label.** The Fraunces title says it too.
- **44pt minimum** touch targets: `<BackLink>`, primary buttons, tabs, `retry`.
- **Placeholders are invisible to screen readers.** Loading is announced as text, not as
  nine empty views.
- **State screens are live regions** and announce on mount.
- **Loading → loaded is announced.** Otherwise the transition is silent to VoiceOver.
- **Visible focus rings on web**, using `color.brand` — brand is identity, and focus is
  identity-adjacent chrome, not a rarity mark. Never `outline: none`.
- **`prefers-reduced-motion` honored once**, in `useReducedMotion`, for all motion.

---

## Web vs native shell

One codebase, two shells. `DESIGN.md:193` deletes the bottom tab bar on web and keeps it in
the native app. Encode it once, in `_layout.tsx`, via `Platform.OS === 'web'` — never
per-screen. State screens render **inside** the native tab shell (the tab bar stays), so
`back to london` is an in-content action, not the only navigation on screen.

---

## NOT in scope — considered and deferred

| Deferred | Why |
|---|---|
| Toast / snackbar system | Explicitly rejected. Failures surface where the action was. |
| Skeleton shimmer animation | Banned by `DESIGN.md → Motion`; D3 resolved to static placeholder. |
| Dark mode variants of shell states | No dark mode at launch. One ground, done properly. |
| Retry with exponential backoff | Network-layer concern, not shell. Belongs with the Supabase client. |
| Offline write queue / optimistic saves | Real feature with real sync complexity. Banner only for now. |
| Empty states for post flow and profile | Those screens don't exist yet. `<StateBlock>` will cover them. |
| Error telemetry / Sentry wiring | `<ErrorBoundary>` logs to console; pick a sink at the TestFlight gate. |
| Localized copy | London-only at launch, English only. |
| Tablet-specific state layouts | Breakpoints cover it; no bespoke tablet design earned yet. |

---

## Implementation Tasks

Synthesized from this review's findings. Each derives from a specific finding. Checkbox as
you ship. Land before T12 (list + save) — every task after it depends on these existing.

- [ ] **S1 (P1, human: ~2h / CC: ~15min)** — `components/shell/StateScreen.tsx` — build the three-kind state screen
  - Surfaced by: Pass 2 — "not-found and load-failed are different problems"; D6 resolved to three kinds, one component
  - Files: `components/shell/StateScreen.tsx`, `components/shell/copy.ts`
  - Verify: Jest renders all three kinds; asserts `notFound` and `crashed` expose no retry, `failed` does

- [ ] **S2 (P1, human: ~1h / CC: ~10min)** — `app/+not-found.tsx` — add the not-found route
  - Surfaced by: Pass 2 — expo-router currently serves an unstyled system-font page on the funnel surface
  - Files: `app/+not-found.tsx`
  - Verify: navigate to `/does-not-exist`; bone ground, Fraunces title, working `browse london`

- [ ] **S3 (P1, human: ~1.5h / CC: ~10min)** — `components/shell/BackLink.tsx` — one back control, history-aware
  - Surfaced by: Pass 1 / D5 — headers are off globally, so native has no visible way back from anywhere
  - Files: `components/shell/BackLink.tsx`
  - Verify: Jest asserts `router.back()` with history and `router.replace('/')` without; hit area ≥44pt

- [ ] **S4 (P1, human: ~2h / CC: ~15min)** — `components/shell/Placeholder.tsx` — static layout placeholders
  - Surfaced by: Pass 5 / D3 — "no shimmer" and "no reflow after paint" resolve to a static geometry reservation
  - Files: `components/shell/Placeholder.tsx`, `components/shell/TilePlaceholder.tsx`, `hooks/useDelayedLoading.ts`
  - Verify: Jest asserts no `Animated` import; asserts `accessibilityElementsHidden`; asserts the 150ms/300ms window

- [ ] **S5 (P1, human: ~1h / CC: ~5min)** — `components/shell/ErrorBoundary.tsx` — catch render errors
  - Surfaced by: Pass 3 step 6 — one thrown error is currently a white screen with no recovery
  - Files: `components/shell/ErrorBoundary.tsx`, `app/_layout.tsx`
  - Verify: Jest renders a throwing child, asserts `crashed` state screen; asserts reset on route change

- [ ] **S6 (P2, human: ~30min / CC: ~5min)** — `app/index.tsx` — free `developing…` for loading
  - Surfaced by: Pass 2 / D4 — empty and loading currently say the same thing
  - Files: `app/index.tsx`, `components/shell/copy.ts`, `__tests__/front-door.test.tsx`
  - Verify: existing front-door test updated; assert empty renders `nothing here yet`, never `developing…`

- [ ] **S7 (P2, human: ~2h / CC: ~15min)** — `components/shell/OfflineBanner.tsx` — connection banner
  - Surfaced by: Pass 2 / D8 — losing signal mid-scroll currently blanks loaded content
  - Files: `components/shell/OfflineBanner.tsx`, `app/_layout.tsx`, `package.json`
  - Verify: Jest mocks netinfo offline → banner renders, content persists; asserts 2s flap debounce

- [ ] **S8 (P2, human: ~1h / CC: ~10min)** — `components/shell/InlineError.tsx` — failures stay put
  - Surfaced by: Pass 2 — a failed save is currently silent; toasts explicitly rejected
  - Files: `components/shell/InlineError.tsx`
  - Verify: Jest asserts retry fires the callback; asserts no auto-dismiss timer exists

- [ ] **S9 (P2, human: ~1.5h / CC: ~10min)** — `hooks/useReducedMotion.ts` — one motion gate
  - Surfaced by: Pass 6 — the save stamp overshoot, haptic and 320ms transition ignore reduced-motion
  - Files: `hooks/useReducedMotion.ts`
  - Verify: Jest mocks `AccessibilityInfo` both ways; asserts durations collapse to 0 and haptic is suppressed

- [ ] **S10 (P2, human: ~1h / CC: ~10min)** — `app/_layout.tsx` — mount the shell, split web/native
  - Surfaced by: Pass 6 — one codebase, two shells, nothing encodes the split
  - Files: `app/_layout.tsx`
  - Verify: `Platform.OS` branch tested both ways; asserts no tab bar on web

- [ ] **S11 (P3, human: ~1h / CC: ~10min)** — web focus styles + contrast regression test
  - Surfaced by: Pass 6 — no focus styles anywhere; contrast measured but unguarded
  - Files: `theme/tokens.ts`, `__tests__/contrast.test.ts`
  - Verify: test asserts `inkMuted`/`error` on `ground` stay ≥4.5:1; keyboard-tab through the front door shows visible focus

**Sequencing:** S1–S5 are P1 and block T12. S3 and S4 have no dependencies and can land
first. S6 depends on S1's `copy.ts`. S10 depends on S5 and S7 existing.
