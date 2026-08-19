/**
 * Design tokens — the single source of truth for GetGo's visual system.
 * Values come straight from DESIGN.md. Read that file before changing anything here;
 * the rationale for each choice lives there. These are decisions, not defaults.
 */

// Color — warm light, single ground. No dark mode at launch.
export const color = {
  ground: '#F3EEE4', // bone. the page.
  surface: '#FFFDF8', // card stock. stamp blocks and sheets.
  ink: '#17150F', // warm near-black. all primary type, rules, action bar.
  inkMuted: '#6B6558', // captions, metadata, inactive tabs.
  rule: '#DCD4C4', // 1px hairlines and borders.
  brand: '#2C5545', // forest green. IDENTITY ONLY.
  mark: '#D6472A', // stamp red. RARITY ONLY — never a button/link/border/fill/error.
  saved: '#2A3CC7', // biro blue. saved state (native app).
  error: '#8A3B2E', // brick. never pure red — red is spoken for.
} as const;

// Spacing — base unit 4px.
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 32,
  xxxl: 48,
  huge: 64,
} as const;

// Layout
export const layout = {
  pageMargin: 20,
  masonryMargin: 14, // the gutter carries the rhythm in the grid
  gutter: 11,
  maxContentWidth: 1180,
  radiusPhoto: 2,
  radiusStamp: 2,
  radiusButton: 4,
} as const;

/**
 * Typeface families. Fonts are not yet self-hosted (DESIGN.md: subset woff2, ~95KB).
 * Until then these fall back to system stacks so the app runs; wiring real fonts is
 * its own task. The three roles each have exactly one job:
 *   display — Fraunces      (wordmark, quest titles, stamp values)
 *   text    — Schibsted     (body, captions)
 *   mono    — Martian Mono  (STAMPED FACTS ONLY — counts, postcodes, cost, tabs)
 */
export const font = {
  display: 'Fraunces',
  text: 'Schibsted Grotesk',
  mono: 'Martian Mono',
} as const;

// Type scale (mobile, 390pt). role -> style fragment.
export const type = {
  heroTitle: { fontFamily: font.display, fontSize: 40, lineHeight: 40, fontWeight: '400' as const, letterSpacing: -0.8 },
  detailTitle: { fontFamily: font.display, fontSize: 30, lineHeight: 32, fontWeight: '400' as const, letterSpacing: -0.45 },
  listTitle: { fontFamily: font.display, fontSize: 20, lineHeight: 23, fontWeight: '500' as const, letterSpacing: -0.2 },
  stampValue: { fontFamily: font.display, fontSize: 22, lineHeight: 22, fontWeight: '500' as const, letterSpacing: -0.22 },
  wordmark: { fontFamily: font.display, fontSize: 22, lineHeight: 26, fontWeight: '400' as const, letterSpacing: -0.22 },
  body: { fontFamily: font.text, fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  tileCaption: { fontFamily: font.text, fontSize: 15, lineHeight: 20, fontWeight: '400' as const },
  secondary: { fontFamily: font.text, fontSize: 14, lineHeight: 20, fontWeight: '400' as const, letterSpacing: 0.07 },
  buttonLabel: { fontFamily: font.text, fontSize: 15, lineHeight: 15, fontWeight: '600' as const, letterSpacing: 0.15 },
  dataLine: { fontFamily: font.mono, fontSize: 12, lineHeight: 12, fontWeight: '500' as const, letterSpacing: 0.96 },
  microLabel: { fontFamily: font.mono, fontSize: 10, lineHeight: 12, fontWeight: '500' as const, letterSpacing: 1.2 },
} as const;
