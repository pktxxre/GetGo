// The session-persistence contract. lib/supabase builds the client once at import; we capture
// the auth options it hands createClient and assert the persistence shape, so a regression
// (persistSession flipped back to false, or the storage adapter dropped) fails here — that's
// the difference between "stay signed in across a reload" and "logged out on every restart".
const captured: { opts?: any } = {};
jest.mock('@supabase/supabase-js', () => ({
  createClient: (_url: string, _key: string, opts: any) => {
    captured.opts = opts;
    return { auth: { startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() } };
  },
}));

import '../lib/supabase';

describe('supabase auth config', () => {
  it('persists the session across restarts with a storage adapter', () => {
    expect(captured.opts.auth.persistSession).toBe(true);
    expect(captured.opts.auth.storage).toBeTruthy();
    expect(captured.opts.auth.autoRefreshToken).toBe(true);
  });

  it('does not read the session from the URL (OTP codes, not magic-link redirects)', () => {
    expect(captured.opts.auth.detectSessionInUrl).toBe(false);
  });
});
