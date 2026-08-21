/**
 * Display formatting for stamped facts (DESIGN.md → Voice: rarity is stated as fact, never
 * praise; mono is for facts only). Pure, so it's trivially unit-tested.
 */

/** "you're the 4th" → `4TH`. Thousands-grouped, uppercase, correct English ordinal suffix. */
export function ordinalize(n: number): string {
  const rem100 = n % 100;
  const rem10 = n % 10;
  const suffix =
    rem100 >= 11 && rem100 <= 13 ? 'th' : rem10 === 1 ? 'st' : rem10 === 2 ? 'nd' : rem10 === 3 ? 'rd' : 'th';
  return `${n.toLocaleString('en-GB')}${suffix}`.toUpperCase();
}

/** The feed tile's rarity mark: `4TH EVER`. */
export function formatOrdinal(n: number): string {
  return `${ordinalize(n)} EVER`;
}

/** Stamp-block effort/nerve tier → word. Unset axis (redo-minted template) reads as em-dash. */
export function tierLabel(tier: number | null): string {
  return tier == null ? '—' : tier <= 1 ? 'low' : tier >= 3 ? 'high' : 'mid';
}

/** Stamp-block cost. 0 → `free`; 300 → `£3`; 420 → `£4.20`; unset → em-dash. */
export function costLabel(pence: number | null): string {
  if (pence == null) return '—';
  if (pence === 0) return 'free';
  const pounds = pence / 100;
  return Number.isInteger(pounds) ? `£${pounds}` : `£${pounds.toFixed(2)}`;
}

/**
 * Save-stamp tilt (DESIGN.md → Motion): "lands crooked and stays crooked, at a seeded angle
 * between −6° and +6° unique to each quest, so a full save list looks like a real stack of
 * stamped tickets, no two aligned." Deterministic from the quest id — same quest, same tilt.
 */
export function seededAngle(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1201) / 100 - 6; // 0..1200 → 0.00..12.00 → −6.00..+6.00
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** The stamp reads `SAVED · 12 AUG` — a stamped date, mono, uppercase. */
export function formatStampDate(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Reception as reportage (DESIGN.md → Quest detail), not a widget. Graceful when silent. */
export function receptionSentence(awesome: number, couldBeCooler: number): string {
  if (awesome === 0 && couldBeCooler === 0) return 'no ratings yet.';
  const a = `${awesome.toLocaleString('en-GB')} said awesome`;
  const c = `${couldBeCooler.toLocaleString('en-GB')} said could be cooler`;
  return `${a}. ${c}.`;
}
