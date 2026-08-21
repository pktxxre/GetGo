// Masonry → QuestTile pulls in expo-router for navigation; stub it (this suite tests pure
// mapping/layout, not routing).
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

import { toFeedItem } from '../lib/feed';
import { aspectRatio, photoUri, DEFAULT_TILE_ASPECT } from '../lib/photos';
import { assignColumns, columnCountForWidth } from '../components/feed/Masonry';
import { formatOrdinal } from '../lib/format';
import type { FeedItem } from '../lib/feed';

// A raw PostgREST feed row (to-one embeds are objects, to-many are arrays).
const row = (over: any = {}) => ({
  id: 'p1',
  caption: 'a japanese garden the herons do not care about',
  completion_ordinal: 4,
  created_at: '2026-08-19T00:00:00Z',
  author: { handle: 'theo' },
  template: { neighbourhood: 'Holland Park' },
  photos: [
    { storage_path: 'https://x/2.jpg', idx: 1, width: 600, height: 900 },
    { storage_path: 'https://x/1.jpg', idx: 0, width: 600, height: 800 },
  ],
  ...over,
});

describe('toFeedItem', () => {
  it('maps the wire row to a view item', () => {
    const item = toFeedItem(row() as any);
    expect(item).toMatchObject({ id: 'p1', ordinal: 4, neighbourhood: 'Holland Park', handle: 'theo' });
    expect(item.caption).toMatch(/herons/);
  });

  it('picks the primary photo (lowest idx) and its aspect ratio', () => {
    const item = toFeedItem(row() as any);
    expect(item.photo?.uri).toBe('https://x/1.jpg'); // idx 0, not idx 1
    expect(item.photo?.aspectRatio).toBeCloseTo(600 / 800);
  });

  it('survives a template-less, photo-less, author-less post', () => {
    const item = toFeedItem(row({ template: null, author: null, photos: [], completion_ordinal: null }) as any);
    expect(item).toMatchObject({ ordinal: null, neighbourhood: null, handle: null, photo: null });
  });
});

describe('photos', () => {
  it('passes an http(s) storage_path through untouched', () => {
    expect(photoUri('https://picsum.photos/seed/x/600/800')).toBe('https://picsum.photos/seed/x/600/800');
  });

  it('falls back to the default aspect when dimensions are unknown', () => {
    expect(aspectRatio(null, null)).toBe(DEFAULT_TILE_ASPECT);
    expect(aspectRatio(0, 800)).toBe(DEFAULT_TILE_ASPECT);
    expect(aspectRatio(600, 800)).toBeCloseTo(0.75);
  });
});

describe('masonry layout', () => {
  it('2 columns on mobile, 3 at tablet, 4 at desktop', () => {
    expect(columnCountForWidth(390)).toBe(2);
    expect(columnCountForWidth(768)).toBe(3);
    expect(columnCountForWidth(1200)).toBe(4);
  });

  it('places every item exactly once across the columns', () => {
    const items = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, photo: { aspectRatio: 0.8 } }) as FeedItem);
    const cols = assignColumns(items, 2);
    const ids = cols.flat().map((i) => i.id);
    expect(ids.sort()).toEqual(items.map((i) => i.id).sort());
    expect(cols).toHaveLength(2);
  });

  it('sends a very tall tile to a fresh column to keep balance', () => {
    const items = [
      { id: 'tall', photo: { aspectRatio: 0.3 } }, // very tall → column 0 heavy
      { id: 'a', photo: { aspectRatio: 1 } },
      { id: 'b', photo: { aspectRatio: 1 } },
    ] as FeedItem[];
    const cols = assignColumns(items, 2);
    expect(cols[0].map((i) => i.id)).toEqual(['tall']); // the two short ones went to column 1
    expect(cols[1].map((i) => i.id)).toEqual(['a', 'b']);
  });
});

describe('formatOrdinal', () => {
  it('formats English ordinals, uppercase, thousands-grouped', () => {
    expect(formatOrdinal(4)).toBe('4TH EVER');
    expect(formatOrdinal(1)).toBe('1ST EVER');
    expect(formatOrdinal(2)).toBe('2ND EVER');
    expect(formatOrdinal(3)).toBe('3RD EVER');
    expect(formatOrdinal(11)).toBe('11TH EVER'); // the teens exception
    expect(formatOrdinal(1204)).toBe('1,204TH EVER');
    expect(formatOrdinal(1502)).toBe('1,502ND EVER');
  });
});
