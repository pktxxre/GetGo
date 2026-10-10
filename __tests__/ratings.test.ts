// The client rating layer expresses intent; the invariants (no self-rating, no double-rate,
// visibility) are pgTAP's job on the 005 policies. Here we lock the query shape: an upsert on the
// unique key (so a switch doesn't error), a keyed delete for a retract, and the my-rating read.
const chain: any = {};
const mockFrom = jest.fn((..._a: any[]) => chain);
jest.mock('../lib/supabase', () => ({ supabase: { from: (...a: any[]) => mockFrom(...a) } }));

import { castRating, fetchMyRating, retractRating } from '../lib/ratings';

beforeEach(() => {
  mockFrom.mockClear();
  chain.upsert = jest.fn().mockResolvedValue({ error: null });
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.maybeSingle = jest.fn().mockResolvedValue({ data: { value: 'awesome' }, error: null });
  chain.delete = jest.fn(() => chain);
});

describe('castRating', () => {
  it('upserts on the (post_id, rater_id) unique key so switching your vote never errors', async () => {
    await castRating('p1', 'u1', 'could_be_cooler');
    expect(mockFrom).toHaveBeenCalledWith('ratings');
    expect(chain.upsert).toHaveBeenCalledWith(
      { post_id: 'p1', rater_id: 'u1', value: 'could_be_cooler' },
      { onConflict: 'post_id,rater_id' },
    );
  });

  it('throws when the write is rejected (e.g. RLS blocked a self-rating)', async () => {
    chain.upsert.mockResolvedValue({ error: { message: 'blocked' } });
    await expect(castRating('p1', 'u1', 'awesome')).rejects.toBeTruthy();
  });
});

describe('retractRating', () => {
  it('deletes your row, scoped to this post + rater', async () => {
    await retractRating('p1', 'u1');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('post_id', 'p1');
    expect(chain.eq).toHaveBeenCalledWith('rater_id', 'u1');
  });
});

describe('fetchMyRating', () => {
  it('returns your current value', async () => {
    expect(await fetchMyRating('p1', 'u1')).toBe('awesome');
  });

  it('returns null when you haven’t rated', async () => {
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await fetchMyRating('p1', 'u1')).toBeNull();
  });
});
