import { supabase } from './supabase';

/**
 * Permanently delete the signed-in user's account (T9). The DB does the whole
 * invariant-preserving teardown (023: tombstone + scrub the profile, soft-delete the user's
 * posts, ban the auth login) so nothing rewrites another user's history. The client's only jobs
 * are to fire the RPC and then drop the local session — the account can no longer sign in, so a
 * lingering session would just be a dead end.
 *
 * Deliberately caller-scoped: the RPC takes no target, it only ever tears down `auth.uid()`.
 */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_account');
  if (error) throw error;
  await supabase.auth.signOut();
}
