import { supabase } from './supabase';

/**
 * Blocking a user (App Store Guideline 1.2 — the block half; reporting is the other, lib/reports).
 * The DB (025) enforces the rules via RLS: you block as yourself, never yourself, once per pair,
 * and a blocked author's posts drop out of your feed/profile/detail through the posts read policy.
 * A block is a viewer-side hide, not a takedown — the content stays public to everyone else — and
 * it's reversible (unblock). The client only expresses intent.
 */

/** Are you currently blocking this user? Drives the block/unblock control on their profile. */
export async function fetchIsBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('blocks')
    .select('blocked_id')
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)
    .maybeSingle();
  if (error) throw error;
  return data != null;
}

/**
 * Block a user. Idempotent: an upsert that ignores the duplicate, so blocking someone you've
 * already blocked is a no-op rather than a unique-violation error (025 PK is (blocker, blocked)).
 */
export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase
    .from('blocks')
    .upsert({ blocker_id: blockerId, blocked_id: blockedId }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true });
  if (error) throw error;
}

/** Unblock a user — their posts return to your feed (025 `blocks_own_delete`). */
export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);
  if (error) throw error;
}
