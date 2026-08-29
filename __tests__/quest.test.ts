import { toQuestDetail } from '../lib/quest';
import { ordinalize, tierLabel, costLabel, receptionSentence, seededAngle, formatStampDate } from '../lib/format';

const row = (over: any = {}) => ({
  id: 'p1',
  user_id: 'u-theo',
  caption: 'the herons do not care about you',
  completion_ordinal: 212,
  neighbourhood: null,
  author: { handle: 'theo' },
  template: { title: 'find the herons', neighbourhood: 'Holland Park', effort: 1, nerve: 2, cost_pence: 0 },
  photos: [
    { storage_path: 'https://x/b.jpg', idx: 1, width: 600, height: 900 },
    { storage_path: 'https://x/a.jpg', idx: 0, width: 600, height: 800 },
  ],
  ratings: [{ value: 'awesome' }, { value: 'awesome' }, { value: 'could_be_cooler' }],
  ...over,
});

describe('toQuestDetail', () => {
  it('maps the row, ordering photos by idx and folding rating counts', () => {
    const q = toQuestDetail(row() as any);
    expect(q).toMatchObject({
      id: 'p1',
      title: 'find the herons',
      ordinal: 212,
      handle: 'theo',
      authorId: 'u-theo',
      neighbourhood: 'Holland Park',
      effort: 1,
      nerve: 2,
      costPence: 0,
      awesome: 2,
      couldBeCooler: 1,
    });
    expect(q.photos.map((p) => p.uri)).toEqual(['https://x/a.jpg', 'https://x/b.jpg']); // idx order
  });

  it('survives a template-less, rating-less post', () => {
    const q = toQuestDetail(row({ template: null, ratings: [], completion_ordinal: null }) as any);
    expect(q).toMatchObject({ title: null, effort: null, ordinal: null, awesome: 0, couldBeCooler: 0 });
  });

  it('falls back to the post neighbourhood before a template is minted (019)', () => {
    const q = toQuestDetail(row({ template: null, neighbourhood: 'Peckham', ratings: [] }) as any);
    expect(q.neighbourhood).toBe('Peckham');
  });
});

describe('stamp-block formatting', () => {
  it('maps effort/nerve tiers to words, em-dash when unset', () => {
    expect(tierLabel(1)).toBe('low');
    expect(tierLabel(2)).toBe('mid');
    expect(tierLabel(3)).toBe('high');
    expect(tierLabel(null)).toBe('—');
  });

  it('renders cost as free / £ / em-dash', () => {
    expect(costLabel(0)).toBe('free');
    expect(costLabel(300)).toBe('£3');
    expect(costLabel(420)).toBe('£4.20');
    expect(costLabel(180)).toBe('£1.80');
    expect(costLabel(null)).toBe('—');
  });

  it('rarity ordinal has no EVER suffix in the stamp cell', () => {
    expect(ordinalize(4)).toBe('4TH');
    expect(ordinalize(1204)).toBe('1,204TH');
  });
});

describe('receptionSentence', () => {
  it('reads as reportage, and stays graceful when silent', () => {
    expect(receptionSentence(31, 4)).toBe('31 said awesome. 4 said could be cooler.');
    expect(receptionSentence(1, 1)).toBe('1 said awesome. 1 said could be cooler.');
    expect(receptionSentence(0, 0)).toBe('no ratings yet.');
  });
});

describe('save stamp helpers', () => {
  it('seededAngle is deterministic and within ±6°', () => {
    const a = seededAngle('e0000000-0000-0000-0000-000000000001');
    expect(a).toBe(seededAngle('e0000000-0000-0000-0000-000000000001')); // stable per quest
    for (const id of ['a', 'quest-2', 'zzz', '', '4', 'e0000000-0000-0000-0000-00000000000a']) {
      const angle = seededAngle(id);
      expect(angle).toBeGreaterThanOrEqual(-6);
      expect(angle).toBeLessThanOrEqual(6);
    }
    // Different quests generally tilt differently — no single frozen angle.
    expect(seededAngle('one')).not.toBe(seededAngle('two'));
  });

  it('formats the stamp date as `12 AUG`', () => {
    expect(formatStampDate(new Date(2026, 7, 12, 12, 0))).toBe('12 AUG'); // local-time constructor
    expect(formatStampDate(new Date(2026, 0, 3, 12, 0))).toBe('3 JAN');
  });
});
