const mockRpc = jest.fn();
const mockSignOut = jest.fn().mockResolvedValue({ error: null });
jest.mock('../lib/supabase', () => ({
  supabase: { rpc: (...a: any[]) => mockRpc(...a), auth: { signOut: (...a: any[]) => mockSignOut(...a) } },
}));

import { deleteAccount } from '../lib/account';

beforeEach(() => {
  mockRpc.mockReset().mockResolvedValue({ error: null });
  mockSignOut.mockClear();
});

describe('deleteAccount', () => {
  it('fires the caller-scoped RPC then drops the local session', async () => {
    await deleteAccount();
    expect(mockRpc).toHaveBeenCalledWith('delete_account');
    expect(mockRpc.mock.calls[0].length).toBe(1); // no target arg — only ever your own account
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('throws and does NOT sign out when the teardown fails', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'nope' } });
    await expect(deleteAccount()).rejects.toBeTruthy();
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
