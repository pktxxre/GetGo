// The client report layer expresses intent; the invariants (own-row, can't-report-own, visibility,
// one-per-reporter) are pgTAP's job on the 024 policies. Here we lock the insert shape + note
// normalisation.
const chain: any = {};
const mockFrom = jest.fn((..._a: any[]) => chain);
jest.mock('../lib/supabase', () => ({ supabase: { from: (...a: any[]) => mockFrom(...a) } }));

import { reportPost, REPORT_REASONS } from '../lib/reports';

beforeEach(() => {
  mockFrom.mockClear();
  chain.insert = jest.fn().mockResolvedValue({ error: null });
});

describe('REPORT_REASONS', () => {
  it('covers the standard objectionable-content categories', () => {
    expect(REPORT_REASONS.map((r) => r.value)).toEqual(['spam', 'nudity', 'violence', 'hate', 'other']);
  });
});

describe('reportPost', () => {
  it('inserts a report against the post as the reporter', async () => {
    await reportPost('p1', 'u1', 'spam', 'buying followers');
    expect(mockFrom).toHaveBeenCalledWith('reports');
    expect(chain.insert).toHaveBeenCalledWith({
      post_id: 'p1',
      reporter_id: 'u1',
      reason: 'spam',
      note: 'buying followers',
    });
  });

  it('drops an empty/whitespace note to null so it never trips the length check', async () => {
    await reportPost('p1', 'u1', 'other', '   ');
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ note: null }));
  });

  it('omitted note becomes null', async () => {
    await reportPost('p1', 'u1', 'hate');
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ note: null }));
  });

  it('throws when the write is rejected (e.g. RLS blocked reporting your own post)', async () => {
    chain.insert.mockResolvedValue({ error: { message: 'blocked' } });
    await expect(reportPost('p1', 'u1', 'spam')).rejects.toBeTruthy();
  });
});
