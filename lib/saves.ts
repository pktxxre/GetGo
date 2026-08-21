import { supabase } from './supabase';

/**
 * Saving a quest = a row in `saves` targeting a quest TEMPLATE (not a post). RLS gates it to
 * the signed-in user (`saves_own_insert`), so a save needs an identity — which is exactly the
 * point the web funnel captures one.
 *
 * All current posts carry a template, so this is a direct insert. Saving a *template-less*
 * post (a first-of-its-kind) would first need the SECURITY DEFINER mint-template RPC noted in
 * 005_social.sql — not built, and not reachable from current data; the UI disables save when
 * a post has no template rather than pretend.
 */

/**
 * Mint (or fetch) the quest template for a first-of-its-kind post, so it can be saved (015).
 * Idempotent and concurrency-safe server-side: returns the existing template_id if the post
 * already has one, otherwise mints `origin='user'` and backfills the origin post as the 1st
 * ever. Only called when a post's `templateId` is null; a curated/templated post saves directly.
 */
export async function mintTemplateFromPost(postId: string): Promise<string> {
  const { data, error } = await supabase.rpc('mint_template_from_post', { p_post_id: postId });
  if (error) throw error;
  return data as string;
}

/** Idempotent: saving twice is a no-op (unique user_id+template_id). Returns nothing on success. */
export async function saveQuest(userId: string, templateId: string): Promise<void> {
  const { error } = await supabase
    .from('saves')
    .upsert({ user_id: userId, template_id: templateId }, { onConflict: 'user_id,template_id', ignoreDuplicates: true });
  if (error) throw error;
}

/** Whether this user has already saved this template — drives the stamp being present on load. */
export async function isSaved(userId: string, templateId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('saves')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('template_id', templateId);
  if (error) throw error;
  return (count ?? 0) > 0;
}
