/**
 * DEV PREVIEW ONLY — not the seed, not the schema.
 *
 * This is throwaway mock data so the feed UI can be seen before the real feed query lands
 * (T12) and before curated content exists. The real curated London quests will live in
 * `content/quests.json` and go into Postgres via an idempotent upsert (eng plan D15) — do
 * not wire this file into the app's data layer.
 *
 * Photos are Lorem Picsum placeholders (stable by seed), NOT real London and NOT graded.
 * The system-wide image grade (+3 warmth, −6 saturation, 4% grain — DESIGN.md) is a later
 * task and isn't applied here.
 */

export type SampleQuest = {
  id: string;
  /** The caption carries the surprise — full ink, up to two lines (DESIGN.md). */
  caption: string;
  photo: string;
  /** width / height, so the masonry reserves height and nothing reflows on paint. */
  aspectRatio: number;
  /** completion ordinal — "you're the Nth ever". Lower = rarer; shown in red. */
  ordinal: number;
  postcode: string;
  /** mono cost fact: 'FREE' or '£<n>'. */
  cost: string;
  /** how many have done it — drives the `popular` sort only. */
  doneCount: number;
};

export const SAMPLE_QUESTS: SampleQuest[] = [
  {
    id: 'q1',
    caption: 'a man who has been selling the same three records since 1974',
    photo: 'https://picsum.photos/seed/getgo-records/800/1040',
    aspectRatio: 800 / 1040,
    ordinal: 4,
    postcode: 'E8',
    cost: 'FREE',
    doneCount: 4,
  },
  {
    id: 'q2',
    caption: 'the last cabmen’s shelter still serving tea to black cabs',
    photo: 'https://picsum.photos/seed/getgo-shelter/800/600',
    aspectRatio: 800 / 600,
    ordinal: 212,
    postcode: 'SW1',
    cost: '£2',
    doneCount: 212,
  },
  {
    id: 'q3',
    caption: 'a door in a wall in bermondsey that opens onto a fake tube platform',
    photo: 'https://picsum.photos/seed/getgo-door/800/1000',
    aspectRatio: 800 / 1000,
    ordinal: 1,
    postcode: 'SE1',
    cost: 'FREE',
    doneCount: 1,
  },
  {
    id: 'q4',
    caption: 'eels, mash and liquor at a shop that hasn’t changed its tiles in a century',
    photo: 'https://picsum.photos/seed/getgo-eels/800/900',
    aspectRatio: 800 / 900,
    ordinal: 1408,
    postcode: 'E2',
    cost: '£6',
    doneCount: 1408,
  },
  {
    id: 'q5',
    caption: 'the tiny museum of a single lightbulb that has been on since 1901',
    photo: 'https://picsum.photos/seed/getgo-bulb/800/560',
    aspectRatio: 800 / 560,
    ordinal: 37,
    postcode: 'N1',
    cost: 'FREE',
    doneCount: 37,
  },
  {
    id: 'q6',
    caption: 'a rooftop with a beehive and the best view of the shard nobody photographs',
    photo: 'https://picsum.photos/seed/getgo-roof/800/1100',
    aspectRatio: 800 / 1100,
    ordinal: 89,
    postcode: 'SE10',
    cost: '£4',
    doneCount: 89,
  },
  {
    id: 'q7',
    caption: 'the phone box turned into the world’s smallest 24-hour library',
    photo: 'https://picsum.photos/seed/getgo-phonebox/800/620',
    aspectRatio: 800 / 620,
    ordinal: 3,
    postcode: 'SE24',
    cost: 'FREE',
    doneCount: 3,
  },
  {
    id: 'q8',
    caption: 'a hidden ice well under a georgian house that once cooled the whole street',
    photo: 'https://picsum.photos/seed/getgo-icewell/800/980',
    aspectRatio: 800 / 980,
    ordinal: 526,
    postcode: 'WC1',
    cost: '£9',
    doneCount: 526,
  },
];
