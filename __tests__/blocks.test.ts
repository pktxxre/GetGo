// The client block layer expresses intent; the invariants (own-row, no-self-block, one-per-pair,
// feed-hiding, anon-denied) are pgTAP's job on the 025 policies. Here we lock the query shapes:
// the idempotent upsert, the keyed delete, and the boolean read.
const chain: any = {};
const mockFrom = jest.fn((..._a: any[]) => chain);
jest.mock('../lib/supabase', () => ({ supabase: { from: (...a: any[]) => mockFrom(...a) } }));

import { blockUser, unblockUser, fetchIsBlocked } from '../lib/blocks';

beforeEach(() => {
  mockFrom.mockClear();
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.delete = jest.fn(() => chain);
  chain.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  chain.upsert = jest.fn().mockResolvedValue({ error: null });
  // delete().eq().eq() is awaited directly; make the chain thenable so it resolves.
  chain.then = (resolve: any) => resolve({ error: null });
});

describe('fetchIsBlocked', () => {
  it('is false when no block row exists', async () => {
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(fetchIsBlocked('me', 'them')).resolves.toBe(false);
    expect(mockFrom).toHaveBeenCalledWith('blocks');
    expect(chain.eq).toHaveBeenCalledWith('blocker_id', 'me');
    expect(chain.eq).toHaveBeenCalledWith('blocked_id', 'them');
  });

  it('is true when a block row exists', async () => {
    chain.maybeSingle.mockResolvedValue({ data: { blocked_id: 'them' }, error: null });
    await expect(fetchIsBlocked('me', 'them')).resolves.toBe(true);
  });
});

describe('blockUser', () => {
  it('upserts the (blocker, blocked) pair, ignoring a duplicate (idempotent)', async () => {
    await blockUser('me', 'them');
    expect(mockFrom).toHaveBeenCalledWith('blocks');
    expect(chain.upsert).toHaveBeenCalledWith(
      { blocker_id: 'me', blocked_id: 'them' },
      { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true },
    );
  });

  it('throws when the write is rejected (e.g. RLS blocked blocking as someone else)', async () => {
    chain.upsert.mockResolvedValue({ error: { message: 'blocked' } });
    await expect(blockUser('me', 'them')).rejects.toBeTruthy();
  });
});

describe('unblockUser', () => {
  it('deletes exactly the (blocker, blocked) row', async () => {
    await unblockUser('me', 'them');
    expect(mockFrom).toHaveBeenCalledWith('blocks');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('blocker_id', 'me');
    expect(chain.eq).toHaveBeenCalledWith('blocked_id', 'them');
  });
});
