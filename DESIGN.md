# Design System — GetGo

> Read this before making any visual or UI decision. Values here are decisions, not
> defaults. The rationale column matters as much as the value — if you're about to
> deviate, the reason it was chosen is written down so you can tell whether your case
> is actually different.

## Product Context

- **What this is:** a social quest diary for sidequests. Browse real sidequests other
  people actually went on in London, save the ones you want to do, post the ones you did.
- **Who it's for:** 18-25, recent London transplants, solo or duo, actively hunting for
  things to do. On the first surface they arrive **cold from a TikTok link** with no
  account, no XP, no rank, and nobody to compete with.
- **Space:** discovery / save-list social. Peers: Beli, Letterboxd, Polarsteps, Atlas
  Obscura. Direct competitor: thesidequest.world.
- **Project type:** mobile web first (the validation surface), Expo native second. Same
  visual system, different first client.

### The memorable thing

> **"i didn't know london had this in it."**

Every decision in this file serves that one sentence. It encodes quality as *surprise*.
The alternative framing — "real people actually did this" — pushes the design toward
receipts and evidence (timestamps, counts, faces, rawness) and away from the thing that
makes someone save a quest. Doneness is the proof; quality is the promise. **Design for
the promise. Let the rarity count carry the proof.**

If a proposed change doesn't serve that sentence, it needs a different justification.

## Aesthetic Direction

- **Direction:** Editorial — specifically *found evidence*. An archive of proof that
  London is stranger than you thought.
- **Decoration level:** minimal, tending intentional. Warm paper ground, hairline rules,
  photographic grain. No illustration, no pattern, no texture beyond grain.
- **Material metaphor:** cheap printed card. Cloakroom stubs, museum vitrine labels,
  rubber date stamps, the back of a ticket. A post is a stub someone kept.
- **Mood:** quiet, specific, slightly jealous curiosity. The target first reaction is
  *"wait — where is that?"*, aimed at the photograph and the city, never at the app.
- **Reference points:** Atlas Obscura (calm), Letterboxd (grid density), Beli (invisible
  chrome), Barbican signage, London Transport Museum ephemera.
- **Deliberately nothing of:** thesidequest.world.

### Why quiet, when the category is loud

thesidequest.world is live on both stores, claims 50,000+ players, and runs Clash Display
+ DM Sans on `#0A0A0A` with `#E8FF47` acid yellow, nav reading "XP & streaks" / "The
Lobby". It owns the loud gamified lane and you cannot out-loud it at 1/50th the user
count. More importantly: gamified chrome on a cold web landing is **a bill for a game the
visitor hasn't joined** — a visible XP counter tells a stranger "you are at zero and
everyone here is ahead of you." The open lane is quiet.

This direction was reached independently by two design voices that did not see each
other's reasoning. They converged on: warm light ground, Fraunces, rarity-as-typeset-fact,
zero gamification chrome, no bottom tab bar on web.

## Typography

Three faces, one job each. All free, variable, self-hostable; subset to ~95KB woff2 total,
which matters on cold mobile web.

- **Display — Fraunces** (Google Fonts). Variable old-style serif. Set `WONK: 1`,
  `SOFT: 0`, `opsz: 72-144` at display sizes. The wonk axis gives odd ball terminals and a
  crooked *g* — it reads printed and slightly inky rather than "editorial serif template."
  Wordmark, quest titles, stamp-block values.
- **Text — Schibsted Grotesk** (Google Fonts). A grotesque with quirks that survive at
  14px. Warm where Inter is clinical. **Deliberately not DM Sans** — the competitor uses it.
- **Stamped data — Martian Mono** (Google Fonts), semi-condensed. Counts, rarity ordinals,
  postcodes, cost, durations, dates, filter and tab labels. **Never prose.** Confining mono
  to facts is what stops it reading as gamified telemetry.
- **Code:** JetBrains Mono (dev surfaces only, never in product UI).
- **Loading:** self-host subset woff2. Google Fonts CDN acceptable in dev only — a cold
  TikTok visitor on 4G pays for every extra connection.

### Scale (mobile, 390pt viewport)

| Role | Face | Size / Line | Weight | Tracking |
|---|---|---|---|---|
| Hero quest title | Fraunces | 40 / 40 | 400 | -0.02em |
| Detail title | Fraunces | 30 / 32 | 400 | -0.015em |
| List quest title | Fraunces | 20 / 23 | 500 | -0.01em |
| Stamp value | Fraunces | 22 / 22 | 500 | -0.01em |
| Wordmark | Fraunces | 22 | 400 | -0.01em |
| Body / caption | Schibsted Grotesk | 16 / 24 | 400 | 0 |
| Grid tile caption | Schibsted Grotesk | 15 / 20 | 400 | 0 |
| Secondary | Schibsted Grotesk | 14 / 20 | 400 | +0.005em |
| Button label | Schibsted Grotesk | 15 / 15 | 600 | +0.01em |
| Data line (UPPERCASE) | Martian Mono | 12 / 12 | 500 | +0.08em |
| Micro label (UPPERCASE) | Martian Mono | 10 / 12 | 500 | +0.12em |

Numerals use `tabular-nums` everywhere a count appears.

## Color

**Approach:** restrained. Warm light, single ground. **No dark mode at launch** — the
first client is a cold web landing; one ground, done properly, beats two done adequately.

| Token | Hex | Role |
|---|---|---|
| `--ground` | `#F3EEE4` | bone. The page. |
| `--surface` | `#FFFDF8` | card stock. Stamp blocks and sheets. |
| `--ink` | `#17150F` | warm near-black. All primary type, rules, action bar. |
| `--ink-muted` | `#6B6558` | captions, metadata, inactive tabs. |
| `--rule` | `#DCD4C4` | 1px hairlines and borders. |
| `--brand` | `#2C5545` | forest green. **Identity only.** |
| `--mark` | `#D6472A` | stamp red. **Rarity only.** |
| `--saved` | `#2A3CC7` | biro blue. Saved state in the native app. |
| `--error` | `#8A3B2E` | brick. Never pure red — red is spoken for. |

No `warning` or `info` colors. The product has no alerts worth a color.

### The two-accent rule (load-bearing — do not blur this)

- **Green `#2C5545` is the brand.** Wordmark, active tab underline, saved state.
- **Red `#D6472A` is the mark.** The rarity ordinal (`4TH EVER`) and the `saved` stamp.
  **Nothing else.** Red is never a button, a link, a border, a fill, or an error.
- They are **never adjacent**. Green says who you are; red says the one fact Pinterest
  structurally cannot show.

Two accents is a discipline problem, which is why the rule is written here. If you find
yourself reaching for red for a call to action, the answer is ink.

### Surface is lighter than ground, not darker

That single decision removes every drop shadow in the product — a lifted card is lit
paper, not a floating pane. Which removes the need for corner radius. Which removes the
need for icons to fight the photograph. **Each deletion makes the next one free.**

### Image grade (system-wide, not user-adjustable)

Every photo, on every surface: **+3 warmth, −6 saturation, 4% monochrome grain.**

This is load-bearing, not a filter. 100% of supply is amateur phone photos. The grade is
what makes a blown-out midday shot and a grainy 11pm shot sit on the same page as one
archive, instead of as one person's good phone and another person's bad one. It is the
only quality control available on user-generated imagery. Do not expose it as an option.

## Layout

**Approach:** grid-disciplined, photo-dominant. 2-column masonry.

### Quest list (the front door)

Three things, top to bottom:

1. **One line of chrome.** `getgo` wordmark in green at left; `LONDON · 341 SIDEQUESTS`
   in mono micro-label at right. Scrolls away and does not come back.
2. **Text tabs, not pills.** `what's new / popular / rarest / nearby`. Active gets a 2px
   green underline. Reads like the index at the back of a book, not a toolbar.
3. **2-column masonry.** Photos at native aspect ratio, gutter 11, page margin 14.
   Each tile: photo → caption → mono fact line.

Each tile's fact line is `<ORDINAL> · <POSTCODE> · <COST>`, with only the ordinal in red.

**The caption is not metadata — it carries the surprise.** "a man who has been going
since 1974" is the sell; the photograph alone is a room. Caption is set in full ink at
15/20, never muted, never truncated below two lines.

**Why the grid, and not one full-bleed quest per screen:** the caption does the selling,
and a grid lets you scan six caption/photo pairs at once. It is also the only layout in
which **rarity is comparable** — six tiles on screen, one reads `4TH EVER` and the rest
read `1,204TH`, and the eye finds it. One quest per screen destroys that comparison.

### Quest detail

- Photo full-bleed, 4:5, running under the status bar. Nothing floats on the image —
  back is a mono `← BACK` on bone below it.
- Title, Fraunces 30/32, ragged right.
- **The stamp block.** A `--surface` rectangle, 1px `--rule` border, split 2×2 by internal
  hairlines — the back of a ticket. Each cell is a mono micro-label over a Fraunces value:
  `EFFORT / NERVE / COST / RARITY`. Only the rarity value is red.
  **This block replaces every badge, chip, XP counter, level and progress ring in the
  product.** It is the same artifact whether or not the viewer has an account, so no
  gamified chrome ever has to be bolted on later.
- Caption, then byline in muted ink.
- **Reception is a sentence, not a widget:** "31 people said awesome. 4 said could be
  cooler." No hearts, no thumbs, no bar chart. Counts read as reportage in a sentence and
  as scoring in chips.
- Location: desaturated bone-tinted map crop, 3:1 strip, one red dot, zero map chrome.
- Sticky bottom bar, ink, 56px, **one verb: `save it`.** A stranger gets exactly one verb.

### Grid & radius

- Columns: 2 at all mobile widths. 3 at ≥720px, 4 at ≥1024px.
- Max content width: 1180px.
- Radius: **photos 0-2px**, stamp block 2px, buttons 4px. **Nothing is a pill.** Corner
  radius on a photograph turns a print into a sticker.

### Deleted on purpose

Bottom tab bar **on web** (four of five tabs are locked doors to a cold visitor; it stays
in the native app) · search field on the front door (a visitor who doesn't know what's in
there has nothing to search for, and it costs the top of the first two photographs) ·
sign-in prompt · avatars in the feed · timestamps as chips · share and repost counts ·
rating pills · XP counter · streak · level · progress ring · drop shadows · pill-shaped
filter chips · every icon in the first viewport.

**Icon count on the quest list: zero.**

## Spacing

- **Base unit:** 4px. **Density:** comfortable; spacious around photographs, tight inside
  the stamp block.
- **Scale:** 4 / 8 / 12 / 16 / 20 / 32 / 48 / 64.
- Page margin 20 (14 in the masonry, where the gutter carries the rhythm). Gutter 11-12.

## Motion

**Approach:** minimal-functional. The governing rule: **this is paper.** Nothing bounces,
nothing shimmers. Springs are banned everywhere except one place.

- **Scroll:** photos parallax at 94% of scroll speed inside their own mask. Scroll-linked,
  zero duration, free.
- **List → detail:** the tapped photograph is a shared element and expands to the detail
  header, 320ms `cubic-bezier(0.2, 0, 0, 1)`. Body text follows 60ms later, 8px rise,
  180ms. The photo never crossfades — it is the same object, moved.
- **Tabs / filters:** the underline slides 200ms. The grid itself **hard-cuts**. Crossfades
  read as lag; hard cuts read as instant.
- **Loading:** no spinners, no skeleton shimmer. A bone rectangle at the photo's aspect
  ratio with one line of muted mono: `developing…`.
- **Save — the entire delight budget, 140ms.** The button does not animate. A vermilion
  `SAVED · 12 AUG` stamp lands on the stamp block, rotated, scaling 1.06 → 1.00, opacity
  0 → 1, ease-out with a 20ms overshoot, plus one haptic tap. **It lands crooked and stays
  crooked**, at a seeded angle between −6° and +6° unique to each quest, so a full save
  list looks like a real stack of stamped tickets, no two aligned. That is the screenshot.
- **Budget:** page transitions ≤ 320ms, micro-interactions ≤ 180ms, nothing exceeds 400ms.
- **Must never move:** the masonry after paint. No reflow once tiles have laid out.

## Voice

Lowercase, playful, blunt-but-kind. "what's new", "could be cooler", "save it",
"developing…", "taking the scenic route!". Sentence case never; title case never.
Rarity is stated as fact, never as praise: `4TH EVER`, not "super rare!".

## Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-08-13 | Initial design system created | /design-consultation, after competitive research (Beli, Letterboxd, Polarsteps, Atlas Obscura, thesidequest.world) and an independent outside design voice |
| 2026-08-13 | Warm bone ground, not dark | Competitor owns `#0A0A0A` + acid yellow at 50k users; bone also color-corrects amateur photos for free and signals "document" rather than "app" |
| 2026-08-13 | Fraunces + Schibsted Grotesk + Martian Mono | Two independent voices picked Fraunces cold; Schibsted avoids the competitor's DM Sans; mono scoped to facts only so it doesn't read as telemetry |
| 2026-08-13 | Kept the 2-column masonry (reversed an earlier proposal to go one-quest-per-screen) | The caption carries the surprise, not the photo alone, and rarity is only comparable at grid density. Also the product's own framing is "Pinterest for sidequests" |
| 2026-08-13 | Green for brand, red for the mark | Green alone stops functioning as a "look here" mark at tile scale; red alone discards the mockups' identity. The two colors were competing for what turned out to be two slots |
| 2026-08-13 | No dark mode at launch | First client is a cold web landing; one ground done properly |
| 2026-08-13 | Stamp block replaces all badges/XP chrome | Same artifact logged-out and logged-in, so gamification never has to be bolted on later; inverts "you are at zero" into "almost nobody has done this" |

## Open

- The image grade needs validating against real London phone photos — it was approved
  against placeholder photography.
- The `rarest` tab is new here and isn't in the eng plan's v1 scope. Confirm before building.
